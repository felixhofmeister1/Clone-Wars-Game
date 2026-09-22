/** Shared UI building blocks: toasts, modals, avatars, names, busy buttons. */
import { resolveAvatar, initials } from '../data/avatars.js';
import { icon } from './icons.js';
import { store } from './store.js';
import { esc, el, hashHue, prefersReducedMotion } from './utils.js';

// ---------------------------------------------------------------- toasts

let toastHost = null;

function ensureToastHost() {
  if (toastHost && document.body.contains(toastHost)) return toastHost;
  toastHost = el('<div class="toasts" role="region" aria-label="Notifications" aria-live="polite"></div>');
  document.body.append(toastHost);
  return toastHost;
}

/**
 * toast('Saved!', { type: 'success' | 'error' | 'info' | 'kudos', timeout, action: { label, onClick } })
 */
export function toast(message, { type = 'info', timeout = 4200, action = null, title = '', tag = '' } = {}) {
  const host = ensureToastHost();
  if (tag) dismissToasts(tag);
  const glyph = { success: 'check', error: 'x', kudos: 'star', info: 'bell' }[type] || 'bell';
  const node = el(`
    <div class="toast toast--${esc(type)}" role="${type === 'error' ? 'alert' : 'status'}">
      <span class="toast__icon">${icon(glyph)}</span>
      <div class="toast__text">
        ${title ? `<strong>${esc(title)}</strong>` : ''}
        <span>${esc(message)}</span>
      </div>
      ${action ? `<button type="button" class="toast__action">${esc(action.label)}</button>` : ''}
      <button type="button" class="toast__close" aria-label="Dismiss">${icon('x')}</button>
    </div>`);
  let timer = 0;
  const dismiss = () => {
    clearTimeout(timer);
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 250);
  };
  if (tag) node.dataset.tag = tag;
  node.dismiss = dismiss;
  node.querySelector('.toast__close').addEventListener('click', dismiss);
  if (action) {
    node.querySelector('.toast__action').addEventListener('click', () => {
      dismiss();
      action.onClick();
    });
  }
  host.append(node);
  while (host.children.length > 4) host.firstElementChild.remove();
  if (timeout > 0) timer = setTimeout(dismiss, timeout);
  node.addEventListener('pointerenter', () => clearTimeout(timer));
  node.addEventListener('pointerleave', () => {
    if (timeout > 0) timer = setTimeout(dismiss, 2000);
  });
  return dismiss;
}

/** Dismiss every visible toast carrying `tag` (e.g. all notices about one match). */
export function dismissToasts(tag) {
  if (!toastHost) return;
  toastHost.querySelectorAll('.toast').forEach((node) => {
    if (node.dataset.tag === tag && typeof node.dismiss === 'function') node.dismiss();
  });
}

export function showError(err, fallback = 'Something went wrong.') {
  console.error(err);
  toast(err?.message || fallback, { type: 'error', timeout: 6000 });
}

// ---------------------------------------------------------------- modals

let modalCounter = 0;

/**
 * Opens a <dialog>. `content` may be an HTML string or a Node.
 * Returns { dialog, body, close(result) }; `onClose(result)` fires once.
 */
export function openModal({ title, content = '', size = 'md', onClose = null, className = '' }) {
  modalCounter += 1;
  const titleId = `modal-title-${modalCounter}`;
  const dialog = el(`
    <dialog class="modal modal--${esc(size)} ${esc(className)}" aria-labelledby="${titleId}">
      <div class="modal__panel">
        <header class="modal__header">
          <h2 class="modal__title" id="${titleId}">${esc(title)}</h2>
          <button type="button" class="icon-btn" data-modal-close aria-label="Close">${icon('x')}</button>
        </header>
        <div class="modal__body"></div>
      </div>
    </dialog>`);
  const body = dialog.querySelector('.modal__body');
  if (typeof content === 'string') body.innerHTML = content;
  else if (content) body.append(content);

  let result;
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    dialog.classList.add('is-leaving');
    setTimeout(() => dialog.remove(), 160);
    document.documentElement.classList.toggle('has-modal', document.querySelectorAll('dialog.modal[open]').length > 0);
    if (onClose) onClose(result);
  };
  const close = (value) => {
    if (closed) return;
    result = value;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else finish();
  };
  dialog.addEventListener('close', finish);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close(undefined);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close(undefined);
    if (event.target.closest('[data-modal-close]')) close(undefined);
  });

  document.body.append(dialog);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  document.documentElement.classList.add('has-modal');
  const focusTarget = body.querySelector('[autofocus], input:not([type=hidden]), textarea, select');
  if (focusTarget && !window.matchMedia('(pointer: coarse)').matches) focusTarget.focus();
  return { dialog, body, close };
}

