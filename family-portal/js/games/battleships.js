/** Battleships UI: fleet placement, turn-based firing, hit/miss/sunk display. */
import { icon } from '../core/icons.js';
import { toast, showError } from '../core/ui.js';
import { esc, $ } from '../core/utils.js';
import {
  SIZE, FLEET, shipCells, canPlace, randomFleet, createState as createBsState, submitFleet, fire,
  shotAt, opponent, shipName, shipsRemaining,
} from './battleships-rules.js';

const LETTERS = 'ABCDEFGHIJ';
const coord = (r, c) => `${LETTERS[c]}${r + 1}`;

export default {
  type: 'battleships',

  createState({ player1, player2 }) {
    return createBsState(player1, player2);
  },

  acceptState(match) {
    return { state: match.game_state, firstTurn: null };
  },

  mount(container, ctx) {
    const me = ctx.userId;
    let match = ctx.match;
    let draft = [];
    let selected = FLEET[0].id;
    let dir = 'h';
    let hover = null;
    let busy = false;
    let lastSeenShot = JSON.stringify(match.game_state?.lastShot || null);

    container.innerHTML = `
      <div class="bs">
        <div class="bs__boards">
          <section class="bs__panel bs__panel--enemy">
            <header class="bs__panel-head"><h3>${icon('target')} Enemy waters</h3><span class="fleet-count" data-enemy-count></span></header>
            <div class="bs-grid" data-grid="enemy"></div>
            <ul class="fleet-status" data-enemy-fleet></ul>
          </section>
          <section class="bs__panel bs__panel--mine">
            <header class="bs__panel-head"><h3>🚢 Your fleet</h3><span class="fleet-count" data-my-count></span></header>
            <div class="bs-grid" data-grid="mine"></div>
            <ul class="fleet-status" data-my-fleet></ul>
          </section>
        </div>
        <section class="bs__placement card" data-placement hidden>
          <h3 class="bs__placement-title">Place your fleet</h3>
          <p class="muted">Pick a ship, then tap the board where it should start. Tap a placed ship to move it.</p>
          <div class="ship-tray" data-tray></div>
          <div class="bs__controls">
            <button type="button" class="btn btn--soft btn--sm" data-rotate>${icon('rotate')} Rotate <kbd>R</kbd></button>
            <button type="button" class="btn btn--soft btn--sm" data-random>${icon('dice')} Randomize</button>
            <button type="button" class="btn btn--ghost btn--sm" data-clear>Clear</button>
            <span class="spacer"></span>
            <button type="button" class="btn btn--primary" data-ready disabled>${icon('check')} Ready</button>
          </div>
        </section>
      </div>`;

    const enemyGrid = $('[data-grid="enemy"]', container);
    const myGrid = $('[data-grid="mine"]', container);
    const placement = $('[data-placement]', container);
    const tray = $('[data-tray]', container);
    const readyBtn = $('[data-ready]', container);

    const state = () => match.game_state;
    const opp = () => opponent(state(), me);
    const placing = () => match.status === 'active' && state().phase === 'placement' && !state().fleets?.[me];

    function gridHTML(kind) {
      const head = `<span class="bs-grid__corner"></span>${[...LETTERS].map((l) => `<span class="bs-grid__label">${l}</span>`).join('')}`;
      const rows = [];
      for (let r = 0; r < SIZE; r += 1) {
        rows.push(`<span class="bs-grid__label">${r + 1}</span>`);
        for (let c = 0; c < SIZE; c += 1) {
          rows.push(`<button type="button" class="bs-cell" data-kind="${kind}" data-r="${r}" data-c="${c}" aria-label="${coord(r, c)}"></button>`);
        }
      }
      return head + rows.join('');
    }
    enemyGrid.innerHTML = gridHTML('enemy');
    myGrid.innerHTML = gridHTML('mine');
    const cell = (grid, r, c) => grid.querySelector(`[data-r="${r}"][data-c="${c}"]`);

    function fleetStatusHTML(owner, fleet) {
      const sunk = state().sunk?.[owner] || [];
      return FLEET.map((spec) => {
        const isSunk = sunk.includes(spec.id);
        const placed = !fleet || fleet.some((s) => s.id === spec.id);
        return `<li class="fleet-status__ship ${isSunk ? 'is-sunk' : ''} ${placed ? '' : 'is-missing'}">
          <span class="fleet-status__pips">${'<i></i>'.repeat(spec.len)}</span>${esc(spec.name)}</li>`;
      }).join('');
    }

    function paintMine() {
      const s = state();
      const fleet = placing() ? draft : s.fleets?.[me] || [];
      const shipAt = new Map();
      fleet.forEach((ship) => shipCells(ship).forEach(([r, c], i) => shipAt.set(`${r},${c}`, { ship, i })));
      const incoming = new Map((s.shots?.[opp()] || []).map(([r, c, hit]) => [`${r},${c}`, hit]));
      const sunk = new Set(s.sunk?.[me] || []);
      const preview = new Map();
      if (placing() && hover && selected) {
        const spec = FLEET.find((f) => f.id === selected);
        const ok = canPlace(draft, spec, hover.r, hover.c, dir);
        shipCells({ r: hover.r, c: hover.c, dir, len: spec.len }).forEach(([r, c]) => preview.set(`${r},${c}`, ok));
      }
      const last = s.lastShot && s.lastShot.by === opp() ? `${s.lastShot.r},${s.lastShot.c}` : null;
      for (let r = 0; r < SIZE; r += 1) {
        for (let c = 0; c < SIZE; c += 1) {
          const k = `${r},${c}`;
          const node = cell(myGrid, r, c);
          const occupant = shipAt.get(k);
          const shot = incoming.get(k);
          node.className = 'bs-cell';
          if (occupant) {
            node.classList.add('has-ship', `ship-${occupant.ship.dir}`);
            if (occupant.i === 0) node.classList.add('ship-start');
            if (occupant.i === occupant.ship.len - 1) node.classList.add('ship-end');
            if (sunk.has(occupant.ship.id)) node.classList.add('is-sunk');
            if (placing() && occupant.ship.id === selected) node.classList.add('is-selected');
          }
          if (shot !== undefined) node.classList.add(shot ? 'is-hit' : 'is-miss');
          if (preview.has(k)) node.classList.add(preview.get(k) ? 'is-preview' : 'is-invalid');
          if (k === last) node.classList.add('is-last');
          node.disabled = !placing();
          node.setAttribute('aria-label', `${coord(r, c)}${occupant ? `, ${shipName(occupant.ship.id)}` : ''}${shot !== undefined ? (shot ? ', hit' : ', miss') : ''}`);
        }
      }
      $('[data-my-fleet]', container).innerHTML = fleetStatusHTML(me, placing() ? draft : null);
      $('[data-my-count]', container).textContent = placing() ? `${draft.length}/5 placed` : `${shipsRemaining(s, me)} afloat`;
    }

    function paintEnemy() {
      const s = state();
      const other = opp();
      const myShots = new Map((s.shots?.[me] || []).map(([r, c, hit]) => [`${r},${c}`, hit]));
      const sunkIds = new Set(s.sunk?.[other] || []);
      const enemyFleet = s.fleets?.[other] || [];
      const sunkCells = new Set();
      enemyFleet.filter((ship) => sunkIds.has(ship.id)).forEach((ship) => shipCells(ship).forEach(([r, c]) => sunkCells.add(`${r},${c}`)));
      const revealAll = match.status === 'finished';
      const revealCells = new Set();
      if (revealAll) enemyFleet.forEach((ship) => shipCells(ship).forEach(([r, c]) => revealCells.add(`${r},${c}`)));
      const myTurn = match.status === 'active' && s.phase === 'battle' && match.current_turn === me && !busy;
      const last = s.lastShot && s.lastShot.by === me ? `${s.lastShot.r},${s.lastShot.c}` : null;
      for (let r = 0; r < SIZE; r += 1) {
        for (let c = 0; c < SIZE; c += 1) {
          const k = `${r},${c}`;
          const node = cell(enemyGrid, r, c);
          const shot = myShots.get(k);
          node.className = 'bs-cell';
          if (shot !== undefined) node.classList.add(shot ? 'is-hit' : 'is-miss');
          if (sunkCells.has(k)) node.classList.add('is-sunk');
          if (revealCells.has(k) && !sunkCells.has(k)) node.classList.add('is-revealed');
          if (k === last) node.classList.add('is-last');
          const canFire = myTurn && shot === undefined;
          if (canFire) node.classList.add('is-target');
          node.disabled = !canFire;
          node.setAttribute('aria-label', `${coord(r, c)}${shot !== undefined ? (shot ? ', hit' : ', miss') : canFire ? ', fire here' : ''}`);
        }
      }
      enemyGrid.classList.toggle('is-fogged', s.phase === 'placement');
      $('[data-enemy-fleet]', container).innerHTML = fleetStatusHTML(other, null);
      $('[data-enemy-count]', container).textContent = s.phase === 'placement' ? '' : `${shipsRemaining(s, other)} afloat`;
    }

    function paintTray() {
      tray.innerHTML = FLEET.map((spec) => {
        const placed = draft.some((s) => s.id === spec.id);
        return `<button type="button" class="ship-chip ${placed ? 'is-placed' : ''} ${selected === spec.id ? 'is-selected' : ''}" data-ship="${spec.id}" aria-pressed="${selected === spec.id}">
          <span class="ship-chip__pips">${'<i></i>'.repeat(spec.len)}</span>
          <span>${esc(spec.name)}</span>${placed ? icon('check') : ''}
        </button>`;
      }).join('');
      readyBtn.disabled = draft.length !== FLEET.length || busy;
    }

    function status() {
      const s = state();
      const other = ctx.nameOf(opp());
      if (match.status === 'finished') {
        if (s.resignedBy) return s.resignedBy === me ? 'You resigned.' : `${other} resigned.`;
        return match.winner_id === me ? 'Victory! You sank the whole enemy fleet. 🎉' : `${other} sank your fleet. Better luck next time!`;
      }
      if (s.phase === 'placement') {
        if (!s.fleets?.[me]) return 'Place your five ships, then press Ready.';
        return `Fleet ready. Waiting for ${other} to place their ships…`;
      }
      const last = s.lastShot;
      const recap = last ? `${last.by === me ? 'You' : other} fired at ${coord(last.r, last.c)}: ${last.sunk ? `sank the ${shipName(last.sunk)}!` : last.hit ? 'hit!' : 'miss.'} ` : '';
      if (match.current_turn === me) return `${recap}Your turn: pick a square in enemy waters.`;
      return `${recap}Waiting for ${other} to fire…`;
    }

    function paint() {
      const isPlacing = placing();
      placement.hidden = !isPlacing;
      container.querySelector('.bs').classList.toggle('is-placing', isPlacing);
      if (isPlacing) paintTray();
      paintMine();
      paintEnemy();
      ctx.setStatus(status(), match.status === 'active' && (isPlacing || match.current_turn === me));
    }

    function selectNext() {
      const next = FLEET.find((spec) => !draft.some((s) => s.id === spec.id));
      selected = next ? next.id : null;
    }

    function placeAt(r, c) {
      const existing = draft.find((ship) => shipCells(ship).some(([rr, cc]) => rr === r && cc === c));
      if (existing) {
        draft = draft.filter((s) => s.id !== existing.id);
        selected = existing.id;
        dir = existing.dir;
        paint();
        return;
      }
      if (!selected) return;
      const spec = FLEET.find((f) => f.id === selected);
      if (!canPlace(draft, spec, r, c, dir)) {
        const node = cell(myGrid, r, c);
        node.classList.add('shake');
        setTimeout(() => node.classList.remove('shake'), 400);
        return;
      }
      draft = [...draft.filter((s) => s.id !== spec.id), { id: spec.id, len: spec.len, r, c, dir }];
      selectNext();
      paint();
    }

    async function submitPlacement() {
      if (busy || draft.length !== FLEET.length) return;
      busy = true;
      paintTray();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const { state: next, nextTurn } = submitFleet(state(), me, draft);
          const updated = await ctx.submit(next, { nextTurn });
          match = updated;
          break;
        } catch (err) {
          if (err.code === 'STALE_MOVE' && attempt < 2) {
            match = await ctx.refetch();
            if (!placing()) break;
            continue;
          }
          showError(err);
          break;
        }
      }
      busy = false;
      paint();
    }

    async function fireAt(r, c) {
      if (busy || match.current_turn !== me || shotAt(state(), me, r, c)) return;
      busy = true;
      paint();
      try {
        const { state: next, result, nextTurn } = fire(state(), me, r, c);
        const updated = await ctx.submit(next, { nextTurn, finish: result.won, winner: result.won ? me : null });
        match = updated;
        lastSeenShot = JSON.stringify(next.lastShot);
        if (!result.won && result.sunk) toast(`You sank their ${shipName(result.sunk)}!`, { type: 'success', timeout: 2500 });
      } catch (err) {
        if (err.code === 'STALE_MOVE') match = await ctx.refetch();
        showError(err);
      } finally {
        busy = false;
        paint();
      }
    }

    container.addEventListener('click', (event) => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.matches('.bs-cell[data-kind="mine"]') && placing()) placeAt(Number(target.dataset.r), Number(target.dataset.c));
      else if (target.matches('.bs-cell[data-kind="enemy"]')) fireAt(Number(target.dataset.r), Number(target.dataset.c));
      else if (target.matches('[data-ship]')) {
        const id = target.dataset.ship;
        const placed = draft.find((s) => s.id === id);
        if (placed) {
          draft = draft.filter((s) => s.id !== id);
          dir = placed.dir;
        }
        selected = id;
        paint();
      } else if (target.matches('[data-rotate]')) {
        dir = dir === 'h' ? 'v' : 'h';
        paint();
      } else if (target.matches('[data-random]')) {
        draft = randomFleet();
        selected = null;
        paint();
      } else if (target.matches('[data-clear]')) {
        draft = [];
        selected = FLEET[0].id;
        paint();
      } else if (target.matches('[data-ready]')) {
        submitPlacement();
      }
    });

    myGrid.addEventListener('pointerover', (event) => {
      const target = event.target.closest('.bs-cell');
      if (!target || !placing()) return;
      hover = { r: Number(target.dataset.r), c: Number(target.dataset.c) };
      paintMine();
    });
    myGrid.addEventListener('pointerleave', () => {
      hover = null;
      if (placing()) paintMine();
    });
    myGrid.addEventListener('contextmenu', (event) => {
      if (!placing()) return;
      event.preventDefault();
      dir = dir === 'h' ? 'v' : 'h';
      paintMine();
    });

    const onKey = (event) => {
      if ((event.key === 'r' || event.key === 'R') && placing() && !event.target.closest('input, textarea')) {
        dir = dir === 'h' ? 'v' : 'h';
        paint();
      }
    };
    document.addEventListener('keydown', onKey);

    paint();

    return {
      update(next) {
        const incoming = JSON.stringify(next.game_state?.lastShot || null);
        const opponentFired = incoming !== lastSeenShot && next.game_state?.lastShot?.by && next.game_state.lastShot.by !== me;
        match = next;
        if (opponentFired) {
          const shot = next.game_state.lastShot;
          lastSeenShot = incoming;
          const who = ctx.nameOf(shot.by);
          if (shot.sunk && next.status === 'active') toast(`${who} sank your ${shipName(shot.sunk)}!`, { type: 'error', timeout: 2500 });
        }
        paint();
      },
      destroy() {
        document.removeEventListener('keydown', onKey);
      },
    };
  },
};
