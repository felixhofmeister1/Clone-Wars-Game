/* =============================================================================
 * systems.js - Browser ports of the UE5 C++ systems in EchoesInTheDrywall/.
 *
 *  Perlin      FMath::PerlinNoise1D (same algorithm, period 256)
 *  Flashlight  AEchoPlayerCharacter battery + flicker
 *  Breathing   UBreathingComponent panic, breath holding, forced gasps
 *  ShiftTrigger ANonEuclideanShiftTrigger dot-product swap behind the player
 *
 * Tuning values match the C++ defaults unless a comment says otherwise.
 * ========================================================================== */

const Perlin = (() => {
  const perm = Array.from({ length: 256 }, (_, i) => i);
  let seed = 1337;
  for (let i = 255; i > 0; i--) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    const j = (seed >>> 8) % (i + 1);
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const scales = [-1, -7 / 8, -6 / 8, -5 / 8, -4 / 8, -3 / 8, -2 / 8, -1 / 8, 1 / 8, 2 / 8, 3 / 8, 4 / 8, 5 / 8, 6 / 8, 7 / 8, 1];
  return {
    noise1D(x) {
      const fl = Math.floor(x);
      const xi = fl & 255;
      const xf = x - fl;
      const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
      const a = scales[p[xi] & 15] * xf;
      const b = scales[p[xi + 1] & 15] * (xf - 1);
      return 2 * (a + u * (b - a));
    },
  };
})();

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  if (x < a) return 0;
  if (x >= b) return 1;
  const f = (x - a) / (b - a);
  return f * f * (3 - 2 * f);
};

/* ---------------------------------------------------------------- Flashlight */
class Flashlight {
  constructor(light) {
    this.light = light;
    this.maxBatterySeconds = 300;
    this.battery = 300 * 0.6;          // Start partly drained: the apartment is not kind.
    this.drainRate = 1;
    this.lowBatteryThreshold = 0.2;
    this.baseIntensity = light.intensity;
    this.emptyBatteryBrightness = 0.35;
    this.flickerSpeed = 3;
    this.flickerAmplitude = 0.05;
    this.lowBatteryFlickerSpeed = 14;
    this.lowBatteryFlickerAmplitude = 0.6;
    this.lowBatteryDropoutThreshold = 0.3;
    this.on = false;
    this.noiseTime = Math.random() * 256;
    this.brightness = 0;               // Last applied brightness multiplier (0..~1.05).
    this.onClick = null;               // () => void, the switch was pressed
    this.onDepleted = null;            // () => void
    light.visible = false;
  }

  get fraction() { return clamp(this.battery / this.maxBatterySeconds, 0, 1); }
  get percentage() { return this.fraction * 100; }
  get isLow() { return this.fraction <= this.lowBatteryThreshold; }

  /** Returns true if the light ends up in the requested state (dead battery: false, still clicks). */
  setEnabled(enable) {
    if (enable === this.on) return true;
    if (this.onClick) this.onClick();
    if (enable && this.battery <= 0) return false;
    this._apply(enable);
    return true;
  }

  toggle() { this.setEnabled(!this.on); return this.on; }

  addCharge(seconds) {
    const before = this.battery;
    this.battery = Math.min(this.maxBatterySeconds, this.battery + Math.max(0, seconds));
    return this.battery - before;
  }

  update(dt) {
    if (!this.on) return;
    this.battery = Math.max(0, this.battery - dt * this.drainRate);
    if (this.battery <= 0) {
      this._apply(false);              // The bulb dies on its own: no click, just darkness.
      if (this.onDepleted) this.onDepleted();
      return;
    }
    this._flicker(dt);
  }

  _apply(on) {
    this.on = on;
    if (on) this._flicker(0);
    this.light.visible = on;
    if (!on) this.brightness = 0;
  }

  _flicker(dt) {
    const charge = this.fraction;
    const lowAlpha = 1 - smoothstep(0, this.lowBatteryThreshold, charge);
    const speed = lerp(this.flickerSpeed, this.lowBatteryFlickerSpeed, lowAlpha);
    const amplitude = lerp(this.flickerAmplitude, this.lowBatteryFlickerAmplitude, lowAlpha);

    this.noiseTime = (this.noiseTime + dt * speed) % 256;
    const noise = 0.7 * Perlin.noise1D(this.noiseTime) + 0.3 * Perlin.noise1D(this.noiseTime * 2 + 17);

    let b = Math.max(0, 1 + noise * amplitude);
    b *= lerp(1, this.emptyBatteryBrightness, lowAlpha);
    if (noise < -lerp(1, this.lowBatteryDropoutThreshold, lowAlpha)) b *= 0.05;

    this.brightness = b;
    this.light.intensity = this.baseIntensity * b;
  }
}