export function confirmDialog({ title = 'Are you sure?', message = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const content = el(`
      <div class="confirm">
        ${message ? `<p class="confirm__message">${esc(message)}</p>` : ''}
        <div class="modal__actions">
          <button type="button" class="btn btn--ghost" data-answer="no">${esc(cancelText)}</button>
          <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-answer="yes">${esc(confirmText)}</button>
        </div>
      </div>`);
    const modal = openModal({ title, content, size: 'sm', onClose: (value) => resolve(value === true) });
    content.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-answer]');
      if (btn) modal.close(btn.dataset.answer === 'yes');
    });
    content.querySelector('[data-answer="yes"]').focus();
  });
}

// ---------------------------------------------------------------- avatars & names

export function avatarHTML(profile, { size = 'md', presence = true, className = '' } = {}) {
  const name = profile?.username || 'Unknown';
  const avatar = resolveAvatar(profile?.avatar_url);
  const online = presence && profile && store.online.has(profile.id);
  const presenceAttr = presence && profile ? ` data-presence="${esc(profile.id)}"` : '';
  const classes = `avatar avatar--${size} ${online ? 'is-online' : ''} ${className}`;
  const fallback = esc(initials(name));
  const hue = hashHue(profile?.id || name);
  if (avatar.kind === 'preset') {
    return `<span class="${classes}" style="--avatar-bg:${esc(avatar.bg)}" role="img" aria-label="${esc(name)}"${presenceAttr}><span class="avatar__emoji" aria-hidden="true">${avatar.emoji}</span></span>`;
  }
  if (avatar.kind === 'image') {
    return `<span class="${classes}" style="--avatar-bg:hsl(${hue} 70% 80%)" role="img" aria-label="${esc(name)}"${presenceAttr}><img class="avatar__img" src="${esc(avatar.url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback="${fallback}"></span>`;
  }
  return `<span class="${classes}" style="--avatar-bg:hsl(${hue} 70% 80%)" role="img" aria-label="${esc(name)}"${presenceAttr}><span class="avatar__initials" aria-hidden="true">${fallback}</span></span>`;
}

/** Broken custom avatar images fall back to initials (one global listener). */
document.addEventListener('error', (event) => {
  const img = event.target;
  if (img instanceof HTMLImageElement && img.classList.contains('avatar__img')) {
    const span = document.createElement('span');
    span.className = 'avatar__initials';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = img.dataset.fallback || '?';
    img.replaceWith(span);
  }
}, true);

export function equippedBadge(profile) {
  return profile?.equipped_badge ? store.items.get(profile.equipped_badge) || null : null;
}

export function equippedTitle(profile) {
  const item = profile?.equipped_title ? store.items.get(profile.equipped_title) : null;
  return item ? item.meta?.title || item.name.replace(/^Title:\s*/, '') : '';
}

/** Name with the equipped badge emoji. */
export function nameHTML(profile, { you = false } = {}) {
  const badge = equippedBadge(profile);
  const name = profile?.username || 'Former member';
  return `<span class="person-name">${esc(name)}${badge ? `<span class="person-name__badge" title="${esc(badge.name)}">${esc(badge.icon)}</span>` : ''}${you && profile?.id === store.userId ? '<span class="person-name__you">you</span>' : ''}</span>`;
}

/** Toggle online dots on every rendered avatar. */
export function refreshPresenceDots(root = document) {
  root.querySelectorAll('[data-presence]').forEach((node) => {
    node.classList.toggle('is-online', store.online.has(node.dataset.presence));
  });
}

// ---------------------------------------------------------------- misc

/** Disable a button with a spinner while `task` runs. Resolves with task's value. */
export async function withBusy(button, task) {
  if (!button) return task();
  if (button.dataset.busy === '1') return undefined;
  button.dataset.busy = '1';
  button.disabled = true;
  button.classList.add('is-busy');
  try {
    return await task();
  } finally {
    delete button.dataset.busy;
    button.disabled = false;
    button.classList.remove('is-busy');
  }
}

export function emptyState(glyph, text) {
  return `<div class="empty"><span class="empty__icon" aria-hidden="true">${glyph}</span><p>${esc(text)}</p></div>`;
}

/** Little emoji confetti burst from an element (or the centre of the screen). */
export function celebrate(anchor, emoji = '⭐', count = 14) {
  if (prefersReducedMotion()) return;
  const rect = anchor?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'burst';
    piece.textContent = emoji;
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const distance = 60 + Math.random() * 70;
    piece.style.left = `${originX}px`;
    piece.style.top = `${originY}px`;
    piece.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    piece.style.setProperty('--dy', `${Math.sin(angle) * distance - 40}px`);
    piece.style.setProperty('--rot', `${Math.random() * 360 - 180}deg`);
    document.body.append(piece);
    piece.addEventListener('animationend', () => piece.remove());
  }
}

export function kudosPill(amount, extra = '') {
  return `<span class="kudos-pill ${extra}">${icon('star')}<span>${esc(amount)}</span></span>`;
}
