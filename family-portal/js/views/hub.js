/** Hub: 3D family island header, calendar, coming up, kudos and news. */
import { onMany } from '../core/bus.js';
import { icon } from '../core/icons.js';
import { store, me, familyMembers, ownedItems } from '../core/store.js';
import { actionCount } from '../core/sync.js';
import { equippedTitle, nameHTML } from '../core/ui.js';
import { $, greeting, formatNumber } from '../core/utils.js';
import { Lobby3D } from '../three/lobby3d.js';
import { mountCalendar, mountUpcoming, resetCalendarCache, upcomingCount } from './calendar.js';
import { mountKudos } from './kudos.js';
import { mountNews } from './news.js';

function decorationModels() {
  return ownedItems(store.userId)
    .filter((item) => item.type === 'decoration' && item.meta?.model)
    .reverse()
    .map((item) => item.meta.model);
}

export function mount(root) {
  root.innerHTML = `
    <div class="hub">
      <section class="hero card" aria-label="Family island">
        <div class="hero__stage" data-stage></div>
        <div class="hero__content">
          <p class="hero__greeting" data-greeting></p>
          <h2 class="hero__name" data-name></h2>
          <p class="hero__title" data-title></p>
          <div class="hero__stats">
            <a class="stat" href="#/shop"><span class="stat__value" data-stat-kudos></span><span class="stat__label">kudos</span></a>
            <a class="stat" href="#/games"><span class="stat__value" data-stat-turns></span><span class="stat__label">your turn</span></a>
            <span class="stat"><span class="stat__value" data-stat-events></span><span class="stat__label">this week</span></span>
          </div>
          <p class="hero__hint">${icon('sparkles')} Drag to spin your island. Décor from the shop appears here.</p>
        </div>
      </section>
      <section class="card hub__calendar" data-calendar></section>
      <section class="card hub__upcoming" data-upcoming-card></section>
      <section class="card hub__kudos" data-kudos></section>
      <section class="card hub__news" data-news-card></section>
    </div>`;

  const lobby = new Lobby3D($('[data-stage]', root), {
    interactive: true,
    members: familyMembers(),
    decorations: decorationModels(),
  });
  lobby.start();

  const renderHero = () => {
    const profile = me();
    if (!profile) return;
    $('[data-greeting]', root).textContent = `${greeting()},`;
    $('[data-name]', root).innerHTML = nameHTML(profile);
    const title = equippedTitle(profile);
    $('[data-title]', root).textContent = title;
    $('[data-title]', root).hidden = !title;
    $('[data-stat-kudos]', root).textContent = `⭐ ${formatNumber(profile.kudos_balance)}`;
    $('[data-stat-turns]', root).textContent = `🎮 ${actionCount()}`;
    $('[data-stat-events]', root).textContent = `📅 ${upcomingCount(7)}`;
  };

  resetCalendarCache();
  const cleanups = [
    mountCalendar($('[data-calendar]', root)),
    mountUpcoming($('[data-upcoming-card]', root)),
    mountKudos($('[data-kudos]', root)),
    mountNews($('[data-news-card]', root)),
  ];

  const onCalendar = () => setTimeout(renderHero, 0);
  document.addEventListener('calendar:changed', onCalendar);
  document.addEventListener('calendar:loaded', onCalendar);
  const offBus = onMany({
    me: renderHero,
    matches: renderHero,
    items: () => lobby.setDecorations(decorationModels()),
    inventory: () => lobby.setDecorations(decorationModels()),
    profiles: () => {
      lobby.setMembers(familyMembers());
      renderHero();
    },
    'db:calendar_events': () => setTimeout(renderHero, 0),
    resync: () => setTimeout(renderHero, 300),
  });

  renderHero();
  const heroTimer = setInterval(renderHero, 60000);

  return () => {
    cleanups.forEach((fn) => fn && fn());
    offBus();
    document.removeEventListener('calendar:changed', onCalendar);
    document.removeEventListener('calendar:loaded', onCalendar);
    clearInterval(heroTimer);
    lobby.destroy();
  };
}

