/**
 * Tiny publish/subscribe bus shared by every module.
 *
 * Events used across the app:
 *   db:<table>      realtime row change  { eventType, new, old }
 *   profiles        any profile changed
 *   me              the signed-in user's profile changed
 *   inventory       inventory rows changed
 *   matches         game match rows changed
 *   presence        the set of online user ids changed
 *   connection      realtime connection status changed
 *   unread          unread counters changed
 *   resync          connection restored: views should refetch their data
 */
const listeners = new Map();

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
}

export function off(event, handler) {
  const set = listeners.get(event);
  if (set) set.delete(handler);
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const handler of [...set]) {
    try {
      handler(payload);
    } catch (err) {
      console.error(`[bus] handler for "${event}" failed`, err);
    }
  }
}

/** Subscribe to several events at once; returns one function that removes them all. */
export function onMany(map) {
  const offs = Object.entries(map).map(([event, handler]) => on(event, handler));
  return () => offs.forEach((fn) => fn());
}
