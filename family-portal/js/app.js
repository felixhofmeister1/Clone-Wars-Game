/**
 * Family Portal: bootstrap, authentication gate, app shell and hash router.
 */
import {
  resolveConfig, createBackend, consumeSetupLink, hardcodedConfig, clearSavedConfig,
} from './backend/index.js';
import { on, onMany } from './core/bus.js';
import { icon } from './core/icons.js';
import { registerServiceWorker } from './core/pwa.js';
import { store, resetStore, me, setUnreadChat } from './core/store.js';
import { loadCoreData, startSync, stopSync, updateBadges } from './core/sync.js';
import {
  avatarHTML, toast, showError, openModal, kudosPill, withBusy, celebrate,
} from './core/ui.js';
import { esc, $, $$, sleep, formatNumber, el } from './core/utils.js';

const root = document.getElementById('app');

const NAV = [
  { name: 'hub', label: 'Hub', icon: 'home', title: 'Family Hub' },
  { name: 'chat', label: 'Chat', icon: 'chat', title: 'Family Chat' },
  { name: 'games', label: 'Games', icon: 'games', title: 'Arcade' },
  { name: 'shop', label: 'Shop', icon: 'shop', title: 'Kudos Shop' },
  { name: 'profile', label: 'Profile', icon: 'user', title: 'Profile' },
];

const VIEWS = {
  hub: () => import('./views/hub.js'),
  chat: () => import('./views/chat.js'),
  games: () => import('./views/games.js'),
  match: () => import('./views/match.js'),
  shop: () => import('./views/shop.js'),
  profile: () => import('./views/profile.js'),
};

let screenCleanup = null;
let viewCleanup = null;
let shellOff = null;
let entering = null;
let routeToken = 0;
let pendingRecovery = false;

// ------------------------------------------------------------------ screens

function cleanupScreen() {
  if (screenCleanup) {
    try {
      screenCleanup();
    } catch (err) {
      console.warn(err);
    }
  }
  screenCleanup = null;
}

function showSplash(text = 'Loading…') {
  cleanupScreen();
  root.innerHTML = `
    <div class="splash" role="status">
      <img class="splash__logo" src="icons/icon.svg" alt="" width="84" height="84">
      <p class="splash__text">${esc(text)}</p>
      <span class="spinner" aria-hidden="true"></span>
    </div>`;
}

function showFatal(title, message, { allowChange = true } = {}) {
  cleanupScreen();
  destroyView();
  root.innerHTML = `
    <div class="splash">
      <div class="card fatal">
        <h1 class="fatal__title">${esc(title)}</h1>
        <p class="fatal__message">${esc(message)}</p>
        <div class="fatal__actions">
          <button type="button" class="btn btn--primary" data-retry>${icon('rotate')} Try again</button>
          ${allowChange && !hardcodedConfig() ? '<button type="button" class="btn btn--ghost" data-change>Change connection</button>' : ''}
        </div>
      </div>
    </div>`;
  $('[data-retry]', root).addEventListener('click', () => location.reload());
  $('[data-change]', root)?.addEventListener('click', () => {
    clearSavedConfig();
    location.reload();
  });
}

async function showConnect() {
  cleanupScreen();
  const { mountConnect } = await import('./views/auth.js');
  screenCleanup = mountConnect(root, { onConnected: (config) => startBackend(config) });
}

async function showAuth() {
  cleanupScreen();
  destroyShell();
  const { mountAuth } = await import('./views/auth.js');
  screenCleanup = mountAuth(root, {
    backend: store.backend,
    canChangeConnection: !hardcodedConfig(),
    onSignedIn: (session) => enterApp(session),
    onChangeConnection: async () => {
      clearSavedConfig();
      store.backend?.destroy?.();
      store.backend = null;
      showConnect();
    },
  });
}

// ------------------------------------------------------------------ backend & session

