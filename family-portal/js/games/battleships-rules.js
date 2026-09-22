/**
 * Battleships rules (pure functions, no DOM).
 *
 * State shape (stored in game_matches.game_state):
 * {
 *   v: 1, phase: 'placement' | 'battle' | 'over', size: 10, players: [p1, p2],
 *   fleets: { [uid]: [{ id, len, r, c, dir: 'h' | 'v' }] },
 *   shots:  { [uid]: [[r, c, hit(0|1)]] }   // shots fired BY uid
 *   sunk:   { [uid]: [shipId] }             // ships OF uid that were sunk
 *   lastShot: { by, r, c, hit, sunk } | null,
 *   placedOrder: [uid], winner: uid | null
 * }
 */
export const SIZE = 10;

export const FLEET = [
  { id: 'carrier', name: 'Carrier', len: 5 },
  { id: 'battleship', name: 'Battleship', len: 4 },
  { id: 'cruiser', name: 'Cruiser', len: 3 },
  { id: 'submarine', name: 'Submarine', len: 3 },
  { id: 'destroyer', name: 'Destroyer', len: 2 },
];

const SHIP_BY_ID = new Map(FLEET.map((ship) => [ship.id, ship]));

export function shipName(id) {
  return SHIP_BY_ID.get(id)?.name || id;
}

export function shipCells({ r, c, dir, len }) {
  return Array.from({ length: len }, (_, i) => (dir === 'v' ? [r + i, c] : [r, c + i]));
}

const key = (r, c) => r * SIZE + c;

function inBounds(r, c) {
  return Number.isInteger(r) && Number.isInteger(c) && r >= 0 && c >= 0 && r < SIZE && c < SIZE;
}

/** Can `ship` sit at (r, c, dir) given the other ships in `fleet` (ignoring the same id)? */
export function canPlace(fleet, ship, r, c, dir) {
  const cells = shipCells({ r, c, dir, len: ship.len });
  if (!cells.every(([rr, cc]) => inBounds(rr, cc))) return false;
  const taken = new Set();
  fleet.filter((s) => s.id !== ship.id).forEach((s) => shipCells(s).forEach(([rr, cc]) => taken.add(key(rr, cc))));
  return cells.every(([rr, cc]) => !taken.has(key(rr, cc)));
}

export function validateFleet(fleet) {
  if (!Array.isArray(fleet) || fleet.length !== FLEET.length) return { ok: false, error: 'Place all five ships.' };
  const seen = new Set();
  const cells = new Set();
  for (const ship of fleet) {
    const spec = SHIP_BY_ID.get(ship?.id);
    if (!spec || seen.has(ship.id) || ship.len !== spec.len) return { ok: false, error: 'That fleet is not valid.' };
    if (ship.dir !== 'h' && ship.dir !== 'v') return { ok: false, error: 'That fleet is not valid.' };
    seen.add(ship.id);
    for (const [r, c] of shipCells(ship)) {
      if (!inBounds(r, c)) return { ok: false, error: `${spec.name} is off the board.` };
      if (cells.has(key(r, c))) return { ok: false, error: 'Ships cannot overlap.' };
      cells.add(key(r, c));
    }
  }
  return { ok: true, error: null };
}

export function randomFleet(random = Math.random) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const fleet = [];
    let failed = false;
    for (const spec of FLEET) {
      let placed = false;
      for (let tries = 0; tries < 300 && !placed; tries += 1) {
        const dir = random() < 0.5 ? 'h' : 'v';
        const maxR = dir === 'v' ? SIZE - spec.len : SIZE - 1;
        const maxC = dir === 'h' ? SIZE - spec.len : SIZE - 1;
        const r = Math.floor(random() * (maxR + 1));
        const c = Math.floor(random() * (maxC + 1));
        if (canPlace(fleet, spec, r, c, dir)) {
          fleet.push({ id: spec.id, len: spec.len, r, c, dir });
          placed = true;
        }
      }
      if (!placed) {
        failed = true;
        break;
      }
    }
    if (!failed) return fleet;
  }
  throw new Error('Could not place the fleet.');
}

export function createState(player1, player2) {
  return {
    v: 1,
    phase: 'placement',
    size: SIZE,
    players: [player1, player2],
    fleets: {},
    shots: { [player1]: [], [player2]: [] },
    sunk: { [player1]: [], [player2]: [] },
    lastShot: null,
    placedOrder: [],
    winner: null,
  };
}

const clone = (value) => JSON.parse(JSON.stringify(value));
export const opponent = (state, uid) => (state.players[0] === uid ? state.players[1] : state.players[0]);

/** Store a player's fleet. The last player to finish placing fires first. */
export function submitFleet(state, uid, fleet) {
  if (state.phase !== 'placement') throw new Error('Ships are already placed.');
  if (!state.players.includes(uid)) throw new Error('You are not in this match.');
  if (state.fleets?.[uid]) throw new Error('Your fleet is already placed.');
  const check = validateFleet(fleet);
  if (!check.ok) throw new Error(check.error);
  const next = clone(state);
  next.fleets = next.fleets || {};
  next.fleets[uid] = fleet.map(({ id, len, r, c, dir }) => ({ id, len, r, c, dir }));
  next.placedOrder = [...(next.placedOrder || []), uid];
  const ready = next.players.every((p) => next.fleets[p]);
  if (ready) next.phase = 'battle';
  return { state: next, nextTurn: ready ? uid : null, started: ready };
}

export function shotAt(state, shooter, r, c) {
  return (state.shots?.[shooter] || []).find(([rr, cc]) => rr === r && cc === c) || null;
}

/** shooter fires at (r, c) on the opponent's board. */
export function fire(state, shooter, r, c) {
  if (state.phase !== 'battle') throw new Error('The battle has not started.');
  if (!inBounds(r, c)) throw new Error('That square is off the board.');
  if (shotAt(state, shooter, r, c)) throw new Error('You already fired there.');
  const target = opponent(state, shooter);
  const next = clone(state);
  const fleet = next.fleets[target] || [];
  const hitShip = fleet.find((ship) => shipCells(ship).some(([rr, cc]) => rr === r && cc === c));
  next.shots[shooter] = [...(next.shots[shooter] || []), [r, c, hitShip ? 1 : 0]];

  let sunk = null;
  if (hitShip) {
    const hits = new Set(next.shots[shooter].filter((s) => s[2] === 1).map(([rr, cc]) => key(rr, cc)));
    if (shipCells(hitShip).every(([rr, cc]) => hits.has(key(rr, cc)))) {
      sunk = hitShip.id;
      next.sunk[target] = [...(next.sunk[target] || []), hitShip.id];
    }
  }
  const won = (next.sunk[target] || []).length === FLEET.length;
  next.lastShot = { by: shooter, r, c, hit: !!hitShip, sunk };
  if (won) {
    next.phase = 'over';
    next.winner = shooter;
  }
  return { state: next, result: { hit: !!hitShip, sunk, won }, nextTurn: won ? null : target };
}

export function shipsRemaining(state, uid) {
  return FLEET.length - (state.sunk?.[uid] || []).length;
}
