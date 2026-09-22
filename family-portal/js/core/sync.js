/**
 * Keeps the store in sync with the backend: initial load, realtime changes,
 * presence, reconnect/resume resyncs, and the notifications they trigger.
 */
import { GAMES, needsAction, opponentOf } from '../games/registry.js';
import { emit } from './bus.js';
import { setAppBadge, systemNotify } from './notify.js';
import {
  store, profileOf,
  setProfiles, upsertProfile, removeProfile,
  setItems, upsertItem, removeItem,
  setInventory, upsertInventory, removeInventory,
  setMatches, upsertMatch, removeMatch,
  setOnline, setConnection, setUnreadChat,
} from './store.js';
import { toast, refreshPresenceDots, celebrate } from './ui.js';

let stopFns = [];
let hiddenSince = 0;
let resyncing = null;

export async function loadCoreData() {
  const backend = store.backend;
  const [settings, profiles, items, inventory, matches] = await Promise.all([
    backend.getSettings().catch(() => null),
    backend.listProfiles(),
    backend.listItems(),
    backend.listInventory(),
    backend.listMatches(),
  ]);
  if (settings) store.settings = { ...store.settings, ...settings };
  setItems(items);
  setProfiles(profiles);
  setInventory(inventory);
  setMatches(matches);
}

export function resync() {
  if (resyncing) return resyncing;
  resyncing = loadCoreData()
    .then(() => emit('resync'))
    .catch((err) => console.warn('[sync] resync failed', err))
    .finally(() => {
      resyncing = null;
    });
  return resyncing;
}

export function actionCount() {
  let count = 0;
  for (const match of store.matches.values()) if (needsAction(match, store.userId)) count += 1;
  return count;
}

export function updateBadges() {
  const games = actionCount();
  const chat = store.unread.chat;
  const total = games + chat;
  document.title = total > 0 ? `(${total}) Family Portal` : 'Family Portal';
  setAppBadge(total);
  emit('badges', { games, chat });
}

function viewingMatch(id) {
  return store.route.name === 'games' && store.route.params.id === id && document.visibilityState === 'visible';
}

function nameOf(id) {
  return profileOf(id)?.username || 'Someone';
}

function handleMatch(change) {
  if (change.eventType === 'DELETE') {
    removeMatch(change.old?.id);
    return;
  }
  const match = change.new;
  const previous = upsertMatch(match);
  if (previous && previous.move_no >= match.move_no) return;
  const uid = store.userId;
  const game = GAMES[match.game_type];
  const gameName = game?.name || 'a game';
  const other = nameOf(opponentOf(match, uid));
  const url = `#/games/${match.id}`;
  const open = { label: 'Open', onClick: () => { location.hash = url; } };
  const tag = `match-${match.id}`;
  if (viewingMatch(match.id)) return;

  if (!previous && match.status === 'pending' && match.player2_id === uid) {
    const stake = match.stake > 0 ? ` for ${match.stake} kudos` : '';
    toast(`${other} challenged you to ${gameName}${stake}!`, { type: 'info', title: `${game?.icon || '🎮'} New challenge`, action: open, timeout: 8000, tag });
    systemNotify('New challenge', `${other} challenged you to ${gameName}${stake}`, { tag: `match-${match.id}`, url });
    return;
  }
  if (!previous) return;

  if (previous.status === 'pending' && match.status === 'active' && match.player1_id === uid) {
    toast(`${other} accepted your ${gameName} challenge.`, { type: 'success', action: open, tag });
    systemNotify(`${gameName} is on`, `${other} accepted your challenge`, { tag: `match-${match.id}`, url });
  } else if (previous.status === 'pending' && match.status === 'declined' && match.player1_id === uid) {
    toast(`${other} declined your ${gameName} challenge.`, { type: 'info', tag });
  } else if (match.status === 'finished' && previous.status !== 'finished') {
    const prize = match.stake * 2 + match.reward;
    if (!match.winner_id) toast(`${gameName} vs ${other} ended in a draw. Stakes refunded.`, { type: 'info', action: open, tag });
    else if (match.winner_id === uid) toast(`You won ${gameName} vs ${other}! +${prize} kudos`, { type: 'kudos', action: open, tag });
    else toast(`${other} won ${gameName}.`, { type: 'info', action: open, tag });
    systemNotify(`${gameName} finished`, match.winner_id === uid ? `You beat ${other}!` : `${other} won this one.`, { tag: `match-${match.id}`, url });
  } else if (match.status === 'active' && match.current_turn === uid && previous.current_turn !== uid) {
    toast(`Your move in ${gameName} vs ${other}.`, { type: 'info', action: open, tag });
    systemNotify(`Your move in ${gameName}`, `${other} is waiting for you`, { tag: `match-${match.id}`, url });
  }
}

