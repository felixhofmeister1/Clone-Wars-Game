/* =============================================================================
 * input.js - One input state for both control schemes.
 *
 *  Computer: WASD / arrows move, Shift run, C sneak, mouse look (pointer lock, or drag
 *            if the browser refuses it), F flashlight, hold Space to hold your
 *            breath, Esc / P pause.
 *  Phone:    left thumb joystick (push lightly to sneak, fully to run), drag the right side to
 *            look, LIGHT button, hold BREATH, pause button.
 * ========================================================================== */

class Input {
  constructor(canvas, touchRoot) {
    this.canvas = canvas;
    this.touchRoot = touchRoot;
    this.mode = 'pc';
    this.enabled = false;
    this.mouseSensitivity = 0.0022;
    this.touchSensitivity = 0.0058;

    this.move = { x: 0, y: 0 };
    this.run = false;
    this.sneak = false;
    this.breathHeld = false;
    this.lookDX = 0;
    this.lookDY = 0;
    this.presses = new Set();

    this.keys = new Set();
    this.locked = false;
    this.lockFailed = false;
    this.dragLook = false;
    this.onLockLost = null;

    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, radius: 56 };
    this.lookId = null;
    this.lookX = 0;
    this.lookY = 0;

    this._bindDesktop();
    this._bindTouch();
  }

  setMode(mode) {
    this.mode = mode;
    this.reset();
  }

  reset() {
    this.keys.clear();
    this.move.x = this.move.y = 0;
    this.run = this.sneak = this.breathHeld = this.dragLook = false;
    this.lookDX = this.lookDY = 0;
    this.presses.clear();
    this._releaseJoystick();
    this.lookId = null;
  }

  consume(name) { return this.presses.delete(name); }

  takeLook() {
    const out = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = this.lookDY = 0;
    return out;
  }

  requestLock() {
    if (this.mode !== 'pc' || this.locked || !this.canvas.requestPointerLock) return;
    try {
      const r = this.canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => { this.lockFailed = true; });
    } catch (e) {
      this.lockFailed = true;
    }
  }

  exitLock() { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); }

  /** Called once per frame before reading move/run. */
  update() {
    if (this.mode !== 'pc') return;
    const k = this.keys;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const len = Math.hypot(f, s) || 1;
    this.move.x = s / len;
    this.move.y = f / len;
    this.run = k.has('ShiftLeft') || k.has('ShiftRight');
    this.sneak = k.has('KeyC') && !this.run; // C, never Ctrl: Ctrl+W would close the tab.
  }

  /* ------------------------------------------------------------ computer */
  _bindDesktop() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled || this.mode !== 'pc') return;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyF') this.presses.add('light');
      if (e.code === 'Space') this.breathHeld = true;
      if (e.code === 'KeyP' || e.code === 'Escape') this.presses.add('pause');
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') this.breathHeld = false;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.breathHeld = false; });

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled || this.mode !== 'pc' || e.button !== 0) return;
      if (!this.locked) {
        this.requestLock();
        this.dragLook = true; // Look by dragging until (or unless) pointer lock engages.
      }
    });
    window.addEventListener('mouseup', () => { this.dragLook = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled || this.mode !== 'pc' || !(this.locked || this.dragLook)) return;
      this.lookDX += (e.movementX || 0) * this.mouseSensitivity;
      this.lookDY += (e.movementY || 0) * this.mouseSensitivity;
    });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      if (this.locked) this.dragLook = false;
      if (was && !this.locked && this.enabled && this.onLockLost) this.onLockLost();
    });
    document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
  }

  /* ------------------------------------------------------------ phone */
  _bindTouch() {
    const root = this.touchRoot;
    const joyZone = root.querySelector('#joy-zone');
    const lookZone = root.querySelector('#look-zone');
    this.joyBase = root.querySelector('#joy-base');
    this.joyKnob = root.querySelector('#joy-knob');

    joyZone.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.joy.id !== null) return;
      e.preventDefault();
      Input.capture(joyZone, e.pointerId);
      Object.assign(this.joy, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
      this.joyBase.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      this.joyBase.hidden = false;
      this._drawKnob();
    });
    joyZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joy.id) return;
      let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
      const len = Math.hypot(dx, dy), r = this.joy.radius;
      if (len > r) { dx *= r / len; dy *= r / len; }
      this.joy.x = dx;
      this.joy.y = dy;
      this.move.x = dx / r;
      this.move.y = -dy / r;
      this.run = len / r > 0.95;
      this._drawKnob();
    });
    const endJoy = (e) => { if (e.pointerId === this.joy.id) this._releaseJoystick(); };
    joyZone.addEventListener('pointerup', endJoy);
    joyZone.addEventListener('pointercancel', endJoy);

    lookZone.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.lookId !== null) return;
      e.preventDefault();
      Input.capture(lookZone, e.pointerId);
      this.lookId = e.pointerId;
      this.lookX = e.clientX;
      this.lookY = e.clientY;
    });
    lookZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookId) return;
      this.lookDX += (e.clientX - this.lookX) * this.touchSensitivity;
      this.lookDY += (e.clientY - this.lookY) * this.touchSensitivity;
      this.lookX = e.clientX;
      this.lookY = e.clientY;
    });
    const endLook = (e) => { if (e.pointerId === this.lookId) this.lookId = null; };
    lookZone.addEventListener('pointerup', endLook);
    lookZone.addEventListener('pointercancel', endLook);

    const tap = (id, name) => {
      root.querySelector(id).addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.enabled) this.presses.add(name);
      });
    };
    tap('#btn-light', 'light');
    tap('#btn-pause', 'pause');

    const breath = root.querySelector('#btn-breath');
    breath.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      Input.capture(breath, e.pointerId);
      if (this.enabled) this.breathHeld = true;
    });
    const release = () => { this.breathHeld = false; };
    breath.addEventListener('pointerup', release);
    breath.addEventListener('pointercancel', release);
    breath.addEventListener('lostpointercapture', release);

    // Stop long-presses from opening context menus or selecting text on phones.
    root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Some browsers throw if the pointer is already gone; capture is a nicety, not a requirement. */
  static capture(el, id) {
    try { el.setPointerCapture(id); } catch (e) { /* keep going without capture */ }
  }

  _drawKnob() {
    this.joyKnob.style.transform = `translate(${this.joy.x}px, ${this.joy.y}px)`;
  }

  _releaseJoystick() {
    this.joy.id = null;
    this.joy.x = this.joy.y = 0;
    if (this.mode === 'mobile') { this.move.x = this.move.y = 0; this.run = false; }
    if (this.joyBase) this.joyBase.hidden = true;
    if (this.joyKnob) this._drawKnob();
  }
}
