/** Group chat: realtime feed, grouped bubbles, day separators, auto-scroll. */
import { onMany } from '../core/bus.js';
import { icon } from '../core/icons.js';
import { store, familyMembers, profileOf, setUnreadChat } from '../core/store.js';
import {
  avatarHTML, nameHTML, equippedTitle, showError, confirmDialog, emptyState, refreshPresenceDots,
} from '../core/ui.js';
import {
  esc, $, richText, formatClock, dayLabel, sameDay, isTouchDevice, delegate,
} from '../core/utils.js';

const PAGE = 60;
const GROUP_GAP_MS = 5 * 60 * 1000;

export function mount(root) {
  let messages = [];
  let hasMore = false;
  let loadingOlder = false;
  let sending = false;

  root.innerHTML = `
    <div class="chat">
      <header class="chat__header">
        <div class="chat__members" data-members></div>
        <p class="chat__online" data-online></p>
      </header>
      <div class="chat__scroll" data-scroll>
        <button type="button" class="btn btn--ghost btn--sm chat__older" data-older hidden>Load earlier messages</button>
        <div class="chat__list" data-list role="log" aria-live="polite" aria-label="Family chat messages"></div>
      </div>
      <button type="button" class="chat__jump" data-jump hidden>${icon('arrowDown')} New messages</button>
      <form class="chat__composer" data-composer autocomplete="off">
        <label class="sr-only" for="chat-input">Message</label>
        <textarea id="chat-input" class="chat__input" name="content" rows="1" maxlength="2000" placeholder="Message your family…"></textarea>
        <button type="submit" class="btn btn--primary chat__send" aria-label="Send message">${icon('send')}</button>
      </form>
    </div>`;

  const scroller = $('[data-scroll]', root);
  const list = $('[data-list]', root);
  const olderBtn = $('[data-older]', root);
  const jumpBtn = $('[data-jump]', root);
  const form = $('[data-composer]', root);
  const input = $('#chat-input', root);

  const nearBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 90;
  const scrollToBottom = (smooth = false) => {
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    jumpBtn.hidden = true;
  };

  function renderMembers() {
    const members = familyMembers();
    $('[data-members]', root).innerHTML = members.slice(0, 8).map((p) => avatarHTML(p, { size: 'sm' })).join('')
      + (members.length > 8 ? `<span class="avatar avatar--sm avatar--more">+${members.length - 8}</span>` : '');
    const online = members.filter((p) => store.online.has(p.id)).length;
    $('[data-online]', root).textContent = `${members.length} member${members.length === 1 ? '' : 's'} · ${online} online`;
  }

  function messageHTML(msg, { first, last }) {
    const mine = msg.user_id === store.userId;
    return `
      <div class="bubble-row ${mine ? 'is-mine' : ''} ${first ? 'is-first' : ''} ${last ? 'is-last' : ''}" data-id="${esc(msg.id)}">
        <div class="bubble" tabindex="0">
          <div class="bubble__text">${richText(msg.content)}</div>
          ${last ? `<time class="bubble__time" datetime="${esc(msg.created_at)}">${esc(formatClock(new Date(msg.created_at)))}</time>` : ''}
        </div>
        ${mine ? `<button type="button" class="bubble__delete" data-delete="${esc(msg.id)}" aria-label="Delete message">${icon('trash')}</button>` : ''}
      </div>`;
  }

  function render() {
    if (!messages.length) {
      list.innerHTML = emptyState('💬', 'Say hello to your family! Messages appear here instantly for everyone.');
      olderBtn.hidden = true;
      return;
    }
    const parts = [];
    let group = [];
    let previousDay = null;

    const flush = () => {
      if (!group.length) return;
      const author = profileOf(group[0].user_id);
      const mine = group[0].user_id === store.userId;
      const title = equippedTitle(author);
      parts.push(`
        <div class="msg-group ${mine ? 'is-mine' : ''}">
          ${mine ? '' : `<div class="msg-group__avatar">${avatarHTML(author, { size: 'sm' })}</div>`}
          <div class="msg-group__body">
            ${mine ? '' : `<div class="msg-group__author">${nameHTML(author)}${title ? `<span class="chat-title">${esc(title)}</span>` : ''}</div>`}
            ${group.map((m, i) => messageHTML(m, { first: i === 0, last: i === group.length - 1 })).join('')}
          </div>
        </div>`);
      group = [];
    };

    messages.forEach((msg) => {
      const date = new Date(msg.created_at);
      if (!previousDay || !sameDay(previousDay, date)) {
        flush();
        parts.push(`<div class="day-sep"><span>${esc(dayLabel(date))}</span></div>`);
        previousDay = date;
      }
      const last = group[group.length - 1];
      if (last && (last.user_id !== msg.user_id || date - new Date(last.created_at) > GROUP_GAP_MS)) flush();
      group.push(msg);
    });
    flush();
    list.innerHTML = parts.join('');
    olderBtn.hidden = !hasMore;
  }

  async function loadInitial() {
    list.innerHTML = '<div class="skeleton-list"><span></span><span></span><span></span></div>';
    try {
      const rows = await store.backend.listMessages({ limit: PAGE });
      messages = rows;
      hasMore = rows.length === PAGE;
      render();
      scrollToBottom();
    } catch (err) {
      list.innerHTML = emptyState('⚠️', 'Could not load messages. Pull to refresh or try again later.');
      console.warn(err);
    }
  }

  async function loadOlder() {
    if (loadingOlder || !messages.length) return;
    loadingOlder = true;
    olderBtn.disabled = true;
    const previousHeight = scroller.scrollHeight;
    const previousTop = scroller.scrollTop;
    try {
      const rows = await store.backend.listMessages({ before: messages[0].created_at, limit: PAGE });
      const known = new Set(messages.map((m) => m.id));
      messages = [...rows.filter((m) => !known.has(m.id)), ...messages];
      hasMore = rows.length === PAGE;
      render();
      scroller.scrollTop = scroller.scrollHeight - previousHeight + previousTop;
    } catch (err) {
      showError(err);
    } finally {
      loadingOlder = false;
      olderBtn.disabled = false;
    }
  }

  function addMessage(msg) {
    if (messages.some((m) => m.id === msg.id)) return;
    const stick = nearBottom() || msg.user_id === store.userId;
    messages.push(msg);
    messages.sort((a, b) => a.created_at.localeCompare(b.created_at));
    render();
    if (stick) scrollToBottom(true);
    else jumpBtn.hidden = false;
  }

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  }

  async function send() {
    const content = input.value.trim();
    if (!content || sending) return;
    sending = true;
    form.classList.add('is-sending');
    try {
      const row = await store.backend.sendMessage(content);
      input.value = '';
      autoGrow();
      addMessage(row);
    } catch (err) {
      showError(err);
    } finally {
      sending = false;
      form.classList.remove('is-sending');
      if (!isTouchDevice()) input.focus();
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    send();
  });
  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !isTouchDevice()) {
      event.preventDefault();
      send();
    }
  });
  olderBtn.addEventListener('click', loadOlder);
  jumpBtn.addEventListener('click', () => scrollToBottom(true));
  scroller.addEventListener('scroll', () => {
    if (nearBottom()) jumpBtn.hidden = true;
    if (scroller.scrollTop < 40 && hasMore) loadOlder();
  }, { passive: true });

  const offDelete = delegate(list, 'click', '[data-delete]', async (event, button) => {
    const ok = await confirmDialog({ title: 'Delete message?', message: 'It will disappear for everyone.', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await store.backend.deleteMessage(button.dataset.delete);
      messages = messages.filter((m) => m.id !== button.dataset.delete);
      render();
    } catch (err) {
      showError(err);
    }
  });

  // Keep the composer above the on-screen keyboard (iOS/Android).
  const viewport = window.visualViewport;
  const onViewport = () => {
    if (!viewport) return;
    const keyboard = window.innerHeight - viewport.height > 150;
    document.documentElement.classList.toggle('keyboard-open', keyboard);
    document.documentElement.style.setProperty('--vvh', `${viewport.height}px`);
    if (keyboard && nearBottom()) requestAnimationFrame(() => scrollToBottom());
  };
  viewport?.addEventListener('resize', onViewport);
  onViewport();

  const offBus = onMany({
    'db:messages': (change) => {
      if (change.eventType === 'INSERT') {
        addMessage(change.new);
        if (document.visibilityState === 'visible') setUnreadChat(0);
      } else if (change.eventType === 'DELETE') {
        const before = messages.length;
        messages = messages.filter((m) => m.id !== change.old?.id);
        if (messages.length !== before) render();
      }
    },
    profiles: () => {
      renderMembers();
      render();
    },
    presence: () => {
      renderMembers();
      refreshPresenceDots(root);
    },
    resync: loadInitial,
  });

  renderMembers();
  loadInitial();
  setUnreadChat(0);
  if (!isTouchDevice()) input.focus();

  return () => {
    offBus();
    offDelete();
    viewport?.removeEventListener('resize', onViewport);
    document.documentElement.classList.remove('keyboard-open');
    document.documentElement.style.removeProperty('--vvh');
  };
}