function handleMessage(change) {
  if (change.eventType !== 'INSERT') return;
  const msg = change.new;
  if (msg.user_id === store.userId) return;
  const onChat = store.route.name === 'chat' && document.visibilityState === 'visible';
  if (!onChat) {
    setUnreadChat(store.unread.chat + 1);
    if (store.route.name !== 'chat') {
      toast(msg.content.length > 90 ? `${msg.content.slice(0, 90)}…` : msg.content, {
        title: nameOf(msg.user_id),
        type: 'info',
        action: { label: 'Reply', onClick: () => { location.hash = '#/chat'; } },
      });
    }
    systemNotify(nameOf(msg.user_id), msg.content.slice(0, 140), { tag: 'chat', url: '#/chat' });
  }
}

function handleKudos(change) {
  if (change.eventType !== 'INSERT') return;
  const row = change.new;
  if (row.recipient_id !== store.userId || row.sender_id === store.userId || !row.sender_id) return;
  toast(`"${row.message}"`, { type: 'kudos', title: `${nameOf(row.sender_id)} sent you +${row.points} kudos` });
  celebrate(document.querySelector('.user-chip .kudos-pill'), '⭐', 12);
  systemNotify(`+${row.points} kudos from ${nameOf(row.sender_id)}`, row.message, { tag: 'kudos', url: '#/hub' });
}

export function handleChange(change) {
  const { table, eventType } = change;
  switch (table) {
    case 'profiles':
      if (eventType === 'DELETE') removeProfile(change.old?.id);
      else upsertProfile(change.new);
      break;
    case 'shop_items':
      if (eventType === 'DELETE' || change.new?.active === false) removeItem(change.old?.id || change.new?.id);
      else upsertItem(change.new);
      break;
    case 'user_inventory':
      if (eventType === 'DELETE') removeInventory(change.old?.id);
      else upsertInventory(change.new);
      break;
    case 'game_matches':
      handleMatch(change);
      break;
    case 'messages':
      handleMessage(change);
      break;
    case 'kudos_feed':
      handleKudos(change);
      break;
    default:
      break;
  }
  emit(`db:${table}`, change);
  if (table === 'game_matches' || table === 'messages') updateBadges();
}

export function startSync() {
  stopSync();
  const backend = store.backend;

  stopFns.push(backend.subscribeAll(handleChange, (status) => {
    const previous = store.connection;
    setConnection(status);
    if (status === 'connected' && previous === 'disconnected') resync();
  }));

  stopFns.push(backend.onPresence((ids) => {
    setOnline(ids);
    refreshPresenceDots();
  }));
  backend.joinPresence(store.userId);

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      hiddenSince = Date.now();
    } else {
      if (hiddenSince && Date.now() - hiddenSince > 20000) resync();
      hiddenSince = 0;
      if (store.route.name === 'chat') setUnreadChat(0);
      updateBadges();
    }
  };
  const onOnline = () => resync();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', onOnline);
  stopFns.push(() => document.removeEventListener('visibilitychange', onVisibility));
  stopFns.push(() => window.removeEventListener('online', onOnline));

  updateBadges();
}

export function stopSync() {
  stopFns.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
  stopFns = [];
  if (store.backend) {
    try {
      store.backend.leavePresence();
    } catch {
      /* ignore */
    }
  }
}

