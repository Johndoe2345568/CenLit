/* ============================================================
   LAST SEEN — audio-manager.js
   Loads the seven user-provided MP3 files with Web Audio synth
   fallback when a file is absent or undecodable. Exposes a single
   `window.LS_AUDIO` API. Never plays without a user gesture.
   Never stacks duplicate ambience / thunder / EAS layers.
   ============================================================ */

(function () {
  "use strict";

  const AUDIO_DIR = "assets/audio/";
  const FILES = {
    title: "ambiencetitlle.mp3",        // exact spelling preserved
    ambience: "ambience.mp3",
    thunder1: "thunder1.mp3",
    thunder2: "thunder2.mp3",
    thunder3: "thunder3.mp3",
    eas: "eas.mp3",
    ending: "ambienceending.mp3"
  };

  // Tracks: { audio: HTMLAudioElement, ok: bool, tried: bool }
  const tracks = {};
  let audioCtx = null;
  let unlocked = false;
  let masterGain = null; // shared master gain for synthesized layers

  // Active synth nodes (so we can stop them cleanly)
  const synth = {
    titleNodes: null,
    ambienceNodes: null,
    endingNodes: null,
    easNodes: null,
    thunderGain: null
  };

  function ensureContext() {
    if (audioCtx) return audioCtx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(audioCtx.destination);
      return audioCtx;
    } catch (_) { return null; }
  }

  function unlock() {
    if (unlocked) return;
    ensureContext();
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    unlocked = true;
  }

  // Attempt to load a single MP3 file. Returns a Promise that resolves
  // to { audio: HTMLAudioElement|null, ok: bool }.
  function loadFile(key, filename) {
    return new Promise(resolve => {
      const url = AUDIO_DIR + filename;
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = url;
      audio.loop = true; // ambience tracks loop by default; EAS may be one-shot
      audio.load();
      const result = { audio, ok: false, tried: true };

      const onCanPlay = () => {
        result.ok = true;
        cleanup();
        // Try a tiny probe play to verify decode (some browsers lie about canplaythrough)
        // We don't actually start playback here — just resolve.
        resolve(result);
      };
      const onError = () => {
        result.ok = false;
        cleanup();
        resolve(result);
      };
      const cleanup = () => {
        audio.removeEventListener("canplaythrough", onCanPlay);
        audio.removeEventListener("canplay", onCanPlay);
        audio.removeEventListener("error", onError);
        window.clearTimeout(timeout);
      };
      // 1.2s timeout — if file isn't ready by then, treat as missing
      // (faster than waiting for full error on a 404 in some browsers)
      const timeout = window.setTimeout(() => {
        if (!result.ok) onError();
      }, 1200);

      audio.addEventListener("canplaythrough", onCanPlay);
      audio.addEventListener("canplay", onCanPlay);
      audio.addEventListener("error", onError);
    });
  }

  async function preloadAll() {
    const entries = Object.entries(FILES);
    await Promise.all(entries.map(async ([key, filename]) => {
      const r = await loadFile(key, filename);
      tracks[key] = r;
    }));
    return tracks;
  }

  // ---------- Helpers for HTMLAudioElement playback ----------

  function stopHtmlAudio(audio) {
    if (!audio) return;
    try { audio.pause(); } catch (_) {}
    try { audio.currentTime = 0; } catch (_) {}
  }

  function fadeHtmlAudio(audio, target, ms) {
    if (!audio) return;
    const start = audio.volume;
    const t0 = performance.now();
    function step(now) {
      const k = Math.min(1, (now - t0) / ms);
      audio.volume = start + (target - start) * k;
      if (k < 1) requestAnimationFrame(step);
      else if (target === 0) { try { audio.pause(); } catch (_) {} }
    }
    requestAnimationFrame(step);
  }

  // ---------- Synth fallbacks ----------
  // (condensed equivalents of the existing IIFE's Web Audio code,
  //  kept private to this module so we don't conflict with the
  //  original inline audio IIFE when it is disabled.)

  function createNoiseBuffer(ctx, seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.015;
      data[i] = last * 2.2;
    }
    return buffer;
  }

  // Title ambience: warm low drone + soft breathy noise + slow flicker LFO
  function startTitleSynth() {
    const ctx = ensureContext(); if (!ctx) return;
    stopTitleSynth();
    const master = ctx.createGain(); master.gain.value = 0.32; master.connect(masterGain);
    const hum = ctx.createOscillator(); hum.type = "sine"; hum.frequency.value = 78;
    const humGain = ctx.createGain(); humGain.gain.value = 0.05; hum.connect(humGain).connect(master);
    // warm breathy noise
    const noise = ctx.createBufferSource(); noise.buffer = createNoiseBuffer(ctx, 4); noise.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 320;
    const noiseGain = ctx.createGain(); noiseGain.gain.value = 0.018;
    noise.connect(lp).connect(noiseGain).connect(master);
    // flicker LFO on humGain
    const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.7;
    const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.025;
    lfo.connect(lfoDepth).connect(humGain.gain);
    hum.start(); noise.start(); lfo.start();
    synth.titleNodes = { master, hum, noise, lfo, humGain, noiseGain };
  }
  function stopTitleSynth() {
    if (!synth.titleNodes) return;
    const n = synth.titleNodes;
    try { n.hum.stop(); } catch (_) {}
    try { n.noise.stop(); } catch (_) {}
    try { n.lfo.stop(); } catch (_) {}
    try { n.master.disconnect(); } catch (_) {}
    synth.titleNodes = null;
  }

  // Main ambience: hum + filtered rain noise + distant cricket
  function startAmbienceSynth() {
    const ctx = ensureContext(); if (!ctx) return;
    stopAmbienceSynth();
    const master = ctx.createGain(); master.gain.value = 0.4; master.connect(masterGain);
    const hum = ctx.createOscillator(); hum.type = "sine"; hum.frequency.value = 59.8;
    const humGain = ctx.createGain(); humGain.gain.value = 0.012; hum.connect(humGain).connect(master);
    const noise = ctx.createBufferSource(); noise.buffer = createNoiseBuffer(ctx, 3); noise.loop = true;
    const airFilter = ctx.createBiquadFilter(); airFilter.type = "lowpass"; airFilter.frequency.value = 1150;
    const airGain = ctx.createGain(); airGain.gain.value = 0.007;
    noise.connect(airFilter).connect(airGain).connect(master);
    const rainFilter = ctx.createBiquadFilter(); rainFilter.type = "highpass"; rainFilter.frequency.value = 1350;
    const rainGain = ctx.createGain(); rainGain.gain.value = 0.038;
    noise.connect(rainFilter).connect(rainGain).connect(master);
    const cricket = ctx.createOscillator(); cricket.type = "sine"; cricket.frequency.value = 3550;
    const cricketGain = ctx.createGain(); cricketGain.gain.value = 0.0001;
    cricket.connect(cricketGain).connect(master);
    hum.start(); noise.start(); cricket.start();
    synth.ambienceNodes = { master, hum, noise, cricket, humGain, airGain, rainGain, cricketGain };
  }
  function stopAmbienceSynth() {
    if (!synth.ambienceNodes) return;
    const n = synth.ambienceNodes;
    try { n.hum.stop(); } catch (_) {}
    try { n.noise.stop(); } catch (_) {}
    try { n.cricket.stop(); } catch (_) {}
    try { n.master.disconnect(); } catch (_) {}
    synth.ambienceNodes = null;
  }

  // Ending ambience: lower, more hollow, with slow swell
  function startEndingSynth() {
    const ctx = ensureContext(); if (!ctx) return;
    stopEndingSynth();
    const master = ctx.createGain(); master.gain.value = 0.34; master.connect(masterGain);
    const hum = ctx.createOscillator(); hum.type = "sine"; hum.frequency.value = 47;
    const humGain = ctx.createGain(); humGain.gain.value = 0.06; hum.connect(humGain).connect(master);
    const noise = ctx.createBufferSource(); noise.buffer = createNoiseBuffer(ctx, 5); noise.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 220;
    const noiseGain = ctx.createGain(); noiseGain.gain.value = 0.025;
    noise.connect(lp).connect(noiseGain).connect(master);
    // slow swell on master
    const swell = ctx.createOscillator(); swell.type = "sine"; swell.frequency.value = 0.13;
    const swellDepth = ctx.createGain(); swellDepth.gain.value = 0.06;
    swell.connect(swellDepth).connect(master.gain);
    hum.start(); noise.start(); swell.start();
    synth.endingNodes = { master, hum, noise, swell, humGain, noiseGain };
  }
  function stopEndingSynth() {
    if (!synth.endingNodes) return;
    const n = synth.endingNodes;
    try { n.hum.stop(); } catch (_) {}
    try { n.noise.stop(); } catch (_) {}
    try { n.swell.stop(); } catch (_) {}
    try { n.master.disconnect(); } catch (_) {}
    synth.endingNodes = null;
  }

  // EAS alarm: alternating 990 Hz / 850 Hz tones (simplified attention signal)
  function startEASSynth() {
    const ctx = ensureContext(); if (!ctx) return;
    stopEASSynth();
    const master = ctx.createGain(); master.gain.value = 0.0; master.connect(masterGain);
    const osc = ctx.createOscillator(); osc.type = "square"; osc.frequency.value = 990;
    const osc2 = ctx.createOscillator(); osc2.type = "square"; osc2.frequency.value = 850;
    osc.connect(master); osc2.connect(master);
    osc.start(); osc2.start();
    // alternate 990 / 850 every 0.5s for that classic EAS feel
    let toggle = false;
    const interval = setInterval(() => {
      if (!synth.easNodes) { clearInterval(interval); return; }
      toggle = !toggle;
      const t = ctx.currentTime;
      osc.frequency.setValueAtTime(toggle ? 990 : 850, t);
      osc2.frequency.setValueAtTime(toggle ? 850 : 990, t);
    }, 500);
    // fade in
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.2);
    synth.easNodes = { master, osc, osc2, interval };
  }
  function stopEASSynth() {
    if (!synth.easNodes) return;
    const n = synth.easNodes;
    try { clearInterval(n.interval); } catch (_) {}
    try { n.osc.stop(); } catch (_) {}
    try { n.osc2.stop(); } catch (_) {}
    try { n.master.disconnect(); } catch (_) {}
    synth.easNodes = null;
  }

  // Synthesized thunder: ~2.8s low rumble with random modulation
  function playThunderSynth() {
    const ctx = ensureContext(); if (!ctx) return;
    const duration = 2.8;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      const rumble = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
      data[i] = rumble * (0.7 + 0.3 * Math.sin(i / 210));
    }
    const source = ctx.createBufferSource(); source.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 210;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.13, ctx.currentTime + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(filter).connect(gain).connect(masterGain);
    source.start();
  }

  // ---------- Public API ----------

  const api = {
    preload: preloadAll,
    unlock,
    isUnlocked: () => unlocked,

    // Title ambience (ambiencetitlle.mp3)
    playTitle() {
      unlock();
      const t = tracks.title;
      if (t && t.ok && t.audio) {
        stopAmbienceSynth(); stopEndingSynth();
        try { t.audio.currentTime = 0; } catch (_) {}
        t.audio.volume = 0;
        t.audio.loop = true;
        t.audio.play().then(() => fadeHtmlAudio(t.audio, 0.45, 1800)).catch(() => startTitleSynth());
      } else {
        startTitleSynth();
      }
    },
    stopTitle(fadeMs = 1200) {
      const t = tracks.title;
      if (t && t.ok && t.audio && !t.audio.paused) {
        fadeHtmlAudio(t.audio, 0, fadeMs);
      }
      stopTitleSynth();
    },

    // Main room ambience (ambience.mp3)
    playAmbience() {
      unlock();
      const t = tracks.ambience;
      if (t && t.ok && t.audio) {
        stopTitleSynth(); stopEndingSynth();
        try { t.audio.currentTime = 0; } catch (_) {}
        t.audio.volume = 0;
        t.audio.loop = true;
        t.audio.play().then(() => fadeHtmlAudio(t.audio, 0.45, 2500)).catch(() => startAmbienceSynth());
      } else {
        startAmbienceSynth();
      }
    },
    stopAmbience(fadeMs = 1200) {
      const t = tracks.ambience;
      if (t && t.ok && t.audio && !t.audio.paused) {
        fadeHtmlAudio(t.audio, 0, fadeMs);
      }
      stopAmbienceSynth();
    },

    // Thunder (thunder1/2/3.mp3 — random variant)
    playThunder(variant) {
      unlock();
      const key = variant || (["thunder1","thunder2","thunder3"][Math.floor(Math.random()*3)]);
      const t = tracks[key];
      if (t && t.ok && t.audio) {
        try { t.audio.currentTime = 0; } catch (_) {}
        t.audio.loop = false;
        // Leave headroom, but make the supplied thunder clearly present over
        // the room bed. The EAS remains louder than thunder by design.
        t.audio.volume = 0.9;
        t.audio.play().catch(() => playThunderSynth());
      } else {
        playThunderSynth();
      }
    },

    // EAS alarm (eas.mp3)
    playEAS() {
      unlock();
      const t = tracks.eas;
      if (t && t.ok && t.audio) {
        try { t.audio.currentTime = 0; } catch (_) {}
        t.audio.loop = true; // loop the klaxon until stopped
        t.audio.volume = 0.7;
        t.audio.play().catch(() => startEASSynth());
      } else {
        startEASSynth();
      }
    },
    stopEAS(fadeMs = 800) {
      const t = tracks.eas;
      if (t && t.ok && t.audio && !t.audio.paused) {
        fadeHtmlAudio(t.audio, 0, fadeMs);
      }
      stopEASSynth();
    },

    // Ending ambience (ambienceending.mp3)
    playEnding() {
      unlock();
      const t = tracks.ending;
      if (t && t.ok && t.audio) {
        stopAmbienceSynth(); stopTitleSynth();
        try { t.audio.currentTime = 0; } catch (_) {}
        t.audio.volume = 0;
        t.audio.loop = true;
        t.audio.play().then(() => fadeHtmlAudio(t.audio, 0.4, 3500)).catch(() => startEndingSynth());
      } else {
        startEndingSynth();
      }
    },
    stopEnding(fadeMs = 1500) {
      const t = tracks.ending;
      if (t && t.ok && t.audio && !t.audio.paused) {
        fadeHtmlAudio(t.audio, 0, fadeMs);
      }
      stopEndingSynth();
    },

    // Hard-stop everything (pagehide / replay)
    stopAll() {
      Object.values(tracks).forEach(t => { if (t && t.audio) stopHtmlAudio(t.audio); });
      stopTitleSynth(); stopAmbienceSynth(); stopEndingSynth(); stopEASSynth();
    },

    // Diagnostic — used by QA
    listTracks() {
      const result = {};
      for (const k of Object.keys(FILES)) {
        const t = tracks[k];
        result[k] = { filename: FILES[k], ok: t ? t.ok : false, tried: t ? t.tried : false };
      }
      return result;
    }
  };

  // Disable the original inline IIFE's native ambience/scheduler chain so it
  // doesn't fight us. We only disable the AMBIENCE schedulers; keypad/power
  // tones (which are short one-shots) still come from the inline IIFE.
  window.LS_NATIVE_AMBIENCE_DISABLED = true;

  // Try to stop any native ambience the inline IIFE may have already started.
  try {
    if (window.LASTSEEN && typeof window.LASTSEEN.stopAmbience === "function") {
      window.LASTSEEN.stopAmbience();
    }
  } catch (_) {}

  window.LS_AUDIO = api;

  // Begin preloading immediately. We don't need to wait for unlock — the
  // <audio> elements will fetch their sources in the background.
  preloadAll().then(() => {
    if (window.console && console.debug) {
      const status = api.listTracks();
      console.debug("[LS_AUDIO] preload complete", status);
    }
  });

  // Unlock on first user gesture
  const unlockOnce = () => {
    unlock();
    document.removeEventListener("pointerdown", unlockOnce);
    document.removeEventListener("keydown", unlockOnce);
  };
  document.addEventListener("pointerdown", unlockOnce);
  document.addEventListener("keydown", unlockOnce);

  // Stop everything on pagehide
  window.addEventListener("pagehide", () => api.stopAll(), { once: true });
})();
