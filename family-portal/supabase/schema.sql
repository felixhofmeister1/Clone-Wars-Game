-- =============================================================================
-- Family Portal — Supabase database schema
--
-- Run this whole file once in Supabase Dashboard → SQL Editor → "New query".
-- It is idempotent: running it again upgrades functions/policies in place and
-- never drops data.
--
-- What it sets up
--   * Tables: profiles, calendar_events, messages, news_posts, kudos_feed,
--             shop_items, user_inventory, game_matches
--   * Row Level Security on every table (members only, owners edit their rows)
--   * Column-level grants so nobody can edit kudos balances directly
--   * RPC functions that are the ONLY way kudos move:
--       give_kudos, purchase_item, equip_item,
--       create_match, respond_match, cancel_match, submit_move, resign_match
--   * A trigger that creates a profile for every new auth user
--   * Realtime publication for all tables the app listens to
--   * Seed data for the shop
--
-- Optional hardening (run after this file, any time):
--   update app_private.settings set join_code = 'pick-a-family-secret';
-- Sign-ups must then enter that code. Leave it NULL for open sign-up.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Private settings (not reachable through the Data API)
-- -----------------------------------------------------------------------------
create schema if not exists app_private;
revoke all on schema app_private from public;

create table if not exists app_private.settings (
  id                 boolean primary key default true check (id),
  join_code          text,
  starting_balance   integer not null default 50  check (starting_balance >= 0),
  kudos_max_per_gift integer not null default 50  check (kudos_max_per_gift > 0),
  kudos_daily_limit  integer not null default 250 check (kudos_daily_limit > 0),
  max_stake          integer not null default 100 check (max_stake >= 0)
);
insert into app_private.settings (id) values (true) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table if not exists public.shop_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  cost        integer not null check (cost >= 0),
  image_url   text,
  type        text not null check (type in ('badge', 'title', 'object', 'decoration')),
  icon        text not null default '🎁',
  meta        jsonb not null default '{}'::jsonb,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index if not exists shop_items_name_key on public.shop_items (name);

create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  username       text not null check (char_length(btrim(username)) between 2 and 24),
  avatar_url     text check (avatar_url is null or char_length(avatar_url) <= 1000),
  kudos_balance  integer not null default 0 check (kudos_balance >= 0),
  equipped_title uuid references public.shop_items (id) on delete set null,
  equipped_badge uuid references public.shop_items (id) on delete set null,
  created_at     timestamptz not null default now()
);
create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

create table if not exists public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  event_date  date not null,
  event_time  time,
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists calendar_events_date_idx on public.calendar_events (event_date);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  content    text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_created_idx on public.messages (created_at desc);

create table if not exists public.news_posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 120),
  body       text not null default '' check (char_length(body) <= 4000),
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists news_posts_created_idx on public.news_posts (created_at desc);

create table if not exists public.kudos_feed (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid references public.profiles (id) on delete set null,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  message      text not null check (char_length(message) between 1 and 280),
  points       integer not null check (points > 0),
  created_at   timestamptz not null default now()
);
create index if not exists kudos_feed_created_idx on public.kudos_feed (created_at desc);
create index if not exists kudos_feed_sender_idx on public.kudos_feed (sender_id, created_at desc);
create index if not exists kudos_feed_recipient_idx on public.kudos_feed (recipient_id);

create table if not exists public.user_inventory (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  item_id      uuid not null references public.shop_items (id) on delete cascade,
  purchased_at timestamptz not null default now(),
  unique (user_id, item_id)
);
create index if not exists user_inventory_user_idx on public.user_inventory (user_id);

