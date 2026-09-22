/** Kudos widget: give shout-outs with points, and the live public kudos stream. */
import { onMany } from '../core/bus.js';
import { icon } from '../core/icons.js';
import { store, familyMembers, profileOf } from '../core/store.js';
import {
  avatarHTML, nameHTML, toast, withBusy, emptyState, celebrate, kudosPill,
} from '../core/ui.js';
import { esc, $, $$, timeAgo, clamp } from '../core/utils.js';

const POINT_CHOICES = [1, 5, 10, 25, 50];

export function mountKudos(container) {
  let feed = [];
  let sentToday = 0;
  let selected = null;

  container.innerHTML = `
    <header class="card__header">
      <h2 class="card__title">${icon('star')} Kudos</h2>
      <span class="card__sub">Shout-outs add points to someone's balance</span>
    </header>
    <form class="form kudos-form" novalidate data-kudos-form>
      <fieldset class="field">
        <legend class="field__label">Who deserves it?</legend>
        <div class="people-picker" data-people role="radiogroup"></div>
      </fieldset>
      <label class="field">
        <span class="field__label">Shout-out</span>
        <textarea class="input" name="message" rows="2" maxlength="280" placeholder="Thanks for tidying the kitchen without being asked!"></textarea>
        <span class="field__counter" data-counter>0 / 280</span>
      </label>
      <fieldset class="field">
        <legend class="field__label">Points</legend>
        <div class="chips" data-points></div>
      </fieldset>
      <p class="form__error" role="alert" hidden></p>
      <div class="kudos-form__footer">
        <span class="muted" data-allowance></span>
        <button type="submit" class="btn btn--kudos">${icon('send')} Send kudos</button>
      </div>
    </form>
    <h3 class="subhead">Kudos stream</h3>
    <ul class="kudos-feed" data-feed aria-live="polite"></ul>`;

  const form = $('[data-kudos-form]', container);
  const people = $('[data-people]', container);
  const pointsEl = $('[data-points]', container);
  const feedEl = $('[data-feed]', container);
  const errorEl = $('.form__error', form);
  const counter = $('[data-counter]', container);
  const allowanceEl = $('[data-allowance]', container);
  const message = $('[name=message]', form);

  function renderPeople() {
    const others = familyMembers({ includeMe: false });
    if (!others.length) {
      people.innerHTML = `<p class="muted">No one else has joined yet. Share the app from <a href="#/profile">your profile</a> to invite your family.</p>`;
      return;
    }
    if (selected && !others.some((p) => p.id === selected)) selected = null;
    people.innerHTML = others.map((p) => `
      <label class="person-option">
        <input type="radio" name="recipient" value="${esc(p.id)}" ${p.id === selected ? 'checked' : ''}>
        ${avatarHTML(p, { size: 'md' })}
        <span class="person-option__name">${esc(p.username)}</span>
      </label>`).join('');
  }

  function renderPoints() {
    const max = store.settings.kudos_max_per_gift;
    const current = $('[name=points]:checked', pointsEl)?.value || '5';
    const custom = $('[name=customPoints]', pointsEl)?.value || '';
    pointsEl.innerHTML = `
      ${POINT_CHOICES.filter((n) => n <= max).map((n) => `
        <label class="chip">
          <input type="radio" name="points" value="${n}" ${String(n) === current ? 'checked' : ''}>
          <span>+${n}</span>
        </label>`).join('')}
      <label class="chip chip--input">
        <input type="radio" name="points" value="custom" ${current === 'custom' ? 'checked' : ''}>
        <input class="chip__number" type="number" name="customPoints" min="1" max="${max}" inputmode="numeric" placeholder="Other" value="${esc(custom)}" aria-label="Custom points">
      </label>`;
  }

  function renderAllowance() {
    const left = Math.max(0, store.settings.kudos_daily_limit - sentToday);
    allowanceEl.textContent = `You can give ${left} more point${left === 1 ? '' : 's'} today`;
  }

  function itemHTML(row) {
    const sender = row.sender_id ? profileOf(row.sender_id) : null;
    const recipient = profileOf(row.recipient_id);
    const system = !row.sender_id;
    return `
      <li class="kudos-item ${system ? 'kudos-item--system' : ''} ${row.recipient_id === store.userId ? 'kudos-item--me' : ''}" data-id="${esc(row.id)}">
        <div class="kudos-item__avatars">
          ${system ? '<span class="avatar avatar--sm avatar--trophy" aria-label="Arcade">🏆</span>' : avatarHTML(sender, { size: 'sm' })}
          <span class="kudos-item__arrow" aria-hidden="true">${icon('chevronRight')}</span>
          ${avatarHTML(recipient, { size: 'sm' })}
        </div>
        <div class="kudos-item__body">
          <p class="kudos-item__who">
            ${system ? '<strong>Arcade</strong>' : nameHTML(sender)}
            <span class="muted">to</span> ${nameHTML(recipient)}
            ${kudosPill(`+${row.points}`, 'kudos-pill--small')}
          </p>
          <p class="kudos-item__msg">${esc(row.message)}</p>
          <time class="kudos-item__time" datetime="${esc(row.created_at)}">${esc(timeAgo(row.created_at))}</time>
        </div>
      </li>`;
  }

  function renderFeed() {
    feedEl.innerHTML = feed.length
      ? feed.map(itemHTML).join('')
      : `<li>${emptyState('🌟', 'No kudos yet. Be the first to say thank you!')}</li>`;
  }

  async function loadFeed() {
    try {
      feed = await store.backend.listKudos(25);
      renderFeed();
    } catch (err) {
      feedEl.innerHTML = `<li>${emptyState('⚠️', 'Could not load the kudos stream.')}</li>`;
      console.warn(err);
    }
  }

  async function loadAllowance() {
    try {
      sentToday = await store.backend.kudosSentSince(new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    } catch {
      sentToday = 0;
    }
    renderAllowance();
  }

  message.addEventListener('input', () => {
    counter.textContent = `${message.value.length} / 280`;
  });
  people.addEventListener('change', (event) => {
    if (event.target.name === 'recipient') selected = event.target.value;
  });
  pointsEl.addEventListener('focusin', (event) => {
    if (event.target.name === 'customPoints') $('[name=points][value=custom]', pointsEl).checked = true;
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    const recipient = $('[name=recipient]:checked', form)?.value;
    const text = message.value.trim();
    const choice = $('[name=points]:checked', form)?.value;
    const max = store.settings.kudos_max_per_gift;
    const points = choice === 'custom' ? Number($('[name=customPoints]', form).value) : Number(choice);
    const fail = (msg) => {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    };
    if (!recipient) return fail('Pick who the kudos are for.');
    if (!text) return fail('Write a short shout-out.');
    if (!Number.isInteger(points) || points < 1 || points > max) return fail(`Points must be a whole number from 1 to ${max}.`);
    const submit = $('[type=submit]', form);
    return withBusy(submit, async () => {
      try {
        const row = await store.backend.giveKudos(recipient, text, clamp(points, 1, max));
        if (!feed.some((r) => r.id === row.id)) feed = [row, ...feed].slice(0, 25);
        renderFeed();
        sentToday += row.points;
        renderAllowance();
        message.value = '';
        counter.textContent = '0 / 280';
        celebrate(submit, '⭐', 16);
        toast(`Sent +${row.points} kudos to ${profileOf(recipient)?.username || 'them'}!`, { type: 'kudos' });
      } catch (err) {
        fail(err.message);
      }
    });
  });

  const offBus = onMany({
    'db:kudos_feed': (change) => {
      if (change.eventType !== 'INSERT' || feed.some((r) => r.id === change.new.id)) return;
      feed = [change.new, ...feed].slice(0, 25);
      renderFeed();
      const node = feedEl.firstElementChild;
      if (node) node.classList.add('is-new');
    },
    profiles: () => {
      renderPeople();
      renderFeed();
    },
    resync: () => {
      loadFeed();
      loadAllowance();
    },
  });

  const clock = setInterval(() => {
    $$('.kudos-item__time', feedEl).forEach((node) => {
      node.textContent = timeAgo(node.getAttribute('datetime'));
    });
  }, 60000);

  renderPeople();
  renderPoints();
  renderAllowance();
  renderFeed();
  loadFeed();
  loadAllowance();

  return () => {
    offBus();
    clearInterval(clock);
  };
}
