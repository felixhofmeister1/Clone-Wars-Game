/** Profile: identity, avatar & name editing, badge/title, family, app settings. */
import { hardcodedConfig, resolveConfig, buildSetupLink, clearSavedConfig } from '../backend/index.js';
import { PRESET_AVATARS, resolveAvatar } from '../data/avatars.js';
import { emit, onMany } from '../core/bus.js';
import { icon } from '../core/icons.js';
import {
  notificationsSupported, notificationsEnabled, enableNotifications, disableNotifications,
} from '../core/notify.js';
import { canPromptInstall, promptInstall, isIOS, isStandalone } from '../core/pwa.js';
import {
  store, me, familyMembers, ownedItems, upsertProfile,
} from '../core/store.js';
import {
  avatarHTML, nameHTML, equippedTitle, toast, showError, withBusy, confirmDialog, emptyState, kudosPill,
} from '../core/ui.js';
import { esc, $, $$, formatNumber, formatDate, isValidHttpUrl } from '../core/utils.js';
import { equip, itemArtHTML } from './shop.js';

export function mount(root) {
  let receivedTotal = null;

  root.innerHTML = `
    <div class="profile">
      <section class="card profile__card" data-identity></section>

      <section class="card profile__edit">
        <header class="card__header"><h2 class="card__title">${icon('edit')} Edit profile</h2></header>
        <form class="form" data-profile-form novalidate>
          <label class="field">
            <span class="field__label">Display name</span>
            <input class="input" name="username" maxlength="24" autocomplete="nickname" required>
          </label>
          <fieldset class="field">
            <legend class="field__label">Avatar</legend>
            <div class="avatar-picker" data-avatar-picker>
              ${PRESET_AVATARS.map((a) => `
                <label class="avatar-option" title="${esc(a.key)}">
                  <input type="radio" name="avatar" value="preset:${esc(a.key)}">
                  <span class="avatar avatar--md" style="--avatar-bg:${esc(a.bg)}"><span class="avatar__emoji">${a.emoji}</span></span>
                </label>`).join('')}
              <label class="avatar-option avatar-option--custom" title="Custom image">
                <input type="radio" name="avatar" value="custom">
                <span class="avatar avatar--md avatar--custom-choice">${icon('link')}</span>
              </label>
            </div>
          </fieldset>
          <div class="field" data-custom-field hidden>
            <label class="field__label" for="avatar-url">Custom image URL</label>
            <div class="input-row">
              <input class="input" id="avatar-url" name="avatarUrl" type="url" inputmode="url" placeholder="https://example.com/me.jpg" autocomplete="off">
              <span class="avatar avatar--md avatar--preview" data-custom-preview></span>
            </div>
            <span class="field__hint">Use a direct link to a square picture (https://…).</span>
          </div>
          <p class="form__error" role="alert" hidden></p>
          <div class="form__actions">
            <button type="submit" class="btn btn--primary">${icon('check')} Save profile</button>
          </div>
        </form>
      </section>

      <section class="card profile__flair">
        <header class="card__header"><h2 class="card__title">${icon('trophy')} Badge &amp; chat title</h2></header>
        <div data-flair></div>
      </section>

      <section class="card profile__family">
        <header class="card__header"><h2 class="card__title">${icon('users')} Family</h2></header>
        <ul class="family-list" data-family></ul>
      </section>

      <section class="card profile__settings">
        <header class="card__header"><h2 class="card__title">${icon('settings')} App &amp; account</h2></header>
        <div class="settings-list" data-settings></div>
      </section>
    </div>`;

  const form = $('[data-profile-form]', root);
  const errorEl = $('.form__error', form);
  const customField = $('[data-custom-field]', root);
  const customInput = $('#avatar-url', root);
  const customPreview = $('[data-custom-preview]', root);

  function fillForm() {
    const profile = me();
    $('[name=username]', form).value = profile.username;
    const current = profile.avatar_url || '';
    const presetInput = $$('[name=avatar]', form).find((input) => input.value === current);
    if (presetInput) {
      presetInput.checked = true;
      customField.hidden = true;
    } else {
      $('[name=avatar][value=custom]', form).checked = true;
      customField.hidden = false;
      customInput.value = resolveAvatar(current).kind === 'image' ? current : '';
      updateCustomPreview();
    }
  }

  function updateCustomPreview() {
    const url = customInput.value.trim();
    customPreview.innerHTML = isValidHttpUrl(url)
      ? `<img class="avatar__img" src="${esc(url)}" alt="" referrerpolicy="no-referrer" data-fallback="?">`
      : '<span class="avatar__initials">?</span>';
  }

  function stats() {
    const finished = [...store.matches.values()].filter((m) => m.status === 'finished');
    const wins = finished.filter((m) => m.winner_id === store.userId).length;
    return { played: finished.length, wins };
  }

  function renderIdentity() {
    const profile = me();
    const title = equippedTitle(profile);
    const { played, wins } = stats();
    $('[data-identity]', root).innerHTML = `
      <div class="profile__identity">
        ${avatarHTML(profile, { size: 'xl' })}
        <div class="profile__who">
          <h2 class="profile__name">${nameHTML(profile)}</h2>
          ${title ? `<p class="chat-title chat-title--lg">${esc(title)}</p>` : ''}
          <p class="muted">${esc(store.session?.user?.email || '')}</p>
          <p class="muted small">Member since ${esc(formatDate(new Date(profile.created_at), { month: 'long', year: 'numeric' }))}</p>
        </div>
      </div>
      <dl class="profile__stats">
        <div><dt>Balance</dt><dd>${kudosPill(formatNumber(profile.kudos_balance))}</dd></div>
        <div><dt>Kudos received</dt><dd>${receivedTotal === null ? '…' : formatNumber(receivedTotal)}</dd></div>
        <div><dt>Recent wins</dt><dd>${wins}</dd></div>
        <div><dt>Games played</dt><dd>${played}</dd></div>
      </dl>`;
  }

  function renderFlair() {
    const profile = me();
    const owned = ownedItems();
    const badges = owned.filter((i) => i.type === 'badge');
    const titles = owned.filter((i) => i.type === 'title');
    const container = $('[data-flair]', root);
    if (!badges.length && !titles.length) {
      container.innerHTML = `${emptyState('🏅', 'Buy a badge or chat title in the shop to show it off here.')}<a class="btn btn--soft btn--block" href="#/shop">${icon('shop')} Visit the shop</a>`;
      return;
    }
    const select = (label, slot, items, current) => `
      <label class="field">
        <span class="field__label">${label}</span>
        <select class="input" data-slot="${slot}">
          <option value="">None</option>
          ${items.map((i) => `<option value="${esc(i.id)}" ${current === i.id ? 'selected' : ''}>${esc(i.icon)} ${esc(i.name.replace(/^Title:\s*/, ''))}</option>`).join('')}
        </select>
      </label>`;
    container.innerHTML = `
      <div class="form__row">
        ${select('Badge (shown next to your name)', 'badge', badges, profile.equipped_badge)}
        ${select('Chat title (shown in chat)', 'title', titles, profile.equipped_title)}
      </div>
      <div class="collection collection--compact">
        ${owned.map((item) => `<span class="collection__item" title="${esc(item.name)}"><span class="item-art item-art--sm">${itemArtHTML(item)}</span></span>`).join('')}
      </div>`;
  }

  function renderFamily() {
    const members = familyMembers();
    $('[data-family]', root).innerHTML = members.map((p) => {
      const title = equippedTitle(p);
      return `
        <li class="family-list__item">
          ${avatarHTML(p, { size: 'md' })}
          <div class="family-list__who">
            ${nameHTML(p, { you: true })}
            ${title ? `<span class="chat-title">${esc(title)}</span>` : ''}
            <span class="family-list__status">${store.online.has(p.id) ? 'Online now' : 'Offline'}</span>
          </div>
          ${kudosPill(formatNumber(p.kudos_balance))}
        </li>`;
    }).join('');
  }

  function renderSettings() {
    const config = resolveConfig();
    const hardcoded = !!hardcodedConfig();
    const rows = [];

    if (!isStandalone()) {
      if (canPromptInstall()) {
        rows.push(`
          <div class="setting">
            <div><strong>Install the app</strong><p class="muted">Add Family Portal to your home screen or desktop.</p></div>
            <button type="button" class="btn btn--soft btn--sm" data-install>${icon('download')} Install</button>
          </div>`);
      } else if (isIOS()) {
        rows.push(`
          <div class="setting">
            <div><strong>Install on iPhone / iPad</strong><p class="muted">Tap the Share button in Safari, then <b>Add to Home Screen</b>.</p></div>
          </div>`);
      }
    }

    if (notificationsSupported()) {
      rows.push(`
        <div class="setting">
          <div><strong>Notifications</strong><p class="muted">Alerts for messages, kudos and your turn while the app is in the background.</p></div>
          <label class="switch"><input type="checkbox" data-notifications ${notificationsEnabled() ? 'checked' : ''}><span class="switch__track"></span><span class="sr-only">Notifications</span></label>
        </div>`);
    }

    if (store.backend.kind === 'supabase' && config?.kind === 'supabase') {
      rows.push(`
        <div class="setting">
          <div><strong>Invite family</strong><p class="muted">Share this link. It opens the portal already connected to your family's project.</p></div>
          <button type="button" class="btn btn--soft btn--sm" data-invite>${icon('copy')} Copy link</button>
        </div>`);
    } else {
      rows.push(`
        <div class="setting">
          <div><strong>Demo mode</strong><p class="muted">Everything is stored in this browser. Open another tab and create a second account to play or chat with "someone else".</p></div>
        </div>`);
    }

    rows.push(`
      <div class="setting">
        <div><strong>Password</strong><p class="muted">Change the password you sign in with.</p></div>
        <button type="button" class="btn btn--ghost btn--sm" data-password>Change</button>
      </div>`);

    rows.push(`
      <div class="setting">
        <div><strong>Connection</strong><p class="muted">${esc(store.backend.label)}</p></div>
        ${hardcoded ? '' : '<button type="button" class="btn btn--ghost btn--sm" data-connection>Change</button>'}
      </div>`);

    rows.push(`
      <div class="setting setting--danger">
        <div><strong>Sign out</strong><p class="muted">You can sign back in on any device.</p></div>
        <button type="button" class="btn btn--danger btn--sm" data-signout>${icon('logout')} Sign out</button>
      </div>`);

    $('[data-settings]', root).innerHTML = rows.join('');
  }

  function renderAll() {
    renderIdentity();
    renderFlair();
    renderFamily();
    renderSettings();
  }

  form.addEventListener('change', (event) => {
    if (event.target.name === 'avatar') {
      customField.hidden = event.target.value !== 'custom';
      if (event.target.value === 'custom') customInput.focus();
    }
  });
  customInput.addEventListener('input', updateCustomPreview);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    const data = Object.fromEntries(new FormData(form));
    const username = String(data.username || '').trim().replace(/\s+/g, ' ');
    let avatarUrl = String(data.avatar || '');
    const fail = (message) => {
      errorEl.textContent = message;
      errorEl.hidden = false;
    };
    if (username.length < 2 || username.length > 24) return fail('Display names need 2–24 characters.');
    if (avatarUrl === 'custom') {
      avatarUrl = customInput.value.trim();
      if (!isValidHttpUrl(avatarUrl)) return fail('Enter a full image URL starting with https://');
      if (avatarUrl.length > 1000) return fail('That image URL is too long.');
    }
    return withBusy($('[type=submit]', form), async () => {
      try {
        const updated = await store.backend.updateProfile(store.userId, { username, avatar_url: avatarUrl || null });
        upsertProfile(updated);
        toast('Profile saved.', { type: 'success' });
      } catch (err) {
        fail(err.message);
      }
    });
  });

  root.addEventListener('change', async (event) => {
    const select = event.target.closest('[data-slot]');
    if (select) {
      const item = select.value ? store.items.get(select.value) : { type: select.dataset.slot, id: null };
      select.disabled = true;
      try {
        await equip(item, !!select.value);
        toast(select.value ? 'Equipped!' : 'Removed.', { type: 'success' });
      } catch (err) {
        showError(err);
        renderFlair();
      } finally {
        select.disabled = false;
      }
    }
    const toggle = event.target.closest('[data-notifications]');
    if (toggle) {
      try {
        if (toggle.checked) {
          await enableNotifications();
          toast('Notifications are on.', { type: 'success' });
        } else {
          disableNotifications();
        }
      } catch (err) {
        toggle.checked = false;
        showError(err);
      }
    }
  });

  root.addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.matches('[data-install]')) {
      await promptInstall();
      renderSettings();
    } else if (target.matches('[data-invite]')) {
      const link = buildSetupLink(resolveConfig());
      try {
        if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
          await navigator.share({ title: 'Join our Family Portal', text: 'Open this link to join our family portal:', url: link });
        } else {
          await navigator.clipboard.writeText(link);
          toast('Invite link copied. Send it to your family!', { type: 'success' });
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          window.prompt('Copy this invite link:', link);
        }
      }
    } else if (target.matches('[data-password]')) {
      emit('change-password');
    } else if (target.matches('[data-connection]')) {
      const ok = await confirmDialog({
        title: 'Change connection?',
        message: 'You will be signed out on this device and can connect to a different project or demo mode.',
        confirmText: 'Change',
      });
      if (!ok) return;
      try {
        await store.backend.signOut();
      } catch {
        /* switching anyway */
      }
      clearSavedConfig();
      location.hash = '';
      location.reload();
    } else if (target.matches('[data-signout]')) {
      const ok = await confirmDialog({ title: 'Sign out?', confirmText: 'Sign out' });
      if (ok) emit('sign-out');
    }
  });

  const offBus = onMany({
    me: () => {
      renderIdentity();
      renderFlair();
      renderFamily();
    },
    profiles: renderFamily,
    presence: renderFamily,
    items: renderFlair,
    inventory: renderFlair,
    matches: renderIdentity,
    installable: renderSettings,
    resync: renderAll,
  });

  renderAll();
  fillForm();
  store.backend.kudosReceivedTotal(store.userId)
    .then((total) => {
      receivedTotal = total;
      renderIdentity();
    })
    .catch(() => {
      receivedTotal = 0;
      renderIdentity();
    });

  return offBus;
}
