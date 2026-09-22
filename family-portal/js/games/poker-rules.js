/**
 * Heads-up Texas Hold'em (pure, no DOM).
 *
 * A match is `maxHands` hands (default 6) or until someone is out of chips;
 * the chip leader wins the match. No-limit betting, blinds 5/10, 200 chips.
 * Heads-up conventions: the dealer posts the small blind and acts first
 * pre-flop; the big blind acts first on every later street.
 *
 * Each action is applied by the acting player's device and submitted as the
 * next match state. Shuffling uses crypto.getRandomValues.
 */
export const DEFAULT_CONFIG = Object.freeze({ startingChips: 200, smallBlind: 5, bigBlind: 10, maxHands: 6 });

const RANKS = '23456789TJQKA';
const SUITS = 'shdc';
export const SUIT_SYMBOLS = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const HAND_NAMES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];

const clone = (value) => JSON.parse(JSON.stringify(value));

export function secureRandomInt(n) {
  if (n <= 1) return 0;
  if (globalThis.crypto?.getRandomValues) {
    const limit = Math.floor(0x100000000 / n) * n;
    const buf = new Uint32Array(1);
    do {
      crypto.getRandomValues(buf);
    } while (buf[0] >= limit);
    return buf[0] % n;
  }
  return Math.floor(Math.random() * n);
}

export function newDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(r + s);
  return deck;
}

export function shuffle(list, randomInt = secureRandomInt) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const rankValue = (card) => RANKS.indexOf(card[0]) + 2;

export function cardLabel(card) {
  const rank = card[0] === 'T' ? '10' : card[0];
  return `${rank}${SUIT_SYMBOLS[card[1]]}`;
}

// ------------------------------------------------------------------ evaluation

/** Score a 5-card hand as [category, tiebreak…]; compare lexicographically. */
export function evaluate5(cards) {
  const values = cards.map(rankValue).sort((a, b) => b - a);
  const flush = cards.every((c) => c[1] === cards[0][1]);
  const unique = [...new Set(values)];
  let straightHigh = 0;
  if (unique.length === 5) {
    if (values[0] - values[4] === 4) straightHigh = values[0];
    else if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) straightHigh = 5;
  }
  const counts = new Map();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  const groups = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  if (straightHigh && flush) return [8, straightHigh];
  if (groups[0].count === 4) return [7, groups[0].value, groups[1].value];
  if (groups[0].count === 3 && groups[1].count === 2) return [6, groups[0].value, groups[1].value];
  if (flush) return [5, ...values];
  if (straightHigh) return [4, straightHigh];
  if (groups[0].count === 3) return [3, groups[0].value, groups[1].value, groups[2].value];
  if (groups[0].count === 2 && groups[1].count === 2) return [2, groups[0].value, groups[1].value, groups[2].value];
  if (groups[0].count === 2) return [1, groups[0].value, groups[1].value, groups[2].value, groups[3].value];
  return [0, ...values];
}

