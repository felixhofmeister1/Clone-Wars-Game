// Unit tests for the pure game engines. Run with:  node --test family-portal/tests/
import test from 'node:test';
import assert from 'node:assert/strict';

import * as bs from '../js/games/battleships-rules.js';
import * as pool from '../js/games/pool-engine.js';
import * as poker from '../js/games/poker-rules.js';

const A = 'player-a';
const B = 'player-b';

function seeded(seed = 42) {
  let s = seed >>> 0;
  const random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { random, randomInt: (n) => Math.floor(random() * n) };
}

// ------------------------------------------------------------------ battleships

test('battleships: random fleets are always valid', () => {
  const { random } = seeded(7);
  for (let i = 0; i < 200; i += 1) {
    const fleet = bs.randomFleet(random);
    assert.equal(bs.validateFleet(fleet).ok, true);
  }
});

test('battleships: overlapping and off-board fleets are rejected', () => {
  const fleet = bs.FLEET.map((s, i) => ({ id: s.id, len: s.len, r: i, c: 0, dir: 'h' }));
  assert.equal(bs.validateFleet(fleet).ok, true);
  const overlap = fleet.map((s) => ({ ...s }));
  overlap[1] = { ...overlap[1], r: 0, c: 2, dir: 'v' };
  assert.equal(bs.validateFleet(overlap).ok, false);
  const off = fleet.map((s) => ({ ...s }));
  off[0] = { ...off[0], c: 7 };
  assert.equal(bs.validateFleet(off).ok, false);
  assert.equal(bs.validateFleet(fleet.slice(1)).ok, false);
});

test('battleships: placement, alternate fire, sinking and win', () => {
  const fleetA = bs.FLEET.map((s, i) => ({ id: s.id, len: s.len, r: i * 2, c: 0, dir: 'h' }));
  const fleetB = bs.FLEET.map((s, i) => ({ id: s.id, len: s.len, r: 0, c: i * 2, dir: 'v' }));
  let state = bs.createState(A, B);
  let res = bs.submitFleet(state, A, fleetA);
  assert.equal(res.started, false);
  assert.equal(res.nextTurn, null);
  res = bs.submitFleet(res.state, B, fleetB);
  assert.equal(res.started, true);
  assert.equal(res.nextTurn, B);
  state = res.state;
  assert.equal(state.phase, 'battle');

  let turn = B;
  const targets = { [A]: [], [B]: [] };
  fleetB.forEach((ship) => bs.shipCells(ship).forEach((cell) => targets[A].push(cell)));
  // A's ships sit on even rows, so B's odd-row shots always miss.
  const misses = [];
  for (let r = 1; r < 10; r += 2) for (let c = 0; c < 10; c += 1) misses.push([r, c]);
  let result;
  // B misses every time; A hits every ship cell of B.
  while (true) {
    if (turn === B) {
      const [mr, mc] = misses.shift();
      result = bs.fire(state, B, mr, mc);
      assert.equal(result.result.hit, false);
    } else {
      const [r, c] = targets[A].shift();
      result = bs.fire(state, A, r, c);
      assert.equal(result.result.hit, true);
    }
    state = result.state;
    if (result.result.won) break;
    turn = result.nextTurn;
  }
  assert.equal(state.phase, 'over');
  assert.equal(state.winner, A);
  assert.equal(bs.shipsRemaining(state, B), 0);
  assert.equal(bs.shipsRemaining(state, A), 5);
  assert.throws(() => bs.fire(state, B, 0, 0));
});

test('battleships: cannot fire twice at the same square', () => {
  let state = bs.createState(A, B);
  state = bs.submitFleet(state, A, bs.randomFleet(seeded(1).random)).state;
  state = bs.submitFleet(state, B, bs.randomFleet(seeded(2).random)).state;
  state = bs.fire(state, B, 3, 3).state;
  assert.throws(() => bs.fire(state, B, 3, 3), /already fired/);
});

// ------------------------------------------------------------------ pool

test('pool: rack has 16 balls, 8 in the middle, no overlaps', () => {
  const balls = pool.rack(seeded(3).randomInt);
  assert.equal(balls.length, 16);
  assert.deepEqual(balls.map((b) => b.id), Array.from({ length: 16 }, (_, i) => i));
  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      const d = Math.hypot(balls[i].x - balls[j].x, balls[i].y - balls[j].y);
      assert.ok(d >= 2 * pool.R, `balls ${balls[i].id} and ${balls[j].id} overlap`);
    }
  }
});