/* ---------------------------------------------------------------- Breathing */
class Breathing {
  constructor() {
    this.maxPanic = 100;
    this.panic = 0;
    this.panicFloor = 0;
    this.highPanicThreshold = 70;
    this.panicDecayRate = 4;
    this.panicDecayDelay = 3;
    this.forcedGaspPanicSpike = 25;
    this.maxBreathHoldDuration = 6;
    this.panicBreathDrainMultiplier = 0.5;
    this.breathRecoveryRate = 1.5;
    this.minBreathToHold = 1;
    this.gaspRecoveryDuration = 2.5;
    this.holdingNoiseMultiplier = 0.1;
    this.panickedNoiseMultiplier = 1.75;

    this.breath = this.maxBreathHoldDuration;
    this.holding = false;
    this.holdTime = 0;
    this.gaspRecovery = 0;
    this.sincePanicIncrease = 0;
    this.onForcedGasp = null;          // (reason: 'exhausted' | 'panicked', panic) => void
    this.onHoldChanged = null;         // (holding) => void
  }

  get panicNormalized() { return this.panic / this.maxPanic; }
  get isPanicHigh() { return this.panic >= this.highPanicThreshold; }
  get breathNormalized() { return clamp(this.breath / this.maxBreathHoldDuration, 0, 1); }
  get recovering() { return this.gaspRecovery > 0; }
  get canHold() {
    return !this.holding && this.gaspRecovery <= 0 && this.breath >= Math.min(this.minBreathToHold, this.maxBreathHoldDuration);
  }

  get noiseMultiplier() {
    if (this.holding) return this.holdingNoiseMultiplier;
    const n = lerp(1, this.panickedNoiseMultiplier, this.panicNormalized);
    return this.recovering ? Math.max(n, this.panickedNoiseMultiplier) : n;
  }

  startHolding() {
    if (!this.canHold) return false;
    this.holding = true;
    this.holdTime = 0;
    if (this.onHoldChanged) this.onHoldChanged(true);
    return true;
  }

  stopHolding() {
    if (!this.holding) return;
    if (this.isPanicHigh) { this._gasp('panicked'); return; }
    this._endHold();
  }

  addPanic(amount) {
    if (amount > 0) this.sincePanicIncrease = 0;
    this.panic = clamp(this.panic + amount, 0, this.maxPanic);
  }

  update(dt) {
    if (this.gaspRecovery > 0) this.gaspRecovery = Math.max(0, this.gaspRecovery - dt);

    if (this.holding) {
      this.holdTime += dt;
      this.breath = Math.max(0, this.breath - dt * (1 + this.panicNormalized * this.panicBreathDrainMultiplier));
      if (this.breath <= 0) this._gasp('exhausted');
    } else {
      this.breath = Math.min(this.maxBreathHoldDuration, this.breath + dt * this.breathRecoveryRate);
      this.sincePanicIncrease += dt;
      if (this.sincePanicIncrease >= this.panicDecayDelay && this.panic > this.panicFloor) {
        this.panic = Math.max(this.panicFloor, this.panic - this.panicDecayRate * dt);
      }
    }
  }

  _endHold() {
    if (!this.holding) return;
    this.holding = false;
    this.holdTime = 0;
    if (this.onHoldChanged) this.onHoldChanged(false);
  }

  _gasp(reason) {
    this.gaspRecovery = this.gaspRecoveryDuration; // Lock out re-holds before anyone is notified.
    this._endHold();
    this.addPanic(this.forcedGaspPanicSpike);
    if (this.onForcedGasp) this.onForcedGasp(reason, this.panic);
  }
}

/* ---------------------------------------------------------------- ShiftTrigger */
class ShiftTrigger {
  /**
   * zone: {minX, maxX, minZ, maxZ} in world metres. focus: THREE.Vector3.
   * isUnseen(): true when none of the affected geometry is on screen.
   * apply(shifted): swaps the layout. onShift(): after a swap.
   */
  constructor({ zone, focus, isUnseen, apply, onShift, enabled = true }) {
    Object.assign(this, { zone, focus, isUnseen, apply, onShift, enabled });
    this.backTurnedDot = -0.7;
    this.armingDot = 0.5;
    this.minTimeInside = 0.25;
    this.inside = false;
    this.timeInside = 0;
    this.armed = false;
    this.triggered = false;
    this.lastDot = 1;
    this._fwd = new THREE.Vector3();
    this._to = new THREE.Vector3();
  }

  update(dt, camera) {
    if (!this.enabled || this.triggered) return;
    const p = camera.position;
    const z = this.zone;
    const inside = p.x >= z.minX && p.x <= z.maxX && p.z >= z.minZ && p.z <= z.maxZ;
    if (!inside) { this.inside = false; this.armed = false; this.timeInside = 0; return; }
    if (!this.inside) { this.inside = true; this.timeInside = 0; this.armed = false; }
    this.timeInside += dt;

    // Camera forward vs direction to the focus, yaw only.
    camera.getWorldDirection(this._fwd);
    this._fwd.y = 0;
    this._to.subVectors(this.focus, p);
    this._to.y = 0;
    if (this._fwd.lengthSq() < 1e-6 || this._to.lengthSq() < 1e-6) return;
    const dot = this._fwd.normalize().dot(this._to.normalize());
    this.lastDot = dot;

    if (!this.armed) { this.armed = dot >= Math.max(this.armingDot, this.backTurnedDot + 0.2); return; }
    if (this.timeInside < this.minTimeInside || dot >= this.backTurnedDot) return;
    if (!this.isUnseen()) return;      // Back is turned but the old space is still on screen.

    this.triggered = true;
    this.apply(true);
    if (this.onShift) this.onShift();
  }
}
