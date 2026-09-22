/** Shared in-memory application state. Mutations emit bus events. */
import { DEFAULT_SETTINGS } from '../config.js';
import { emit } from './bus.js';

export const store = {
  backend: null,
  session: null,
  userId: null,
  settings: { ...DEFAULT_SETTINGS },
  profiles: new Map(),
  items: new Map(),
  inventory: new Map(),
  matches: new Map(),
  online: new Set(),
  connection: 'connecting',
  networkOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  unread: { chat: 0 },
  route: { name: 'hub', params: {} },
};

export function resetStore() {
  store.session = null;
  store.userId = null;
  store.settings = { ...DEFAULT_SETTINGS };
  store.profiles.clear();
  store.items.clear();
  store.inventory.clear();
  store.matches.clear();
  store.online.clear();
  store.unread.chat = 0;
  store.connection = 'connecting';
}

export const me = () => store.profiles.get(store.userId) || null;
export const profileOf = (id) => store.profiles.get(id) || null;

export function familyMembers({ includeMe = true } = {}) {
  return [...store.profiles.values()]
    .filter((p) => includeMe || p.id !== store.userId)
    .sort((a, b) => a.username.localeCompare(b.username));
}

export function setProfiles(rows) {
  store.profiles.clear();
  rows.forEach((row) => store.profiles.set(row.id, row));
  emit('profiles');
  emit('me', { profile: me(), previous: null });
}

export function upsertProfile(row) {
  const previous = store.profiles.get(row.id);
  store.profiles.set(row.id, { ...previous, ...row });
  emit('profiles');
  if (row.id === store.userId) emit('me', { profile: me(), previous: previous || null });
  return previous;
}

export function removeProfile(id) {
  store.profiles.delete(id);
  emit('profiles');
}

export function setItems(rows) {
  store.items.clear();
  rows.forEach((row) => store.items.set(row.id, row));
  emit('items');
}

export function upsertItem(row) {
  store.items.set(row.id, { ...store.items.get(row.id), ...row });
  emit('items');
}

export function removeItem(id) {
  store.items.delete(id);
  emit('items');
}

export function sortedItems() {
  return [...store.items.values()]
    .filter((item) => item.active !== false)
    .sort((a, b) => (a.sort_order - b.sort_order) || a.cost - b.cost);
}

export function setInventory(rows) {
  store.inventory.clear();
  rows.forEach((row) => store.inventory.set(row.id, row));
  emit('inventory');
}

export function upsertInventory(row) {
  store.inventory.set(row.id, row);
  emit('inventory');
}

export function removeInventory(id) {
  store.inventory.delete(id);
  emit('inventory');
}

/** Shop items owned by a user, newest first. */
export function ownedItems(userId = store.userId) {
  return [...store.inventory.values()]
    .filter((row) => row.user_id === userId)
    .sort((a, b) => new Date(b.purchased_at) - new Date(a.purchased_at))
    .map((row) => store.items.get(row.item_id))
    .filter(Boolean);
}

export function ownsItem(itemId, userId = store.userId) {
  for (const row of store.inventory.values()) {
    if (row.user_id === userId && row.item_id === itemId) return true;
  }
  return false;
}

export function setMatches(rows) {
  store.matches.clear();
  rows.forEach((row) => store.matches.set(row.id, row));
  emit('matches');
}

export function upsertMatch(row) {
  const previous = store.matches.get(row.id) || null;
  // Every server-side change bumps move_no, so an equal or lower number is an
  // echo of something we already have (e.g. the realtime copy of our own RPC).
  if (previous && (previous.move_no ?? 0) >= (row.move_no ?? 0)) return previous;
  store.matches.set(row.id, row);
  emit('matches', { match: row, previous });
  return previous;
}

export function removeMatch(id) {
  store.matches.delete(id);
  emit('matches');
}

export function setOnline(ids) {
  store.online = new Set(ids);
  emit('presence', store.online);
}

export function setConnection(status) {
  if (store.connection === status) return;
  store.connection = status;
  emit('connection', status);
}

export function setUnreadChat(count) {
  store.unread.chat = Math.max(0, count);
  emit('unread', store.unread);
}