async function startBackend(config) {
  showSplash('Connecting…');
  let backend;
  try {
    backend = await createBackend(config);
  } catch (err) {
    console.error(err);
    showFatal(
      "Couldn't start the app",
      navigator.onLine
        ? 'The Supabase library could not be loaded. Check that cdn.jsdelivr.net is reachable, then try again.'
        : 'You appear to be offline. Connect to the internet and try again.',
    );
    return;
  }
  store.backend?.destroy?.();
  store.backend = backend;
  backend.onAuthChange(onAuthChange);

  let session = null;
  try {
    session = await backend.getSession();
  } catch (err) {
    console.warn('[app] getSession failed', err);
  }
  if (session) await enterApp(session);
  else await showAuth();
}

async function onAuthChange(session, event) {
  if (event === 'PASSWORD_RECOVERY') pendingRecovery = true;
  if (!session) {
    if (store.session) {
      leaveApp();
      await showAuth();
    }
    return;
  }
  if (!store.session || store.session.user.id !== session.user.id) {
    if (store.session) leaveApp();
    await enterApp(session);
  }
  if (pendingRecovery && store.session) {
    pendingRecovery = false;
    openPasswordModal(true);
  }
}

function enterApp(session) {
  if (entering) return entering;
  if (store.session?.user.id === session.user.id && $('.shell', root)) return Promise.resolve();
  entering = (async () => {
    cleanupScreen();
    showSplash('Loading your family…');
    store.session = session;
    store.userId = session.user.id;
    try {
      await loadCoreData();
      for (let attempt = 0; !me() && attempt < 6; attempt += 1) {
        await sleep(700);
        await loadCoreData();
      }
      if (!me()) throw new Error('Your profile could not be found. Make sure supabase/schema.sql has been run on this project.');
    } catch (err) {
      console.error(err);
      store.session = null;
      store.userId = null;
      showFatal('Could not load your Family Portal', err.message || 'Unknown error');
      return;
    }
    renderShell();
    startSync();
    await route();
    if (pendingRecovery) {
      pendingRecovery = false;
      openPasswordModal(true);
    }
  })().finally(() => {
    entering = null;
  });
  return entering;
}

function leaveApp() {
  stopSync();
  destroyView();
  destroyShell();
  resetStore();
  root.innerHTML = '';
}

export async function signOut() {
  try {
    await store.backend.signOut();
  } catch (err) {
    showError(err);
  }
  if (store.session) {
    leaveApp();
    await showAuth();
  }
}

// ------------------------------------------------------------------ shell

function navLink(item) {
  return `
    <a class="nav-link" href="#/${item.name}" data-nav="${item.name}">
      <span class="nav-link__icon">${icon(item.icon)}<span class="nav-badge" data-badge="${item.name}" hidden></span></span>
      <span class="nav-link__label">${item.label}</span>
    </a>`;
}

