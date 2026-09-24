/* =============================================================================
 * audio.js - Every sound is synthesized with the Web Audio API; no audio files.
 *
 *  Sound          engine: drone bed, 3D positional one-shots, the scratching
 *                 in the walls, a muffle filter while you hold your breath
 *  AudioDirector  port of AHorrorAudioManager: a sound 3.5 m behind you while
 *                 the drone drops to silence for 4.5 s, then swells back
 * ========================================================================== */

const Sound = {
  ctx: null,
  ready: false,

  /** Must run inside a user gesture (browsers block audio until then). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 18000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    this.master.connect(this.muffle);
    this.muffle.connect(comp);
    comp.connect(ctx.destination);

    this.noise = this._noiseBuffer(2.5, false);
    this.brown = this._noiseBuffer(4, true);
    this._buildDrone();
    this._buildScratch();
    this.ready = true;
  },

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  /* ------------------------------------------------------------ plumbing */
  _noiseBuffer(seconds, brown) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  },

  _noise(t, dur, dest) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.connect(dest);
    s.start(t, Math.random() * 2);
    s.stop(t + dur);
    return s;
  },

  _env(param, t, peak, attack, hold, release) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    if (hold > 0) param.setValueAtTime(Math.max(peak, 0.0002), t + attack + hold);
    param.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  },

  _panner(pos, ref = 1.2) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.maxDistance = 50;
    p.rolloffFactor = 1.15;
    this._setPos(p, pos);
    p.connect(this.master);
    return p;
  },

  _setPos(p, v) {
    if (p.positionX) { p.positionX.value = v.x; p.positionY.value = v.y; p.positionZ.value = v.z; }
    else p.setPosition(v.x, v.y, v.z);
  },

  /** Disconnects a one-shot's output once it has finished, so nodes can be collected. */
  _cleanup(node, seconds) { setTimeout(() => { try { node.disconnect(); } catch (e) { /* already gone */ } }, seconds * 1000); },

  updateListener(pos, fwd) {
    if (!this.ready) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z;
      l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  },

  /** Holding your breath: the world goes muffled and close. */
  setMuffled(on) {
    if (!this.ready) return;
    this.muffle.frequency.setTargetAtTime(on ? 1400 : 18000, this.ctx.currentTime, 0.12);
  },

  /* ------------------------------------------------------------ drone bed */
  _buildDrone() {
    const ctx = this.ctx;
    this.droneBus = ctx.createGain();
    this.droneBus.gain.value = 0;
    this.droneBus.connect(this.master);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 150;
    lp.Q.value = 0.7;
    lp.connect(this.droneBus);
    [41.2, 55.1, 61.7].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'sine' : 'sawtooth';
      o.frequency.value = f;
      o.detune.value = (i - 1) * 7;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.25 : 0.16;
      o.connect(g);
      g.connect(lp);
      o.start();
    });

    const rumble = ctx.createBufferSource();
    rumble.buffer = this.brown;
    rumble.loop = true;
    const rl = ctx.createBiquadFilter();
    rl.type = 'lowpass';
    rl.frequency.value = 320;
    const rg = ctx.createGain();
    rg.gain.value = 0.5;
    rumble.connect(rl);
    rl.connect(rg);
    rg.connect(this.droneBus);
    rumble.start();

    // The filter drifts slowly so the bed never sits still.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lg = ctx.createGain();
    lg.gain.value = 45;
    lfo.connect(lg);
    lg.connect(lp.frequency);
    lfo.start();
  },

  fadeDrone(level, seconds) {
    if (!this.ready) return;
    const g = this.droneBus.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(level, t + Math.max(0.02, seconds));
  },

  /* ------------------------------------------------------------ the thing in the walls */
  _buildScratch() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 1.3;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 800;
    this.scratchGain = ctx.createGain();
    this.scratchGain.gain.value = 0;
    this.scratchPanner = this._panner({ x: 0, y: 1.2, z: 0 }, 1.0);
    src.connect(bp);
    bp.connect(hp);
    hp.connect(this.scratchGain);
    this.scratchGain.connect(this.scratchPanner);
    src.start();
    this.scratchT = 0;
  },

  /** activity 0..1: how hard it is dragging itself through the drywall. */
  updateScratch(dt, pos, activity) {
    if (!this.ready) return;
    this.scratchT += dt * 8;
    const grain = Math.max(0, Perlin.noise1D(this.scratchT) * 1.7 + 0.1);
    this._setPos(this.scratchPanner, pos);
    this.scratchGain.gain.setTargetAtTime(activity * grain * 0.85, this.ctx.currentTime, 0.03);
  },

  /* ------------------------------------------------------------ one-shots */
  click() {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(2400, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.02);
    const g = c.createGain();
    this._env(g.gain, t, 0.1, 0.001, 0, 0.03);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.06);
  },

  step(volume, run) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = run ? 700 : 420;
    const g = c.createGain();
    this._env(g.gain, t, volume, 0.005, 0.02, 0.12);
    lp.connect(g);
    g.connect(this.master);
    this._noise(t, 0.2, lp);
    if (Math.random() < 0.14) {
      // Floorboard creak.
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(170 + Math.random() * 80, t);
      o.frequency.linearRampToValueAtTime(130 + Math.random() * 60, t + 0.28);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 620;
      bp.Q.value = 6;
      const cg = c.createGain();
      this._env(cg.gain, t + 0.02, volume * 0.3, 0.05, 0.08, 0.15);
      o.connect(bp);
      bp.connect(cg);
      cg.connect(this.master);
      o.start(t);
      o.stop(t + 0.36);
    }
  },

  gasp() {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(600, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.32);
    const g = c.createGain();
    this._env(g.gain, t, 0.95, 0.03, 0.18, 0.35);
    bp.connect(g);
    g.connect(this.master);
    this._noise(t, 0.7, bp);
    for (let i = 1; i <= 3; i++) {
      // Ragged breaths after the gasp.
      const tt = t + 0.55 + i * 0.5;
      const b2 = c.createBiquadFilter();
      b2.type = 'bandpass';
      b2.frequency.value = 1400 - i * 150;
      b2.Q.value = 0.9;
      const g2 = c.createGain();
      this._env(g2.gain, tt, 0.35 / i, 0.08, 0.05, 0.3);
      b2.connect(g2);
      g2.connect(this.master);
      this._noise(tt, 0.5, b2);
    }
  },

  exhale() {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.7;
    const g = c.createGain();
    this._env(g.gain, t, 0.16, 0.08, 0.1, 0.5);
    bp.connect(g);
    g.connect(this.master);
    this._noise(t, 0.8, bp);
  },

  heartbeat(volume) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    [0, 0.24].forEach((offset, i) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(62, t + offset);
      o.frequency.exponentialRampToValueAtTime(38, t + offset + 0.12);
      const g = c.createGain();
      this._env(g.gain, t + offset, volume * (i ? 0.7 : 1), 0.008, 0.02, 0.14);
      o.connect(g);
      g.connect(this.master);
      o.start(t + offset);
      o.stop(t + offset + 0.22);
    });
  },

  whisper(pos) {
    if (!this.ready) return;
    const c = this.ctx, t0 = c.currentTime;
    const out = this._panner(pos, 1.0);
    const count = 5 + Math.floor(Math.random() * 4);
    let t = t0;
    for (let i = 0; i < count; i++) {
      const dur = 0.07 + Math.random() * 0.12;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800 + Math.random() * 2400;
      bp.Q.value = 2.5;
      const g = c.createGain();
      this._env(g.gain, t, 0.6 + Math.random() * 0.35, 0.02, dur * 0.5, dur);
      bp.connect(g);
      g.connect(out);
      this._noise(t, dur * 2 + 0.05, bp);
      t += dur + 0.03 + Math.random() * 0.1;
    }
    this._cleanup(out, t - t0 + 1);
  },

  knock(pos) {
    if (!this.ready) return;
    const c = this.ctx, t0 = c.currentTime;
    const out = this._panner(pos, 1.4);
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const t = t0 + i * (0.28 + Math.random() * 0.08);
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.09);
      const g = c.createGain();
      this._env(g.gain, t, 0.9, 0.003, 0.01, 0.16);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 0.25);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1200;
      const ng = c.createGain();
      this._env(ng.gain, t, 0.5, 0.002, 0, 0.05);
      lp.connect(ng);
      ng.connect(out);
      this._noise(t, 0.08, lp);
    }
    this._cleanup(out, 2);
  },

  breathBehind(pos) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const out = this._panner(pos, 1.0);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(700, t);
    bp.frequency.linearRampToValueAtTime(1100, t + 0.9);
    bp.frequency.linearRampToValueAtTime(500, t + 2.2);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.25, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
    bp.connect(g);
    g.connect(out);
    this._noise(t, 2.4, bp);
    this._cleanup(out, 3.5);
  },

  creak(pos) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const out = this._panner(pos, 1.6);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(95, t);
    o.frequency.linearRampToValueAtTime(160, t + 0.7);
    o.frequency.linearRampToValueAtTime(120, t + 1.4);
    const vib = c.createOscillator();
    vib.frequency.value = 23;
    const vg = c.createGain();
    vg.gain.value = 14;
    vib.connect(vg);
    vg.connect(o.frequency);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 5;
    const g = c.createGain();
    this._env(g.gain, t, 0.55, 0.15, 0.9, 0.5);
    o.connect(bp);
    bp.connect(g);
    g.connect(out);
    o.start(t);
    vib.start(t);
    o.stop(t + 1.7);
    vib.stop(t + 1.7);
    this._cleanup(out, 2.5);
  },

  unlock(pos) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const out = this._panner(pos, 1.6);
    [0, 0.16].forEach((offset) => {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2600;
      bp.Q.value = 4;
      const g = c.createGain();
      this._env(g.gain, t + offset, 0.9, 0.002, 0.01, 0.06);
      bp.connect(g);
      g.connect(out);
      this._noise(t + offset, 0.1, bp);
    });
    this._cleanup(out, 1);
    setTimeout(() => this.creak(pos), 450);
  },

  sting() {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5000, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 1.6);
    const g = c.createGain();
    this._env(g.gain, t, 0.5, 0.01, 0.1, 1.5);
    lp.connect(g);
    g.connect(this.master);
    [311.1, 329.6, 466.2, 622.3].forEach((f) => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.01);
      o.connect(lp);
      o.start(t);
      o.stop(t + 1.8);
    });
    const ng = c.createGain();
    this._env(ng.gain, t, 0.6, 0.005, 0.02, 0.4);
    ng.connect(this.master);
    this._noise(t, 0.5, ng);
  },

  /** A garbled voice off an old cassette. */
  tapeVoice() {
    if (!this.ready) return;
    const c = this.ctx, t0 = c.currentTime;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1000;
    bp.Q.value = 1.2;
    const g = c.createGain();
    g.gain.value = 0.0001;
    bp.connect(g);
    g.connect(this.master);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 128;
    const vib = c.createOscillator();
    vib.frequency.value = 5.5;
    const vg = c.createGain();
    vg.gain.value = 9;
    vib.connect(vg);
    vg.connect(o.frequency);
    o.connect(bp);
    let t = t0 + 0.1;
    for (let i = 0; i < 7; i++) {
      const d = 0.1 + Math.random() * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.frequency.setValueAtTime(105 + Math.random() * 60, t);
      t += d + 0.05 + Math.random() * 0.08;
    }
    const hiss = c.createGain();
    this._env(hiss.gain, t0, 0.05, 0.05, t - t0, 0.2);
    hiss.connect(this.master);
    this._noise(t0, t - t0 + 0.4, hiss);
    o.start(t0);
    vib.start(t0);
    o.stop(t + 0.1);
    vib.stop(t + 0.1);
  },

  pickup() {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    [660, 990].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = c.createGain();
      this._env(g.gain, t + i * 0.07, 0.1, 0.005, 0.03, 0.18);
      o.connect(g);
      g.connect(this.master);
      o.start(t + i * 0.07);
      o.stop(t + i * 0.07 + 0.3);
    });
  },

  capture() {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const g = c.createGain();
    this._env(g.gain, t, 1.0, 0.005, 0.35, 1.2);
    g.connect(this.master);
    this._noise(t, 1.7, g);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 1.4);
    const og = c.createGain();
    this._env(og.gain, t, 0.7, 0.01, 0.3, 1.1);
    o.connect(og);
    og.connect(this.master);
    o.start(t);
    o.stop(t + 1.6);
    this.sting();
  },
};