export function compareScores(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/** Best 5 of 5–7 cards: { score, cards, name }. */
export function evaluateBest(cards) {
  let best = null;
  const n = cards.length;
  for (let a = 0; a < n; a += 1) {
    for (let b = a + 1; b < n; b += 1) {
      for (let c = b + 1; c < n; c += 1) {
        for (let d = c + 1; d < n; d += 1) {
          for (let e = d + 1; e < n; e += 1) {
            const hand = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            const score = evaluate5(hand);
            if (!best || compareScores(score, best.score) > 0) best = { score, cards: hand };
          }
        }
      }
    }
  }
  const name = best.score[0] === 8 && best.score[1] === 14 ? 'Royal flush' : HAND_NAMES[best.score[0]];
  return { ...best, name };
}

// ------------------------------------------------------------------ match state

export const opponent = (state, uid) => (state.players[0] === uid ? state.players[1] : state.players[0]);

export function createState(player1, player2, config = DEFAULT_CONFIG) {
  return {
    v: 1,
    players: [player1, player2],
    config: { ...config },
    chips: { [player1]: config.startingChips, [player2]: config.startingChips },
    handNo: 0,
    dealer: null,
    deck: [],
    hole: {},
    board: [],
    street: 'waiting',
    pot: 0,
    bets: { [player1]: 0, [player2]: 0 },
    acted: { [player1]: false, [player2]: false },
    toAct: null,
    minRaise: config.bigBlind,
    folded: null,
    log: [],
    lastHand: null,
    matchOver: false,
    winner: null,
  };
}

function log(state, u, t) {
  state.log = [{ u, t, h: state.handNo }, ...(state.log || [])].slice(0, 14);
}

function put(state, uid, amount) {
  const paid = Math.max(0, Math.min(amount, state.chips[uid]));
  state.chips[uid] -= paid;
  state.bets[uid] += paid;
  return paid;
}

function roundComplete(state) {
  if (state.folded) return true;
  const [a, b] = state.players;
  const maxBet = Math.max(state.bets[a], state.bets[b]);
  const active = state.players.filter((p) => state.chips[p] > 0);
  if (active.length === 0) return true;
  if (active.length === 1) return state.bets[active[0]] >= maxBet;
  return state.players.every((p) => state.acted[p] && state.bets[p] === maxBet);
}

function nextActor(state, justActed) {
  const maxBet = Math.max(...state.players.map((p) => state.bets[p]));
  const needs = (p) => state.chips[p] > 0 && (!state.acted[p] || state.bets[p] < maxBet);
  const other = opponent(state, justActed);
  if (needs(other)) return other;
  if (needs(justActed)) return justActed;
  return null;
}

function startHand(state, randomInt) {
  const cfg = state.config;
  const [a, b] = state.players;
  state.handNo += 1;
  state.deck = shuffle(newDeck(), randomInt);
  const nonDealer = opponent(state, state.dealer);
  state.hole = { [nonDealer]: [], [state.dealer]: [] };
  for (let i = 0; i < 2; i += 1) {
    state.hole[nonDealer].push(state.deck.pop());
    state.hole[state.dealer].push(state.deck.pop());
  }
  state.board = [];
  state.street = 'preflop';
  state.pot = 0;
  state.bets = { [a]: 0, [b]: 0 };
  state.acted = { [a]: false, [b]: false };
  state.folded = null;
  state.minRaise = cfg.bigBlind;
  const sbPaid = put(state, state.dealer, cfg.smallBlind);
  const bbPaid = put(state, nonDealer, cfg.bigBlind);
  log(state, null, `Hand ${state.handNo} of ${cfg.maxHands}. Blinds ${sbPaid}/${bbPaid}.`);
  state.toAct = state.chips[state.dealer] > 0 ? state.dealer : nonDealer;
  if (roundComplete(state)) advanceStreet(state, randomInt);
  else state.toAct = nextActor(state, nonDealer) || state.dealer;
}

function finishHand(state, randomInt) {
  state.street = 'complete';
  state.toAct = null;
  const [a, b] = state.players;
  if (state.chips[a] === 0 || state.chips[b] === 0 || state.handNo >= state.config.maxHands) {
    state.matchOver = true;
    state.winner = state.chips[a] > state.chips[b] ? a : state.chips[b] > state.chips[a] ? b : null;
    log(state, state.winner, state.winner ? 'wins the match!' : 'The match is a draw.');
    return;
  }
  state.dealer = opponent(state, state.dealer);
  startHand(state, randomInt);
}

function collectBets(state) {
  const [a, b] = state.players;
  if (state.bets[a] !== state.bets[b]) {
    const high = state.bets[a] > state.bets[b] ? a : b;
    const low = opponent(state, high);
    const excess = state.bets[high] - state.bets[low];
    state.bets[high] -= excess;
    state.chips[high] += excess;
    log(state, high, `gets ${excess} uncalled chips back.`);
  }
  state.pot += state.bets[a] + state.bets[b];
  state.bets = { [a]: 0, [b]: 0 };
  state.acted = { [a]: false, [b]: false };
  state.minRaise = state.config.bigBlind;
}

function showdown(state, randomInt) {
  const [a, b] = state.players;
  const handA = evaluateBest([...state.hole[a], ...state.board]);
  const handB = evaluateBest([...state.hole[b], ...state.board]);
  const cmp = compareScores(handA.score, handB.score);
  const pot = state.pot;
  let winners;
  if (cmp > 0) winners = [a];
  else if (cmp < 0) winners = [b];
  else winners = [a, b];
  if (winners.length === 1) {
    state.chips[winners[0]] += pot;
    log(state, winners[0], `wins ${pot} with ${(winners[0] === a ? handA : handB).name.toLowerCase()}.`);
  } else {
    const half = Math.floor(pot / 2);
    const bigBlindPlayer = opponent(state, state.dealer);
    state.chips[a] += half;
    state.chips[b] += half;
    state.chips[bigBlindPlayer] += pot - half * 2;
    log(state, null, `Split pot (${pot}) with ${handA.name.toLowerCase()}.`);
  }
  state.pot = 0;
  state.lastHand = {
    no: state.handNo,
    reason: 'showdown',
    pot,
    board: [...state.board],
    winners,
    reveal: {
      [a]: { cards: [...state.hole[a]], name: handA.name, best: handA.cards },
      [b]: { cards: [...state.hole[b]], name: handB.name, best: handB.cards },
    },
  };
  finishHand(state, randomInt);
}

function advanceStreet(state, randomInt) {
  for (;;) {
    collectBets(state);
    if (state.street === 'river') {
      showdown(state, randomInt);
      return;
    }
    state.deck.pop();
    if (state.street === 'preflop') {
      state.board.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
      state.street = 'flop';
      log(state, null, `Flop: ${state.board.map(cardLabel).join(' ')}`);
    } else if (state.street === 'flop') {
      state.board.push(state.deck.pop());
      state.street = 'turn';
      log(state, null, `Turn: ${cardLabel(state.board[3])}`);
    } else {
      state.board.push(state.deck.pop());
      state.street = 'river';
      log(state, null, `River: ${cardLabel(state.board[4])}`);
    }
    const bigBlindPlayer = opponent(state, state.dealer);
    state.toAct = state.chips[bigBlindPlayer] > 0 ? bigBlindPlayer : state.dealer;
    if (!roundComplete(state)) return;
  }
}

/** Deal the first hand. The dealer (small blind) acts first. */
export function startMatch(state, dealer, randomInt = secureRandomInt) {
  const next = clone(state);
  next.dealer = dealer;
  startHand(next, randomInt);
  return next;
}

export function legalActions(state, uid) {
  const opp = opponent(state, uid);
  const toCall = Math.max(0, state.bets[opp] - state.bets[uid]);
  const myTotal = state.bets[uid] + state.chips[uid];
  const oppTotal = state.bets[opp] + state.chips[opp];
  const maxRaiseTo = Math.min(myTotal, oppTotal);
  let minRaiseTo = state.bets[opp] + state.minRaise;
  const canRaise = state.chips[uid] > toCall && state.chips[opp] > 0 && maxRaiseTo > state.bets[opp];
  if (minRaiseTo > maxRaiseTo) minRaiseTo = maxRaiseTo;
  return {
    toCall,
    canCheck: toCall === 0,
    canFold: toCall > 0,
    callAmount: Math.min(toCall, state.chips[uid]),
    canRaise,
    minRaiseTo,
    maxRaiseTo,
    isBet: state.bets[opp] === 0,
    pot: state.pot + state.bets[uid] + state.bets[opp],
  };
}

/**
 * Apply fold / check / call / raise ({ type, amount: raise-to total }).
 * Returns the new state; the next player to act is state.toAct.
 */
export function applyAction(state, uid, action, randomInt = secureRandomInt) {
  if (state.matchOver) throw new Error('The match is over.');
  if (state.toAct !== uid) throw new Error("It's not your turn.");
  const next = clone(state);
  const opp = opponent(next, uid);
  const legal = legalActions(next, uid);

  switch (action.type) {
    case 'fold': {
      if (!legal.canFold) throw new Error('Nothing to fold to. Check instead.');
      next.folded = uid;
      const [a, b] = next.players;
      const pot = next.pot + next.bets[a] + next.bets[b];
      next.chips[opp] += pot;
      next.pot = 0;
      next.bets = { [a]: 0, [b]: 0 };
      log(next, uid, 'folds.');
      log(next, opp, `wins ${pot}.`);
      next.lastHand = { no: next.handNo, reason: 'fold', pot, board: [...next.board], winners: [opp], folder: uid, reveal: null };
      finishHand(next, randomInt);
      return next;
    }
    case 'check': {
      if (!legal.canCheck) throw new Error(`You need to call ${legal.toCall} or fold.`);
      next.acted[uid] = true;
      log(next, uid, 'checks.');
      break;
    }
    case 'call': {
      if (legal.toCall === 0) {
        next.acted[uid] = true;
        log(next, uid, 'checks.');
        break;
      }
      const paid = put(next, uid, legal.toCall);
      next.acted[uid] = true;
      log(next, uid, `calls ${paid}${next.chips[uid] === 0 ? ' and is all-in' : ''}.`);
      break;
    }
    case 'raise': {
      const to = Math.floor(Number(action.amount));
      if (!legal.canRaise) throw new Error('You cannot raise right now.');
      if (!Number.isFinite(to) || to < legal.minRaiseTo || to > legal.maxRaiseTo) {
        throw new Error(`Raise to between ${legal.minRaiseTo} and ${legal.maxRaiseTo}.`);
      }
      const raiseSize = to - next.bets[opp];
      put(next, uid, to - next.bets[uid]);
      if (raiseSize >= next.minRaise) next.minRaise = raiseSize;
      next.acted = { [uid]: true, [opp]: false };
      const verb = legal.isBet ? 'bets' : 'raises to';
      log(next, uid, `${verb} ${to}${next.chips[uid] === 0 ? ' (all-in)' : ''}.`);
      break;
    }
    default:
      throw new Error('Unknown action.');
  }

  if (roundComplete(next)) advanceStreet(next, randomInt);
  else next.toAct = nextActor(next, uid);
  return next;
}