test('pool: simulation is deterministic and all balls come to rest on the table or in pockets', () => {
  const balls = pool.rack(seeded(4).randomInt);
  const a = pool.simulate(balls, 1, 0.01, 1);
  const b = pool.simulate(balls, 1, 0.01, 1);
  assert.deepEqual(a.final, b.final);
  assert.equal(a.firstHit !== null, true);
  a.final.forEach((ball) => {
    if (!ball.p) {
      assert.ok(ball.x >= pool.R - 0.001 && ball.x <= pool.W - pool.R + 0.001, `ball ${ball.id} x=${ball.x}`);
      assert.ok(ball.y >= pool.R - 0.001 && ball.y <= pool.H - pool.R + 0.001, `ball ${ball.id} y=${ball.y}`);
    }
  });
});

test('pool: a straight shot into the corner pocket pots the ball', () => {
  const balls = [
    { id: 0, x: 500, y: 250, p: 0 },
    { id: 3, x: 700, y: 250 - 200 * (200 / 450), p: 0 },
  ];
  // aim from cue through ball 3 toward the top-right corner (1000, 0)
  const tx = pool.W - 20;
  const ty = 20;
  const obj = balls[1];
  const len = Math.hypot(tx - obj.x, ty - obj.y);
  const ghost = { x: obj.x - ((tx - obj.x) / len) * 2 * pool.R, y: obj.y - ((ty - obj.y) / len) * 2 * pool.R };
  const dx = ghost.x - balls[0].x;
  const dy = ghost.y - balls[0].y;
  const sim = pool.simulate(balls, dx, dy, 0.6);
  assert.equal(sim.firstHit, 3);
  assert.ok(sim.pocketed.includes(3), `pocketed: ${sim.pocketed}`);
});

test('pool: rules — groups assigned, turn kept, fouls give ball in hand, 8-ball wins/loses', () => {
  let state = pool.createState(A, B, seeded(5).randomInt);
  state.breakDone = true;
  state.kitchenOnly = false;
  state.ballInHand = false;
  // A pots a stripe cleanly: A becomes stripes and keeps the turn.
  let out = pool.applyShot(state, A, { dx: 1, dy: 0, power: 0.5 }, {
    final: state.balls.map((b) => (b.id === 11 ? { ...b, p: 1 } : { ...b })), pocketed: [11], firstHit: 11,
  });
  assert.equal(out.state.groups[A], 'stripes');
  assert.equal(out.state.groups[B], 'solids');
  assert.equal(out.nextTurn, A);
  assert.equal(out.state.ballInHand, false);

  // A then hits a solid first: foul, B gets ball in hand.
  out = pool.applyShot(out.state, A, { dx: 1, dy: 0, power: 0.5 }, {
    final: out.state.balls.map((b) => ({ ...b })), pocketed: [], firstHit: 2,
  });
  assert.equal(out.nextTurn, B);
  assert.equal(out.state.ballInHand, true);

  // B pots the 8 early: A wins.
  const early = pool.applyShot(out.state, B, { dx: 1, dy: 0, power: 0.5 }, {
    final: out.state.balls.map((b) => (b.id === 8 ? { ...b, p: 1 } : { ...b })), pocketed: [8], firstHit: 1,
  });
  assert.equal(early.finished, true);
  assert.equal(early.winner, A);

  // B clears solids then legally sinks the 8: B wins.
  const cleared = JSON.parse(JSON.stringify(out.state));
  cleared.balls.forEach((b) => { if (b.id >= 1 && b.id <= 7) b.p = 1; });
  const win = pool.applyShot(cleared, B, { dx: 1, dy: 0, power: 0.5 }, {
    final: cleared.balls.map((b) => (b.id === 8 ? { ...b, p: 1 } : { ...b })), pocketed: [8], firstHit: 8,
  });
  assert.equal(win.winner, B);

  // Scratch: cue ball is re-spotted on the table and opponent has ball in hand.
  const scratch = pool.applyShot(out.state, B, { dx: 1, dy: 0, power: 0.5 }, {
    final: out.state.balls.map((b) => (b.id === 0 ? { ...b, p: 1 } : { ...b })), pocketed: [0], firstHit: 1,
  });
  assert.equal(scratch.nextTurn, A);
  assert.equal(scratch.state.ballInHand, true);
  assert.equal(scratch.state.balls.find((b) => b.id === 0).p, 0);
});

test('pool: 8-ball on the break is re-spotted', () => {
  const state = pool.createState(A, B, seeded(6).randomInt);
  const out = pool.applyShot(state, A, { dx: 1, dy: 0, power: 1 }, {
    final: state.balls.map((b) => (b.id === 8 ? { ...b, p: 1 } : { ...b })), pocketed: [8], firstHit: 1,
  });
  assert.equal(out.finished, false);
  assert.equal(out.state.balls.find((b) => b.id === 8).p, 0);
});