create table if not exists public.game_matches (
  id           uuid primary key default gen_random_uuid(),
  game_type    text not null check (game_type in ('battleships', 'pool', 'poker')),
  player1_id   uuid not null references public.profiles (id) on delete cascade,
  player2_id   uuid not null references public.profiles (id) on delete cascade,
  current_turn uuid references public.profiles (id) on delete set null,
  game_state   jsonb not null default '{}'::jsonb,
  status       text not null default 'pending'
               check (status in ('pending', 'active', 'finished', 'declined', 'cancelled')),
  winner_id    uuid references public.profiles (id) on delete set null,
  stake        integer not null default 0 check (stake >= 0),
  reward       integer not null default 0 check (reward >= 0),
  move_no      integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  finished_at  timestamptz,
  check (player1_id <> player2_id)
);
create index if not exists game_matches_p1_idx on public.game_matches (player1_id, updated_at desc);
create index if not exists game_matches_p2_idx on public.game_matches (player2_id, updated_at desc);

-- -----------------------------------------------------------------------------
-- Privileges: start from nothing, then grant exactly what the app needs.
-- Everything that changes kudos goes through SECURITY DEFINER functions below.
-- -----------------------------------------------------------------------------
revoke all on public.shop_items, public.profiles, public.calendar_events, public.messages,
              public.news_posts, public.kudos_feed, public.user_inventory, public.game_matches
  from anon, authenticated;

grant select on public.shop_items, public.profiles, public.calendar_events, public.messages,
                public.news_posts, public.kudos_feed, public.user_inventory, public.game_matches
  to authenticated;

grant update (username, avatar_url) on public.profiles to authenticated;
grant insert (title, description, event_date, event_time) on public.calendar_events to authenticated;
grant update (title, description, event_date, event_time) on public.calendar_events to authenticated;
grant delete on public.calendar_events to authenticated;
grant insert (content) on public.messages to authenticated;
grant delete on public.messages to authenticated;
grant insert (title, body, pinned) on public.news_posts to authenticated;
grant update (title, body, pinned) on public.news_posts to authenticated;
grant delete on public.news_posts to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.shop_items      enable row level security;
alter table public.profiles        enable row level security;
alter table public.calendar_events enable row level security;
alter table public.messages        enable row level security;
alter table public.news_posts      enable row level security;
alter table public.kudos_feed      enable row level security;
alter table public.user_inventory  enable row level security;
alter table public.game_matches    enable row level security;

drop policy if exists "members read shop" on public.shop_items;
create policy "members read shop" on public.shop_items
  for select to authenticated using (true);

drop policy if exists "members read profiles" on public.profiles;
create policy "members read profiles" on public.profiles
  for select to authenticated using (true);
drop policy if exists "members edit own profile" on public.profiles;
create policy "members edit own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "members read events" on public.calendar_events;
create policy "members read events" on public.calendar_events
  for select to authenticated using (true);
drop policy if exists "members add events" on public.calendar_events;
create policy "members add events" on public.calendar_events
  for insert to authenticated with check (created_by = auth.uid());
drop policy if exists "owners edit events" on public.calendar_events;
create policy "owners edit events" on public.calendar_events
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
drop policy if exists "owners delete events" on public.calendar_events;
create policy "owners delete events" on public.calendar_events
  for delete to authenticated using (created_by = auth.uid());

drop policy if exists "members read messages" on public.messages;
create policy "members read messages" on public.messages
  for select to authenticated using (true);
drop policy if exists "members send messages" on public.messages;
create policy "members send messages" on public.messages
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "owners delete messages" on public.messages;
create policy "owners delete messages" on public.messages
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "members read news" on public.news_posts;
create policy "members read news" on public.news_posts
  for select to authenticated using (true);
drop policy if exists "members post news" on public.news_posts;
create policy "members post news" on public.news_posts
  for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "owners edit news" on public.news_posts;
create policy "owners edit news" on public.news_posts
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "owners delete news" on public.news_posts;
create policy "owners delete news" on public.news_posts
  for delete to authenticated using (author_id = auth.uid());

drop policy if exists "members read kudos" on public.kudos_feed;
create policy "members read kudos" on public.kudos_feed
  for select to authenticated using (true);

drop policy if exists "members read inventories" on public.user_inventory;
create policy "members read inventories" on public.user_inventory
  for select to authenticated using (true);