function renderShell() {
  destroyShell();
  root.innerHTML = `
    <div class="shell">
      <a class="skip-link" href="#view">Skip to content</a>
      <aside class="sidebar">
        <a class="brand" href="#/hub">
          <img class="brand__logo" src="icons/icon.svg" alt="" width="40" height="40">
          <span class="brand__text"><span class="brand__name">Family Portal</span><span class="brand__sub">${store.backend.kind === 'local' ? 'Demo mode' : 'Together, anywhere'}</span></span>
        </a>
        <nav class="sidenav" aria-label="Main">${NAV.map(navLink).join('')}</nav>
        <div class="sidebar__footer">
          <span class="conn" data-conn><span class="conn__dot"></span><span class="conn__label">Connecting…</span></span>
        </div>
      </aside>
      <div class="shell__main">
        <header class="topbar">
          <div class="topbar__left">
            <img class="topbar__logo" src="icons/icon.svg" alt="" width="32" height="32">
            <h1 class="topbar__title" id="page-title">Family Hub</h1>
            ${store.backend.kind === 'local' ? '<span class="demo-tag" title="Data is stored in this browser only">Demo</span>' : ''}
          </div>
          <div class="topbar__right">
            <span class="conn conn--compact" data-conn><span class="conn__dot"></span><span class="conn__label">Connecting…</span></span>
            <a class="user-chip" href="#/profile" data-user-chip aria-label="Your profile"></a>
          </div>
        </header>
        <div class="offline-banner" data-offline ${navigator.onLine ? 'hidden' : ''}>${icon('wifiOff')}<span>You're offline. You can look around, but changes need a connection.</span></div>
        <main id="view" class="view" tabindex="-1"></main>
      </div>
      <nav class="bottom-nav" aria-label="Main">${NAV.map(navLink).join('')}</nav>
    </div>`;

  renderUserChip(null);
  renderConnection(store.connection);
  $('.skip-link', root).addEventListener('click', (event) => {
    event.preventDefault();
    $('#view', root)?.focus();
  });

  const onOffline = () => $('[data-offline]', root)?.removeAttribute('hidden');
  const onOnline = () => $('[data-offline]', root)?.setAttribute('hidden', '');
  window.addEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);

  const offBus = onMany({
    me: ({ previous }) => renderUserChip(previous),
    connection: renderConnection,
    badges: renderBadges,
    matches: () => updateBadges(),
  });
  shellOff = () => {
    offBus();
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('online', onOnline);
  };
}

function destroyShell() {
  if (shellOff) shellOff();
  shellOff = null;
}

function renderUserChip(previous) {
  const chip = $('[data-user-chip]', root);
  const profile = me();
  if (!chip || !profile) return;
  chip.innerHTML = `
    ${avatarHTML(profile, { size: 'sm', presence: false })}
    <span class="user-chip__name">${esc(profile.username)}</span>
    ${kudosPill(formatNumber(profile.kudos_balance))}`;
  const delta = previous ? profile.kudos_balance - previous.kudos_balance : 0;
  if (delta !== 0) {
    const pill = $('.kudos-pill', chip);
    pill.classList.add(delta > 0 ? 'is-up' : 'is-down');
    const float = el(`<span class="kudos-float ${delta > 0 ? 'is-up' : 'is-down'}">${delta > 0 ? '+' : ''}${delta}</span>`);
    chip.append(float);
    float.addEventListener('animationend', () => float.remove());
    if (delta > 0) celebrate(pill, '⭐', 8);
  }
}

function renderConnection(status) {
  const labels = { connected: 'Live', connecting: 'Connecting…', disconnected: 'Reconnecting…' };
  $$('[data-conn]', root).forEach((node) => {
    node.className = `${node.classList.contains('conn--compact') ? 'conn conn--compact' : 'conn'} conn--${status}`;
    node.title = status === 'connected' ? 'Live updates are on' : labels[status];
    const label = $('.conn__label', node);
    if (label) label.textContent = labels[status] || status;
  });
}

function renderBadges({ games, chat }) {
  $$('[data-badge="games"]', root).forEach((badge) => {
    badge.textContent = games > 9 ? '9+' : String(games);
    badge.hidden = games === 0;
  });
  $$('[data-badge="chat"]', root).forEach((badge) => {
    badge.textContent = chat > 9 ? '9+' : String(chat);
    badge.hidden = chat === 0;
  });
}

// ------------------------------------------------------------------ router

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [rawName, rawId] = hash.split('/');
  const name = decodeURIComponent(rawName || '');
  if (!NAV.some((item) => item.name === name)) return { name: 'hub', params: {} };
  const id = rawId ? decodeURIComponent(rawId) : '';
  return { name, params: id && name === 'games' ? { id } : {} };
}

function destroyView() {
  if (viewCleanup) {
    try {
      viewCleanup();
    } catch (err) {
      console.warn('[router] view cleanup failed', err);
    }
  }
  viewCleanup = null;
}

