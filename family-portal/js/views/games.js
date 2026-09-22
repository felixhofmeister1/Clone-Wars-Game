/** Arcade lobby: challenge family members, answer invites, see matches and results. */
import { onMany } from '../core/bus.js';
import { icon } from '../core/icons.js';
import { store, me, familyMembers, profileOf, upsertMatch } from '../core/store.js';
import {
  avatarHTML, nameHTML, openModal, toast, showError, withBusy, emptyState, kudosPill, refreshPresenceDots,
} from '../core/ui.js';
import { esc, $, el, timeAgo, delegate } from '../core/utils.js';
import {
  GAMES, GAME_LIST, needsAction, matchStatusLabel, opponentOf,
} from '../games/registry.js';

const STAKES = [0, 5, 10, 25, 50, 100];

export async function acceptMatch(match) {
  const module = (await GAMES[match.game_type].load()).default;
  const { state, firstTurn } = module.acceptState(match);
  const updated = await store.backend.respondMatch(match.id, true, state, firstTurn);
  upsertMatch(updated);
  return updated;
}

export async function declineMatch(match) {
  const updated = await store.backend.respondMatch(match.id, false, null, null);
  upsertMatch(updated);
  return updated;
}

export async function cancelMatch(match) {
  const updated = await store.backend.cancelMatch(match.id);
  upsertMatch(updated);
  return updated;
}

export async function createChallenge(gameType, opponentId, stake) {
  const module = (await GAMES[gameType].load()).default;
  const state = module.createState({ player1: store.userId, player2: opponentId });
  const match = await store.backend.createMatch({ gameType, opponentId, stake, state });
  upsertMatch(match);
  return match;
}

export function openChallengeModal(gameType, { opponentId = null, stake = null } = {}) {
  const game = GAMES[gameType];
  const others = familyMembers({ includeMe: false });
  const balance = me()?.kudos_balance ?? 0;
  const maxStake = store.settings.max_stake;
  const stakes = STAKES.filter((s) => s <= maxStake);
  const initialStake = stake !== null && stake <= balance ? stake : 0;

  const form = el(`
    <form class="form challenge-form" novalidate>
      <div class="challenge-form__game"><span class="challenge-form__icon">${game.icon}</span><div><strong>${esc(game.name)}</strong><p class="muted">${esc(game.tagline)}</p></div></div>
      <fieldset class="field">
        <legend class="field__label">Who do you want to play?</legend>
        <div class="people-picker">
          ${others.length ? others.map((p) => `
            <label class="person-option">
              <input type="radio" name="opponent" value="${esc(p.id)}" ${p.id === opponentId ? 'checked' : ''}>
              ${avatarHTML(p, { size: 'md' })}
              <span class="person-option__name">${esc(p.username)}</span>
            </label>`).join('') : '<p class="muted">Nobody else has joined yet. Invite your family from your profile page.</p>'}
        </div>
      </fieldset>
      <fieldset class="field">
        <legend class="field__label">Kudos stake <span class="muted">(each player puts this in)</span></legend>
        <div class="chips">
          ${stakes.map((s) => `
            <label class="chip ${s > balance ? 'is-disabled' : ''}">
              <input type="radio" name="stake" value="${s}" ${s === initialStake ? 'checked' : ''} ${s > balance ? 'disabled' : ''}>
              <span>${s === 0 ? 'Just for fun' : `⭐ ${s}`}</span>
            </label>`).join('')}
        </div>
      </fieldset>
      <p class="challenge-form__prize" data-prize></p>
      <p class="form__error" role="alert" hidden></p>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" data-modal-close>Cancel</button>
        <button type="submit" class="btn btn--primary" ${others.length ? '' : 'disabled'}>${icon('send')} Send challenge</button>
      </div>
    </form>`);

  const prize = $('[data-prize]', form);
  const renderPrize = () => {
    const s = Number(new FormData(form).get('stake') || 0);
    prize.innerHTML = `Winner gets ${kudosPill(s * 2 + game.reward)} ${s ? `(both stakes + ${game.reward} bonus)` : `(${game.reward} bonus from the arcade)`}. A draw refunds the stakes.`;
  };
  form.addEventListener('change', renderPrize);
  renderPrize();

  const modal = openModal({ title: `Challenge to ${game.name}`, content: form });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const opponent = data.get('opponent');
    const errorEl = $('.form__error', form);
    if (!opponent) {
      errorEl.textContent = 'Pick someone to challenge.';
      errorEl.hidden = false;
      return;
    }
    withBusy($('[type=submit]', form), async () => {
      try {
        const match = await createChallenge(gameType, String(opponent), Number(data.get('stake') || 0));
        modal.close(match);
        toast(`Challenge sent to ${profileOf(String(opponent))?.username || 'them'}!`, { type: 'success' });
        location.hash = `#/games/${match.id}`;
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }
    });
  });
}

