/**
 * 8-ball pool: deterministic 2D physics and simplified rules (pure, no DOM).
 *
 * The shooter's device simulates the shot, applies the rules and submits the
 * resulting state. The opponent's device replays the same shot from the stored
 * start positions, direction and power. The simulation only uses + − × ÷ and
 * sqrt, so replays match; the stored final positions are applied afterwards
 * either way.
 *
 * Units: table playing surface is 1000 × 500, balls have radius 12.
 */
export const W = 1000;
export const H = 500;
export const R = 12;
export const HEAD_X = 250;
export const FOOT = { x: 750, y: 250 };
export const HEAD = { x: 200, y: 250 };

/** Capture circles (centre slightly outside the cushion line). `vr` = drawn radius. */
export const POCKETS = [
  { x: -6, y: -6, r: 40, vx: 0, vy: 0, vr: 26 },
  { x: W / 2, y: -6, r: 27, vx: W / 2, vy: -4, vr: 22 },
  { x: W + 6, y: -6, r: 40, vx: W, vy: 0, vr: 26 },
  { x: -6, y: H + 6, r: 40, vx: 0, vy: H, vr: 26 },
  { x: W / 2, y: H + 6, r: 27, vx: W / 2, vy: H + 4, vr: 22 },
  { x: W + 6, y: H + 6, r: 40, vx: W, vy: H, vr: 26 },
];

const DT = 1 / 240;
const RECORD_EVERY = 4;
const MAX_STEPS = 240 * 25;
const FRICTION = 250;
const DRAG = 0.4;
const CUSHION = 0.78;
const BALL_RESTITUTION = 0.95;
const MIN_SPEED = 120;
const MAX_SPEED = 1750;
const STOP_SPEED = 4;

export const SOLIDS = [1, 2, 3, 4, 5, 6, 7];
export const STRIPES = [9, 10, 11, 12, 13, 14, 15];

export function groupOf(id) {
  if (id >= 1 && id <= 7) return 'solids';
  if (id >= 9 && id <= 15) return 'stripes';
  if (id === 8) return 'eight';
  return 'cue';
}

const clone = (value) => JSON.parse(JSON.stringify(value));
export const opponent = (state, uid) => (state.players[0] === uid ? state.players[1] : state.players[0]);

// ------------------------------------------------------------------ setup

/** Standard triangle rack: 8 in the middle, one solid and one stripe in the back corners. */
export function rack(randomInt) {
  const gap = 0.6;
  const dx = (2 * R + gap) * Math.sqrt(3) / 2;
  const positions = [];
  for (let row = 0; row < 5; row += 1) {
    for (let j = 0; j <= row; j += 1) {
      positions.push({ row, j, x: FOOT.x + row * dx, y: FOOT.y + (j - row / 2) * (2 * R + gap) });
    }
  }
  const shuffle = (list) => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const k = randomInt(i + 1);
      [out[i], out[k]] = [out[k], out[i]];
    }
    return out;
  };
  const solids = shuffle(SOLIDS);
  const stripes = shuffle(STRIPES);
  const cornerA = solids.pop();
  const cornerB = stripes.pop();
  const rest = shuffle([...solids, ...stripes]);
  const flip = randomInt(2) === 1;
  const balls = [{ id: 0, x: HEAD.x, y: HEAD.y, p: 0 }];
  positions.forEach((pos) => {
    let id;
    if (pos.row === 2 && pos.j === 1) id = 8;
    else if (pos.row === 4 && pos.j === 0) id = flip ? cornerB : cornerA;
    else if (pos.row === 4 && pos.j === 4) id = flip ? cornerA : cornerB;
    else id = rest.pop();
    balls.push({ id, x: pos.x, y: pos.y, p: 0 });
  });
  return balls.sort((a, b) => a.id - b.id);
}

export function createState(player1, player2, randomInt) {
  return {
    v: 1,
    players: [player1, player2],
    balls: rack(randomInt),
    groups: { [player1]: null, [player2]: null },
    breakDone: false,
    ballInHand: true,
    kitchenOnly: true,
    shotNo: 0,
    lastShot: null,
    log: [],
    winner: null,
    winReason: '',
  };
}

