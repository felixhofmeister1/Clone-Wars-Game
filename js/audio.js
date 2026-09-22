/* =============================================================================
 * audio.js — Procedural sound effects (Web Audio API) + droid voice lines
 * (Web Speech API). No audio files are needed: every blaster "pew", reload
 * clack and explosion is synthesised on the fly.
 *
 * Mobile browsers only allow audio after a user gesture, so GameAudio.init()
 * must be called from a tap/click handler (the "Deploy" button does this).
 * ========================================================================== */

const GameAudio = (() => {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let lastSpeech = 0;
  let speechUnlocked = false;
  let voiceEnabled = true;
  let droidVoice = null;

  /** Creates (or resumes) the AudioContext. Call from a user gesture. */
  function init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!ctx && AC) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);

      // One second of white noise, reused by every noisy effect.
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();

    // iOS only lets speech play after one utterance was queued from a gesture.
    if ('speechSynthesis' in window && !speechUnlocked) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
      speechUnlocked = true;
      pickVoice();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = pickVoice;
      }
    }
  }

  /** Prefers an English voice for the droids' flat, nasal delivery. */
  function pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    droidVoice = voices.find((v) => /en[-_]US/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang)) || null;
  }

  const ready = () => ctx && ctx.state === 'running';

  /** Optional stereo panning node (older Safari has no StereoPannerNode). */
  function output(pan) {
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(master);
      return p;
    }
    return master;
  }

  /** Oscillator sweep from f0 to f1 with a fast attack / exponential decay. */
  function tone({ type = 'sine', f0, f1 = f0, dur, vol, delay = 0, pan = 0 }) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(output(pan));
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Filtered white-noise burst. */
  function noise({ dur, vol, type = 'bandpass', freq = 1000, q = 1, delay = 0, pan = 0 }) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(output(pan));
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /** Volume falloff for sounds positioned in the world. */
  const falloff = (dist) => Math.max(0.06, Math.min(1, 1 - dist / 70));

  return {
    init,

    setVoiceEnabled(on) { voiceEnabled = on; },

    /** DC-15A shot: bright descending "pew" with a crackle of noise. */
    blaster() {
      if (!ready()) return;
      tone({ type: 'sawtooth', f0: 1500, f1: 110, dur: 0.22, vol: 0.16 });
      tone({ type: 'sine', f0: 2800, f1: 320, dur: 0.16, vol: 0.14 });
      noise({ dur: 0.07, vol: 0.18, freq: 3200, q: 0.8 });
    },

    /** E-5 droid blaster: lower, buzzier, attenuated by distance. */
    droidBlaster(dist = 20, pan = 0) {
      if (!ready()) return;
      const v = falloff(dist);
      tone({ type: 'square', f0: 950, f1: 90, dur: 0.26, vol: 0.07 * v, pan });
      tone({ type: 'sawtooth', f0: 600, f1: 70, dur: 0.2, vol: 0.06 * v, pan });
    },

    /** Power-cell swap: eject click, whine, slam, ready chirp. */
    reload() {
      if (!ready()) return;
      noise({ dur: 0.05, vol: 0.25, type: 'highpass', freq: 2500 });
      tone({ type: 'square', f0: 220, f1: 160, dur: 0.06, vol: 0.06, delay: 0.02 });
      tone({ type: 'sawtooth', f0: 250, f1: 1100, dur: 0.5, vol: 0.05, delay: 0.45 });
      noise({ dur: 0.08, vol: 0.3, type: 'lowpass', freq: 1200, delay: 1.05 });
      tone({ type: 'sine', f0: 1300, f1: 1900, dur: 0.12, vol: 0.08, delay: 1.3 });
    },

    /** Dry-fire click when the cell is empty. */
    empty() {
      if (!ready()) return;
      noise({ dur: 0.03, vol: 0.2, type: 'highpass', freq: 4000 });
    },

    /** Bolt striking droid armour. */
    hitMetal(dist = 10) {
      if (!ready()) return;
      const v = falloff(dist);
      tone({ type: 'triangle', f0: 1900, f1: 900, dur: 0.1, vol: 0.12 * v });
      noise({ dur: 0.06, vol: 0.15 * v, freq: 5000, q: 2 });
    },

    /** Bolt striking stone. */
    hitStone(dist = 10) {
      if (!ready()) return;
      noise({ dur: 0.09, vol: 0.12 * falloff(dist), type: 'lowpass', freq: 1800 });
    },

    /** Droid destroyed: short boom plus a falling "power-down" whine. */
    droidDestroyed(dist = 10, pan = 0) {
      if (!ready()) return;
      const v = falloff(dist);
      noise({ dur: 0.45, vol: 0.35 * v, type: 'lowpass', freq: 700, pan });
      tone({ type: 'sawtooth', f0: 700, f1: 60, dur: 0.6, vol: 0.07 * v, pan });
      tone({ type: 'square', f0: 2200, f1: 400, dur: 0.18, vol: 0.04 * v, delay: 0.05, pan });
    },

    /** Player takes a hit. */
    playerHurt() {
      if (!ready()) return;
      tone({ type: 'sawtooth', f0: 190, f1: 55, dur: 0.22, vol: 0.14 });
      noise({ dur: 0.18, vol: 0.2, type: 'lowpass', freq: 900 });
    },

    /** Short Republic fanfare for each new wave. */
    waveHorn() {
      if (!ready()) return;
      tone({ type: 'sawtooth', f0: 196, f1: 196, dur: 0.35, vol: 0.06 });
      tone({ type: 'sawtooth', f0: 262, f1: 262, dur: 0.35, vol: 0.06, delay: 0.3 });
      tone({ type: 'sawtooth', f0: 392, f1: 392, dur: 0.7, vol: 0.07, delay: 0.6 });
    },

    /** Droid voice chirp played under every speech bubble (works everywhere). */
    droidChirp(dist = 10, pan = 0) {
      if (!ready()) return;
      const v = falloff(dist);
      tone({ type: 'square', f0: 520, f1: 470, dur: 0.12, vol: 0.05 * v, pan });
      tone({ type: 'square', f0: 470, f1: 420, dur: 0.14, vol: 0.05 * v, delay: 0.15, pan });
    },

    /**
     * Speaks a droid line ("Roger, roger!") in a high, fast, nasal voice.
     * Throttled so the droids never talk over each other.
     * @returns {boolean} whether the line was actually spoken.
     */
    speak(text, dist = 10) {
      if (!voiceEnabled || !('speechSynthesis' in window)) return false;
      const now = performance.now();
      if (now - lastSpeech < 1400 || window.speechSynthesis.speaking) return false;
      lastSpeech = now;
      const u = new SpeechSynthesisUtterance(text);
      if (droidVoice) u.voice = droidVoice;
      u.pitch = 1.8;
      u.rate = 1.35;
      u.volume = Math.max(0.3, falloff(dist));
      window.speechSynthesis.speak(u);
      return true;
    },

    /** Stops any queued speech (used on pause / game over). */
    silence() {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    },
  };
})();

window.GameAudio = GameAudio;
