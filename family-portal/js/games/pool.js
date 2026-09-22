/** Pool UI: canvas table, aiming, ball in hand, animated shots and replays. */
import { icon } from '../core/icons.js';
import { showError } from '../core/ui.js';
import { esc, $, clamp, prefersReducedMotion } from '../core/utils.js';
import { secureRandomInt } from './poker-rules.js';
import {
  W, H, R, HEAD_X, FOOT, POCKETS, SOLIDS, STRIPES, createState as createPoolState, simulate, applyShot,
  aimPreview, validCuePosition, nearestValidCuePosition, shotStartBalls, groupOf, opponent,
} from './pool-engine.js';

const RAIL = 44;
const TW = W + RAIL * 2;
const TH = H + RAIL * 2;
const BALL_COLORS = {
  1: '#f4c20d', 2: '#1d4ed8', 3: '#dc2626', 4: '#7c3aed', 5: '#f97316', 6: '#15803d', 7: '#7f1d1d', 8: '#111827',
};
const colorOf = (id) => BALL_COLORS[id > 8 ? id - 8 : id];

function miniBall(id, pocketed) {
  const color = colorOf(id);
  const stripe = id > 8;
  return `<span class="mini-ball ${stripe ? 'is-stripe' : ''} ${pocketed ? 'is-potted' : ''}" style="--ball:${color}" title="${id}">${id}</span>`;
}

