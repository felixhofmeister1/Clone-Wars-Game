# Family Portal

An installable Progressive Web App for the whole family. It includes a shared calendar, a group chat, a news board, a kudos system with a shop, a 3D "family island" and a multiplayer arcade with Battleships, Pool and Poker. It is built with plain HTML, CSS and ES modules, uses Three.js for 3D, and uses Supabase for auth, the database and realtime sync. There is no build step.

| | |
|---|---|
| **Hub** | 3D family island (owned décor appears on it), month/week calendar, "coming up" list, kudos widget and stream, news board |
| **Chat** | Realtime group chat with avatars, titles, day separators, grouping, auto-scroll and "load earlier" |
| **Games** | Challenge anyone to Battleships, Pool (2D physics) or heads-up Hold'em. Optional kudos stakes, house reward for the winner |
| **Shop** | Badges, chat titles, collectibles and 3D decorations bought with kudos |
| **Profile** | Display name, 24 preset avatars or a custom image URL, badge/title, family list, notifications, install, invite link |

## 1. Try it in 30 seconds (demo mode)

```bash
cd family-portal
python3 -m http.server 8080     # or: npx serve .
```

1. Open <http://localhost:8080> and choose **Try demo mode on this device**.
2. Create an account.
3. To play against someone, open a second tab. Go to **Profile → Sign out**, then create a second account. Each tab keeps its own session, and changes show up in the other tab instantly.

Demo mode stores everything in the browser (`localStorage` + `BroadcastChannel`). It follows the same rules as the database functions, so it behaves like the real thing, but it only lives on one device.

