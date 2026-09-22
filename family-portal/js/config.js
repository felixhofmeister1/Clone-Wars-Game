/**
 * Deployment configuration.
 *
 * Leave SUPABASE_URL / SUPABASE_ANON_KEY empty and the app shows a one-time
 * "Connect" screen where each device can paste them (or pick Demo mode).
 * Fill them in before deploying and every family member goes straight to the
 * sign-in screen instead. The anon / publishable key is designed to be public;
 * the database is protected by the Row Level Security rules in
 * supabase/schema.sql. Never put the service_role / secret key here.
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export const APP_NAME = 'Family Portal';

/** Used until the server's get_app_settings() answer arrives (and in demo mode). */
export const DEFAULT_SETTINGS = Object.freeze({
  starting_balance: 50,
  kudos_max_per_gift: 50,
  kudos_daily_limit: 250,
  max_stake: 100,
  join_code_required: false,
});

/** localStorage keys. */
export const STORAGE_KEYS = Object.freeze({
  backend: 'familyPortal.backend',
  notifications: 'familyPortal.notifications',
  calendarMode: 'familyPortal.calendarMode',
  shopTab: 'familyPortal.shopTab',
});
