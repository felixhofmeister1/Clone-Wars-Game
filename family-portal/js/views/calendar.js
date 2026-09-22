/** Shared family calendar (month / week grid) plus the "Coming up" list. */
import { STORAGE_KEYS } from '../config.js';
import { onMany } from '../core/bus.js';
import { icon } from '../core/icons.js';
import { store, profileOf } from '../core/store.js';
import {
  avatarHTML, nameHTML, openModal, confirmDialog, toast, showError, withBusy, emptyState,
} from '../core/ui.js';
import {
  esc, $, $$, el, richText, hashHue, toISODate, parseISODate, addDays, addMonths, startOfMonth,
  startOfWeek, sameDay, weekdayNames, formatMonth, formatDate, formatTimeOfDay, dayLabel, firstDayOfWeek, delegate,
} from '../core/utils.js';

// ------------------------------------------------------------------ event cache

const cache = new Map();
const loadedMonths = new Set();
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
let queue = Promise.resolve();

/** Loads every month touching [from, to] that isn't cached yet. Calls are serialized. */
function ensureRange(from, to) {
  const run = queue.then(() => fetchMissing(from, to));
  queue = run.catch(() => false);
  return run;
}

async function fetchMissing(from, to) {
  const missing = [];
  for (let cursor = startOfMonth(from); cursor <= to; cursor = addMonths(cursor, 1)) {
    if (!loadedMonths.has(monthKey(cursor))) missing.push(new Date(cursor));
  }
  if (!missing.length) return false;
  const first = missing[0];
  const last = missing[missing.length - 1];
  const rangeEnd = addDays(addMonths(last, 1), -1);
  const rows = await store.backend.listEvents(toISODate(first), toISODate(rangeEnd));
  rows.forEach((row) => cache.set(row.id, row));
  missing.forEach((month) => loadedMonths.add(monthKey(month)));
  document.dispatchEvent(new CustomEvent('calendar:loaded'));
  return true;
}

function eventsOn(iso) {
  return [...cache.values()]
    .filter((e) => e.event_date === iso)
    .sort((a, b) => (a.event_time || '').localeCompare(b.event_time || '') || a.title.localeCompare(b.title));
}

function eventsBetween(fromIso, toIso) {
  return [...cache.values()]
    .filter((e) => e.event_date >= fromIso && e.event_date <= toIso)
    .sort((a, b) => `${a.event_date}${a.event_time || ''}`.localeCompare(`${b.event_date}${b.event_time || ''}`));
}

function applyChange(change) {
  if (change.eventType === 'DELETE') cache.delete(change.old?.id);
  else if (change.new) cache.set(change.new.id, change.new);
}

export function resetCalendarCache() {
  cache.clear();
  loadedMonths.clear();
}

// ------------------------------------------------------------------ modals

function eventHue(event) {
  return hashHue(event.created_by);
}

function eventTimeLabel(event) {
  return event.event_time ? formatTimeOfDay(event.event_time) : 'All day';
}

