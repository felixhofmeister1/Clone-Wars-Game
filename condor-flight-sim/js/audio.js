/* =============================================================================
 * audio.js — Synthesised sound (WebAudio): two Trent 7000s (fan whine,
 * roar, rumble), wind, runway rumble, touchdown thump & tyre chirp,
 * gear/flap motors, Airbus aural alerts (cavalry charge, master caution
 * chime, C-chord altitude alert, overspeed clacker, stall cricket, seat-belt
 * chime) and spoken callouts via speech synthesis (RA callouts, RETARD,
 * GPWS, pilot-monitoring calls, cabin announcements).
 * ========================================================================== */
(function () {
  'use strict';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  class SimAudio {
    constructor() {
      this.ctx = null; this.enabled = true; this.voice = true; this.volume = 0.8;
      this.queue = []; this.speaking = false;
    }
    init() {
      if (this.ctx) { this.ctx.resume?.(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(ctx.destination);
      this.cockpitFilter = ctx.createBiquadFilter(); this.cockpitFilter.type = 'lowpass'; this.cockpitFilter.frequency.value = 20000;
      this.cockpitFilter.connect(this.master);
      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < d.length; i++) { // pink-ish noise
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      }
      this.noiseBuf = noiseBuf;
      const noise = () => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(); return s; };
      const chain = (src, type, freq, q = 0.7) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(this.cockpitFilter); return { f, g }; };
      // Engines
      this.roar = chain(noise(), 'lowpass', 400);
      this.rumble = chain(noise(), 'lowpass', 90);
      this.whine = [0, 1].map(() => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 400; o.start();
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6; f.frequency.value = 800;
        const g = ctx.createGain(); g.gain.value = 0;
        o.connect(f); f.connect(g); g.connect(this.cockpitFilter);
        return { o, f, g };
      });
      this.buzz = chain(noise(), 'bandpass', 1800, 2.5);
      this.wind = chain(noise(), 'bandpass', 700, 0.6);
      this.runway = chain(noise(), 'lowpass', 160);
      this.motor = chain(noise(), 'bandpass', 380, 8);
    }
    setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
    pause(on) {
      if (!this.ctx) return;
      if (on) { this.ctx.suspend?.(); if (window.speechSynthesis) speechSynthesis.cancel(); }
      else this.ctx.resume?.();
    }

    /** Continuous sounds from the aircraft state. */
    update(ac, view, dt) {
      if (!this.ctx || !this.enabled) return;
      const t = this.ctx.currentTime;
      const inside = view === 'cockpit' || view === 'cabin';
      this.cockpitFilter.frequency.setTargetAtTime(inside ? 2200 : 16000, t, 0.2);
      const n1 = (ac.engines[0].n1 + ac.engines[1].n1) / 200;
      const thrust = clamp((n1 - 0.2) / 0.75, 0, 1);
      const rev = Math.max(ac.engines[0].rev || 0, ac.engines[1].rev || 0);
      const ext = inside ? 0.35 : 1;
      this.roar.g.gain.setTargetAtTime((0.05 + thrust * 0.45 + rev * 0.25) * ext, t, 0.15);
      this.roar.f.frequency.setTargetAtTime(250 + thrust * 1400, t, 0.2);
      this.rumble.g.gain.setTargetAtTime((0.05 + thrust * 0.35) * (inside ? 0.6 : 1), t, 0.2);
      this.whine.forEach((w, i) => {
        const e = ac.engines[i];
        const f = 180 + e.n1 * 14;
        w.o.frequency.setTargetAtTime(f, t, 0.1);
        w.f.frequency.setTargetAtTime(f * 2, t, 0.1);
        w.g.gain.setTargetAtTime((e.n1 > 5 ? 0.02 + (e.n1 / 100) * 0.05 : 0) * (inside ? 0.5 : 1), t, 0.2);
      });
      this.buzz.g.gain.setTargetAtTime(thrust > 0.6 && ac.tas < 150 ? (thrust - 0.6) * 0.12 * ext : 0, t, 0.3);
      const ias = ac.cas;
      this.wind.g.gain.setTargetAtTime(clamp(ias / 160, 0, 1) ** 2 * (inside ? 0.18 : 0.3) * (1 + ac.spoilerSB * 0.6 + ac.gearPos * 0.4), t, 0.3);
      this.wind.f.frequency.setTargetAtTime(400 + ias * 5, t, 0.3);
      const rolling = ac.onGround ? clamp(ac.gs / 60, 0, 1) : 0;
      this.runway.g.gain.setTargetAtTime(rolling * 0.5, t, 0.1);
      const moving = Math.abs((this.prevFlap ?? ac.flap) - ac.flap) > 1e-4 || (ac.gearPos > 0.01 && ac.gearPos < 0.99);
      this.prevFlap = ac.flap;
      this.motor.g.gain.setTargetAtTime(moving ? (inside ? 0.05 : 0.02) : 0, t, 0.2);
    }

    /* ------------------------------------------------------ one-shot sounds */
    tone(freq, dur, type = 'sine', gain = 0.2, when = 0, slide = null) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
    }
    noiseBurst(dur, freq, gain, when = 0, type = 'lowpass') {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + when;
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
      const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.05);
    }
    cavalryCharge() { // AP disconnect
      if (!this.ctx) return;
      const notes = [1047, 1319, 1568, 2093];
      for (let r = 0; r < 3; r++) notes.forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.12, r * 0.55 + i * 0.1));
    }
    masterCaution() { this.tone(1760, 0.35, 'sine', 0.18); this.tone(880, 0.35, 'sine', 0.08); }
    masterWarning() { for (let i = 0; i < 3; i++) { this.tone(1500, 0.15, 'square', 0.1, i * 0.36); this.tone(1000, 0.15, 'square', 0.1, i * 0.36 + 0.18); } }
    cChord() { [523, 659, 784].forEach((f) => this.tone(f, 1.2, 'sine', 0.08)); }
    chime() { this.tone(1318, 0.9, 'sine', 0.14); this.tone(1046, 1.1, 'sine', 0.14, 0.45); }
    clacker() { for (let i = 0; i < 12; i++) this.noiseBurst(0.03, 3000, 0.25, i * 0.1, 'bandpass'); }
    cricket() { for (let i = 0; i < 4; i++) this.tone(4200, 0.06, 'square', 0.06, i * 0.09); }
    touchdown(fpm) {
      const k = clamp(fpm / 600, 0.3, 1.6);
      this.noiseBurst(0.35, 120, 0.6 * k);
      this.noiseBurst(0.25, 2400, 0.12 * k, 0.02, 'bandpass');
    }
    click() { this.noiseBurst(0.02, 4000, 0.08, 0, 'highpass'); }
    thunk() { this.noiseBurst(0.18, 200, 0.25); }

    /* ------------------------------------------------------------- speech */
    say(text, opts = {}) {
      if (!this.voice || !window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = opts.rate || 1.12; u.pitch = opts.pitch ?? 0.8; u.volume = clamp(this.volume * (opts.vol || 1), 0, 1);
      const voices = speechSynthesis.getVoices();
      const pref = voices.find((v) => /en-(US|GB)/.test(v.lang) && /Google|Daniel|Alex|David|Microsoft/.test(v.name)) || voices.find((v) => /^en/.test(v.lang));
      if (pref) u.voice = pref;
      if (opts.interrupt) speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
  }

  window.SimAudio = SimAudio;
})();
