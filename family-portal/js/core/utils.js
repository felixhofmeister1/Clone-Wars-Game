/** DOM, text, date and random helpers. No app state lives here. */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape any value for safe use inside HTML text or a quoted attribute. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** Parse an HTML string into a single element. */
export function el(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

/**
 * Delegated event listener: handler(event, matchedElement).
 * Returns a function that removes the listener.
 */
export function delegate(root, type, selector, handler, options) {
  const listener = (event) => {
    const target = event.target instanceof Element ? event.target.closest(selector) : null;
    if (target && root.contains(target)) handler(event, target);
  };
  root.addEventListener(type, listener, options);
  return () => root.removeEventListener(type, listener, options);
}

/** Escape text, keep line breaks and turn http(s) URLs into safe links. */
export function richText(text) {
  const escaped = esc(text);
  const linked = escaped.replace(
    /\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
  );
  return linked.replace(/\n/g, '<br>');
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function debounce(fn, wait = 200) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function randomBytes(n) {
  const bytes = new Uint8Array(n);
  if (globalThis.crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < n; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/** Stable hue (0-359) for a string, used to colour people and events. */
export function hashHue(text) {
  let hash = 0;
  const str = String(text ?? '');
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

export function formatNumber(n) {
  return new Intl.NumberFormat().format(Number(n) || 0);
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

// ---------------------------------------------------------------- dates

/** YYYY-MM-DD in the device's local time zone. */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD as a local date (midnight). */
export function parseISODate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date, months) {
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return next;
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** 0 = Sunday … 6 = Saturday, from the user's locale when the browser knows it. */
export function firstDayOfWeek() {
  try {
    const locale = new Intl.Locale(navigator.language || 'en-GB');
    const info = typeof locale.getWeekInfo === 'function' ? locale.getWeekInfo() : locale.weekInfo;
    if (info && typeof info.firstDay === 'number') return info.firstDay % 7;
  } catch {
    /* fall through to the default */
  }
  return 1;
}

export function startOfWeek(date, firstDay = firstDayOfWeek()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = (d.getDay() - firstDay + 7) % 7;
  return addDays(d, -diff);
}

export function weekdayNames(firstDay = firstDayOfWeek(), style = 'short') {
  const base = new Date(2024, 0, 7); // a Sunday
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: style });
  return Array.from({ length: 7 }, (_, i) => fmt.format(addDays(base, (firstDay + i) % 7)));
}

export function formatMonth(date) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
}

export function formatDate(date, options = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

export function formatClock(date) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
}

/** "14:30" (HH:MM[:SS]) → localized time string. */
export function formatTimeOfDay(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(2000, 0, 1, h || 0, m || 0);
  return formatClock(d);
}

export function dayLabel(date) {
  const today = new Date();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, addDays(today, -1))) return 'Yesterday';
  if (sameDay(date, addDays(today, 1))) return 'Tomorrow';
  const sameYear = date.getFullYear() === today.getFullYear();
  return formatDate(date, sameYear
    ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { day: 'numeric', month: 'long', year: 'numeric' });
}

export function timeAgo(isoOrDate) {
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 7) return rtf.format(-days, 'day');
  return formatDate(date, { day: 'numeric', month: 'short', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function isTouchDevice() {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