drop policy if exists "players read their matches" on public.game_matches;
create policy "players read their matches" on public.game_matches
  for select to authenticated using (auth.uid() in (player1_id, player2_id));

-- -----------------------------------------------------------------------------
-- New users → profile (and optional family join code)
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg  app_private.settings;
  v_base text;
  v_name text;
begin
  select * into v_cfg from app_private.settings where id;

  if coalesce(btrim(v_cfg.join_code), '') <> ''
     and coalesce(new.raw_user_meta_data ->> 'family_code', '') <> v_cfg.join_code then
    raise exception 'INVALID_FAMILY_CODE';
  end if;

  v_base := btrim(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
                           split_part(coalesce(new.email, ''), '@', 1)));
  v_base := left(regexp_replace(v_base, '\s+', ' ', 'g'), 24);
  if char_length(v_base) < 2 then
    v_base := 'Member';
  end if;

  v_name := v_base;
  while exists (select 1 from public.profiles p where lower(p.username) = lower(v_name)) loop
    v_name := left(v_base, 19) || '-' || (1000 + floor(random() * 9000))::int;
  end loop;

  insert into public.profiles (id, username, avatar_url, kudos_balance)
  values (
    new.id,
    v_name,
    coalesce(nullif(new.raw_user_meta_data ->> 'avatar_url', ''), 'preset:fox'),
    v_cfg.starting_balance
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles for users that signed up before this script ran.
insert into public.profiles (id, username, avatar_url, kudos_balance)
select u.id,
       left(coalesce(nullif(split_part(u.email, '@', 1), ''), 'Member'), 19) || '-' || substr(u.id::text, 1, 4),
       'preset:fox',
       (select starting_balance from app_private.settings where id)
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Public (non-secret) settings for the client UI
-- -----------------------------------------------------------------------------
create or replace function public.get_app_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'starting_balance',   s.starting_balance,
    'kudos_max_per_gift', s.kudos_max_per_gift,
    'kudos_daily_limit',  s.kudos_daily_limit,
    'max_stake',          s.max_stake,
    'join_code_required', coalesce(btrim(s.join_code), '') <> ''
  )
  from app_private.settings s
  where s.id;
$$;

-- -----------------------------------------------------------------------------
-- Kudos
-- -----------------------------------------------------------------------------
create or replace function public.give_kudos(p_recipient uuid, p_message text, p_points integer)
returns public.kudos_feed
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_cfg  app_private.settings;
  v_msg  text := btrim(coalesce(p_message, ''));
  v_sent integer;
  v_row  public.kudos_feed;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.';
  end if;
  if p_recipient is null or p_recipient = v_uid then
    raise exception 'Pick a family member other than yourself.';
  end if;
  if not exists (select 1 from public.profiles where id = p_recipient) then
    raise exception 'That family member no longer exists.';
  end if;

  select * into v_cfg from app_private.settings where id;
  if p_points is null or p_points < 1 or p_points > v_cfg.kudos_max_per_gift then
    raise exception 'Kudos must be between 1 and % points.', v_cfg.kudos_max_per_gift;
  end if;
  if char_length(v_msg) = 0 or char_length(v_msg) > 280 then
    raise exception 'Write a shout-out message (up to 280 characters).';
  end if;

  -- One kudos transaction per sender at a time keeps the daily limit exact.
  perform pg_advisory_xact_lock(hashtext('kudos:' || v_uid::text));
  select coalesce(sum(k.points), 0) into v_sent
  from public.kudos_feed k
  where k.sender_id = v_uid and k.created_at > now() - interval '24 hours';
  if v_sent + p_points > v_cfg.kudos_daily_limit then
    raise exception 'Daily kudos limit reached: you can give % more points in the next 24 hours.',
      greatest(v_cfg.kudos_daily_limit - v_sent, 0);
  end if;

  update public.profiles set kudos_balance = kudos_balance + p_points where id = p_recipient;
  insert into public.kudos_feed (sender_id, recipient_id, message, points)
  values (v_uid, p_recipient, v_msg, p_points)
  returning * into v_row;
  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- Shop