## 2. Connect a real Supabase project (all devices)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste all of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. The script is safe to run again, and doing so upgrades functions and policies in place.
3. **Authentication → URL Configuration**: set **Site URL** to where you host the app (e.g. `https://you.github.io/Clone-Wars-Game/family-portal/`). Add the same URL under **Redirect URLs**. Confirmation and password-reset emails link back to this address.
4. **Project Settings → API** (or **API Keys**): copy the **Project URL** and the **anon** / **publishable** key. Then choose one:
   - paste them into `js/config.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) before deploying. Everyone then goes straight to sign-in. **Or**
   - leave `config.js` empty and paste them on the **Connect** screen. Then use **Profile → Invite family → Copy link** to set up every other device with one tap.
5. Optional, recommended if the URL is public: require a family code for sign-up:
   ```sql
   update app_private.settings set join_code = 'our-secret-code';
   ```
   Other limits live in the same row: `starting_balance` (50), `kudos_max_per_gift` (50), `kudos_daily_limit` (250), `max_stake` (100).

The anon key is meant to be public. Row Level Security protects the data. Never put the `service_role` / secret key in the app.

## 3. Deploy

The folder is a static site, so any HTTPS host works: GitHub Pages, Netlify, Vercel, Cloudflare Pages or S3. Service workers need HTTPS (or `localhost`).

- **GitHub Pages:** the repository already serves static files (`.nojekyll`). The app is available at `/family-portal/`.
- **When you deploy changes:** bump `VERSION` in `sw.js`. Installed apps then show **"A new version is ready → Update"**.
- **Install:** Android / desktop Chrome and Edge offer **Install** (also available in Profile). On iPhone / iPad use Safari **Share → Add to Home Screen**. The app opens full-screen and standalone with its own icon.

## 4. Project structure

```
family-portal/
├── index.html              App shell, PWA meta tags, import map (three, supabase-js)
├── manifest.json           PWA manifest (standalone, icons, shortcuts)
├── sw.js                   Service worker: precache, offline, runtime CDN cache, notification clicks
├── offline.html            Fallback when opened offline before the first visit
├── package.json            `npm test` (engine unit tests), `npm start`
├── supabase/
│   └── schema.sql          Tables, RLS, grants, RPCs, trigger, realtime, shop seed
├── icons/                  SVG + PNG app icons (any, maskable, apple-touch-icon)
├── css/
│   ├── base.css            Design tokens (light + dark), reset, utilities
│   ├── layout.css          Shell, bottom nav (<768px), sidebar (≥768px), top bar, auth
│   ├── components.css      Buttons, forms, chips, avatars, toasts, modals / bottom sheets
│   ├── pages.css           Hub, calendar, kudos, news, chat, shop, profile
│   └── games.css           Arcade lobby, match page, Battleships, Pool, Poker
├── js/
│   ├── app.js              Boot, auth gate, shell, hash router, password reset
│   ├── config.js           Supabase URL / key (optional) and defaults
│   ├── backend/
│   │   ├── index.js        Picks the backend; connect config; invite (#setup=) links
│   │   ├── supabase.js     Supabase Auth, REST, RPC, Realtime, Presence
│   │   └── local.js        Demo backend with the same API and rules, cross-tab realtime
│   ├── core/
│   │   ├── bus.js          Pub/sub between modules
│   │   ├── store.js        In-memory state (profiles, items, inventory, matches…)
│   │   ├── sync.js         Initial load, realtime → store, presence, resync, notifications
│   │   ├── ui.js           Toasts, modals, confirm, avatars, names, bursts
│   │   ├── notify.js       System notifications + app badge
│   │   ├── pwa.js          Service worker registration, update + install prompts
│   │   ├── icons.js        Inline SVG icon set
│   │   └── utils.js        Escaping, dates, DOM helpers
│   ├── data/
│   │   ├── avatars.js      Preset avatars
│   │   └── catalog.js      Shop catalogue for demo mode (mirrors the SQL seed)
│   ├── views/              auth, hub, calendar, kudos, news, chat, shop, profile, games (lobby), match
│   ├── games/
│   │   ├── registry.js     Game metadata, "needs action" logic
│   │   ├── battleships-rules.js / battleships.js
│   │   ├── pool-engine.js / pool.js           Deterministic physics, 8-ball rules / canvas UI
│   │   └── poker-rules.js / poker.js          Deck, 7-card evaluator, betting state machine / table UI
│   └── three/
│       ├── lobby3d.js      Family island scene (drag to spin, décor slots, member orbs)
│       └── decorations.js  Low-poly shop decorations (tree, lamp, windmill, rocket…)
└── tests/
    └── rules.test.mjs      Node unit tests for the three game engines
```

## 5. How it works

**Data flow.** Every screen talks to `store.backend`, which is either `SupabaseBackend` or `LocalBackend` with the same method names. `core/sync.js` subscribes to one realtime channel covering every table. Row changes update the in-memory store, and events fan out to whichever page is open. When the connection comes back, or the app returns from the background, the app re-fetches everything so nothing is missed.

**Kudos economy.** Balances can't be edited directly. Column-level grants allow members to update only `username` and `avatar_url`. Kudos only move through `SECURITY DEFINER` functions:

| Function | What it does |
|---|---|
| `give_kudos` | Adds 1–50 points to the recipient. Nothing is taken from the sender. A 24-hour cap per sender applies. Logged in `kudos_feed`. |
| `purchase_item` | Checks and deducts the balance and adds the item to the buyer's inventory in one transaction. Each item can be owned once. |
| `create_match` / `respond_match` | Accepting a challenge escrows the stake from both players (row locks are taken in a fixed order so accepts can't deadlock). |
| `submit_move` | Checks participant, turn order and a move counter (`STALE_MOVE` on conflict). Finishing pays the winner both stakes plus the house reward (Battleships 20, Pool 15, Poker 15), records it in the kudos stream and stores the result as match history. A draw refunds the stakes. |
| `resign_match` | Awards the match to the other player. |

**Games.**

| Game | How it plays |
|---|---|
| **Battleships** | Both players place ships at the same time (the turn is `null` during placement). The last player to finish placing fires first. After that, shots alternate. |
| **Pool** | The shooter's device runs a fixed-step physics simulation. The result is checked against simplified 8-ball rules: the table is open until the first legal pot, and fouls include a scratch, no hit, or hitting the wrong ball first. Fouls give the opponent ball in hand, and potting the 8-ball early loses. The opponent's device replays the same shot from the stored direction and power. |
| **Poker** | Heads-up no-limit Hold'em: 200 chips each, blinds 5/10, six hands, and the chip leader wins. Side-cases are handled: short blinds, all-in run-outs, uncalled bets and split pots. |

**Trust model (read this).** Game rules run on the players' devices. The server enforces who may move, whose turn it is, move ordering and all kudos transfers, but it doesn't re-simulate pool physics or re-deal cards. Ship positions and hole cards sit in the match row, and only the two players can read that row. A determined player could read their opponent's cards or ships with browser dev tools. That trade-off suits a family app. For stricter play, move dealing and shot resolution into Postgres functions or Edge Functions.

**Offline.** The service worker precaches the whole app, so an installed app always opens. With Supabase, pages you have already loaded stay readable offline, and changes need a connection. Demo mode works fully offline.

**Notifications.** When enabled in Profile, messages, kudos, challenges and "your move" raise system notifications while the app is running in the background, and the app icon shows a badge count. Delivering alerts while the app is closed would need a Web Push server, which isn't included.

## 6. Customising

- **New shop item:** `insert into public.shop_items (name, description, cost, type, icon, meta) values (...)`. Use `type` = `badge`, `title` (`meta.title` is the text shown), `object` or `decoration` (`meta.model` is one of `tree, lamp, snowman, campfire, windmill, balloon, trophy, rocket`). `image_url` can point to a picture instead of the emoji. For demo mode, add the item to `js/data/catalog.js` as well.
- **Rewards:** change `public.game_reward()` in SQL and `reward` in `js/games/registry.js`.
- **Look & feel:** every colour, radius and shadow is a CSS variable at the top of `css/base.css`. Dark mode overrides are in the same file.

## 7. Tests

```bash
cd family-portal
npm test          # 19 unit tests: fleets, firing & sinking; rack, physics determinism, pocketing, 8-ball rules; hand ranking, blinds, betting, all-ins, full matches
```

## Browser support

Current Chrome, Edge, Firefox and Safari. iOS / iPadOS 16.4 or later is required for import maps. If WebGL or the Three.js CDN isn't available, the 3D island falls back to a flat illustration and the rest of the app works normally.
