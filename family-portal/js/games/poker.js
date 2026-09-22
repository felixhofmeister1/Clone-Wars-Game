/** Poker UI: heads-up Hold'em table, betting controls, showdown results. */
import { icon } from '../core/icons.js';
import { showError } from '../core/ui.js';
import { esc, $, clamp } from '../core/utils.js';
import {
  createState as createPokerState, startMatch, applyAction, legalActions, evaluateBest, cardLabel,
  SUIT_SYMBOLS, opponent,
} from './poker-rules.js';

const STREET_LABELS = { preflop: 'Pre-flop', flop: 'Flop', turn: 'Turn', river: 'River', complete: 'Hand over', waiting: 'Waiting' };

function cardHTML(card, { highlight = false, small = false } = {}) {
  if (!card) return `<span class="pcard pcard--empty ${small ? 'pcard--sm' : ''}"></span>`;
  const red = card[1] === 'h' || card[1] === 'd';
  const rank = card[0] === 'T' ? '10' : card[0];
  return `<span class="pcard ${red ? 'pcard--red' : ''} ${highlight ? 'is-best' : ''} ${small ? 'pcard--sm' : ''}" aria-label="${esc(cardLabel(card))}">
    <span class="pcard__rank">${rank}</span><span class="pcard__suit">${SUIT_SYMBOLS[card[1]]}</span>
  </span>`;
}

const backHTML = (small = false) => `<span class="pcard pcard--back ${small ? 'pcard--sm' : ''}" aria-label="Hidden card"></span>`;

function describeHand(hole, board) {
  if (!hole?.length) return '';
  if (board.length < 3) {
    const [a, b] = hole;
    if (a[0] === b[0]) return 'Pocket pair';
    return a[1] === b[1] ? 'Suited' : 'High card';
  }
  return evaluateBest([...hole, ...board]).name;
}