-- -----------------------------------------------------------------------------
create or replace function public.purchase_item(p_item_id uuid)
returns public.user_inventory
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_item    public.shop_items;
  v_balance integer;
  v_row     public.user_inventory;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.';
  end if;
  select * into v_item from public.shop_items where id = p_item_id and active;
  if not found then
    raise exception 'That item is not for sale.';
  end if;

  select kudos_balance into v_balance from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'Your profile was not found.';
  end if;
  if exists (select 1 from public.user_inventory where user_id = v_uid and item_id = p_item_id) then
    raise exception 'You already own %.', v_item.name;
  end if;
  if v_balance < v_item.cost then
    raise exception 'Not enough kudos: % costs % and you have %.', v_item.name, v_item.cost, v_balance;
  end if;

  update public.profiles set kudos_balance = kudos_balance - v_item.cost where id = v_uid;
  insert into public.user_inventory (user_id, item_id)
  values (v_uid, p_item_id)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.equip_item(p_slot text, p_item_id uuid default null)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.profiles;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.';
  end if;
  if p_slot not in ('title', 'badge') then
    raise exception 'Only titles and badges can be equipped.';
  end if;
  if p_item_id is not null and not exists (
    select 1
    from public.user_inventory ui
    join public.shop_items si on si.id = ui.item_id
    where ui.user_id = v_uid and ui.item_id = p_item_id and si.type = p_slot
  ) then
    raise exception 'You do not own that %.', p_slot;
  end if;

  update public.profiles
  set equipped_title = case when p_slot = 'title' then p_item_id else equipped_title end,
      equipped_badge = case when p_slot = 'badge' then p_item_id else equipped_badge end
  where id = v_uid
  returning * into v_row;
  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- Games