test('pool: ball-in-hand placement validation', () => {
  const state = pool.createState(A, B, seeded(8).randomInt);
  assert.equal(pool.validCuePosition(state, 200, 250), true);
  assert.equal(pool.validCuePosition(state, 400, 250), false, 'kitchen only on the break');
  const rackBall = state.balls.find((b) => b.id === 1);
  const open = { ...state, kitchenOnly: false };
  assert.equal(pool.validCuePosition(open, rackBall.x, rackBall.y), false);
  const spot = pool.nearestValidCuePosition(open, rackBall.x, rackBall.y);
  assert.equal(pool.validCuePosition(open, spot.x, spot.y), true);
});

// ------------------------------------------------------------------ poker evaluation

const best = (cards) => poker.evaluateBest(cards.split(' '));

test('poker: hand categories', () => {
  assert.equal(best('As Ks Qs Js Ts 2d 3c').name, 'Royal flush');
  assert.equal(best('9h 8h 7h 6h 5h Ad Ac').name, 'Straight flush');
  assert.equal(best('Ah 2h 3h 4h 5h Kd Kc').score[1], 5, 'steel wheel is a 5-high straight flush');
  assert.equal(best('Qd Qc Qh Qs 2d 3c 4h').name, 'Four of a kind');
  assert.equal(best('Kd Kc Kh 2s 2d 3c 4h').name, 'Full house');
  assert.equal(best('Ad 9d 7d 4d 2d Kc Qh').name, 'Flush');
  assert.equal(best('As 2d 3c 4h 5s Kd Qc').name, 'Straight');
  assert.equal(best('7s 7d 7c Ah Ks 2d 4c').name, 'Three of a kind');
  assert.equal(best('7s 7d 5c 5h Ks 2d 4c').name, 'Two pair');
  assert.equal(best('7s 7d Ac 5h Ks 2d 4c').name, 'Pair');
  assert.equal(best('7s 9d Ac 5h Ks 2d 4c').name, 'High card');
});

test('poker: tie-breakers and kickers', () => {
  const cmp = (a, b) => poker.compareScores(best(a).score, best(b).score);
  assert.equal(cmp('As Ad Kc 7h 5s 3d 2c', 'Ah Ac Qc 7d 5h 3s 2d'), 1, 'pair of aces, king kicker wins');
  assert.equal(cmp('Ks Kd 2c 2h 9s 8d 7c', 'Kh Kc 3s 3d 4s 5d 6h'), -1, 'kings and threes beat kings and twos');
  assert.equal(cmp('Ks Kd 2c 2h 9s 8d 7c', 'Kh Kc 2s 2d 8s 5d 4h'), 1, 'same two pair: 9 kicker beats 8');
  assert.equal(cmp('As Ks Qd Jc 9h 3d 2c', 'Ah Kh Qc Jd 8s 3s 2d'), 1);
  assert.equal(cmp('Ts Js Qs Ks As 2d 3d', 'Th Jh Qh Kh Ah 4c 5c'), 0, 'two royal flushes split');
  assert.equal(cmp('2s 3d 4c 5h 6s 9d Kc', 'As 2d 3c 4h 5d 9h Kd'), 1, 'six-high straight beats the wheel');
  assert.equal(cmp('Ah Ad Ac Kh Kd 2s 3s', 'Kc Ks Kh Ah As 2d 3d'), 1, 'aces full beats kings full');
});

// ------------------------------------------------------------------ poker betting

function newMatch(seed = 11) {
  const { randomInt } = seeded(seed);
  const created = poker.createState(A, B);
  return { state: poker.startMatch(created, B, randomInt), randomInt };
}

test('poker: blinds, pre-flop order, and chip conservation', () => {
  const { state } = newMatch();
  assert.equal(state.handNo, 1);
  assert.equal(state.dealer, B);
  assert.equal(state.toAct, B, 'dealer (small blind) acts first pre-flop');
  assert.equal(state.bets[B], 5);
  assert.equal(state.bets[A], 10);
  assert.equal(state.chips[A] + state.chips[B] + state.bets[A] + state.bets[B] + state.pot, 400);
  assert.equal(state.hole[A].length, 2);
  assert.equal(state.hole[B].length, 2);
  assert.equal(new Set([...state.hole[A], ...state.hole[B], ...state.deck]).size, 52);
});

