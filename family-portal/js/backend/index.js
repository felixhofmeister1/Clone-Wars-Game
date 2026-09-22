/**
 * Picks the backend for this device:
 *   1. SUPABASE_URL / SUPABASE_ANON_KEY hard-coded in js/config.js
 *   2. a connection saved on this device from the Connect screen or a setup link
 *   3. nothing yet → the app shows the Connect screen
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_KEYS } from '../config.js';

export function hardcodedConfig() {
  return SUPABASE_URL && SUPABASE_ANON_KEY ? { kind: 'supabase', url: SUPABASE_URL, key: SUPABASE_ANON_KEY } : null;
}

export function savedConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.backend);
    const config = raw ? JSON.parse(raw) : null;
    if (config?.kind === 'local') return config;
    if (config?.kind === 'supabase' && config.url && config.key) return config;
  } catch {
    /* ignore corrupt entries */
  }
  return null;
}

export function resolveConfig() {
  return hardcodedConfig() || savedConfig();
}

export function saveConfig(config) {
  localStorage.setItem(STORAGE_KEYS.backend, JSON.stringify(config));
}

export function clearSavedConfig() {
  localStorage.removeItem(STORAGE_KEYS.backend);
}

export function normalizeSupabaseUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  const url = new URL(trimmed);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('The project URL must start with https://');
  }
  return url.origin;
}

/**
 * Link that pre-configures another device: #setup=<base64 json>.
 * Only the project URL and the public anon key are included.
 */
export function buildSetupLink(config) {
  const payload = btoa(JSON.stringify({ url: config.url, key: config.key }));
  return `${location.origin}${location.pathname}#setup=${encodeURIComponent(payload)}`;
}

/** Consumes a #setup= link, saving the connection. Returns true when one was applied. */
export function consumeSetupLink() {
  const match = location.hash.match(/^#setup=(.+)$/);
  if (!match) return false;
  try {
    const { url, key } = JSON.parse(atob(decodeURIComponent(match[1])));
    saveConfig({ kind: 'supabase', url: normalizeSupabaseUrl(url), key: String(key).trim() });
    return true;
  } catch {
    return false;
  } finally {
    history.replaceState(null, '', `${location.pathname}${location.search}#/hub`);
  }
}

export async function createBackend(config) {
  if (config.kind === 'local') {
    const { createLocalBackend } = await import('./local.js');
    return createLocalBackend();
  }
  const { createSupabaseBackend } = await import('./supabase.js');
  return createSupabaseBackend(config);
}