function matchRowHTML(match) {
  const uid = store.userId;
  const game = GAMES[match.game_type];
  const other = profileOf(opponentOf(match, uid));
  const action = needsAction(match, uid);
  const incoming = match.status === 'pending' && match.player2_id === uid;
  const outgoing = match.status === 'pending' && match.player1_id === uid;
  const result = match.status === 'finished' ? (match.winner_id === uid ? 'is-won' : match.winner_id ? 'is-lost' : 'is-draw') : '';
  return `
    <li class="match-row ${action ? 'needs-action' : ''} ${result}">
      <a class="match-row__link" href="#/games/${esc(match.id)}">
        <span class="match-row__icon" aria-hidden="true">${game?.icon || '🎮'}</span>
        <span class="match-row__main">
          <span class="match-row__title">${esc(game?.name || match.game_type)} <span class="muted">vs</span> ${nameHTML(other)}</span>
          <span class="match-row__meta">${esc(matchStatusLabel(match, uid))} · ${esc(timeAgo(match.updated_at))}${match.stake ? ` · ⭐ ${match.stake} stake` : ''}</span>
        </span>
        ${avatarHTML(other, { size: 'sm' })}
      </a>
      ${incoming ? `
        <div class="match-row__actions">
          <button type="button" class="btn btn--primary btn--xs" data-accept="${esc(match.id)}">Accept</button>
          <button type="button" class="btn btn--ghost btn--xs" data-decline="${esc(match.id)}">Decline</button>
        </div>` : ''}
      ${outgoing ? `<div class="match-row__actions"><button type="button" class="btn btn--ghost btn--xs" data-cancel="${esc(match.id)}">Cancel</button></div>` : ''}
    </li>`;
}

export function mount(root) {
  root.innerHTML = `
    <div class="arcade">
      <section class="arcade__games">
        ${GAME_LIST.map((game) => `
          <article class="game-card game-card--${game.type}">
            <div class="game-card__art" aria-hidden="true">${game.icon}</div>
            <div class="game-card__body">
              <h2 class="game-card__name">${esc(game.name)}</h2>
              <p class="game-card__tagline">${esc(game.tagline)}</p>
              <p class="game-card__reward">${kudosPill(`+${game.reward}`, 'kudos-pill--small')} for the winner</p>
            </div>
            <button type="button" class="btn btn--primary btn--block" data-challenge="${game.type}">${icon('games')} Challenge</button>
          </article>`).join('')}
      </section>
      <section class="card">
        <header class="card__header"><h2 class="card__title">${icon('bell')} Needs you</h2></header>
        <ul class="match-list" data-list="action"></ul>
      </section>
      <section class="card">
        <header class="card__header"><h2 class="card__title">${icon('clock')} Waiting on others</h2></header>
        <ul class="match-list" data-list="waiting"></ul>
      </section>
      <section class="card">
        <header class="card__header"><h2 class="card__title">${icon('trophy')} Recent results</h2><span class="card__sub" data-record></span></header>
        <ul class="match-list" data-list="history"></ul>
      </section>
    </div>`;

  function render() {
    const uid = store.userId;
    const matches = [...store.matches.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const open = matches.filter((m) => m.status === 'pending' || m.status === 'active');
    const action = open.filter((m) => needsAction(m, uid));
    const waiting = open.filter((m) => !needsAction(m, uid));
    const history = matches.filter((m) => m.status !== 'pending' && m.status !== 'active').slice(0, 20);
    $('[data-list="action"]', root).innerHTML = action.length ? action.map(matchRowHTML).join('') : `<li>${emptyState('✅', 'Nothing waiting for you. Challenge someone!')}</li>`;
    $('[data-list="waiting"]', root).innerHTML = waiting.length ? waiting.map(matchRowHTML).join('') : `<li>${emptyState('🕹️', 'No games in progress.')}</li>`;
    $('[data-list="history"]', root).innerHTML = history.length ? history.map(matchRowHTML).join('') : `<li>${emptyState('🏆', 'Finished games will show up here.')}</li>`;
    const finished = matches.filter((m) => m.status === 'finished');
    const wins = finished.filter((m) => m.winner_id === uid).length;
    $('[data-record]', root).textContent = finished.length ? `${wins} won · ${finished.length - wins} lost or drawn` : '';
  }

  const offs = [
    delegate(root, 'click', '[data-challenge]', (event, button) => openChallengeModal(button.dataset.challenge)),
    delegate(root, 'click', '[data-accept]', (event, button) => {
      const match = store.matches.get(button.dataset.accept);
      if (!match) return;
      withBusy(button, async () => {
        try {
          await acceptMatch(match);
          location.hash = `#/games/${match.id}`;
        } catch (err) {
          showError(err);
        }
      });
    }),
    delegate(root, 'click', '[data-decline]', (event, button) => {
      const match = store.matches.get(button.dataset.decline);
      if (match) withBusy(button, () => declineMatch(match).catch(showError));
    }),
    delegate(root, 'click', '[data-cancel]', (event, button) => {
      const match = store.matches.get(button.dataset.cancel);
      if (match) withBusy(button, () => cancelMatch(match).catch(showError));
    }),
  ];

  const offBus = onMany({
    matches: render,
    profiles: render,
    resync: render,
    presence: () => refreshPresenceDots(root),
  });
  const clock = setInterval(render, 60000);
  render();

  return () => {
    offs.forEach((fn) => fn());
    offBus();
    clearInterval(clock);
  };
}
