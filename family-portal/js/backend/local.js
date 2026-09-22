/**
 * Demo backend: the same API as the Supabase backend, stored in this browser.
 *
 * Every tab of the app on this device shares the data (localStorage) and sees
 * changes live (BroadcastChannel). Each tab keeps its own session
 * (sessionStorage), so two tabs can be signed in as two family members to try
 * chat, kudos and multiplayer games. Business rules mirror the SQL functions in
 * supabase/schema.sql.
 */
import { CATALOG } from '../data/catalog.js';
import { DEFAULT_SETTINGS } from '../config.js';
import { uuid } from '../core/utils.js';

const DB_KEY = 'familyPortal.demo.db.v1';
const SESSION_KEY = 'familyPortal.demo.session';
const EVENT_KEY = 'familyPortal.demo.event';
const CHANNEL_NAME = 'familyPortal.demo';
const REWARDS = { battleships: 20, pool: 15, poker: 15 };
const GAME_NAMES = { battleships: 'Battleships', pool: 'Pool', poker: 'Poker' };
const TABLES = ['profiles', 'calendar_events', 'messages', 'news_posts', 'kudos_feed', 'shop_items', 'user_inventory', 'game_matches'];

const nowIso = () => new Date().toISOString();
const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

function fail(message, code) {
  const error = new Error(message);
  if (code) error.code = code;
  throw error;
}

function freshDb() {
  const created = nowIso();
  return {
    version: 1,
    users: [],
    profiles: [],
    calendar_events: [],
    messages: [],
    news_posts: [],
    kudos_feed: [],
    shop_items: CATALOG.map((item) => ({ id: uuid(), image_url: null, active: true, created_at: created, ...clone(item) })),
    user_inventory: [],
    game_matches: [],
  };
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const byte of data) {
    h1 = Math.imul(h1 ^ byte, 16777619) >>> 0;
    h2 = Math.imul(h2 + byte, 2246822519) >>> 0;
  }
  return `${h1.toString(16)}${h2.toString(16)}`;
}

function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  try {
    if (session) {
      const raw = JSON.stringify(session);
      sessionStorage.setItem(SESSION_KEY, raw);
      localStorage.setItem(SESSION_KEY, raw);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* storage unavailable: session lives only in memory */
  }
}

function checkLength(value, min, max, message) {
  const length = String(value ?? '').trim().length;
  if (length < min || length > max) fail(message);
}

export class LocalBackend {
  constructor() {
    this.kind = 'local';
    this.label = 'Demo mode (this device only)';
    this.tabId = uuid();
    this.session = readSession();
    this.memoryDb = null;
    this.changeHandlers = new Set();
    this.authHandlers = new Set();
    this.presenceHandlers = new Set();
    this.peers = new Map();
    this.presenceUser = null;
    this.presenceTimer = 0;
    this.channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null;
    if (this.channel) this.channel.onmessage = (event) => this.onRemote(event.data);
    this.onStorage = (event) => {
      if (event.key === EVENT_KEY && event.newValue && !this.channel) {
        try {
          this.onRemote(JSON.parse(event.newValue));
        } catch {
          /* ignore malformed payloads */
        }
      }
    };
    window.addEventListener('storage', this.onStorage);
    this.onPageHide = () => this.leavePresence();
    window.addEventListener('pagehide', this.onPageHide);
    if (this.session && !this.load().users.some((u) => u.id === this.session.user.id)) {
      this.session = null;
      writeSession(null);
    }
  }

  // ------------------------------------------------------------ storage

