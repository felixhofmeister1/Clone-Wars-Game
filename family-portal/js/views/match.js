/** Match page: players, pot, invite handling, the game itself, and the result. */
import { onMany } from '../core/bus.js';
import { icon } from '../core/icons.js';
import { store, profileOf, upsertMatch } from '../core/store.js';
import {
  avatarHTML, nameHTML, confirmDialog, showError, withBusy, kudosPill, celebrate, refreshPresenceDots, dismissToasts,
} from '../core/ui.js';
import { esc, $, timeAgo } from '../core/utils.js';
import { GAMES, opponentOf } from '../games/registry.js';
import {
  acceptMatch, declineMatch, cancelMatch, openChallengeModal,
} from './games.js';

export function mount(root, { id }) {
  let match = store.matches.get(id) || null;
  let gameModule = null;
  let controller = null;
  let celebrated = false;
  let destroyed = false;

  root.innerHTML = '<div class="view-loading"><span class="spinner" aria-hidden="true"></span></div>';
  dismissToasts(`match-${id}`);

  const nameOf = (uid) => (uid === store.userId ? 'You' : profileOf(uid)?.username || 'Your opponent');

  function setStatus(text, yourMove) {
    const node = $('[data-status]', root);
    if (!node) return;
    node.textContent = text;
    node.classList.toggle('is-your-move', !!yourMove);
  }

  async function submit(state, { nextTurn = null, finish = false, winner = null } = {}) {
    const current = store.matches.get(id) || match;
    try {
      const updated = await store.backend.submitMove(id, current.move_no, state, nextTurn, finish, winner);
      upsertMatch(updated);
      match = store.matches.get(id) || updated;
      return match;
    } catch (err) {
      if (err.code === 'STALE_MOVE') {
        const fresh = await store.backend.getMatch(id);
        if (fresh) upsertMatch(fresh);
      }
      throw err;
    }
  }

  async function refetch() {
    const fresh = await store.backend.getMatch(id);
    if (fresh) {
      upsertMatch(fresh);
      match = store.matches.get(id) || fresh;
    }
    return match;
  }

  function playerTag(uid) {
    const profile = profileOf(uid);
    const turn = match.status === 'active' && match.current_turn === uid;
    return `
      <div class="player-tag ${turn ? 'is-turn' : ''} ${uid === store.userId ? 'is-me' : ''} ${match.winner_id === uid ? 'is-winner' : ''}">
        ${avatarHTML(profile, { size: 'md' })}
        <span class="player-tag__name">${nameHTML(profile)}${uid === store.userId ? ' <span class="muted">(you)</span>' : ''}</span>
        ${match.winner_id === uid ? `<span class="player-tag__crown" title="Winner">${icon('trophy')}</span>` : ''}
      </div>`;
  }

  function resultHTML() {
    const uid = store.userId;
    const prize = match.stake * 2 + match.reward;
    if (match.status === 'finished') {
      if (!match.winner_id) return `<div class="result result--draw"><strong>Draw</strong><span>${match.stake ? 'Both stakes were refunded.' : 'Nobody wins this time.'}</span></div>`;
      if (match.winner_id === uid) return `<div class="result result--won"><strong>🏆 You won!</strong><span>${kudosPill(`+${prize}`)} added to your balance.</span></div>`;
      return `<div class="result result--lost"><strong>${esc(nameOf(match.winner_id))} won</strong><span>${match.stake ? `You lost your ${match.stake} kudos stake.` : 'Good game!'}</span></div>`;
    }
    if (match.status === 'declined') return `<div class="result result--draw"><strong>Challenge declined</strong><span>${esc(nameOf(match.player2_id))} said no this time.</span></div>`;
    if (match.status === 'cancelled') return '<div class="result result--draw"><strong>Challenge cancelled</strong></div>';
    return '';
  }

  function pendingHTML() {
    const uid = store.userId;
    const game = GAMES[match.game_type];
    const challenger = nameOf(match.player1_id);
    if (match.player2_id === uid) {
      return `
        <div class="invite card">
          <div class="invite__icon" aria-hidden="true">${game.icon}</div>
          <h3>${esc(challenger)} challenged you to ${esc(game.name)}</h3>
          <p class="muted">${esc(game.tagline)}</p>
          <p>${match.stake ? `Stake: ⭐ ${match.stake} each. ` : ''}Winner gets ${kudosPill(match.stake * 2 + match.reward)}.</p>
          <div class="invite__actions">
            <button type="button" class="btn btn--ghost" data-decline>Decline</button>
            <button type="button" class="btn btn--primary" data-accept>${icon('check')} Accept &amp; play</button>
          </div>
        </div>`;
    }
    return `
      <div class="invite card">
        <div class="invite__icon" aria-hidden="true">${game.icon}</div>
        <h3>Waiting for ${esc(nameOf(match.player2_id))} to accept</h3>
        <p class="muted">Sent ${esc(timeAgo(match.created_at))}. They'll get a notification.</p>
        <div class="invite__actions">
          <button type="button" class="btn btn--ghost" data-cancel>Cancel challenge</button>
        </div>
      </div>`;
  }

  function renderFrame() {
    const game = GAMES[match.game_type];
    root.innerHTML = `
      <div class="match match--${esc(match.game_type)}">
        <header class="match__top">
          <a class="icon-btn" href="#/games" aria-label="Back to the arcade">${icon('arrowLeft')}</a>
          <h2 class="match__title"><span aria-hidden="true">${game.icon}</span> ${esc(game.name)}</h2>
          <span class="match__pot" title="Winner's prize">${kudosPill(match.stake * 2 + match.reward)}</span>
          <span class="spacer"></span>
          <button type="button" class="btn btn--ghost btn--sm" data-resign hidden>${icon('flag')}<span>Resign</span></button>
          <button type="button" class="btn btn--soft btn--sm" data-rematch hidden>${icon('rotate')}<span>Rematch</span></button>
        </header>
        <div class="match__players" data-players></div>
        <p class="match__status" data-status aria-live="polite"></p>
        <div data-result></div>
        <div class="match__body" data-body></div>
      </div>`;
  }

  function renderChrome() {
    $('[data-players]', root).innerHTML = `${playerTag(match.player1_id)}<span class="vs">vs</span>${playerTag(match.player2_id)}`;
    $('[data-result]', root).innerHTML = resultHTML();
    $('[data-resign]', root).hidden = match.status !== 'active';
    $('[data-rematch]', root).hidden = !['finished', 'declined', 'cancelled'].includes(match.status);
    if (match.status === 'pending') setStatus(match.player2_id === store.userId ? 'You have been challenged!' : 'Challenge sent.', match.player2_id === store.userId);
    if (match.status === 'declined' || match.status === 'cancelled') setStatus('This match did not happen.', false);
    if (match.status === 'finished' && match.winner_id === store.userId && !celebrated) {
      celebrated = true;
      celebrate($('.result', root), '🏆', 18);
    }
  }

  async function renderBody() {
    const body = $('[data-body]', root);
    if (match.status === 'pending') {
      if (controller) {
        controller.destroy();
        controller = null;
      }
      body.innerHTML = pendingHTML();
      return;
    }
    if (match.status === 'declined' || match.status === 'cancelled') {
      if (controller) {
        controller.destroy();
        controller = null;
      }
      body.innerHTML = '';
      return;
    }
    if (!gameModule) gameModule = (await GAMES[match.game_type].load()).default;
    if (destroyed) return;
    if (!controller) {
      body.innerHTML = '';
      const stage = document.createElement('div');
      stage.className = 'match__stage';
      body.append(stage);
      controller = gameModule.mount(stage, {
        userId: store.userId,
        match,
        submit,
        refetch,
        nameOf: (uid) => profileOf(uid)?.username || 'Opponent',
        setStatus,
      });
    } else {
      controller.update(match);
    }
  }

  async function render() {
    renderChrome();
    await renderBody();
  }

  async function load() {
    try {
      if (!match) {
        match = await store.backend.getMatch(id);
        if (match) upsertMatch(match);
      }
    } catch (err) {
      showError(err);
    }
    if (destroyed) return;
    if (!match) {
      root.innerHTML = `
        <div class="card error-card">
          <h2>Match not found</h2>
          <p class="muted">It may have been removed, or it belongs to other players.</p>
          <a class="btn btn--primary" href="#/games">${icon('arrowLeft')} Back to the arcade</a>
        </div>`;
      return;
    }
    renderFrame();
    await render();
  }

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button || !match) return;
    if (button.matches('[data-accept]')) {
      await withBusy(button, async () => {
        try {
          match = await acceptMatch(match);
          await render();
        } catch (err) {
          showError(err);
        }
      });
    } else if (button.matches('[data-decline]')) {
      await withBusy(button, async () => {
        try {
          match = await declineMatch(match);
          await render();
        } catch (err) {
          showError(err);
        }
      });
    } else if (button.matches('[data-cancel]')) {
      await withBusy(button, async () => {
        try {
          match = await cancelMatch(match);
          await render();
        } catch (err) {
          showError(err);
        }
      });
    } else if (button.matches('[data-resign]')) {
      const other = nameOf(opponentOf(match, store.userId));
      const ok = await confirmDialog({
        title: 'Resign this match?',
        message: `${other} will be awarded the win${match.stake ? ` and both stakes (${match.stake * 2} kudos)` : ''}.`,
        confirmText: 'Resign',
        danger: true,
      });
      if (!ok) return;
      try {
        const updated = await store.backend.resignMatch(match.id);
        upsertMatch(updated);
        match = store.matches.get(id) || updated;
        await render();
      } catch (err) {
        showError(err);
      }
    } else if (button.matches('[data-rematch]')) {
      openChallengeModal(match.game_type, { opponentId: opponentOf(match, store.userId), stake: match.stake });
    }
  });

  const offBus = onMany({
    matches: () => {
      const latest = store.matches.get(id);
      if (!latest || latest === match || !$('[data-body]', root)) return;
      match = latest;
      render();
    },
    profiles: () => {
      if (match && $('[data-players]', root)) renderChrome();
    },
    presence: () => refreshPresenceDots(root),
    resync: async () => {
      await refetch();
      if ($('[data-body]', root)) render();
    },
  });

  load();

  return () => {
    destroyed = true;
    offBus();
    if (controller) controller.destroy();
  };
}
