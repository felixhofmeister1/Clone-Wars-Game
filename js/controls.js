/* =============================================================================
 * controls.js — Unified input for both control schemes.
 *
 *  PC mode     : pointer-lock mouse look, WASD / arrows to move, Shift sprint,
 *                Space jump, R reload, left mouse to fire, Esc to pause.
 *  Mobile mode : floating virtual joystick (left half of the screen), drag
 *                anywhere on the right half to look, on-screen FIRE / RELOAD /
 *                JUMP / PAUSE buttons. Dragging the FIRE button also aims, so
 *                you can shoot and turn with one thumb.
 *
 * The rest of the game only reads the normalised state exposed here
 * (move, look deltas, firing, one-shot "presses"), so it never needs to know
 * which control scheme is active.
 * ========================================================================== */

class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.mode = 'pc';          // 'pc' | 'mobile'
    this.enabled = false;      // true while the game is actively being played
    this.sensitivity = 1;

    // Normalised output state ------------------------------------------------
    this.move = { x: 0, y: 0 }; // x = strafe right, y = forward (both -1..1)
    this.look = { dx: 0, dy: 0 }; // accumulated look delta in radians
    this.firing = false;
    this.sprint = false;
    this._presses = new Set();  // one-shot actions: 'jump', 'reload', 'pause'

    // PC internals -----------------------------------------------------------
    this.keys = new Set();
    this.mouseDown = false;
    this.pointerLocked = false;
    this.pointerLockFailed = false;
    this.onPointerLockChange = null; // (locked:boolean) => void

    // Mobile internals -------------------------------------------------------
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, radius: 60 };
    this.lookTouch = { id: null, x: 0, y: 0 };
    this.fireTouchId = null;

    this._bindKeyboardAndMouse();
    this._bindTouchControls();
  }

  /* ------------------------------------------------------------ public API */

  setMode(mode) {
    this.mode = mode;
    this.reset();
  }

  /** Clears all held input (used when pausing or switching modes). */
  reset() {
    this.keys.clear();
    this.move.x = this.move.y = 0;
    this.look.dx = this.look.dy = 0;
    this.firing = this.sprint = this.mouseDown = false;
    this._presses.clear();
    this._releaseJoystick();
    this.lookTouch.id = null;
    this.fireTouchId = null;
    document.getElementById('btn-fire')?.classList.remove('active');
  }

  /** Returns and clears the accumulated look delta for this frame. */
  consumeLook() {
    const out = { dx: this.look.dx, dy: this.look.dy };
    this.look.dx = this.look.dy = 0;
    return out;
  }

  /** True once per press of a one-shot action. */
  consumePress(name) {
    if (this._presses.has(name)) {
      this._presses.delete(name);
      return true;
    }
    return false;
  }

  requestPointerLock() {
    if (this.mode !== 'pc' || this.pointerLocked) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => { this.pointerLockFailed = true; });
    } catch (e) {
      this.pointerLockFailed = true;
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Called once per frame before the game reads the input state. */
  update() {
    if (this.mode === 'pc') {
      const k = this.keys;
      const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      const str = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      this.move.x = str;
      this.move.y = fwd;
      this.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
      this.firing = this.mouseDown && (this.pointerLocked || this.pointerLockFailed);
    } else {
      // Joystick pushed almost to its rim while moving forward = sprint.
      const mag = Math.hypot(this.move.x, this.move.y);
      this.sprint = mag > 0.92 && this.move.y > 0.6;
    }
  }

  /* ------------------------------------------------------- PC: keys/mouse */

  _bindKeyboardAndMouse() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled || this.mode !== 'pc') return;
      this.keys.add(e.code);
      if (e.code === 'Space') this._presses.add('jump');
      if (e.code === 'KeyR') this._presses.add('reload');
      if (e.code === 'KeyP') this._presses.add('pause');
      // Stop the page from scrolling with space / arrow keys.
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || this.mode !== 'pc') return;
      // Fallback for browsers/iframes without pointer lock: drag to look.
      const canLook = this.pointerLocked || (this.pointerLockFailed && this.mouseDown);
      if (!canLook) return;
      const s = 0.0022 * this.sensitivity;
      this.look.dx += e.movementX * s;
      this.look.dy += e.movementY * s;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled || this.mode !== 'pc') return;
      // Clicking the view (re)captures the mouse. If pointer lock is refused
      // (e.g. Chrome's ~1 s cooldown after Esc), drag-to-look still works.
      if (!this.pointerLocked) this.requestPointerLock();
      if (e.button === 0 && (this.pointerLocked || this.pointerLockFailed)) this.mouseDown = true;
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (this.pointerLocked) this.pointerLockFailed = false;
      else this.mouseDown = false;
      if (this.onPointerLockChange) this.onPointerLockChange(this.pointerLocked);
    });
    document.addEventListener('pointerlockerror', () => { this.pointerLockFailed = true; });
  }

  /* -------------------------------------------- Mobile: virtual controls */

  _bindTouchControls() {
    const joyZone = document.getElementById('joystick-zone');
    const lookZone = document.getElementById('look-zone');
    const base = document.getElementById('joystick-base');
    const knob = document.getElementById('joystick-knob');
    const fireBtn = document.getElementById('btn-fire');
    this._joyEls = { base, knob };

    const active = () => this.enabled && this.mode === 'mobile';

    // Joystick: appears wherever the left thumb lands.
    joyZone.addEventListener('pointerdown', (e) => {
      if (!active() || this.joy.id !== null) return;
      e.preventDefault();
      this.joy.id = e.pointerId;
      this.joy.ox = e.clientX;
      this.joy.oy = e.clientY;
      base.style.left = `${e.clientX}px`;
      base.style.top = `${e.clientY}px`;
      base.classList.add('active');
      knob.style.transform = 'translate(-50%, -50%)';
    });

    // Look area: drag to rotate the camera.
    lookZone.addEventListener('pointerdown', (e) => {
      if (!active() || this.lookTouch.id !== null) return;
      e.preventDefault();
      this._startLook(e);
    });

    // Fire button: hold to fire, drag to keep aiming.
    fireBtn.addEventListener('pointerdown', (e) => {
      if (!active()) return;
      e.preventDefault();
      e.stopPropagation();
      this.firing = true;
      this.fireTouchId = e.pointerId;
      fireBtn.classList.add('active');
      if (this.lookTouch.id === null) this._startLook(e);
    });

    // Simple tap buttons.
    const tapButton = (id, action) => {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.enabled && action !== 'pause') return;
        this._presses.add(action);
        el.classList.add('active');
        setTimeout(() => el.classList.remove('active'), 150);
      });
    };
    tapButton('btn-reload', 'reload');
    tapButton('btn-jump', 'jump');
    tapButton('btn-pause', 'pause');

    // Shared move / release handling for every tracked pointer.
    window.addEventListener('pointermove', (e) => {
      if (!active()) return;
      if (e.pointerId === this.joy.id) {
        let dx = e.clientX - this.joy.ox;
        let dy = e.clientY - this.joy.oy;
        const len = Math.hypot(dx, dy);
        const r = this.joy.radius;
        if (len > r) { dx = (dx / len) * r; dy = (dy / len) * r; }
        this.move.x = dx / r;
        this.move.y = -dy / r;
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
      if (e.pointerId === this.lookTouch.id) {
        const s = 0.0048 * this.sensitivity;
        this.look.dx += (e.clientX - this.lookTouch.x) * s;
        this.look.dy += (e.clientY - this.lookTouch.y) * s;
        this.lookTouch.x = e.clientX;
        this.lookTouch.y = e.clientY;
      }
    }, { passive: true });

    const release = (e) => {
      if (e.pointerId === this.joy.id) this._releaseJoystick();
      if (e.pointerId === this.lookTouch.id) this.lookTouch.id = null;
      if (e.pointerId === this.fireTouchId) {
        this.firing = false;
        this.fireTouchId = null;
        fireBtn.classList.remove('active');
      }
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    // Block browser gestures (pinch zoom, pull-to-refresh) over the controls.
    document.getElementById('touch-controls').addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  _startLook(e) {
    this.lookTouch.id = e.pointerId;
    this.lookTouch.x = e.clientX;
    this.lookTouch.y = e.clientY;
  }

  _releaseJoystick() {
    this.joy.id = null;
    this.move.x = this.move.y = 0;
    if (this._joyEls) {
      this._joyEls.base.classList.remove('active');
      this._joyEls.base.style.left = '';   // back to its resting spot (CSS)
      this._joyEls.base.style.top = '';
      this._joyEls.knob.style.transform = 'translate(-50%, -50%)';
    }
  }
}

window.InputController = InputController;