--   Matches are created as 'pending'. Accepting escrows the stake from both
--   players. Every move is checked for turn order and a move counter
--   (optimistic concurrency). Finishing a match pays the winner both stakes
--   plus the house reward, or refunds both stakes on a draw.
-- -----------------------------------------------------------------------------
create or replace function public.game_reward(p_game_type text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_game_type
           when 'battleships' then 20
           when 'pool'        then 15
           when 'poker'       then 15
           else 10
         end;
$$;

create or replace function public._settle_match(p_match_id uuid, p_winner uuid, p_state jsonb)
returns public.game_matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match  public.game_matches;
  v_loser  uuid;
  v_prize  integer;
  v_name   text;
  v_game   text;
begin
  select * into v_match from public.game_matches where id = p_match_id for update;
  if not found or v_match.status <> 'active' then
    raise exception 'This match is not active.';
  end if;
  if p_winner is not null and p_winner not in (v_match.player1_id, v_match.player2_id) then
    raise exception 'The winner must be one of the players.';
  end if;

  v_game := case v_match.game_type
              when 'battleships' then 'Battleships'
              when 'pool' then 'Pool'
              else 'Poker'
            end;

  if p_winner is null then
    if v_match.stake > 0 then
      update public.profiles set kudos_balance = kudos_balance + v_match.stake
      where id in (v_match.player1_id, v_match.player2_id);
    end if;
  else
    v_loser := case when p_winner = v_match.player1_id then v_match.player2_id else v_match.player1_id end;
    v_prize := v_match.stake * 2 + v_match.reward;
    if v_prize > 0 then
      update public.profiles set kudos_balance = kudos_balance + v_prize where id = p_winner;
      select username into v_name from public.profiles where id = v_loser;
      insert into public.kudos_feed (sender_id, recipient_id, message, points)
      values (null, p_winner,
              format('🏆 Won %s against %s', v_game, coalesce(v_name, 'a family member')),
              v_prize);
    end if;
  end if;

  update public.game_matches
  set status       = 'finished',
      winner_id    = p_winner,
      current_turn = null,
      game_state   = coalesce(p_state, game_state),
      move_no      = move_no + 1,
      finished_at  = now(),
      updated_at   = now()
  where id = p_match_id
  returning * into v_match;
  return v_match;
end;
$$;

create or replace function public.create_match(
  p_game_type text,
  p_opponent  uuid,
  p_stake     integer,
  p_state     jsonb
)
returns public.game_matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_cfg     app_private.settings;
  v_balance integer;
  v_row     public.game_matches;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.';
  end if;
  if p_game_type not in ('battleships', 'pool', 'poker') then
    raise exception 'Unknown game: %.', p_game_type;
  end if;
  if p_opponent is null or p_opponent = v_uid then
    raise exception 'Choose someone else to challenge.';
  end if;
  if not exists (select 1 from public.profiles where id = p_opponent) then
    raise exception 'That family member no longer exists.';
  end if;

  select * into v_cfg from app_private.settings where id;
  if p_stake is null or p_stake < 0 or p_stake > v_cfg.max_stake then
    raise exception 'Stakes must be between 0 and % kudos.', v_cfg.max_stake;
  end if;
  select kudos_balance into v_balance from public.profiles where id = v_uid;
  if v_balance < p_stake then
    raise exception 'You only have % kudos to stake.', v_balance;
  end if;
  if (select count(*) from public.game_matches where player1_id = v_uid and status = 'pending') >= 10 then
    raise exception 'You already have 10 open challenges. Cancel some first.';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) > 200000 then
    raise exception 'Invalid game state.';
  end if;

  insert into public.game_matches (game_type, player1_id, player2_id, game_state, status, stake, reward)
  values (p_game_type, v_uid, p_opponent, p_state, 'pending', p_stake, public.game_reward(p_game_type))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.respond_match(
  p_match_id   uuid,
  p_accept     boolean,
  p_state      jsonb default null,
  p_first_turn uuid default null
)
returns public.game_matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_match public.game_matches;
  v_b1    integer;
  v_b2    integer;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.';
  end if;
  select * into v_match from public.game_matches where id = p_match_id for update;
  if not found then
    raise exception 'Match not found.';
  end if;
  if v_match.player2_id <> v_uid then
    raise exception 'Only the challenged player can respond.';
  end if;
  if v_match.status <> 'pending' then
    raise exception 'This challenge is no longer open.';
  end if;

  if not coalesce(p_accept, false) then
    update public.game_matches
    set status = 'declined', finished_at = now(), updated_at = now(), move_no = move_no + 1
    where id = p_match_id
    returning * into v_match;
    return v_match;
  end if;

  if p_first_turn is not null and p_first_turn not in (v_match.player1_id, v_match.player2_id) then
    raise exception 'The first turn must belong to a player.';
  end if;
  if p_state is not null and (jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) > 200000) then
    raise exception 'Invalid game state.';
  end if;

  if v_match.stake > 0 then
    -- Lock both balances in a stable order so two accepts can never deadlock.
    perform 1 from public.profiles
    where id in (v_match.player1_id, v_match.player2_id)
    order by id
    for update;
    select kudos_balance into v_b1 from public.profiles where id = v_match.player1_id;
    select kudos_balance into v_b2 from public.profiles where id = v_match.player2_id;
    if v_b2 < v_match.stake then
      raise exception 'You need % kudos to accept this stake (you have %).', v_match.stake, v_b2;
    end if;
    if v_b1 < v_match.stake then
      raise exception 'Your challenger no longer has % kudos for this stake.', v_match.stake;
    end if;
    update public.profiles set kudos_balance = kudos_balance - v_match.stake
    where id in (v_match.player1_id, v_match.player2_id);
  end if;

  update public.game_matches
  set status       = 'active',
      game_state   = coalesce(p_state, game_state),
      current_turn = p_first_turn,
      move_no      = move_no + 1,
      updated_at   = now()
  where id = p_match_id
  returning * into v_match;
  return v_match;
end;
$$;