export function openEventForm({ event = null, date = toISODate(new Date()) } = {}) {
  const editing = !!event;
  const form = el(`
    <form class="form" novalidate>
      <label class="field">
        <span class="field__label">Title</span>
        <input class="input" name="title" maxlength="120" required placeholder="e.g. Grandma's birthday dinner" value="${esc(event?.title || '')}">
      </label>
      <div class="form__row">
        <label class="field">
          <span class="field__label">Date</span>
          <input class="input" type="date" name="event_date" required value="${esc(event?.event_date || date)}">
        </label>
        <label class="field">
          <span class="field__label">Time <span class="muted">(optional)</span></span>
          <input class="input" type="time" name="event_time" value="${esc(event?.event_time ? event.event_time.slice(0, 5) : '')}">
        </label>
      </div>
      <label class="field">
        <span class="field__label">Details <span class="muted">(optional)</span></span>
        <textarea class="input" name="description" rows="3" maxlength="2000" placeholder="Where, what to bring, who's driving…">${esc(event?.description || '')}</textarea>
      </label>
      <p class="form__error" role="alert" hidden></p>
      <div class="modal__actions">
        ${editing ? `<button type="button" class="btn btn--danger-ghost" data-delete>${icon('trash')} Delete</button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn btn--ghost" data-modal-close>Cancel</button>
        <button type="submit" class="btn btn--primary">${editing ? 'Save changes' : 'Add event'}</button>
      </div>
    </form>`);
  const modal = openModal({ title: editing ? 'Edit event' : 'New event', content: form });
  const errorEl = $('.form__error', form);

  form.addEventListener('submit', (submitEvent) => {
    submitEvent.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const payload = {
      title: String(data.title || '').trim(),
      event_date: String(data.event_date || ''),
      event_time: data.event_time ? String(data.event_time) : null,
      description: String(data.description || '').trim(),
    };
    errorEl.hidden = true;
    if (!payload.title) {
      errorEl.textContent = 'Give the event a title.';
      errorEl.hidden = false;
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.event_date)) {
      errorEl.textContent = 'Pick a date.';
      errorEl.hidden = false;
      return;
    }
    withBusy($('[type=submit]', form), async () => {
      try {
        const saved = editing
          ? await store.backend.updateEvent(event.id, payload)
          : await store.backend.createEvent(payload);
        cache.set(saved.id, saved);
        modal.close(saved);
        toast(editing ? 'Event updated.' : `Added "${saved.title}" to the calendar.`, { type: 'success' });
        document.dispatchEvent(new CustomEvent('calendar:changed'));
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }
    });
  });

  $('[data-delete]', form)?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Delete event?', message: `"${event.title}" will be removed for everyone.`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await store.backend.deleteEvent(event.id);
      cache.delete(event.id);
      modal.close(null);
      toast('Event deleted.', { type: 'success' });
      document.dispatchEvent(new CustomEvent('calendar:changed'));
    } catch (err) {
      showError(err);
    }
  });
}

function eventCardHTML(event) {
  const creator = profileOf(event.created_by);
  const mine = event.created_by === store.userId;
  return `
    <article class="event-card" style="--hue:${eventHue(event)}">
      <div class="event-card__time">${esc(eventTimeLabel(event))}</div>
      <div class="event-card__body">
        <h3 class="event-card__title">${esc(event.title)}</h3>
        ${event.description ? `<p class="event-card__desc">${richText(event.description)}</p>` : ''}
        <p class="event-card__meta">${avatarHTML(creator, { size: 'xs' })} Added by ${nameHTML(creator)}</p>
      </div>
      ${mine ? `<button type="button" class="icon-btn" data-edit-event="${esc(event.id)}" aria-label="Edit ${esc(event.title)}">${icon('edit')}</button>` : ''}
    </article>`;
}

export function openDayModal(iso) {
  const content = el('<div class="day-modal"></div>');
  const render = () => {
    const events = eventsOn(iso);
    content.innerHTML = `
      ${events.length ? events.map(eventCardHTML).join('') : emptyState('🗓️', 'Nothing planned yet.')}
      <div class="modal__actions">
        <button type="button" class="btn btn--primary" data-add-here>${icon('plus')} Add event</button>
      </div>`;
  };
  render();
  const modal = openModal({ title: dayLabel(parseISODate(iso)), content, size: 'md' });
  content.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-event]');
    if (edit) {
      const row = cache.get(edit.dataset.editEvent);
      modal.close();
      if (row) openEventForm({ event: row });
    }
    if (event.target.closest('[data-add-here]')) {
      modal.close();
      openEventForm({ date: iso });
    }
  });
}

// ------------------------------------------------------------------ calendar card

export function mountCalendar(container) {
  let mode = localStorage.getItem(STORAGE_KEYS.calendarMode) === 'week' ? 'week' : 'month';
  let cursor = new Date();
  const firstDay = firstDayOfWeek();

  container.innerHTML = `
    <header class="card__header cal__header">
      <div class="cal__heading">
        <h2 class="card__title">${icon('calendar')} <span data-cal-title></span></h2>
      </div>
      <div class="cal__controls">
        <div class="segmented segmented--sm" role="tablist" aria-label="Calendar view">
          <button type="button" class="segmented__btn" role="tab" data-mode="month">Month</button>
          <button type="button" class="segmented__btn" role="tab" data-mode="week">Week</button>
        </div>
        <div class="cal__nav">
          <button type="button" class="icon-btn" data-step="-1" aria-label="Previous">${icon('chevronLeft')}</button>
          <button type="button" class="btn btn--ghost btn--sm" data-today>Today</button>
          <button type="button" class="icon-btn" data-step="1" aria-label="Next">${icon('chevronRight')}</button>
        </div>
        <button type="button" class="btn btn--primary btn--sm" data-add-event>${icon('plus')}<span>Event</span></button>
      </div>
    </header>
    <div class="cal__weekdays" aria-hidden="true">${weekdayNames(firstDay).map((d) => `<span>${esc(d)}</span>`).join('')}</div>
    <div class="cal__body" data-cal-body></div>`;

  const body = $('[data-cal-body]', container);
  const title = $('[data-cal-title]', container);

  function range() {
    if (mode === 'week') {
      const start = startOfWeek(cursor, firstDay);
      return { start, end: addDays(start, 6) };
    }
    const start = startOfWeek(startOfMonth(cursor), firstDay);
    return { start, end: addDays(start, 41) };
  }

  function render() {
    const { start, end } = range();
    const today = new Date();
    $$('[data-mode]', container).forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    container.classList.toggle('cal--week', mode === 'week');
    if (mode === 'month') {
      title.textContent = formatMonth(cursor);
      const cells = [];
      for (let i = 0; i < 42; i += 1) {
        const day = addDays(start, i);
        const iso = toISODate(day);
        const events = eventsOn(iso);
        const outside = day.getMonth() !== cursor.getMonth();
        cells.push(`
          <button type="button" class="cal__day ${outside ? 'is-outside' : ''} ${sameDay(day, today) ? 'is-today' : ''} ${events.length ? 'has-events' : ''}"
            data-date="${iso}" aria-label="${esc(formatDate(day, { weekday: 'long', day: 'numeric', month: 'long' }))}${events.length ? `, ${events.length} event${events.length > 1 ? 's' : ''}` : ''}">
            <span class="cal__num">${day.getDate()}</span>
            <span class="cal__chips">
              ${events.slice(0, 3).map((e) => `<span class="cal__chip" style="--hue:${eventHue(e)}" title="${esc(`${eventTimeLabel(e)} · ${e.title}`)}">${esc(e.title)}</span>`).join('')}
              ${events.length > 3 ? `<span class="cal__more">+${events.length - 3} more</span>` : ''}
            </span>
            <span class="cal__dots">${events.slice(0, 4).map((e) => `<i style="--hue:${eventHue(e)}"></i>`).join('')}</span>
          </button>`);
      }
      body.className = 'cal__body cal__grid';
      body.innerHTML = cells.join('');
    } else {
      const sameMonth = start.getMonth() === end.getMonth();
      title.textContent = sameMonth
        ? formatMonth(start)
        : `${formatDate(start, { day: 'numeric', month: 'short' })} – ${formatDate(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
      const columns = [];
      for (let i = 0; i < 7; i += 1) {
        const day = addDays(start, i);
        const iso = toISODate(day);
        const events = eventsOn(iso);
        columns.push(`
          <section class="cal__col ${sameDay(day, today) ? 'is-today' : ''}">
            <button type="button" class="cal__col-head" data-date="${iso}">
              <span class="cal__col-weekday">${esc(formatDate(day, { weekday: 'short' }))}</span>
              <span class="cal__col-num">${day.getDate()}</span>
            </button>
            <div class="cal__col-events">
              ${events.map((e) => `
                <button type="button" class="cal__event" style="--hue:${eventHue(e)}" data-date="${iso}">
                  <span class="cal__event-time">${esc(eventTimeLabel(e))}</span>
                  <span class="cal__event-title">${esc(e.title)}</span>
                </button>`).join('') || `<button type="button" class="cal__empty" data-date="${iso}" aria-label="Add event">+</button>`}
            </div>
          </section>`);
      }
      body.className = 'cal__body cal__week';
      body.innerHTML = columns.join('');
    }
  }

  async function load() {
    const { start, end } = range();
    render();
    container.classList.add('is-loading');
    try {
      const fetched = await ensureRange(start, end);
      if (fetched) render();
    } catch (err) {
      showError(err, 'Could not load the calendar.');
    } finally {
      container.classList.remove('is-loading');
    }
  }

  const offClick = delegate(container, 'click', '[data-date]', (event, target) => openDayModal(target.dataset.date));
  container.addEventListener('click', (event) => {
    const modeBtn = event.target.closest('[data-mode]');
    if (modeBtn) {
      mode = modeBtn.dataset.mode;
      localStorage.setItem(STORAGE_KEYS.calendarMode, mode);
      load();
    }
    const step = event.target.closest('[data-step]');
    if (step) {
      const n = Number(step.dataset.step);
      cursor = mode === 'month' ? addMonths(cursor, n) : addDays(cursor, 7 * n);
      load();
    }
    if (event.target.closest('[data-today]')) {
      cursor = new Date();
      load();
    }
    if (event.target.closest('[data-add-event]')) {
      const iso = mode === 'month' && cursor.getMonth() !== new Date().getMonth() ? toISODate(startOfMonth(cursor)) : toISODate(new Date());
      openEventForm({ date: iso });
    }
  });

  const onLocalChange = () => render();
  document.addEventListener('calendar:changed', onLocalChange);
  const offBus = onMany({
    'db:calendar_events': (change) => {
      applyChange(change);
      render();
    },
    profiles: render,
    resync: () => {
      resetCalendarCache();
      load();
    },
  });

  load();
  return () => {
    offClick();
    offBus();
    document.removeEventListener('calendar:changed', onLocalChange);
  };
}

// ------------------------------------------------------------------ coming up

export function mountUpcoming(container) {
  container.innerHTML = `
    <header class="card__header">
      <h2 class="card__title">${icon('clock')} Coming up</h2>
    </header>
    <div data-upcoming></div>`;
  const list = $('[data-upcoming]', container);

  const render = () => {
    const today = new Date();
    const events = eventsBetween(toISODate(today), toISODate(addDays(today, 30))).slice(0, 8);
    if (!events.length) {
      list.innerHTML = emptyState('🌤️', 'Nothing on the calendar for the next month. Add something fun!');
      return;
    }
    let lastDay = '';
    list.innerHTML = `<ul class="upcoming">${events.map((e) => {
      const header = e.event_date !== lastDay ? `<li class="upcoming__day">${esc(dayLabel(parseISODate(e.event_date)))}</li>` : '';
      lastDay = e.event_date;
      return `${header}
        <li>
          <button type="button" class="upcoming__item" data-date="${e.event_date}" style="--hue:${eventHue(e)}">
            <span class="upcoming__time">${esc(eventTimeLabel(e))}</span>
            <span class="upcoming__title">${esc(e.title)}</span>
            ${avatarHTML(profileOf(e.created_by), { size: 'xs' })}
          </button>
        </li>`;
    }).join('')}</ul>`;
  };

  const load = async () => {
    try {
      const today = new Date();
      await ensureRange(today, addDays(today, 30));
    } catch (err) {
      console.warn('[calendar] upcoming load failed', err);
    }
    render();
  };

  const offClick = delegate(container, 'click', '[data-date]', (event, target) => openDayModal(target.dataset.date));
  const onLocalChange = () => render();
  document.addEventListener('calendar:changed', onLocalChange);
  const offBus = onMany({
    'db:calendar_events': (change) => {
      applyChange(change);
      render();
    },
    profiles: render,
    resync: () => setTimeout(load, 50),
  });
  render();
  load();
  return () => {
    offClick();
    offBus();
    document.removeEventListener('calendar:changed', onLocalChange);
  };
}

export function upcomingCount(days = 7) {
  const today = new Date();
  return eventsBetween(toISODate(today), toISODate(addDays(today, days))).length;
}