// ------------------------------------------------------------------ geometry helpers

function inPocket(x, y) {
  for (let i = 0; i < POCKETS.length; i += 1) {
    const p = POCKETS[i];
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy < p.r * p.r) return i;
  }
  return -1;
}

/** Is (x, y) a legal spot for the cue ball when the player has ball in hand? */
export function validCuePosition(state, x, y) {
  if (!(x >= R && x <= W - R && y >= R && y <= H - R)) return false;
  if (state.kitchenOnly && x > HEAD_X) return false;
  if (inPocket(x, y) >= 0) return false;
  return state.balls.every((b) => b.id === 0 || b.p || (b.x - x) ** 2 + (b.y - y) ** 2 >= (2 * R + 0.5) ** 2);
}

/** Nearest legal cue position to (x, y), searching outward in rings. */
export function nearestValidCuePosition(state, x, y) {
  const cx = Math.min(W - R, Math.max(R, state.kitchenOnly ? Math.min(x, HEAD_X) : x));
  const cy = Math.min(H - R, Math.max(R, y));
  if (validCuePosition(state, cx, cy)) return { x: cx, y: cy };
  for (let radius = 4; radius < 400; radius += 4) {
    for (let a = 0; a < 24; a += 1) {
      const angle = (a / 24) * Math.PI * 2;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (validCuePosition(state, px, py)) return { x: px, y: py };
    }
  }
  return { x: HEAD.x, y: HEAD.y };
}

/** Ray from the cue ball: first object ball contact (ghost-ball position) or cushion. */
export function aimPreview(balls, dx, dy) {
  const cue = balls.find((b) => b.id === 0);
  let best = null;
  for (const b of balls) {
    if (b.id === 0 || b.p) continue;
    const ox = b.x - cue.x;
    const oy = b.y - cue.y;
    const along = ox * dx + oy * dy;
    if (along <= 0) continue;
    const perp2 = ox * ox + oy * oy - along * along;
    const reach = (2 * R) * (2 * R);
    if (perp2 > reach) continue;
    const t = along - Math.sqrt(reach - perp2);
    if (t >= 0 && (!best || t < best.t)) best = { t, ball: b };
  }
  let wallT = Infinity;
  if (dx > 0) wallT = Math.min(wallT, (W - R - cue.x) / dx);
  if (dx < 0) wallT = Math.min(wallT, (R - cue.x) / dx);
  if (dy > 0) wallT = Math.min(wallT, (H - R - cue.y) / dy);
  if (dy < 0) wallT = Math.min(wallT, (R - cue.y) / dy);
  if (best && best.t < wallT) {
    const gx = cue.x + dx * best.t;
    const gy = cue.y + dy * best.t;
    const nx = best.ball.x - gx;
    const ny = best.ball.y - gy;
    const len = Math.sqrt(nx * nx + ny * ny) || 1;
    return { hit: best.ball.id, ghost: { x: gx, y: gy }, objectDir: { x: nx / len, y: ny / len }, end: { x: gx, y: gy } };
  }
  return { hit: null, ghost: null, objectDir: null, end: { x: cue.x + dx * wallT, y: cue.y + dy * wallT } };
}

// ------------------------------------------------------------------ physics

/**
 * Simulate a shot. balls: [{ id, x, y, p }]. Returns:
 *  { frames: number[][] (x, y, p per ball, in `order`), order: ids, final: balls,
 *    firstHit: id | null, pocketed: [id], cushionHits: n }
 */