create or replace function public.cancel_match(p_match_id uuid)
returns public.game_matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_match public.game_matches;
begin
  select * into v_match from public.game_matches where id = p_match_id for update;
  if not found then
    raise exception 'Match not found.';
  end if;
  if v_match.player1_id is distinct from v_uid then
    raise exception 'Only the challenger can cancel a challenge.';
  end if;
  if v_match.status <> 'pending' then
    raise exception 'Only open challenges can be cancelled.';
  end if;
  update public.game_matches
  set status = 'cancelled', finished_at = now(), updated_at = now(), move_no = move_no + 1
  where id = p_match_id
  returning * into v_match;
  return v_match;
end;
$$;

create or replace function public.submit_move(
  p_match_id      uuid,
  p_expected_move integer,
  p_state         jsonb,
  p_next_turn     uuid,
  p_finish        boolean default false,
  p_winner        uuid default null
)
returns public.game_matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_match public.game_matches;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.';
  end if;
  select * into v_match from public.game_matches where id = p_match_id for update;
  if not found then
    raise exception 'Match not found.';
  end if;
  if v_uid not in (v_match.player1_id, v_match.player2_id) then
    raise exception 'You are not playing in this match.';
  end if;
  if v_match.status <> 'active' then
    raise exception 'This match is not active.';
  end if;
  if v_match.move_no <> p_expected_move then
    raise exception 'STALE_MOVE' using hint = 'The board changed. Reload and try again.';
  end if;
  if v_match.current_turn is not null and v_match.current_turn <> v_uid then
    raise exception 'It is not your turn.';
  end if;
  if p_next_turn is not null and p_next_turn not in (v_match.player1_id, v_match.player2_id) then
    raise exception 'The next turn must belong to a player.';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) > 200000 then
    raise exception 'Invalid game state.';
  end if;

  if coalesce(p_finish, false) then
    return public._settle_match(p_match_id, p_winner, p_state);
  end if;

  update public.game_matches
  set game_state   = p_state,
      current_turn = p_next_turn,
      move_no      = move_no + 1,
      updated_at   = now()
  where id = p_match_id
  returning * into v_match;
  return v_match;
end;
$$;

create or replace function public.resign_match(p_match_id uuid)
returns public.game_matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_match public.game_matches;
  v_other uuid;
begin
  select * into v_match from public.game_matches where id = p_match_id for update;
  if not found then
    raise exception 'Match not found.';
  end if;
  if v_uid is null or v_uid not in (v_match.player1_id, v_match.player2_id) then
    raise exception 'You are not playing in this match.';
  end if;
  if v_match.status <> 'active' then
    raise exception 'This match is not active.';
  end if;
  v_other := case when v_uid = v_match.player1_id then v_match.player2_id else v_match.player1_id end;
  return public._settle_match(p_match_id, v_other,
                              v_match.game_state || jsonb_build_object('resignedBy', v_uid));
end;
$$;