async function route() {
  const previousView = $('#view', root);
  if (!store.session || !previousView) return;
  const token = ++routeToken;
  const next = parseRoute();
  const canonical = `#/${next.name}${next.params.id ? `/${encodeURIComponent(next.params.id)}` : ''}`;
  if (location.hash !== canonical) history.replaceState(null, '', canonical);

  destroyView();
  // Each page gets a fresh <main> so listeners from the previous page can't leak.
  const viewEl = previousView.cloneNode(false);
  previousView.replaceWith(viewEl);
  store.route = next;
  const isMatch = !!next.params.id;
  $$('[data-nav]', root).forEach((link) => {
    const active = link.dataset.nav === next.name;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const navItem = NAV.find((item) => item.name === next.name);
  $('#page-title', root).textContent = isMatch ? 'Match' : navItem.title;
  document.body.dataset.route = isMatch ? 'match' : next.name;
  viewEl.className = `view view--${isMatch ? 'match' : next.name}`;
  viewEl.innerHTML = '<div class="view-loading"><span class="spinner" aria-hidden="true"></span></div>';
  if (next.name === 'chat') setUnreadChat(0);
  updateBadges();

  try {
    const mod = await (isMatch ? VIEWS.match : VIEWS[next.name])();
    if (token !== routeToken) return;
    viewEl.innerHTML = '';
    viewCleanup = mod.mount(viewEl, next.params) || null;
    window.scrollTo(0, 0);
    // Move focus into the new page (screen readers announce it; nothing is left focused on removed nodes).
    if (!document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected) {
      viewEl.focus({ preventScroll: true });
    }
  } catch (err) {
    if (token !== routeToken) return;
    console.error(err);
    viewEl.innerHTML = `
      <div class="card error-card">
        <h2>This page couldn't load</h2>
        <p>${esc(navigator.onLine ? 'Something went wrong while opening it.' : 'You are offline and this page has not been saved for offline use yet.')}</p>
        <button type="button" class="btn btn--primary" data-reload>${icon('rotate')} Reload</button>
      </div>`;
    $('[data-reload]', viewEl).addEventListener('click', () => location.reload());
  }
}

window.addEventListener('hashchange', () => {
  if (store.session && $('.shell', root)) route();
});

// ------------------------------------------------------------------ password recovery / change

export function openPasswordModal(recovery = false) {
  const form = el(`
    <form class="form" novalidate>
      ${recovery ? '<p class="muted">Choose a new password for your account.</p>' : ''}
      <label class="field">
        <span class="field__label">New password</span>
        <input class="input" type="password" name="password" minlength="6" autocomplete="new-password" required>
      </label>
      <label class="field">
        <span class="field__label">Repeat new password</span>
        <input class="input" type="password" name="confirm" minlength="6" autocomplete="new-password" required>
      </label>
      <p class="form__error" role="alert" hidden></p>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" data-modal-close>Cancel</button>
        <button type="submit" class="btn btn--primary">Save password</button>
      </div>
    </form>`);
  const modal = openModal({ title: recovery ? 'Reset your password' : 'Change password', content: form, size: 'sm' });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const errorEl = $('.form__error', form);
    const { password, confirm } = Object.fromEntries(new FormData(form));
    errorEl.hidden = true;
    if (String(password).length < 6) {
      errorEl.textContent = 'Passwords need at least 6 characters.';
      errorEl.hidden = false;
      return;
    }
    if (password !== confirm) {
      errorEl.textContent = 'The passwords do not match.';
      errorEl.hidden = false;
      return;
    }
    withBusy($('[type=submit]', form), async () => {
      try {
        await store.backend.updatePassword(String(password));
        modal.close(true);
        toast('Password updated.', { type: 'success' });
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }
    });
  });
}

// ------------------------------------------------------------------ boot

function boot() {
  registerServiceWorker();
  consumeSetupLink();
  on('sign-out', signOut);
  on('change-password', () => openPasswordModal(false));
  const config = resolveConfig();
  if (!config) {
    showConnect();
    return;
  }
  startBackend(config);
}

boot();