/* ---------------------------------------------------------------- AudioDirector */
class AudioDirector {
  constructor() {
    this.firstEventDelay = 20;
    this.eventInterval = 30;
    this.eventIntervalJitter = 10;
    this.eventChance = 0.75;
    this.behindDistance = 3.5;       // metres
    this.silenceDuration = 4.5;      // seconds of absolute silence
    this.silenceFadeOut = 0.25;
    this.silenceFadeIn = 3;
    this.droneVolume = 0.55;
    this.onEvent = null;             // (position) => void
    this.reset();
  }

  reset() {
    this.timer = this.firstEventDelay;
    this.phase = 'idle';             // idle | silent | recover
    this.phaseTime = 0;
    this.lastSound = -1;
  }

  startDrone() { Sound.fadeDrone(this.droneVolume, 4); }

  update(dt, playerPos, yaw) {
    if (this.phase === 'silent') {
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        Sound.fadeDrone(this.droneVolume, this.silenceFadeIn);
        this.phase = 'recover';
        this.phaseTime = this.silenceFadeIn;
      }
    } else if (this.phase === 'recover') {
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) this.phase = 'idle';
    }

    // Looping timer; each period is re-rolled so the scares never settle into a rhythm.
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = Math.max(1, this.eventInterval + (Math.random() * 2 - 1) * this.eventIntervalJitter);
      if (this.phase === 'idle' && Math.random() < this.eventChance) this.trigger(playerPos, yaw);
    }
  }

  trigger(playerPos, yaw) {
    // Heading only: forward is (-sin yaw, 0, -cos yaw), so "behind" is position - forward * 3.5 m.
    const pos = {
      x: playerPos.x + Math.sin(yaw) * this.behindDistance,
      y: 1.5,
      z: playerPos.z + Math.cos(yaw) * this.behindDistance,
    };
    let pick;
    do { pick = Math.floor(Math.random() * 3); } while (pick === this.lastSound);
    this.lastSound = pick;
    if (pick === 0) Sound.whisper(pos);
    else if (pick === 1) Sound.knock(pos);
    else Sound.breathBehind(pos);

    Sound.fadeDrone(0, this.silenceFadeOut);
    this.phase = 'silent';
    this.phaseTime = this.silenceFadeOut + this.silenceDuration;
    if (this.onEvent) this.onEvent(pos);
  }
}
