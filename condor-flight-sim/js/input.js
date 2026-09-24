/* =============================================================================
 * input.js — Flight controls from keyboard, gamepads / joysticks (incl. real
 * sidesticks and throttle quadrants via the Gamepad API) and touch.
 *
 * Output each frame: sidestick pitch/roll (-1..1), pedals, tiller, brakes,
 * thrust lever (-1 rev .. 0 idle .. 0.6 CL .. 0.8 FLX/MCT .. 1 TOGA) plus
 * discrete commands (gear, flaps, AP...) delivered through `onCommand`.
 * Keyboard sidestick input ramps in while a key is held and springs back to
 * neutral when released — which suits the Airbus normal law (neutral stick
 * holds the attitude/flight path).
 * ========================================================================== */
(function () {
  'use strict';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const DETENTS = [0, 0.6, 0.8, 1.0];
  const approach = (v, t, r) => (v < t ? Math.min(t, v + r) : Math.max(t, v - r));

  // Keyboard bindings (KeyboardEvent.code). Shown in the help overlay.
  const BINDINGS = [
    ['Flight controls', [
      ['↑ / Num8', 'Sidestick forward (nose down)'], ['↓ / Num2', 'Sidestick back (nose up)'],
      ['← → / Num4 Num6', 'Sidestick roll'], ['Q / E  (Num0 / NumEnter)', 'Rudder & nose-wheel steering'],
      ['Shift (hold) + arrows', 'Fine sidestick input'],
    ]],
    ['Thrust', [
      ['PgUp / PgDn  or  + / −', 'Thrust levers forward / back'],
      ['1 · 2 · 3 · 4', 'Detents: IDLE · CL · FLX/MCT · TOGA'],
      ['R (hold)', 'Reverse thrust (levers at idle, on the ground)'],
    ]],
    ['Configuration', [
      ['G', 'Landing gear up / down'], ['F  /  Shift+F', 'Flaps lever: next notch / previous notch'],
      ['/  (slash)', 'Speed brake: cycle RET / ½ / FULL'], ['Shift+/', 'Arm / disarm ground spoilers'],
      ['B or Space (hold)', 'Wheel brakes'], ['P', 'Parking brake'], ['K', 'Autobrake: OFF / LO / MED / MAX'],
    ]],
    ['Autoflight (FCU)', [
      ['Z', 'AP1 on / off'], ['Shift+Z', 'A/THR on / off'], ['A', 'APPR (arm ILS approach)'], ['L', 'LOC'],
      ['H / Shift+H', 'Heading knob: pull (HDG) / push (NAV)'], ['[ ]', 'Heading −1° / +1° (hold Ctrl-free)'],
      ['Home / End', 'FCU altitude +1000 / −1000 ft'], ['U / Shift+U', 'Altitude knob: push (managed) / pull (open)'],
      ['; \'', 'Speed −1 / +1 kt (selected)'], ['S / Shift+S', 'Speed knob: push (managed) / pull (selected)'],
      ['V / Shift+V', 'V/S +100 / −100 fpm'],
    ]],
    ['Views & sim', [
      ['C', 'Cockpit ⇄ outside view'], ['X', 'Cycle outside views (chase, drone, tower, fly-by, cabin)'],
      ['Mouse drag (right button in cockpit)', 'Look around'], ['Mouse wheel', 'Zoom / turn a knob you point at'],
      ['I', 'Instrument panel overlay'], ['M', 'Route map'], ['T / Shift+T', 'Time acceleration faster / slower'],
      ['Esc', 'Pause menu'], ['F1 / ?', 'This help'],
    ]],
  ];

  class Input {
    constructor() {
      this.keys = new Set();
      this.stick = { pitch: 0, roll: 0 };
      this.rudder = 0;
      this.brake = 0;
      this.throttle = 0;
      this.reverseHeld = false;
      this.touch = { active: false, pitch: 0, roll: 0, brake: false, rudder: 0, throttle: null };
      this.gamepad = null; this.gpPrev = [];
      this.onCommand = () => {};
      this.enabled = false;
      this.settings = { invertThrottle: false, throttleAxis: 'auto', rudderAxis: 'auto', sensitivity: 1 };
      this.throttleFromAxis = false;
      window.addEventListener('keydown', (e) => this.keydown(e));
      window.addEventListener('keyup', (e) => this.keys.delete(e.code));
      window.addEventListener('blur', () => this.keys.clear());
      window.addEventListener('gamepadconnected', (e) => { this.gamepad = e.gamepad.index; this.onCommand('message', `Controller connected: ${e.gamepad.id.slice(0, 40)}`); });
      window.addEventListener('gamepaddisconnected', () => { this.gamepad = null; });
    }

    keydown(e) {
      if (!this.enabled) return;
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const k = e.code, sh = e.shiftKey;
      const first = !this.keys.has(k);
      this.keys.add(k);
      const cmd = (c, v) => { e.preventDefault(); if (first || c.endsWith('Turn') || c === 'throttleStep') this.onCommand(c, v); };
      const nav = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'PageUp', 'PageDown', 'Home', 'End', 'F1', 'Slash'];
      if (nav.includes(k)) e.preventDefault();
      switch (k) {
        case 'KeyG': cmd('gear'); break;
        case 'KeyF': cmd('flaps', sh ? -1 : 1); break;
        case 'Slash': cmd(sh ? 'spoilersArm' : 'speedbrakeCycle'); break;
        case 'KeyP': cmd('parkbrake'); break;
        case 'KeyK': cmd('autobrakeCycle'); break;
        case 'KeyZ': cmd(sh ? 'athr' : 'ap1'); break;
        case 'KeyA': cmd('appr'); break;
        case 'KeyL': cmd('loc'); break;
        case 'KeyH': cmd(sh ? 'hdgPush' : 'hdgPull'); break;
        case 'BracketLeft': cmd('hdgTurn', -1); break;
        case 'BracketRight': cmd('hdgTurn', 1); break;
        case 'Home': cmd('altTurn', 1000); break;
        case 'End': cmd('altTurn', -1000); break;
        case 'KeyU': cmd(sh ? 'altPull' : 'altPush'); break;
        case 'Semicolon': cmd('spdTurn', -1); break;
        case 'Quote': cmd('spdTurn', 1); break;
        case 'KeyS': cmd(sh ? 'spdPull' : 'spdPush'); break;
        case 'KeyV': cmd('vsTurn', sh ? -100 : 100); break;
        case 'Digit1': cmd('detent', 0); break;
        case 'Digit2': cmd('detent', 0.6); break;
        case 'Digit3': cmd('detent', 0.8); break;
        case 'Digit4': cmd('detent', 1.0); break;
        case 'KeyC': cmd('viewToggle'); break;
        case 'KeyX': cmd('viewCycle'); break;
        case 'KeyI': cmd('panel'); break;
        case 'KeyM': cmd('map'); break;
        case 'KeyT': cmd('timeScale', sh ? -1 : 1); break;
        case 'Escape': cmd('pause'); break;
        case 'F1': cmd('help'); break;
        default: if (e.key === '?') cmd('help');
      }
    }

    has(...codes) { return codes.some((c) => this.keys.has(c)); }

    /** Poll devices and blend inputs. Returns the pilot inputs for the FDM. */
    update(dt) {
      const k = this;
      const fine = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
      // ---- keyboard sidestick (ramp in, spring back)
      const maxDefl = fine ? 0.3 : 1;
      const rate = (fine ? 1.2 : 2.2) * this.settings.sensitivity;
      let kp = 0, kr = 0;
      if (k.has('ArrowUp', 'Numpad8')) kp -= 1;
      if (k.has('ArrowDown', 'Numpad2')) kp += 1;
      if (k.has('ArrowLeft', 'Numpad4')) kr -= 1;
      if (k.has('ArrowRight', 'Numpad6')) kr += 1;
      this.stick.pitch = kp ? clamp(this.stick.pitch + kp * rate * dt, -maxDefl, maxDefl) : approach(this.stick.pitch, 0, 5 * dt);
      this.stick.roll = kr ? clamp(this.stick.roll + kr * rate * dt, -maxDefl, maxDefl) : approach(this.stick.roll, 0, 5 * dt);
      let rud = 0;
      if (k.has('KeyQ', 'Numpad0')) rud -= 1;
      if (k.has('KeyE', 'NumpadEnter')) rud += 1;
      this.rudder = rud ? clamp(this.rudder + rud * 2.5 * dt, -1, 1) : approach(this.rudder, 0, 3 * dt);
      let brake = k.has('KeyB', 'Space', 'Period') ? 1 : 0;
      // Throttle keys
      let dThr = 0;
      if (k.has('PageUp', 'Equal', 'NumpadAdd', 'F3')) dThr += 0.45 * dt;
      if (k.has('PageDown', 'Minus', 'NumpadSubtract', 'F2')) dThr -= 0.45 * dt;
      if (dThr) { this.throttle = clamp(this.throttle + dThr, 0, 1); this.throttleFromAxis = false; }
      this.reverseHeld = k.has('KeyR');

      let pitch = this.stick.pitch, roll = this.stick.roll, pedal = this.rudder, tiller = null;
      // ---- gamepad / joystick
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = this.gamepad != null ? pads[this.gamepad] : [...pads].find((p) => p);
      if (gp) {
        const dz = (v, d = 0.08) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));
        const btn = (i) => gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5);
        const edge = (i) => btn(i) && !this.gpPrev[i];
        if (gp.mapping === 'standard') {
          const gRoll = dz(gp.axes[0]), gPitch = dz(gp.axes[1]);
          if (gRoll || gPitch) { roll = clamp(roll + gRoll, -1, 1); pitch = clamp(pitch + gPitch, -1, 1); }
          const gRud = dz(gp.axes[2] || 0, 0.12);
          if (gRud) pedal = clamp(pedal + gRud, -1, 1);
          brake = Math.max(brake, gp.buttons[6] ? gp.buttons[6].value : 0);
          const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
          if (rt > 0.1) { this.throttle = clamp(this.throttle + rt * 0.5 * dt, 0, 1); this.throttleFromAxis = false; }
          if (btn(12)) this.throttle = clamp(this.throttle + 0.4 * dt, 0, 1);
          if (btn(13)) this.throttle = clamp(this.throttle - 0.4 * dt, 0, 1);
          if (edge(14)) this.onCommand('flaps', -1);
          if (edge(15)) this.onCommand('flaps', 1);
          if (edge(0)) this.onCommand('gear');
          if (edge(1)) this.onCommand('speedbrakeCycle');
          if (edge(2)) this.onCommand('ap1');
          if (edge(3)) this.onCommand('viewToggle');
          if (edge(4)) this.onCommand('athr');
          this.reverseHeld = this.reverseHeld || btn(5);
          if (edge(8)) this.onCommand('viewCycle');
          if (edge(9)) this.onCommand('pause');
        } else {
          // Generic joystick / sidestick + throttle quadrant
          const ax = gp.axes;
          roll = clamp(roll + dz(ax[0] || 0, 0.04), -1, 1);
          pitch = clamp(pitch + dz(ax[1] || 0, 0.04), -1, 1);
          const tIdx = this.settings.throttleAxis === 'auto' ? (ax.length > 2 ? 2 : -1) : +this.settings.throttleAxis;
          const rIdx = this.settings.rudderAxis === 'auto' ? (ax.length > 5 ? 5 : ax.length > 3 ? 3 : -1) : +this.settings.rudderAxis;
          if (tIdx >= 0 && ax[tIdx] != null) {
            let tv = (1 - ax[tIdx]) / 2;
            if (this.settings.invertThrottle) tv = 1 - tv;
            if (this.lastAxisThr == null || Math.abs(tv - this.lastAxisThr) > 0.01) { this.throttle = tv; this.throttleFromAxis = true; }
            this.lastAxisThr = tv;
          }
          if (rIdx >= 0 && ax[rIdx] != null) pedal = clamp(pedal + dz(ax[rIdx], 0.1), -1, 1);
          // Button 0 = sidestick takeover (AP disconnect) pushbutton, 1 = view
          if (edge(0)) this.onCommand('apOff');
          if (edge(1)) this.onCommand('viewToggle');
          if (edge(2)) this.onCommand('gear');
          if (edge(3)) this.onCommand('flaps', 1);
          if (edge(4)) this.onCommand('flaps', -1);
          brake = Math.max(brake, btn(5) ? 1 : 0);
        }
        this.gpPrev = gp.buttons.map((b) => b.pressed || b.value > 0.5);
      }
      // ---- touch
      const T = this.touch;
      if (T.active) { pitch = clamp(pitch + T.pitch, -1, 1); roll = clamp(roll + T.roll, -1, 1); }
      if (T.rudder) pedal = clamp(pedal + T.rudder, -1, 1);
      if (T.brake) brake = 1;
      if (T.throttle != null) { this.throttle = T.throttle; T.throttle = null; this.throttleFromAxis = false; }
      if (T.reverse) this.reverseHeld = true;
      return { pitch, roll, pedal, tiller, brake, throttle: this.throttle, reverse: this.reverseHeld };
    }

    setDetent(v) { this.throttle = v; this.throttleFromAxis = false; }
    stepDetent(dir) {
      const cur = this.throttle;
      if (dir > 0) this.throttle = DETENTS.find((d) => d > cur + 0.01) ?? 1;
      else this.throttle = [...DETENTS].reverse().find((d) => d < cur - 0.01) ?? 0;
    }
  }

  window.FlightInput = Input;
  window.KEY_BINDINGS = BINDINGS;
})();