test('poker: call/check through to showdown moves the pot to the winner', () => {
  let { state, randomInt } = newMatch(12);
  state = poker.applyAction(state, B, { type: 'call' }, randomInt);
  assert.equal(state.toAct, A, 'big blind gets the option');
  state = poker.applyAction(state, A, { type: 'check' }, randomInt);
  assert.equal(state.street, 'flop');
  assert.equal(state.board.length, 3);
  assert.equal(state.toAct, A, 'big blind acts first after the flop');
  for (const street of ['flop', 'turn', 'river']) {
    assert.equal(state.street, street);
    state = poker.applyAction(state, A, { type: 'check' }, randomInt);
    state = poker.applyAction(state, B, { type: 'check' }, randomInt);
  }
  assert.equal(state.handNo, 2, 'next hand dealt automatically');
  assert.equal(state.lastHand.reason, 'showdown');
  assert.equal(state.lastHand.pot, 20);
  assert.equal(state.dealer, A, 'dealer button moves');
  const total = state.chips[A] + state.chips[B] + state.bets[A] + state.bets[B] + state.pot;
  assert.equal(total, 400);
});

test('poker: fold awards the pot without revealing cards', () => {
  let { state, randomInt } = newMatch(13);
  state = poker.applyAction(state, B, { type: 'raise', amount: 30 }, randomInt);
  assert.equal(state.toAct, A);
  assert.throws(() => poker.applyAction(state, B, { type: 'check' }, randomInt), /not your turn/);
  state = poker.applyAction(state, A, { type: 'fold' }, randomInt);
  assert.equal(state.lastHand.reason, 'fold');
  assert.equal(state.lastHand.reveal, null);
  assert.equal(state.lastHand.winners[0], B);
  assert.equal(state.handNo, 2);
});

test('poker: raise limits and re-raise reopens action', () => {
  let { state, randomInt } = newMatch(14);
  const legal = poker.legalActions(state, B);
  assert.equal(legal.minRaiseTo, 20);
  assert.equal(legal.maxRaiseTo, 200);
  assert.throws(() => poker.applyAction(state, B, { type: 'raise', amount: 15 }, randomInt));
  state = poker.applyAction(state, B, { type: 'raise', amount: 40 }, randomInt);
  const legalA = poker.legalActions(state, A);
  assert.equal(legalA.toCall, 30);
  assert.equal(legalA.minRaiseTo, 70, 'min re-raise is the size of the last raise');
  state = poker.applyAction(state, A, { type: 'raise', amount: 70 }, randomInt);
  assert.equal(state.toAct, B);
  state = poker.applyAction(state, B, { type: 'call' }, randomInt);
  assert.equal(state.street, 'flop');
  assert.equal(state.pot, 140);
});

test('poker: all-in pre-flop runs the board out and can end the match', () => {
  let { state, randomInt } = newMatch(15);
  state = poker.applyAction(state, B, { type: 'raise', amount: 200 }, randomInt);
  state = poker.applyAction(state, A, { type: 'call' }, randomInt);
  assert.equal(state.lastHand.board.length, 5);
  assert.equal(state.lastHand.reason, 'showdown');
  const [a, b] = [state.chips[A], state.chips[B]];
  assert.equal(a + b, 400);
  if (a === 0 || b === 0) {
    assert.equal(state.matchOver, true);
    assert.equal(state.winner, a > b ? A : B);
  } else {
    assert.equal(a, 200, 'a split pot returns the chips');
    assert.equal(state.handNo, 2);
  }
});

test('poker: short-stacked small blind is all-in, uncalled chips return, board runs out', () => {
  const { randomInt } = seeded(16);
  const created = poker.createState(A, B);
  created.chips[B] = 3;
  created.chips[A] = 397;
  const state = poker.startMatch(created, B, randomInt);
  // B (dealer) could only post 3 of the 5 small blind; A's extra 7 comes back.
  assert.equal(state.lastHand.reason, 'showdown');
  assert.equal(state.lastHand.pot, 6);
  assert.equal(state.lastHand.board.length, 5);
  assert.equal(state.chips[A] + state.chips[B] + state.bets[A] + state.bets[B] + state.pot, 400);
  if (state.lastHand.winners.length === 1 && state.lastHand.winners[0] === A) {
    assert.equal(state.matchOver, true);
    assert.equal(state.winner, A);
  } else {
    assert.equal(state.matchOver, false);
    assert.equal(state.handNo, 2);
  }
});

test('poker: six-hand match ends with the chip leader as winner', () => {
  let { state, randomInt } = newMatch(17);
  let guard = 0;
  while (!state.matchOver && guard < 500) {
    const uid = state.toAct;
    const legal = poker.legalActions(state, uid);
    state = poker.applyAction(state, uid, { type: legal.canCheck ? 'check' : 'call' }, randomInt);
    guard += 1;
  }
  assert.equal(state.matchOver, true);
  assert.equal(state.handNo, 6);
  assert.equal(state.chips[A] + state.chips[B], 400);
  const expected = state.chips[A] > state.chips[B] ? A : state.chips[B] > state.chips[A] ? B : null;
  assert.equal(state.winner, expected);
});