  load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) {
        const db = JSON.parse(raw);
        TABLES.forEach((table) => {
          if (!Array.isArray(db[table])) db[table] = [];
        });
        if (!Array.isArray(db.users)) db.users = [];
        if (db.shop_items.length === 0) db.shop_items = freshDb().shop_items;
        return db;
      }
    } catch {
      if (this.memoryDb) return clone(this.memoryDb);
    }
    const db = this.memoryDb ? clone(this.memoryDb) : freshDb();
    this.save(db);
    return db;
  }

  save(db) {
    this.memoryDb = db;
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (err) {
      if (err?.name === 'QuotaExceededError') {
        db.messages = db.messages.slice(-300);
        db.kudos_feed = db.kudos_feed.slice(-300);
        localStorage.setItem(DB_KEY, JSON.stringify(db));
      }
    }
  }

  /** Run fn(db, changes) atomically (per tab), persist, then broadcast the changes. */
  mutate(fn) {
    const db = this.load();
    const changes = [];
    const result = fn(db, changes);
    this.save(db);
    if (changes.length) this.publish(changes);
    return clone(result);
  }

  publish(changes) {
    const message = { type: 'changes', id: uuid(), changes };
    if (this.channel) this.channel.postMessage(message);
    else {
      try {
        localStorage.setItem(EVENT_KEY, JSON.stringify(message));
      } catch {
        /* other tabs will catch up on their next resync */
      }
    }
    setTimeout(() => this.deliver(changes), 0);
  }

  deliver(changes) {
    const userId = this.session?.user?.id;
    changes.forEach((change) => {
      if (change.table === 'game_matches') {
        const row = change.new || change.old;
        if (!row || (row.player1_id !== userId && row.player2_id !== userId)) return;
      }
      this.changeHandlers.forEach((handler) => handler(clone(change)));
    });
  }

  onRemote(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'changes') {
      this.deliver(message.changes || []);
    } else if (message.type === 'presence') {
      this.peers.set(message.tabId, { userId: message.userId, seen: Date.now() });
      this.emitPresence();
    } else if (message.type === 'presence-leave') {
      this.peers.delete(message.tabId);
      this.emitPresence();
    } else if (message.type === 'presence-query') {
      this.beat();
    }
  }

  me() {
    const id = this.session?.user?.id;
    if (!id) fail('You need to be signed in.');
    return id;
  }

  // ------------------------------------------------------------ auth

  async getSession() {
    return clone(this.session);
  }

  onAuthChange(handler) {
    this.authHandlers.add(handler);
    return () => this.authHandlers.delete(handler);
  }

  setSession(session, event) {
    this.session = session;
    writeSession(session);
    this.authHandlers.forEach((handler) => setTimeout(() => handler(clone(session), event), 0));
  }

  async signUp({ email, password, username, avatarUrl }) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) fail('Enter a valid email address.');
    if (String(password || '').length < 6) fail('Passwords need at least 6 characters.');
    const salt = uuid();
    const passHash = await hashPassword(password, salt);
    const user = this.mutate((db, changes) => {
      if (db.users.some((u) => u.email === normalized)) fail('An account with this email already exists. Try signing in.');
      const id = uuid();
      db.users.push({ id, email: normalized, salt, passHash, created_at: nowIso() });
      let base = String(username || '').trim().replace(/\s+/g, ' ') || normalized.split('@')[0];
      base = base.slice(0, 24);
      if (base.length < 2) base = 'Member';
      let name = base;
      while (db.profiles.some((p) => p.username.toLowerCase() === name.toLowerCase())) {
        name = `${base.slice(0, 19)}-${1000 + Math.floor(Math.random() * 9000)}`;
      }
      const profile = {
        id,
        username: name,
        avatar_url: /^preset:[a-z]+$/.test(String(avatarUrl || '')) ? avatarUrl : 'preset:fox',
        kudos_balance: DEFAULT_SETTINGS.starting_balance,
        equipped_title: null,
        equipped_badge: null,
        created_at: nowIso(),
      };
      db.profiles.push(profile);
      changes.push({ table: 'profiles', eventType: 'INSERT', new: profile, old: null });
      return { id, email: normalized };
    });
    const session = { user: user, created_at: nowIso() };
    this.setSession(session, 'SIGNED_IN');
    return { session: clone(session), needsConfirmation: false };
  }

  async signIn({ email, password }) {
    const normalized = String(email || '').trim().toLowerCase();
    const user = this.load().users.find((u) => u.email === normalized);
    if (!user || (await hashPassword(password, user.salt)) !== user.passHash) fail('Wrong email or password.');
    const session = { user: { id: user.id, email: user.email }, created_at: nowIso() };
    this.setSession(session, 'SIGNED_IN');
    return clone(session);
  }

  async signOut() {
    this.leavePresence();
    this.setSession(null, 'SIGNED_OUT');
  }

  async resetPassword() {
    fail('Password reset emails are not available in demo mode. Create a new demo account instead.');
  }

  async updatePassword(newPassword) {
    const id = this.me();
    if (String(newPassword || '').length < 6) fail('Passwords need at least 6 characters.');
    const salt = uuid();
    const passHash = await hashPassword(newPassword, salt);
    this.mutate((db) => {
      const user = db.users.find((u) => u.id === id);
      if (!user) fail('Account not found.');
      user.salt = salt;
      user.passHash = passHash;
    });
  }

  // ------------------------------------------------------------ settings & profiles

  async getSettings() {
    return { ...DEFAULT_SETTINGS };
  }

  async listProfiles() {
    return clone(this.load().profiles);
  }

  async updateProfile(id, { username, avatar_url: avatarUrl }) {
    const uid = this.me();
    if (id !== uid) fail('You can only edit your own profile.');
    const name = String(username ?? '').trim();
    checkLength(name, 2, 24, 'Display names need 2–24 characters.');
    if (avatarUrl != null && String(avatarUrl).length > 1000) fail('That avatar URL is too long.');
    return this.mutate((db, changes) => {
      if (db.profiles.some((p) => p.id !== uid && p.username.toLowerCase() === name.toLowerCase())) {
        fail('That display name is already taken.');
      }
      const profile = db.profiles.find((p) => p.id === uid);
      if (!profile) fail('Your profile was not found.');
      const old = clone(profile);
      profile.username = name;
      profile.avatar_url = avatarUrl ?? null;
      changes.push({ table: 'profiles', eventType: 'UPDATE', new: clone(profile), old });
      return profile;
    });
  }

  // ------------------------------------------------------------ calendar

  async listEvents(from, to) {
    return clone(this.load().calendar_events
      .filter((e) => e.event_date >= from && e.event_date <= to)
      .sort((a, b) => (a.event_date + (a.event_time || '')).localeCompare(b.event_date + (b.event_time || ''))));
  }

  validateEvent({ title, description = '', event_date: date, event_time: time }) {
    checkLength(title, 1, 120, 'Event titles need 1–120 characters.');
    if (String(description).length > 2000) fail('Descriptions can be up to 2000 characters.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) fail('Pick a date for the event.');
    if (time && !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) fail('That time is not valid.');
  }

  async createEvent(input) {
    const uid = this.me();
    this.validateEvent(input);
    return this.mutate((db, changes) => {
      const row = {
        id: uuid(),
        title: input.title.trim(),
        description: String(input.description || '').trim(),
        event_date: input.event_date,
        event_time: input.event_time || null,
        created_by: uid,
        created_at: nowIso(),
      };
      db.calendar_events.push(row);
      changes.push({ table: 'calendar_events', eventType: 'INSERT', new: row, old: null });
      return row;
    });
  }

  async updateEvent(id, input) {
    const uid = this.me();
    this.validateEvent(input);
    return this.mutate((db, changes) => {
      const row = db.calendar_events.find((e) => e.id === id);
      if (!row || row.created_by !== uid) fail('You can only change events you created.');
      const old = clone(row);
      Object.assign(row, {
        title: input.title.trim(),
        description: String(input.description || '').trim(),
        event_date: input.event_date,
        event_time: input.event_time || null,
      });
      changes.push({ table: 'calendar_events', eventType: 'UPDATE', new: clone(row), old });
      return row;
    });
  }

  async deleteEvent(id) {
    const uid = this.me();
    this.mutate((db, changes) => {
      const index = db.calendar_events.findIndex((e) => e.id === id);
      if (index < 0 || db.calendar_events[index].created_by !== uid) fail('You can only delete events you created.');
      const [old] = db.calendar_events.splice(index, 1);
      changes.push({ table: 'calendar_events', eventType: 'DELETE', new: null, old: { id: old.id } });
    });
  }

  // ------------------------------------------------------------ chat

  async listMessages({ before = null, limit = 60 } = {}) {
    const rows = this.load().messages
      .filter((m) => !before || m.created_at < before)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return clone(rows.slice(-limit));
  }

  async sendMessage(content) {
    const uid = this.me();
    checkLength(content, 1, 2000, 'Messages can be 1–2000 characters.');
    return this.mutate((db, changes) => {
      const row = { id: uuid(), user_id: uid, content: String(content).trim(), created_at: nowIso() };
      db.messages.push(row);
      changes.push({ table: 'messages', eventType: 'INSERT', new: row, old: null });
      return row;
    });
  }

  async deleteMessage(id) {
    const uid = this.me();
    this.mutate((db, changes) => {
      const index = db.messages.findIndex((m) => m.id === id);
      if (index < 0 || db.messages[index].user_id !== uid) fail('You can only delete your own messages.');
      db.messages.splice(index, 1);
      changes.push({ table: 'messages', eventType: 'DELETE', new: null, old: { id } });
    });
  }

  // ------------------------------------------------------------ news

  async listNews(limit = 30) {
    return clone(this.load().news_posts
      .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || b.created_at.localeCompare(a.created_at))
      .slice(0, limit));
  }

  async createNews({ title, body = '', pinned = false }) {
    const uid = this.me();
    checkLength(title, 1, 120, 'Headlines need 1–120 characters.');
    if (String(body).length > 4000) fail('Posts can be up to 4000 characters.');
    return this.mutate((db, changes) => {
      const row = { id: uuid(), author_id: uid, title: title.trim(), body: String(body).trim(), pinned: !!pinned, created_at: nowIso() };
      db.news_posts.push(row);
      changes.push({ table: 'news_posts', eventType: 'INSERT', new: row, old: null });
      return row;
    });
  }

  async updateNews(id, patch) {
    const uid = this.me();
    if (patch.title !== undefined) checkLength(patch.title, 1, 120, 'Headlines need 1–120 characters.');
    if (patch.body !== undefined && String(patch.body).length > 4000) fail('Posts can be up to 4000 characters.');
    return this.mutate((db, changes) => {
      const row = db.news_posts.find((n) => n.id === id);
      if (!row || row.author_id !== uid) fail('You can only change your own posts.');
      const old = clone(row);
      ['title', 'body', 'pinned'].forEach((key) => {
        if (patch[key] !== undefined) row[key] = key === 'pinned' ? !!patch[key] : String(patch[key]).trim();
      });
      changes.push({ table: 'news_posts', eventType: 'UPDATE', new: clone(row), old });
      return row;
    });
  }

  async deleteNews(id) {
    const uid = this.me();
    this.mutate((db, changes) => {
      const index = db.news_posts.findIndex((n) => n.id === id);
      if (index < 0 || db.news_posts[index].author_id !== uid) fail('You can only delete your own posts.');
      db.news_posts.splice(index, 1);
      changes.push({ table: 'news_posts', eventType: 'DELETE', new: null, old: { id } });
    });
  }

  // ------------------------------------------------------------ kudos

  async listKudos(limit = 30) {
    return clone(this.load().kudos_feed.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit));
  }

  async kudosSentSince(sinceIso) {
    const uid = this.me();
    return this.load().kudos_feed
      .filter((k) => k.sender_id === uid && k.created_at > sinceIso)
      .reduce((sum, k) => sum + k.points, 0);
  }

  async kudosReceivedTotal(userId) {
    return this.load().kudos_feed.filter((k) => k.recipient_id === userId).reduce((sum, k) => sum + k.points, 0);
  }

  async giveKudos(recipientId, message, points) {
    const uid = this.me();
    const text = String(message || '').trim();
    const cfg = DEFAULT_SETTINGS;
    return this.mutate((db, changes) => {
      if (!recipientId || recipientId === uid) fail('Pick a family member other than yourself.');
      const recipient = db.profiles.find((p) => p.id === recipientId);
      if (!recipient) fail('That family member no longer exists.');
      if (!Number.isInteger(points) || points < 1 || points > cfg.kudos_max_per_gift) {
        fail(`Kudos must be between 1 and ${cfg.kudos_max_per_gift} points.`);
      }
      if (text.length === 0 || text.length > 280) fail('Write a shout-out message (up to 280 characters).');
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const sent = db.kudos_feed.filter((k) => k.sender_id === uid && k.created_at > since).reduce((s, k) => s + k.points, 0);
      if (sent + points > cfg.kudos_daily_limit) {
        fail(`Daily kudos limit reached: you can give ${Math.max(cfg.kudos_daily_limit - sent, 0)} more points in the next 24 hours.`);
      }
      const old = clone(recipient);
      recipient.kudos_balance += points;
      changes.push({ table: 'profiles', eventType: 'UPDATE', new: clone(recipient), old });
      const row = { id: uuid(), sender_id: uid, recipient_id: recipientId, message: text, points, created_at: nowIso() };
      db.kudos_feed.push(row);
      changes.push({ table: 'kudos_feed', eventType: 'INSERT', new: row, old: null });
      return row;
    });
  }

  // ------------------------------------------------------------ shop

  async listItems() {
    return clone(this.load().shop_items.filter((i) => i.active !== false).sort((a, b) => a.sort_order - b.sort_order));
  }

  async listInventory() {
    return clone(this.load().user_inventory);
  }

  async purchaseItem(itemId) {
    const uid = this.me();
    return this.mutate((db, changes) => {
      const item = db.shop_items.find((i) => i.id === itemId && i.active !== false);
      if (!item) fail('That item is not for sale.');
      const profile = db.profiles.find((p) => p.id === uid);
      if (!profile) fail('Your profile was not found.');
      if (db.user_inventory.some((r) => r.user_id === uid && r.item_id === itemId)) fail(`You already own ${item.name}.`);
      if (profile.kudos_balance < item.cost) {
        fail(`Not enough kudos: ${item.name} costs ${item.cost} and you have ${profile.kudos_balance}.`);
      }
      const old = clone(profile);
      profile.kudos_balance -= item.cost;
      changes.push({ table: 'profiles', eventType: 'UPDATE', new: clone(profile), old });
      const row = { id: uuid(), user_id: uid, item_id: itemId, purchased_at: nowIso() };
      db.user_inventory.push(row);
      changes.push({ table: 'user_inventory', eventType: 'INSERT', new: row, old: null });
      return row;
    });
  }

  async equipItem(slot, itemId = null) {
    const uid = this.me();
    if (slot !== 'title' && slot !== 'badge') fail('Only titles and badges can be equipped.');
    return this.mutate((db, changes) => {
      if (itemId) {
        const item = db.shop_items.find((i) => i.id === itemId);
        const owned = db.user_inventory.some((r) => r.user_id === uid && r.item_id === itemId);
        if (!item || !owned || item.type !== slot) fail(`You do not own that ${slot}.`);
      }
      const profile = db.profiles.find((p) => p.id === uid);
      const old = clone(profile);
      if (slot === 'title') profile.equipped_title = itemId;
      else profile.equipped_badge = itemId;
      changes.push({ table: 'profiles', eventType: 'UPDATE', new: clone(profile), old });
      return profile;
    });
  }

  // ------------------------------------------------------------ games

  async listMatches() {
    const uid = this.me();
    const mine = this.load().game_matches.filter((m) => m.player1_id === uid || m.player2_id === uid);
    const open = mine.filter((m) => m.status === 'pending' || m.status === 'active');
    const closed = mine
      .filter((m) => m.status !== 'pending' && m.status !== 'active')
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 50);
    return clone([...open, ...closed]);
  }

  async getMatch(id) {
    const uid = this.me();
    const match = this.load().game_matches.find((m) => m.id === id);
    if (!match || (match.player1_id !== uid && match.player2_id !== uid)) return null;
    return clone(match);
  }

  async createMatch({ gameType, opponentId, stake, state }) {
    const uid = this.me();
    const cfg = DEFAULT_SETTINGS;
    return this.mutate((db, changes) => {
      if (!REWARDS[gameType]) fail(`Unknown game: ${gameType}.`);
      if (!opponentId || opponentId === uid) fail('Choose someone else to challenge.');
      if (!db.profiles.some((p) => p.id === opponentId)) fail('That family member no longer exists.');
      if (!Number.isInteger(stake) || stake < 0 || stake > cfg.max_stake) fail(`Stakes must be between 0 and ${cfg.max_stake} kudos.`);
      const profile = db.profiles.find((p) => p.id === uid);
      if (profile.kudos_balance < stake) fail(`You only have ${profile.kudos_balance} kudos to stake.`);
      if (db.game_matches.filter((m) => m.player1_id === uid && m.status === 'pending').length >= 10) {
        fail('You already have 10 open challenges. Cancel some first.');
      }
      if (!state || typeof state !== 'object' || Array.isArray(state)) fail('Invalid game state.');
      const row = {
        id: uuid(),
        game_type: gameType,
        player1_id: uid,
        player2_id: opponentId,
        current_turn: null,
        game_state: clone(state),
        status: 'pending',
        winner_id: null,
        stake,
        reward: REWARDS[gameType],
        move_no: 0,
        created_at: nowIso(),
        updated_at: nowIso(),
        finished_at: null,
      };
      db.game_matches.push(row);
      changes.push({ table: 'game_matches', eventType: 'INSERT', new: row, old: null });
      return row;
    });
  }

  lockedMatch(db, id) {
    const match = db.game_matches.find((m) => m.id === id);
    if (!match) fail('Match not found.');
    return match;
  }

  async respondMatch(id, accept, state = null, firstTurn = null) {
    const uid = this.me();
    return this.mutate((db, changes) => {
      const match = this.lockedMatch(db, id);
      if (match.player2_id !== uid) fail('Only the challenged player can respond.');
      if (match.status !== 'pending') fail('This challenge is no longer open.');
      const old = clone(match);
      if (!accept) {
        Object.assign(match, { status: 'declined', finished_at: nowIso(), updated_at: nowIso(), move_no: match.move_no + 1 });
        changes.push({ table: 'game_matches', eventType: 'UPDATE', new: clone(match), old });
        return match;
      }
      if (firstTurn && firstTurn !== match.player1_id && firstTurn !== match.player2_id) fail('The first turn must belong to a player.');
      if (match.stake > 0) {
        const p1 = db.profiles.find((p) => p.id === match.player1_id);
        const p2 = db.profiles.find((p) => p.id === match.player2_id);
        if (p2.kudos_balance < match.stake) fail(`You need ${match.stake} kudos to accept this stake (you have ${p2.kudos_balance}).`);
        if (p1.kudos_balance < match.stake) fail(`Your challenger no longer has ${match.stake} kudos for this stake.`);
        [p1, p2].forEach((p) => {
          const before = clone(p);
          p.kudos_balance -= match.stake;
          changes.push({ table: 'profiles', eventType: 'UPDATE', new: clone(p), old: before });
        });
      }
      Object.assign(match, {
        status: 'active',
        game_state: state ? clone(state) : match.game_state,
        current_turn: firstTurn || null,
        move_no: match.move_no + 1,
        updated_at: nowIso(),
      });
      changes.push({ table: 'game_matches', eventType: 'UPDATE', new: clone(match), old });
      return match;
    });
  }

  async cancelMatch(id) {
    const uid = this.me();
    return this.mutate((db, changes) => {
      const match = this.lockedMatch(db, id);
      if (match.player1_id !== uid) fail('Only the challenger can cancel a challenge.');
      if (match.status !== 'pending') fail('Only open challenges can be cancelled.');
      const old = clone(match);
      Object.assign(match, { status: 'cancelled', finished_at: nowIso(), updated_at: nowIso(), move_no: match.move_no + 1 });
      changes.push({ table: 'game_matches', eventType: 'UPDATE', new: clone(match), old });
      return match;
    });
  }

  settle(db, changes, match, winnerId, state) {
    if (winnerId && winnerId !== match.player1_id && winnerId !== match.player2_id) fail('The winner must be one of the players.');
    const old = clone(match);
    if (!winnerId) {
      if (match.stake > 0) {
        [match.player1_id, match.player2_id].forEach((pid) => {
          const p = db.profiles.find((x) => x.id === pid);
          if (!p) return;
          const before = clone(p);
          p.kudos_balance += match.stake;
          changes.push({ table: 'profiles', eventType: 'UPDATE', new: clone(p), old: before });
        });
      }
    } else {
      const loserId = winnerId === match.player1_id ? match.player2_id : match.player1_id;
      const prize = match.stake * 2 + match.reward;
      if (prize > 0) {
        const winner = db.profiles.find((x) => x.id === winnerId);
        if (winner) {
          const before = clone(winner);
          winner.kudos_balance += prize;
          changes.push({ table: 'profiles', eventType: 'UPDATE', new: clone(winner), old: before });
        }
        const loser = db.profiles.find((x) => x.id === loserId);
        const row = {
          id: uuid(),
          sender_id: null,
          recipient_id: winnerId,
          message: `🏆 Won ${GAME_NAMES[match.game_type]} against ${loser ? loser.username : 'a family member'}`,
          points: prize,
          created_at: nowIso(),
        };
        db.kudos_feed.push(row);
        changes.push({ table: 'kudos_feed', eventType: 'INSERT', new: row, old: null });
      }
    }
    Object.assign(match, {
      status: 'finished',
      winner_id: winnerId || null,
      current_turn: null,
      game_state: state ? clone(state) : match.game_state,
      move_no: match.move_no + 1,
      finished_at: nowIso(),
      updated_at: nowIso(),
    });
    changes.push({ table: 'game_matches', eventType: 'UPDATE', new: clone(match), old });
    return match;
  }

  async submitMove(id, expectedMove, state, nextTurn, finish = false, winnerId = null) {
    const uid = this.me();
    return this.mutate((db, changes) => {
      const match = this.lockedMatch(db, id);
      if (match.player1_id !== uid && match.player2_id !== uid) fail('You are not playing in this match.');
      if (match.status !== 'active') fail('This match is not active.');
      if (match.move_no !== expectedMove) fail('The board changed. Reload and try again.', 'STALE_MOVE');
      if (match.current_turn && match.current_turn !== uid) fail('It is not your turn.');
      if (nextTurn && nextTurn !== match.player1_id && nextTurn !== match.player2_id) fail('The next turn must belong to a player.');
      if (!state || typeof state !== 'object' || Array.isArray(state)) fail('Invalid game state.');
      if (finish) return this.settle(db, changes, match, winnerId, state);
      const old = clone(match);
      Object.assign(match, {
        game_state: clone(state),
        current_turn: nextTurn || null,
        move_no: match.move_no + 1,
        updated_at: nowIso(),
      });
      changes.push({ table: 'game_matches', eventType: 'UPDATE', new: clone(match), old });
      return match;
    });
  }

  async resignMatch(id) {
    const uid = this.me();
    return this.mutate((db, changes) => {
      const match = this.lockedMatch(db, id);
      if (match.player1_id !== uid && match.player2_id !== uid) fail('You are not playing in this match.');
      if (match.status !== 'active') fail('This match is not active.');
      const other = uid === match.player1_id ? match.player2_id : match.player1_id;
      return this.settle(db, changes, match, other, { ...match.game_state, resignedBy: uid });
    });
  }

  // ------------------------------------------------------------ realtime & presence

  subscribeAll(handler, onStatus) {
    this.changeHandlers.add(handler);
    if (onStatus) setTimeout(() => onStatus('connected'), 0);
    return () => this.changeHandlers.delete(handler);
  }

  beat() {
    if (!this.presenceUser) return;
    const message = { type: 'presence', tabId: this.tabId, userId: this.presenceUser };
    if (this.channel) this.channel.postMessage(message);
  }

  emitPresence() {
    const cutoff = Date.now() - 12000;
    for (const [tabId, peer] of this.peers) if (peer.seen < cutoff) this.peers.delete(tabId);
    const ids = new Set([...this.peers.values()].map((peer) => peer.userId));
    if (this.presenceUser) ids.add(this.presenceUser);
    this.presenceHandlers.forEach((handler) => handler([...ids]));
  }

  joinPresence(userId) {
    this.leavePresence();
    this.presenceUser = userId;
    this.beat();
    if (this.channel) this.channel.postMessage({ type: 'presence-query' });
    this.presenceTimer = setInterval(() => {
      this.beat();
      this.emitPresence();
    }, 4000);
    this.emitPresence();
  }

  leavePresence() {
    clearInterval(this.presenceTimer);
    if (this.presenceUser && this.channel) this.channel.postMessage({ type: 'presence-leave', tabId: this.tabId });
    this.presenceUser = null;
  }

  onPresence(handler) {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }

  destroy() {
    this.leavePresence();
    window.removeEventListener('storage', this.onStorage);
    window.removeEventListener('pagehide', this.onPageHide);
    if (this.channel) this.channel.close();
    this.changeHandlers.clear();
    this.authHandlers.clear();
    this.presenceHandlers.clear();
  }
}

export function createLocalBackend() {
  return new LocalBackend();
}
