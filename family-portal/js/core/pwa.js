/** Service worker registration, update prompts and "install app" support. */
import { emit } from './bus.js';
import { toast } from './ui.js';

let deferredInstallPrompt = null;

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function canPromptInstall() {
  return !!deferredInstallPrompt;
}

export async function promptInstall() {
  if (!deferredInstallPrompt) return false;
  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  promptEvent.prompt();
  const { outcome } = await promptEvent.userChoice;
  emit('installable', false);
  return outcome === 'accepted';
}

export function registerServiceWorker() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    emit('installable', true);
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    emit('installable', false);
    toast('Family Portal is installed. Find it on your home screen!', { type: 'success' });
  });

  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NAVIGATE' && typeof event.data.url === 'string' && event.data.url.startsWith('#/')) {
      location.hash = event.data.url;
    }
  });

  const offerUpdate = (worker) => {
    toast('A new version of Family Portal is ready.', {
      type: 'info',
      timeout: 0,
      action: { label: 'Update', onClick: () => worker.postMessage({ type: 'SKIP_WAITING' }) },
    });
  };

  const register = () => {
    navigator.serviceWorker.register('sw.js').then((registration) => {
      if (!registration) return;
      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
        });
      });
      setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    }).catch((err) => console.warn('[pwa] service worker registration failed', err));
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