-- Only the RPCs the client needs are callable, and only by signed-in members.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public._settle_match(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.game_reward(text) from public, anon;
revoke all on function public.get_app_settings() from public;
revoke all on function public.give_kudos(uuid, text, integer) from public, anon;
revoke all on function public.purchase_item(uuid) from public, anon;
revoke all on function public.equip_item(text, uuid) from public, anon;
revoke all on function public.create_match(text, uuid, integer, jsonb) from public, anon;
revoke all on function public.respond_match(uuid, boolean, jsonb, uuid) from public, anon;
revoke all on function public.cancel_match(uuid) from public, anon;
revoke all on function public.submit_move(uuid, integer, jsonb, uuid, boolean, uuid) from public, anon;
revoke all on function public.resign_match(uuid) from public, anon;

grant execute on function public.get_app_settings() to anon, authenticated;
grant execute on function public.game_reward(text) to authenticated;
grant execute on function public.give_kudos(uuid, text, integer) to authenticated;
grant execute on function public.purchase_item(uuid) to authenticated;
grant execute on function public.equip_item(text, uuid) to authenticated;
grant execute on function public.create_match(text, uuid, integer, jsonb) to authenticated;
grant execute on function public.respond_match(uuid, boolean, jsonb, uuid) to authenticated;
grant execute on function public.cancel_match(uuid) to authenticated;
grant execute on function public.submit_move(uuid, integer, jsonb, uuid, boolean, uuid) to authenticated;
grant execute on function public.resign_match(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['profiles', 'calendar_events', 'messages', 'news_posts', 'kudos_feed',
                           'shop_items', 'user_inventory', 'game_matches'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Shop catalogue (kept in sync with js/data/catalog.js used by demo mode)
-- -----------------------------------------------------------------------------
insert into public.shop_items (name, description, cost, type, icon, meta, sort_order) values
  ('Superstar',             'A shining star next to your name everywhere in the portal.',       30,  'badge',      '⭐', '{}',                              10),
  ('Helper Hero',           'For the one who always lends a hand.',                             40,  'badge',      '🦸', '{}',                              11),
  ('Master Chef',           'Kitchen legend. Pancakes on demand.',                              35,  'badge',      '👩‍🍳', '{}',                           12),
  ('Bookworm',              'Reads under the covers with a torch.',                             25,  'badge',      '📚', '{}',                              13),
  ('Champion',              'The trophy badge. Earned, not given.',                             80,  'badge',      '🏆', '{}',                              14),
  ('Title: Captain Chaos',  'Shows "Captain Chaos" under your name in chat.',                   40,  'title',      '🌀', '{"title":"Captain Chaos"}',        20),
  ('Title: Snack Boss',     'Shows "Chief Snack Officer" under your name in chat.',             50,  'title',      '🍪', '{"title":"Chief Snack Officer"}',  21),
  ('Title: Homework Hero',  'Shows "Homework Hero" under your name in chat.',                   30,  'title',      '✏️', '{"title":"Homework Hero"}',        22),
  ('Title: The Legend',     'Shows "The Legend" under your name in chat.',                      100, 'title',      '👑', '{"title":"The Legend"}',           23),
  ('Pet Rock',              'Low maintenance. Excellent listener.',                             10,  'object',     '🪨', '{}',                              30),
  ('Lucky Sock',            'The other one is still missing.',                                  15,  'object',     '🧦', '{}',                              31),
  ('Crystal Ball',          'Predicts what''s for dinner with 50% accuracy.',                   45,  'object',     '🔮', '{}',                              32),
  ('Golden TV Remote',      'Ceremonial. Grants no actual control over the TV.',                60,  'object',     '📺', '{}',                              33),
  ('Pine Tree',             'A cosy pine for your 3D family island.',                           20,  'decoration', '🌲', '{"model":"tree"}',                40),
  ('Street Lamp',           'A warm glowing lamp for your 3D island.',                          25,  'decoration', '💡', '{"model":"lamp"}',                41),
  ('Snowman',               'Never melts. Slightly judgemental.',                               30,  'decoration', '⛄', '{"model":"snowman"}',             42),
  ('Campfire',              'A flickering campfire for island story time.',                     35,  'decoration', '🔥', '{"model":"campfire"}',            43),
  ('Windmill',              'A spinning windmill for your 3D island.',                          60,  'decoration', '🌬️', '{"model":"windmill"}',            44),
  ('Hot Air Balloon',       'Floats lazily above your island.',                                 75,  'decoration', '🎈', '{"model":"balloon"}',             45),
  ('Trophy Statue',         'A giant golden trophy for the island plaza.',                      90,  'decoration', '🏆', '{"model":"trophy"}',              46),
  ('Rocket',                'A hovering rocket, fuelled by family pride.',                      120, 'decoration', '🚀', '{"model":"rocket"}',              47)
on conflict (name) do update
  set description = excluded.description,
      cost        = excluded.cost,
      type        = excluded.type,
      icon        = excluded.icon,
      meta        = excluded.meta,
      sort_order  = excluded.sort_order;
