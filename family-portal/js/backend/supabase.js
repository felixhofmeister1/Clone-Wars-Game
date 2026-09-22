/**
 * Supabase backend: Auth, PostgREST queries, RPCs and Realtime.
 * supabase-js is loaded lazily from the CDN (see the import map in index.html)
 * so demo mode keeps working even when the CDN is unreachable.
 */
const TABLES = ['profiles', 'calendar_events', 'messages', 'news_posts', 'kudos_feed', 'shop_items', 'user_inventory', 'game_matches'];

const FRIENDLY = [
  [/INVALID_FAMILY_CODE|Database error saving new user/i, 'Sign-up was rejected. Check the family code and try again.'],
  [/profiles_username_lower_key|duplicate key value.*username/i, 'That display name is already taken.'],
  [/Invalid login credentials/i, 'Wrong email or password.'],
  [/Email not confirmed/i, 'Please confirm your email address first. Check your inbox for the link.'],
  [/User already registered/i, 'An account with this email already exists. Try signing in.'],
  [/Password should be at least/i, 'Passwords need at least 6 characters.'],
  [/rate limit|too many requests/i, 'Too many attempts. Wait a minute and try again.'],
  [/Failed to fetch|NetworkError|Load failed|fetch failed/i, "Can't reach the server. Check your internet connection."],
  [/JWT expired|invalid JWT/i, 'Your session expired. Please sign in again.'],
  [/violates row-level security|permission denied/i, "You don't have permission to do that."],
];

function toError(error) {
  const raw = error?.message || String(error || 'Unknown error');
  const mapped = FRIENDLY.find(([pattern]) => pattern.test(raw) || pattern.test(error?.details || ''));
  const result = new Error(mapped ? mapped[1] : raw);
  result.code = /STALE_MOVE/.test(raw) ? 'STALE_MOVE' : error?.code;
  result.cause = error;
  return result;
}

function unwrap({ data, error }) {
  if (error) throw toError(error);
  return data;
}

function mapSession(session) {
  if (!session?.user) return null;
  return { user: { id: session.user.id, email: session.user.email }, created_at: new Date().toISOString() };
}

function appUrl() {
  return `${location.origin}${location.pathname}`;
}

export class SupabaseBackend {
  constructor(client, url) {
    this.kind = 'supabase';
    this.label = `Supabase · ${new URL(url).host}`;
    this.url = url;
    this.client = client;
    this.userId = null;
    this.dbChannel = null;
    this.presenceChannel = null;
    this.presenceHandlers = new Set();
  }

  me() {
    if (!this.userId) throw new Error('You need to be signed in.');
    return this.userId;
  }

  // ------------------------------------------------------------ auth

  async getSession() {
    const data = unwrap(await this.client.auth.getSession());
    const session = mapSession(data.session);
    this.userId = session?.user.id || null;
    return session;
  }