export default {
  type: 'poker',

  createState({ player1, player2 }) {
    return createPokerState(player1, player2);
  },

  acceptState(match) {
    const state = startMatch(match.game_state, match.player2_id);
    return { state, firstTurn: state.matchOver ? null : state.toAct };
  },

  mount(container, ctx) {
    const me = ctx.userId;
    let match = ctx.match;
    let busy = false;
    let raiseTo = 0;

    container.innerHTML = `
      <div class="poker">
        <div class="poker__table">
          <div class="seat seat--opp" data-seat="opp"></div>
          <div class="poker__center">
            <div class="poker__board" data-board></div>
            <div class="poker__pot" data-pot></div>
            <div class="poker__street" data-street></div>
          </div>
          <div class="seat seat--me" data-seat="me"></div>
        </div>
        <div class="poker__actions" data-actions></div>
        <section class="poker__last" data-last hidden></section>
        <ul class="game-log" data-log></ul>
      </div>`;

    const state = () => match.game_state;
    const myTurn = () => match.status === 'active' && match.current_turn === me && state().toAct === me && !busy;

    function seatHTML(uid, isMe) {
      const s = state();
      const turn = match.status === 'active' && s.toAct === uid;
      const cards = isMe
        ? (s.hole?.[uid] || []).map((c) => cardHTML(c)).join('')
        : (s.hole?.[uid] || []).map(() => backHTML()).join('');
      const bet = s.bets?.[uid] || 0;
      const strength = isMe ? describeHand(s.hole?.[uid], s.board || []) : '';
      return `
        <div class="seat__row">
          <div class="seat__info ${turn ? 'is-turn' : ''}">
            <span class="seat__name">${esc(isMe ? 'You' : ctx.nameOf(uid))}${s.dealer === uid ? '<span class="dealer-btn" title="Dealer (small blind)">D</span>' : ''}</span>
            <span class="seat__chips">${s.chips?.[uid] ?? 0} chips</span>
            ${strength && match.status === 'active' ? `<span class="seat__hand">${esc(strength)}</span>` : ''}
          </div>
          <div class="seat__cards">${cards}</div>
        </div>
        <div class="seat__bet ${bet ? '' : 'is-empty'}">${bet ? `<span class="chip-stack"></span>${bet}` : ''}</div>`;
    }

    function boardHTML() {
      const board = state().board || [];
      return Array.from({ length: 5 }, (_, i) => cardHTML(board[i])).join('');
    }

    function lastHandHTML() {
      const last = state().lastHand;
      if (!last) return '';
      const winners = last.winners || [];
      const who = winners.length > 1 ? 'Split pot' : `${winners[0] === me ? 'You' : esc(ctx.nameOf(winners[0]))} won ${last.pot}`;
      if (last.reason === 'fold') {
        return `<h3>Hand ${last.no}</h3><p>${who}: ${last.folder === me ? 'you folded' : `${esc(ctx.nameOf(last.folder))} folded`}.</p>`;
      }
      const reveal = last.reveal || {};
      return `
        <h3>Hand ${last.no} showdown</h3>
        <p>${who}${winners.length === 1 ? ` with ${esc((reveal[winners[0]]?.name || '').toLowerCase())}` : ''}.</p>
        <div class="showdown">
          ${state().players.map((uid) => `
            <div class="showdown__player ${winners.includes(uid) ? 'is-winner' : ''}">
              <span class="showdown__name">${uid === me ? 'You' : esc(ctx.nameOf(uid))}</span>
              <span class="showdown__cards">${(reveal[uid]?.cards || []).map((c) => cardHTML(c, { small: true, highlight: reveal[uid]?.best?.includes(c) })).join('')}</span>
              <span class="showdown__hand">${esc(reveal[uid]?.name || '')}</span>
            </div>`).join('')}
          <div class="showdown__board">${(last.board || []).map((c) => cardHTML(c, { small: true })).join('')}</div>
        </div>`;
    }

    function actionsHTML() {
      if (!myTurn()) return '';
      const legal = legalActions(state(), me);
      raiseTo = clamp(raiseTo || legal.minRaiseTo, legal.minRaiseTo, legal.maxRaiseTo);
      return `
        <div class="poker__buttons">
          ${legal.canFold ? '<button type="button" class="btn btn--danger-ghost" data-act="fold">Fold</button>' : ''}
          ${legal.canCheck
            ? '<button type="button" class="btn btn--soft" data-act="check">Check</button>'
            : `<button type="button" class="btn btn--soft" data-act="call">Call ${legal.callAmount}${legal.callAmount < legal.toCall || legal.callAmount === state().chips[me] ? ' (all-in)' : ''}</button>`}
        </div>
        ${legal.canRaise ? `
          <div class="raise">
            <div class="raise__quick">
              <button type="button" class="chip-btn" data-quick="min">Min</button>
              <button type="button" class="chip-btn" data-quick="half">½ pot</button>
              <button type="button" class="chip-btn" data-quick="pot">Pot</button>
              <button type="button" class="chip-btn" data-quick="max">All-in</button>
            </div>
            <input type="range" class="raise__slider" data-raise min="${legal.minRaiseTo}" max="${legal.maxRaiseTo}" step="1" value="${raiseTo}" aria-label="Raise amount">
            <button type="button" class="btn btn--primary" data-act="raise">${legal.isBet ? 'Bet' : 'Raise to'} <span data-raise-label>${raiseTo}</span></button>
          </div>` : ''}`;
    }

    function statusText() {
      const s = state();
      const other = ctx.nameOf(opponent(s, me));
      if (match.status === 'finished') {
        if (s.resignedBy) return s.resignedBy === me ? 'You left the table.' : `${other} left the table.`;
        if (!match.winner_id) return `Match drawn at ${s.chips[me]} chips each. Stakes refunded.`;
        return match.winner_id === me
          ? `You win the match with ${s.chips[me]} chips! 🎉`
          : `${other} wins the match with ${s.chips[match.winner_id]} chips.`;
      }
      if (myTurn()) {
        const legal = legalActions(s, me);
        return legal.canCheck ? 'Your move: check or bet.' : `Your move: ${legal.toCall} to call.`;
      }
      return `Waiting for ${other}…`;
    }

    function paint() {
      const s = state();
      const other = opponent(s, me);
      $('[data-seat="opp"]', container).innerHTML = seatHTML(other, false);
      $('[data-seat="me"]', container).innerHTML = seatHTML(me, true);
      $('[data-board]', container).innerHTML = boardHTML();
      const livePot = (s.pot || 0) + (s.bets?.[me] || 0) + (s.bets?.[other] || 0);
      $('[data-pot]', container).innerHTML = `${icon('star')} Pot ${livePot}`;
      $('[data-street]', container).textContent = `${STREET_LABELS[s.street] || ''} · Hand ${s.handNo} of ${s.config.maxHands} · Blinds ${s.config.smallBlind}/${s.config.bigBlind}`;
      $('[data-actions]', container).innerHTML = actionsHTML();
      const last = $('[data-last]', container);
      last.innerHTML = lastHandHTML();
      last.hidden = !s.lastHand;
      $('[data-log]', container).innerHTML = (s.log || []).map((e) => `<li>${e.u ? `<b>${esc(ctx.nameOf(e.u))}</b> ` : ''}${esc(e.t)}</li>`).join('');
      ctx.setStatus(statusText(), myTurn());
    }

    async function act(action) {
      if (!myTurn()) return;
      busy = true;
      paint();
      try {
        const next = applyAction(state(), me, action);
        match = await ctx.submit(next, {
          nextTurn: next.matchOver ? null : next.toAct,
          finish: next.matchOver,
          winner: next.winner,
        });
        raiseTo = 0;
      } catch (err) {
        if (err.code === 'STALE_MOVE') match = await ctx.refetch();
        showError(err);
      } finally {
        busy = false;
        paint();
      }
    }

    container.addEventListener('click', (event) => {
      const button = event.target.closest('[data-act], [data-quick]');
      if (!button || !myTurn()) return;
      if (button.dataset.act) {
        act(button.dataset.act === 'raise' ? { type: 'raise', amount: raiseTo } : { type: button.dataset.act });
        return;
      }
      const legal = legalActions(state(), me);
      const opp = opponent(state(), me);
      const afterCall = legal.pot + legal.toCall;
      const targets = {
        min: legal.minRaiseTo,
        half: state().bets[opp] + Math.round(afterCall / 2),
        pot: state().bets[opp] + afterCall,
        max: legal.maxRaiseTo,
      };
      raiseTo = clamp(targets[button.dataset.quick], legal.minRaiseTo, legal.maxRaiseTo);
      const slider = $('[data-raise]', container);
      if (slider) slider.value = String(raiseTo);
      const label = $('[data-raise-label]', container);
      if (label) label.textContent = String(raiseTo);
    });
    container.addEventListener('input', (event) => {
      if (event.target.matches('[data-raise]')) {
        raiseTo = Number(event.target.value);
        $('[data-raise-label]', container).textContent = String(raiseTo);
      }
    });

    paint();

    return {
      update(next) {
        const handChanged = next.game_state.handNo !== state().handNo;
        match = next;
        if (handChanged) raiseTo = 0;
        paint();
      },
      destroy() {},
    };
  },
};