export function simulate(balls, dx, dy, power) {
  const order = balls.map((b) => b.id);
  const s = balls.map((b) => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, p: b.p ? 1 : 0 }));
  const cue = s.find((b) => b.id === 0);
  const clamped = Math.min(1, Math.max(0, power));
  const speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * clamped;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  cue.vx = (dx / len) * speed;
  cue.vy = (dy / len) * speed;

  const frames = [];
  const snapshot = () => {
    const frame = [];
    for (const b of s) frame.push(b.x, b.y, b.p);
    frames.push(frame);
  };
  let firstHit = null;
  const pocketed = [];
  let cushionHits = 0;
  snapshot();

  for (let step = 1; step <= MAX_STEPS; step += 1) {
    let moving = false;
    for (const b of s) {
      if (b.p || (b.vx === 0 && b.vy === 0)) continue;
      b.x += b.vx * DT;
      b.y += b.vy * DT;
      const pocket = inPocket(b.x, b.y);
      if (pocket >= 0) {
        b.p = 1;
        b.vx = 0;
        b.vy = 0;
        b.x = POCKETS[pocket].vx;
        b.y = POCKETS[pocket].vy;
        pocketed.push(b.id);
        continue;
      }
      if (b.x < R) {
        b.x = R + (R - b.x);
        b.vx = -b.vx * CUSHION;
        b.vy *= 0.97;
        cushionHits += 1;
      } else if (b.x > W - R) {
        b.x = (W - R) - (b.x - (W - R));
        b.vx = -b.vx * CUSHION;
        b.vy *= 0.97;
        cushionHits += 1;
      }
      if (b.y < R) {
        b.y = R + (R - b.y);
        b.vy = -b.vy * CUSHION;
        b.vx *= 0.97;
        cushionHits += 1;
      } else if (b.y > H - R) {
        b.y = (H - R) - (b.y - (H - R));
        b.vy = -b.vy * CUSHION;
        b.vx *= 0.97;
        cushionHits += 1;
      }
    }

    for (let i = 0; i < s.length; i += 1) {
      const a = s[i];
      if (a.p) continue;
      for (let j = i + 1; j < s.length; j += 1) {
        const b = s[j];
        if (b.p) continue;
        const ox = b.x - a.x;
        const oy = b.y - a.y;
        const d2 = ox * ox + oy * oy;
        if (d2 >= 4 * R * R || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = ox / d;
        const ny = oy / d;
        const overlap = 2 * R - d;
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;
        const approach = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (approach > 0) {
          const impulse = approach * (1 + BALL_RESTITUTION) * 0.5;
          a.vx -= impulse * nx;
          a.vy -= impulse * ny;
          b.vx += impulse * nx;
          b.vy += impulse * ny;
          if (firstHit === null) {
            if (a.id === 0) firstHit = b.id;
            else if (b.id === 0) firstHit = a.id;
          }
        }
      }
    }

    for (const b of s) {
      if (b.p) continue;
      const v2 = b.vx * b.vx + b.vy * b.vy;
      if (v2 === 0) continue;
      const v = Math.sqrt(v2);
      const decel = (FRICTION + DRAG * v) * DT;
      if (v <= decel || v < STOP_SPEED) {
        b.vx = 0;
        b.vy = 0;
      } else {
        const k = (v - decel) / v;
        b.vx *= k;
        b.vy *= k;
        moving = true;
      }
    }

    if (step % RECORD_EVERY === 0) snapshot();
    if (!moving) break;
  }
  snapshot();

  const final = s.map((b) => ({ id: b.id, x: b.x, y: b.y, p: b.p }));
  return { frames, order, final, firstHit, pocketed, cushionHits };
}

// ------------------------------------------------------------------ rules

function respot(balls, id, target) {
  const ball = balls.find((b) => b.id === id);
  let x = target.x;
  const clear = (px) => balls.every((b) => b.id === id || b.p || (b.x - px) ** 2 + (b.y - target.y) ** 2 >= (2 * R + 0.5) ** 2);
  while (!clear(x) && x < W - R) x += 2;
  if (!clear(x)) {
    x = target.x;
    while (!clear(x) && x > R) x -= 2;
  }
  ball.x = x;
  ball.y = target.y;
  ball.p = 0;
}

/**
 * Apply the shot result to the state.
 * Returns { state, nextTurn, finished, winner }.
 */