export default {
  type: 'pool',

  createState({ player1, player2 }) {
    return createPoolState(player1, player2, secureRandomInt);
  },

  acceptState(match) {
    return { state: match.game_state, firstTurn: match.player2_id };
  },

  mount(container, ctx) {
    const me = ctx.userId;
    let match = ctx.match;
    let display = match.game_state.balls.map((b) => ({ ...b }));
    let shownShot = match.game_state.shotNo || 0;
    let aimAngle = 0;
    let power = 0.55;
    let cuePos = null;
    let cueValid = true;
    let dragging = null;
    let animating = false;
    let busy = false;
    let raf = 0;
    let vertical = false;
    let scale = 1;
    let dpr = 1;
    const reduced = prefersReducedMotion();

    container.innerHTML = `
      <div class="pool">
        <div class="pool__scores" data-scores></div>
        <div class="pool__table-wrap" data-wrap>
          <canvas class="pool__canvas" aria-label="Pool table"></canvas>
        </div>
        <div class="pool__controls" data-controls>
          <div class="pool__power">
            <label for="pool-power">Power</label>
            <input id="pool-power" type="range" min="5" max="100" value="55" data-power>
            <output data-power-out>55%</output>
          </div>
          <div class="pool__buttons">
            <button type="button" class="icon-btn" data-nudge="-1" aria-label="Rotate aim anticlockwise">${icon('chevronLeft')}</button>
            <button type="button" class="icon-btn" data-nudge="1" aria-label="Rotate aim clockwise">${icon('chevronRight')}</button>
            <button type="button" class="btn btn--primary" data-shoot>${icon('target')} Shoot</button>
          </div>
        </div>
        <div class="pool__footer">
          <button type="button" class="btn btn--ghost btn--sm" data-replay hidden>${icon('rotate')} Replay last shot</button>
          <p class="pool__hint muted" data-hint></p>
        </div>
        <ul class="game-log" data-log></ul>
      </div>`;

    const canvas = $('canvas', container);
    const ctx2d = canvas.getContext('2d');
    const wrap = $('[data-wrap]', container);
    const powerInput = $('[data-power]', container);
    const powerOut = $('[data-power-out]', container);
    const shootBtn = $('[data-shoot]', container);
    const replayBtn = $('[data-replay]', container);

    const state = () => match.game_state;
    const myTurn = () => match.status === 'active' && match.current_turn === me && !animating && !busy;
    const placing = () => myTurn() && state().ballInHand;
    const cueBall = () => {
      const cue = display.find((b) => b.id === 0);
      return placing() && cuePos ? { ...cue, x: cuePos.x, y: cuePos.y } : cue;
    };

    function defaultAim() {
      const cue = cueBall();
      if (!cue) return;
      const s = state();
      const group = s.groups?.[me];
      const targets = display.filter((b) => !b.p && b.id !== 0 && (group ? groupOf(b.id) === group : b.id !== 8));
      const pick = targets.length ? targets : display.filter((b) => !b.p && b.id !== 0);
      let best = pick[0];
      let bestD = Infinity;
      pick.forEach((b) => {
        const d = (b.x - cue.x) ** 2 + (b.y - cue.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      });
      aimAngle = best ? Math.atan2(best.y - cue.y, best.x - cue.x) : Math.atan2(FOOT.y - cue.y, FOOT.x - cue.x);
    }

    function resetCuePlacement() {
      if (!placing()) {
        cuePos = null;
        return;
      }
      const cue = display.find((b) => b.id === 0);
      cuePos = nearestValidCuePosition(state(), cue.x, cue.y);
      cueValid = validCuePosition(state(), cuePos.x, cuePos.y);
    }

    // ---------------------------------------------------------------- layout & coordinates

    function layout() {
      const wrapWidth = wrap.clientWidth || 320;
      vertical = wrapWidth < 560;
      const logicalW = vertical ? TH : TW;
      const logicalH = vertical ? TW : TH;
      let cssW = wrapWidth;
      let cssH = (cssW * logicalH) / logicalW;
      const maxH = Math.max(280, window.innerHeight - (vertical ? 230 : 250));
      if (cssH > maxH) {
        cssH = maxH;
        cssW = (cssH * logicalW) / logicalH;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = `${Math.round(cssW)}px`;
      canvas.style.height = `${Math.round(cssH)}px`;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      scale = cssW / logicalW;
      draw();
    }

    function toTable(event) {
      const rect = canvas.getBoundingClientRect();
      const px = (event.clientX - rect.left) / scale;
      const py = (event.clientY - rect.top) / scale;
      return vertical ? { x: py - RAIL, y: H + RAIL - px } : { x: px - RAIL, y: py - RAIL };
    }

    function setTableTransform() {
      const k = scale * dpr;
      if (vertical) ctx2d.setTransform(0, k, -k, 0, k * (H + RAIL), k * RAIL);
      else ctx2d.setTransform(k, 0, 0, k, k * RAIL, k * RAIL);
    }

    // ---------------------------------------------------------------- drawing

    function drawTable() {
      const g = ctx2d;
      const wood = g.createLinearGradient(0, -RAIL, 0, H + RAIL);
      wood.addColorStop(0, '#7a4a2c');
      wood.addColorStop(0.5, '#5a3320');
      wood.addColorStop(1, '#7a4a2c');
      g.fillStyle = wood;
      g.beginPath();
      g.roundRect(-RAIL, -RAIL, W + RAIL * 2, H + RAIL * 2, 26);
      g.fill();
      g.fillStyle = '#0d5a31';
      g.fillRect(-14, -14, W + 28, H + 28);
      const felt = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.62);
      felt.addColorStop(0, '#23a05a');
      felt.addColorStop(1, '#14713d');
      g.fillStyle = felt;
      g.fillRect(0, 0, W, H);

      g.fillStyle = 'rgba(255, 244, 214, 0.85)';
      [0.125, 0.25, 0.375, 0.625, 0.75, 0.875].forEach((f) => {
        [[W * f, -RAIL / 2], [W * f, H + RAIL / 2]].forEach(([x, y]) => {
          g.beginPath();
          g.arc(x, y, 3.5, 0, Math.PI * 2);
          g.fill();
        });
      });
      [0.25, 0.5, 0.75].forEach((f) => {
        [[-RAIL / 2, H * f], [W + RAIL / 2, H * f]].forEach(([x, y]) => {
          g.beginPath();
          g.arc(x, y, 3.5, 0, Math.PI * 2);
          g.fill();
        });
      });

      const s = state();
      if (s.kitchenOnly && placing()) {
        g.fillStyle = 'rgba(255, 255, 255, 0.06)';
        g.fillRect(0, 0, HEAD_X, H);
      }
      g.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      g.setLineDash([8, 10]);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(HEAD_X, 0);
      g.lineTo(HEAD_X, H);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(255, 255, 255, 0.35)';
      g.beginPath();
      g.arc(FOOT.x, FOOT.y, 3, 0, Math.PI * 2);
      g.fill();

      POCKETS.forEach((p) => {
        g.fillStyle = '#0b0b0b';
        g.beginPath();
        g.arc(p.vx, p.vy, p.vr, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 3;
        g.stroke();
      });
    }

    function drawBall(ball, { ghost = false } = {}) {
      const g = ctx2d;
      g.save();
      g.translate(ball.x, ball.y);
      if (!ghost) {
        g.beginPath();
        g.arc(2.5, 3.5, R, 0, Math.PI * 2);
        g.fillStyle = 'rgba(0, 0, 0, 0.3)';
        g.fill();
      }
      g.beginPath();
      g.arc(0, 0, R, 0, Math.PI * 2);
      if (ball.id === 0 || ball.id > 8) g.fillStyle = '#f7f5ea';
      else g.fillStyle = colorOf(ball.id);
      g.fill();
      if (ball.id > 8) {
        g.save();
        g.clip();
        g.fillStyle = colorOf(ball.id);
        g.fillRect(-R, -R * 0.56, R * 2, R * 1.12);
        g.restore();
      }
      if (ball.id > 0) {
        g.beginPath();
        g.arc(0, 0, R * 0.5, 0, Math.PI * 2);
        g.fillStyle = '#ffffff';
        g.fill();
        g.save();
        if (vertical) g.rotate(-Math.PI / 2);
        g.fillStyle = '#111';
        g.font = `bold ${ball.id > 9 ? 8 : 9.5}px Nunito, system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(ball.id), 0, 0.6);
        g.restore();
      }
      const shine = g.createRadialGradient(-R * 0.35, -R * 0.4, 0, -R * 0.2, -R * 0.2, R * 1.05);
      shine.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
      shine.addColorStop(0.35, 'rgba(255, 255, 255, 0.08)');
      shine.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
      g.beginPath();
      g.arc(0, 0, R, 0, Math.PI * 2);
      g.fillStyle = shine;
      g.fill();
      g.restore();
    }

    function drawAim(cue) {
      const g = ctx2d;
      const dx = Math.cos(aimAngle);
      const dy = Math.sin(aimAngle);
      const balls = display.map((b) => (b.id === 0 ? { ...b, x: cue.x, y: cue.y } : b));
      const preview = aimPreview(balls, dx, dy);
      g.save();
      g.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      g.lineWidth = 2;
      g.setLineDash([7, 7]);
      g.beginPath();
      g.moveTo(cue.x + dx * R, cue.y + dy * R);
      g.lineTo(preview.end.x, preview.end.y);
      g.stroke();
      g.setLineDash([]);
      if (preview.ghost) {
        g.beginPath();
        g.arc(preview.ghost.x, preview.ghost.y, R, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        g.stroke();
        const target = display.find((b) => b.id === preview.hit);
        g.strokeStyle = 'rgba(255, 236, 153, 0.8)';
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(target.x, target.y);
        g.lineTo(target.x + preview.objectDir.x * 130, target.y + preview.objectDir.y * 130);
        g.stroke();
      }
      const pull = 8 + power * 70;
      const tipX = cue.x - dx * (R + pull);
      const tipY = cue.y - dy * (R + pull);
      const buttX = tipX - dx * 380;
      const buttY = tipY - dy * 380;
      const wood = g.createLinearGradient(tipX, tipY, buttX, buttY);
      wood.addColorStop(0, '#e9dcc0');
      wood.addColorStop(0.03, '#e9dcc0');
      wood.addColorStop(0.035, '#2563eb');
      wood.addColorStop(0.05, '#d9a55b');
      wood.addColorStop(0.7, '#9b5e2e');
      wood.addColorStop(1, '#2e1b10');
      g.strokeStyle = wood;
      g.lineCap = 'round';
      g.lineWidth = 7;
      g.beginPath();
      g.moveTo(tipX, tipY);
      g.lineTo(buttX, buttY);
      g.stroke();
      g.restore();
    }

    function draw() {
      const g = ctx2d;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      setTableTransform();
      drawTable();
      const cue = cueBall();
      display.forEach((ball) => {
        if (ball.p || ball.id === 0) return;
        drawBall(ball);
      });
      if (cue && !cue.p) {
        if (placing()) {
          g.save();
          g.beginPath();
          g.arc(cue.x, cue.y, R + 7, 0, Math.PI * 2);
          g.strokeStyle = cueValid ? 'rgba(255, 255, 255, 0.9)' : 'rgba(239, 68, 68, 0.95)';
          g.lineWidth = 2.5;
          g.setLineDash([5, 5]);
          g.stroke();
          g.restore();
        }
        drawBall(cue);
        if (myTurn() && dragging !== 'cue') drawAim(cue);
      }
    }

    // ---------------------------------------------------------------- animation

    function playFrames(sim) {
      return new Promise((resolve) => {
        const showFrame = (index) => {
          const frame = sim.frames[index];
          display = sim.order.map((id, i) => ({ id, x: frame[i * 3], y: frame[i * 3 + 1], p: frame[i * 3 + 2] }));
          draw();
        };
        let done = false;
        let safety = 0;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(safety);
          cancelAnimationFrame(raf);
          showFrame(sim.frames.length - 1);
          resolve();
        };
        // Skip the animation when nobody can see it (background tab, reduced motion).
        if (reduced || document.visibilityState === 'hidden') {
          finish();
          return;
        }
        // Browsers pause requestAnimationFrame in background tabs; never get stuck mid-shot.
        safety = setTimeout(finish, (sim.frames.length / 60) * 1000 + 1500);
        const start = performance.now();
        const step = (now) => {
          if (done) return;
          const index = Math.min(sim.frames.length - 1, Math.max(0, Math.floor(((now - start) / 1000) * 60)));
          showFrame(index);
          if (index >= sim.frames.length - 1) finish();
          else raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      });
    }

    async function replay(shot, { thenState = null } = {}) {
      if (!shot || animating) return;
      animating = true;
      paintUI();
      const sim = simulate(shotStartBalls(shot), shot.dx, shot.dy, shot.power);
      await playFrames(sim);
      animating = false;
      display = (thenState || state()).balls.map((b) => ({ ...b }));
      shownShot = (thenState || state()).shotNo;
      resetCuePlacement();
      defaultAim();
      paintUI();
      draw();
    }

    async function shoot() {
      if (!myTurn()) return;
      if (placing() && !cueValid) {
        showError(new Error(state().kitchenOnly ? 'Place the cue ball behind the line (left of the dashed line).' : 'The cue ball cannot go there.'));
        return;
      }
      busy = true;
      const before = state();
      const cue = cueBall();
      const balls = display.map((b) => (b.id === 0 ? { ...b, x: cue.x, y: cue.y, p: 0 } : { ...b }));
      const dx = Math.cos(aimAngle);
      const dy = Math.sin(aimAngle);
      const shot = { dx, dy, power, cue: before.ballInHand ? { x: cue.x, y: cue.y } : null };
      const sim = simulate(balls, dx, dy, power);
      const outcome = applyShot(before, me, shot, sim);
      animating = true;
      cuePos = null;
      paintUI();
      const saving = ctx.submit(outcome.state, {
        nextTurn: outcome.nextTurn,
        finish: outcome.finished,
        winner: outcome.winner,
      });
      await playFrames(sim);
      try {
        match = await saving;
      } catch (err) {
        showError(err);
        if (err.code === 'STALE_MOVE') match = await ctx.refetch();
      }
      animating = false;
      busy = false;
      display = state().balls.map((b) => ({ ...b }));
      shownShot = state().shotNo;
      resetCuePlacement();
      defaultAim();
      paintUI();
      draw();
    }

    // ---------------------------------------------------------------- UI chrome

    function scoresHTML() {
      const s = state();
      return s.players.map((uid) => {
        const group = s.groups?.[uid];
        const ids = group === 'solids' ? SOLIDS : group === 'stripes' ? STRIPES : [];
        const onTable = new Set(display.filter((b) => !b.p).map((b) => b.id));
        const turn = match.status === 'active' && match.current_turn === uid;
        return `
          <div class="pool__player ${turn ? 'is-turn' : ''} ${uid === me ? 'is-me' : ''}">
            <div class="pool__player-name">${esc(ctx.nameOf(uid))}${uid === me ? ' <span class="muted">(you)</span>' : ''}</div>
            <div class="pool__group">${group ? esc(group === 'solids' ? 'Solids' : 'Stripes') : 'Open table'}</div>
            <div class="pool__balls">${ids.map((id) => miniBall(id, !onTable.has(id))).join('')}${group && ids.every((id) => !onTable.has(id)) ? miniBall(8, false) : ''}</div>
          </div>`;
      }).join('<span class="vs">vs</span>');
    }

    function statusText() {
      const s = state();
      const other = ctx.nameOf(opponent(s, me));
      if (match.status === 'finished') {
        if (s.resignedBy) return s.resignedBy === me ? 'You resigned.' : `${other} resigned.`;
        if (!match.winner_id) return 'Draw.';
        const shooter = s.lastShot?.by;
        if (match.winner_id === me) {
          return shooter === me ? 'You sank the 8-ball. You win! 🎉' : `${other} ${s.winReason}. You win! 🎉`;
        }
        return shooter === me ? `You ${s.winReason}. ${other} wins.` : `${other} sank the 8-ball and wins.`;
      }
      if (animating) return 'Balls rolling…';
      if (match.current_turn !== me) return `Waiting for ${other} to shoot…`;
      if (!s.breakDone) return 'Your break! Place the cue ball behind the line, aim and shoot.';
      const group = s.groups?.[me];
      const cleared = group && display.filter((b) => !b.p && groupOf(b.id) === group).length === 0;
      if (s.ballInHand) return 'Ball in hand: drag the cue ball anywhere, then aim and shoot.';
      if (cleared) return 'All your balls are down. Sink the 8-ball to win!';
      return group ? `Your shot. You are ${group}.` : 'Your shot. The table is open.';
    }

    const nudgeButtons = () => [...container.querySelectorAll('[data-nudge]')];

    function paintUI() {
      $('[data-scores]', container).innerHTML = scoresHTML();
      const enabled = myTurn();
      $('[data-controls]', container).classList.toggle('is-disabled', !enabled);
      shootBtn.disabled = !enabled;
      nudgeButtons().forEach((node) => { node.disabled = !enabled; });
      powerInput.disabled = !enabled;
      replayBtn.hidden = !state().lastShot || animating;
      $('[data-hint]', container).textContent = enabled
        ? (vertical ? 'Drag on the table to aim. ' : 'Click or drag on the table to aim. Arrow keys fine-tune, Space shoots. ')
          + (state().ballInHand ? 'Drag the white ball to move it.' : '')
        : '';
      const log = state().log || [];
      $('[data-log]', container).innerHTML = log.map((entry) => `<li>${entry.u ? `<b>${esc(ctx.nameOf(entry.u))}</b> ` : ''}${esc(entry.t)}</li>`).join('');
      ctx.setStatus(statusText(), enabled);
    }

    // ---------------------------------------------------------------- input

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (event) => {
      if (!myTurn()) return;
      const p = toTable(event);
      const cue = cueBall();
      canvas.setPointerCapture(event.pointerId);
      if (placing() && Math.hypot(p.x - cue.x, p.y - cue.y) < R * 2.6) {
        dragging = 'cue';
      } else {
        dragging = 'aim';
        aimAngle = Math.atan2(p.y - cue.y, p.x - cue.x);
      }
      draw();
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!dragging || !myTurn()) return;
      const p = toTable(event);
      if (dragging === 'cue') {
        const x = clamp(p.x, R, W - R);
        const y = clamp(p.y, R, H - R);
        cuePos = { x, y };
        cueValid = validCuePosition(state(), x, y);
      } else {
        const cue = cueBall();
        if (Math.hypot(p.x - cue.x, p.y - cue.y) > R) aimAngle = Math.atan2(p.y - cue.y, p.x - cue.x);
      }
      draw();
    });
    const endDrag = () => {
      if (dragging === 'cue' && !cueValid && cuePos) {
        cuePos = nearestValidCuePosition(state(), cuePos.x, cuePos.y);
        cueValid = validCuePosition(state(), cuePos.x, cuePos.y);
      }
      dragging = null;
      draw();
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    powerInput.addEventListener('input', () => {
      power = Number(powerInput.value) / 100;
      powerOut.textContent = `${powerInput.value}%`;
      draw();
    });
    container.addEventListener('click', (event) => {
      const nudge = event.target.closest('[data-nudge]');
      if (nudge && myTurn()) {
        aimAngle += Number(nudge.dataset.nudge) * (Math.PI / 720);
        draw();
      }
      if (event.target.closest('[data-shoot]')) shoot();
      if (event.target.closest('[data-replay]')) replay(state().lastShot);
    });
    const onKey = (event) => {
      if (!myTurn() || event.target.closest('input, textarea, select, [contenteditable]')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const step = event.shiftKey ? Math.PI / 1440 : Math.PI / 360;
        aimAngle += event.key === 'ArrowLeft' ? -step : step;
        event.preventDefault();
        draw();
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const next = clamp(Number(powerInput.value) + (event.key === 'ArrowUp' ? 5 : -5), 5, 100);
        powerInput.value = String(next);
        powerInput.dispatchEvent(new Event('input'));
        event.preventDefault();
      } else if (event.key === ' ' && document.activeElement?.tagName !== 'BUTTON') {
        event.preventDefault();
        shoot();
      }
    };
    document.addEventListener('keydown', onKey);

    const resizeObserver = new ResizeObserver(() => layout());
    resizeObserver.observe(wrap);

    resetCuePlacement();
    defaultAim();
    layout();
    paintUI();

    return {
      update(next) {
        const incoming = next.game_state;
        const opponentShot = incoming.lastShot && incoming.shotNo > shownShot && incoming.lastShot.by !== me;
        match = next;
        if (opponentShot && !animating && !busy) {
          replay(incoming.lastShot, { thenState: incoming });
          return;
        }
        if (!animating && !busy) {
          display = incoming.balls.map((b) => ({ ...b }));
          shownShot = incoming.shotNo;
          resetCuePlacement();
          if (match.current_turn === me) defaultAim();
          draw();
        }
        paintUI();
      },
      destroy() {
        cancelAnimationFrame(raf);
        resizeObserver.disconnect();
        document.removeEventListener('keydown', onKey);
      },
    };
  },
};
