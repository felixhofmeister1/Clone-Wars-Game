/**
 * System notifications (when the app is in the background) and the app icon
 * badge. In-app toasts live in ui.js.
 */
import { STORAGE_KEYS } from '../config.js';

export function notificationsSupported() {
  return typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
}

export function notificationsEnabled() {
  try {
    return notificationsSupported()
      && Notification.permission === 'granted'
      && localStorage.getItem(STORAGE_KEYS.notifications) === 'on';
  } catch {
    return false;
  }
}

export async function enableNotifications() {
  if (!notificationsSupported()) throw new Error('This browser does not support notifications. On iPhone and iPad, add the app to your Home Screen first.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were blocked. You can allow them in your browser settings.');
  localStorage.setItem(STORAGE_KEYS.notifications, 'on');
}

export function disableNotifications() {
  localStorage.setItem(STORAGE_KEYS.notifications, 'off');
}

/** Show a system notification only while the app is hidden. */
export async function systemNotify(title, body, { tag = 'family-portal', url = '#/hub' } = {}) {
  if (!notificationsEnabled() || document.visibilityState === 'visible') return;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      tag,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { url },
      renotify: true,
    });
  } catch {
    try {
      const note = new Notification(title, { body, tag, icon: 'icons/icon-192.png' });
      note.onclick = () => {
        window.focus();
        location.hash = url;
        note.close();
      };
    } catch {
      /* notifications unavailable */
    }
  }
}

export function setAppBadge(count) {
  try {
    if (count > 0 && navigator.setAppBadge) navigator.setAppBadge(count);
    else if (navigator.clearAppBadge) navigator.clearAppBadge();
  } catch {
    /* badging unsupported */
  }
}