export function applyShot(state, shooter, shot, sim) {
  const opp = opponent(state, shooter);
  const isBreak = !state.breakDone;
  const next = clone(state);
  const pocketed = sim.pocketed;
  const cueIn = pocketed.includes(0);
  const eightIn = pocketed.includes(8);
  const objectIn = pocketed.filter((id) => id !== 0 && id !== 8);
  const myGroup = state.groups[shooter];
  const remainingBefore = (group) => state.balls.filter((b) => !b.p && groupOf(b.id) === group).length;
  const clearedBefore = myGroup ? remainingBefore(myGroup) === 0 : false;

  let foul = null;
  if (cueIn) foul = 'scratched';
  else if (sim.firstHit === null) foul = 'missed every ball';
  else if (!isBreak) {
    if (myGroup) {
      if (clearedBefore) {
        if (sim.firstHit !== 8) foul = 'had to hit the 8-ball first';
      } else if (groupOf(sim.firstHit) !== myGroup) {
        foul = sim.firstHit === 8 ? 'hit the 8-ball first' : 'hit the wrong group first';
      }
    } else if (sim.firstHit === 8) {
      foul = 'hit the 8-ball first';
    }
  }

  next.balls = sim.final.map((b) => ({ id: b.id, x: b.x, y: b.y, p: b.p }));
  next.shotNo = (state.shotNo || 0) + 1;
  next.breakDone = true;
  next.kitchenOnly = false;
  const log = [];

  let winner = null;
  let winReason = '';
  if (eightIn) {
    if (isBreak) {
      respot(next.balls, 8, FOOT);
      log.push({ u: shooter, t: 'potted the 8-ball on the break. It was re-spotted.' });
    } else if (clearedBefore && !foul) {
      winner = shooter;
      winReason = 'sank the 8-ball';
    } else {
      winner = opp;
      winReason = foul ? `potted the 8-ball on a foul (${foul})` : 'potted the 8-ball too early';
    }
  }

  if (!winner && !foul && !isBreak && !myGroup && objectIn.length) {
    const group = groupOf(objectIn[0]);
    next.groups[shooter] = group;
    next.groups[opp] = group === 'solids' ? 'stripes' : 'solids';
    log.push({ u: shooter, t: `is ${group}.` });
  }

  const group = next.groups[shooter];
  const pottedOwn = objectIn.some((id) => !group || groupOf(id) === group);
  const keepTurn = !winner && !foul && pottedOwn;

  if (cueIn && !winner) respot(next.balls, 0, HEAD);

  if (objectIn.length) log.unshift({ u: shooter, t: `potted ${objectIn.join(', ')}.` });
  if (winner) {
    log.push({ u: winner === shooter ? shooter : opp, t: winner === shooter ? 'sank the 8-ball and wins!' : 'wins the game.' });
    if (winner !== shooter) log.push({ u: shooter, t: winReason + '.' });
  } else if (foul) {
    log.push({ u: shooter, t: `fouled: ${foul}.` });
    log.push({ u: opp, t: 'has ball in hand.' });
  } else if (keepTurn) {
    log.push({ u: shooter, t: 'shoots again.' });
  } else if (!objectIn.length) {
    log.push({ u: shooter, t: 'potted nothing.' });
  }

  next.ballInHand = !winner && !!foul;
  next.winner = winner;
  next.winReason = winReason;
  next.lastShot = {
    by: shooter,
    no: next.shotNo,
    dx: shot.dx,
    dy: shot.dy,
    power: shot.power,
    start: state.balls.map((b) => [b.id, b.x, b.y, b.p]),
    cue: shot.cue,
    pocketed,
    foul,
    firstHit: sim.firstHit,
  };
  next.log = [...log, ...(state.log || [])].slice(0, 8);

  const nextTurn = winner ? null : keepTurn ? shooter : opp;
  return { state: next, nextTurn, finished: !!winner, winner };
}

/** Rebuild the ball list at the moment a stored shot was taken (with the placed cue ball). */
export function shotStartBalls(lastShot) {
  const balls = lastShot.start.map(([id, x, y, p]) => ({ id, x, y, p }));
  if (lastShot.cue) {
    const cue = balls.find((b) => b.id === 0);
    cue.x = lastShot.cue.x;
    cue.y = lastShot.cue.y;
    cue.p = 0;
  }
  return balls;
}

export function remaining(state, group) {
  return state.balls.filter((b) => !b.p && groupOf(b.id) === group).map((b) => b.id);
}