  onAuthChange(handler) {
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      const mapped = mapSession(session);
      this.userId = mapped?.user.id || null;
      // Never call Supabase from inside this callback (it can deadlock the auth lock).
      setTimeout(() => handler(mapped, event), 0);
    });
    return () => data.subscription.unsubscribe();
  }

  async signUp({ email, password, username, familyCode, avatarUrl }) {
    const data = unwrap(await this.client.auth.signUp({
      email: String(email).trim(),
      password,
      options: {
        emailRedirectTo: appUrl(),
        data: {
          username: String(username || '').trim(),
          family_code: String(familyCode || '').trim(),
          avatar_url: String(avatarUrl || ''),
        },
      },
    }));
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists. Try signing in.');
    }
    const session = mapSession(data.session);
    this.userId = session?.user.id || null;
    return { session, needsConfirmation: !data.session };
  }

  async signIn({ email, password }) {
    const data = unwrap(await this.client.auth.signInWithPassword({ email: String(email).trim(), password }));
    const session = mapSession(data.session);
    this.userId = session?.user.id || null;
    return session;
  }

  async signOut() {
    await this.leavePresence();
    const { error } = await this.client.auth.signOut();
    if (error) await this.client.auth.signOut({ scope: 'local' });
    this.userId = null;
  }

  async resetPassword(email) {
    unwrap(await this.client.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: appUrl() }));
  }

  async updatePassword(newPassword) {
    unwrap(await this.client.auth.updateUser({ password: newPassword }));
  }

  // ------------------------------------------------------------ settings & profiles

  async getSettings() {
    return unwrap(await this.client.rpc('get_app_settings'));
  }

  async listProfiles() {
    return unwrap(await this.client.from('profiles').select('*').order('username'));
  }

  async updateProfile(id, { username, avatar_url: avatarUrl }) {
    const rows = unwrap(await this.client
      .from('profiles')
      .update({ username: String(username).trim(), avatar_url: avatarUrl ?? null })
      .eq('id', id)
      .select());
    if (!rows.length) throw new Error('You can only edit your own profile.');
    return rows[0];
  }

  // ------------------------------------------------------------ calendar

  async listEvents(from, to) {
    return unwrap(await this.client
      .from('calendar_events')
      .select('*')
      .gte('event_date', from)
      .lte('event_date', to)
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true, nullsFirst: true })
      .limit(1000));
  }

  async createEvent({ title, description = '', event_date: date, event_time: time }) {
    return unwrap(await this.client
      .from('calendar_events')
      .insert({ title: title.trim(), description: description.trim(), event_date: date, event_time: time || null })
      .select()
      .single());
  }

  async updateEvent(id, { title, description = '', event_date: date, event_time: time }) {
    const rows = unwrap(await this.client
      .from('calendar_events')
      .update({ title: title.trim(), description: description.trim(), event_date: date, event_time: time || null })
      .eq('id', id)
      .select());
    if (!rows.length) throw new Error('You can only change events you created.');
    return rows[0];
  }

  async deleteEvent(id) {
    const rows = unwrap(await this.client.from('calendar_events').delete().eq('id', id).select('id'));
    if (!rows.length) throw new Error('You can only delete events you created.');
  }

  // ------------------------------------------------------------ chat

  async listMessages({ before = null, limit = 60 } = {}) {
    let query = this.client.from('messages').select('*').order('created_at', { ascending: false }).limit(limit);
    if (before) query = query.lt('created_at', before);
    const rows = unwrap(await query);
    return rows.reverse();
  }

  async sendMessage(content) {
    return unwrap(await this.client.from('messages').insert({ content: String(content).trim() }).select().single());
  }

  async deleteMessage(id) {
    const rows = unwrap(await this.client.from('messages').delete().eq('id', id).select('id'));
    if (!rows.length) throw new Error('You can only delete your own messages.');
  }

  // ------------------------------------------------------------ news

  async listNews(limit = 30) {
    return unwrap(await this.client
      .from('news_posts')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit));
  }

  async createNews({ title, body = '', pinned = false }) {
    return unwrap(await this.client
      .from('news_posts')
      .insert({ title: title.trim(), body: body.trim(), pinned: !!pinned })
      .select()
      .single());
  }

  async updateNews(id, patch) {
    const update = {};
    if (patch.title !== undefined) update.title = String(patch.title).trim();
    if (patch.body !== undefined) update.body = String(patch.body).trim();
    if (patch.pinned !== undefined) update.pinned = !!patch.pinned;
    const rows = unwrap(await this.client.from('news_posts').update(update).eq('id', id).select());
    if (!rows.length) throw new Error('You can only change your own posts.');
    return rows[0];
  }

  async deleteNews(id) {
    const rows = unwrap(await this.client.from('news_posts').delete().eq('id', id).select('id'));
    if (!rows.length) throw new Error('You can only delete your own posts.');
  }

  // ------------------------------------------------------------ kudos

  async listKudos(limit = 30) {
    return unwrap(await this.client.from('kudos_feed').select('*').order('created_at', { ascending: false }).limit(limit));
  }

  async kudosSentSince(sinceIso) {
    const rows = unwrap(await this.client
      .from('kudos_feed')
      .select('points')
      .eq('sender_id', this.me())
      .gt('created_at', sinceIso)
      .limit(1000));
    return rows.reduce((sum, row) => sum + row.points, 0);
  }

  async kudosReceivedTotal(userId) {
    const rows = unwrap(await this.client.from('kudos_feed').select('points').eq('recipient_id', userId).limit(10000));
    return rows.reduce((sum, row) => sum + row.points, 0);
  }

  async giveKudos(recipientId, message, points) {
    return unwrap(await this.client.rpc('give_kudos', { p_recipient: recipientId, p_message: message, p_points: points }));
  }

  // ------------------------------------------------------------ shop

  async listItems() {
    return unwrap(await this.client.from('shop_items').select('*').eq('active', true).order('sort_order'));
  }

  async listInventory() {
    return unwrap(await this.client.from('user_inventory').select('*').limit(5000));
  }

  async purchaseItem(itemId) {
    return unwrap(await this.client.rpc('purchase_item', { p_item_id: itemId }));
  }

  async equipItem(slot, itemId = null) {
    return unwrap(await this.client.rpc('equip_item', { p_slot: slot, p_item_id: itemId }));
  }

  // ------------------------------------------------------------ games

  async listMatches() {
    const [open, closed] = await Promise.all([
      this.client.from('game_matches').select('*').in('status', ['pending', 'active']).order('updated_at', { ascending: false }),
      this.client.from('game_matches').select('*').in('status', ['finished', 'declined', 'cancelled'])
        .order('updated_at', { ascending: false }).limit(50),
    ]);
    return [...unwrap(open), ...unwrap(closed)];
  }

  async getMatch(id) {
    return unwrap(await this.client.from('game_matches').select('*').eq('id', id).maybeSingle());
  }

  async createMatch({ gameType, opponentId, stake, state }) {
    return unwrap(await this.client.rpc('create_match', {
      p_game_type: gameType,
      p_opponent: opponentId,
      p_stake: stake,
      p_state: state,
    }));
  }

  async respondMatch(id, accept, state = null, firstTurn = null) {
    return unwrap(await this.client.rpc('respond_match', {
      p_match_id: id,
      p_accept: accept,
      p_state: state,
      p_first_turn: firstTurn,
    }));
  }

  async cancelMatch(id) {
    return unwrap(await this.client.rpc('cancel_match', { p_match_id: id }));
  }

  async submitMove(id, expectedMove, state, nextTurn, finish = false, winnerId = null) {
    return unwrap(await this.client.rpc('submit_move', {
      p_match_id: id,
      p_expected_move: expectedMove,
      p_state: state,
      p_next_turn: nextTurn,
      p_finish: finish,
      p_winner: winnerId,
    }));
  }

  async resignMatch(id) {
    return unwrap(await this.client.rpc('resign_match', { p_match_id: id }));
  }

  // ------------------------------------------------------------ realtime & presence

  subscribeAll(handler, onStatus = () => {}) {
    if (this.dbChannel) this.client.removeChannel(this.dbChannel);
    const channel = this.client.channel('family-portal-db');
    TABLES.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        handler({ table, eventType: payload.eventType, new: payload.new || null, old: payload.old || null });
      });
    });
    onStatus('connecting');
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') onStatus('connected');
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onStatus('disconnected');
      else if (status === 'CLOSED') onStatus('disconnected');
    });
    this.dbChannel = channel;
    return () => {
      if (this.dbChannel === channel) this.dbChannel = null;
      this.client.removeChannel(channel);
    };
  }

  joinPresence(userId) {
    if (this.presenceChannel) this.client.removeChannel(this.presenceChannel);
    const channel = this.client.channel('family-portal-presence', { config: { presence: { key: userId } } });
    channel.on('presence', { event: 'sync' }, () => {
      const ids = Object.keys(channel.presenceState());
      this.presenceHandlers.forEach((handler) => handler(ids));
    });
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() });
    });
    this.presenceChannel = channel;
  }

  async leavePresence() {
    if (!this.presenceChannel) return;
    const channel = this.presenceChannel;
    this.presenceChannel = null;
    try {
      await channel.untrack();
    } catch {
      /* already disconnected */
    }
    this.client.removeChannel(channel);
  }

  onPresence(handler) {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }

  destroy() {
    this.leavePresence();
    if (this.dbChannel) this.client.removeChannel(this.dbChannel);
    this.presenceHandlers.clear();
  }
}

export async function createSupabaseBackend({ url, key }) {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'familyPortal.auth' },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  return new SupabaseBackend(client, url);
}
