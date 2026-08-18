/* ============================================================
   LAST SEEN — narrative.js
   Top-level narrative state machine. Coordinates state transitions,
   audio layering, body classes for CSS targeting, and replay cleanup.
   Sub-modules (title, flashlight, corridor, storm-eas, ending) listen
   to ls:narrativeState events and react to the new state.
   ============================================================ */

(function () {
  "use strict";

  // Authoritative narrative states. The corridor is a *flag* inside
  // the main state, not a separate state — Z toggles the flag without
  // leaving "main", preserving the 120s timer and audio continuity.
  const STATES = {
    TITLE: "title",
    OPENING: "opening",
    MAIN: "main",
    ENDING: "ending"
  };

  let current = null;
  let started = false;
  let mainTimerStart = 0;       // performance.now() when main scene fade completed
  let mainSceneFadeTimeout = null;

  // Sub-state flags (read-only to listeners; mutated by sub-modules)
  const flags = {
    flashlightOn: false,
    corridorActive: false,
    easActive: false,
    notificationActive: false,
    naditoOpened: false,
    manRevealed: false,
    newerPhoneActive: false,
    danteAlertActive: false,
    cassCodeAccepted: false,
    cassPlayed: false,
    cassReturned: false
  };

  function setState(name) {
    if (current === name) return;
    const prev = current;
    current = name;
    // Update body class for CSS targeting
    document.body.classList.remove(
      "ls-state-title", "ls-state-opening", "ls-state-main", "ls-state-ending"
    );
    document.body.classList.add("ls-state-" + name);
    // Dispatch event for sub-modules
    document.dispatchEvent(new CustomEvent("ls:narrativeState", {
      detail: { from: prev, to: name, flags: { ...flags } }
    }));
    // Audio transitions
    if (name === STATES.TITLE) {
      // Title ambience handled by title.js on its own — but ensure
      // ending/ambience are stopped.
      try { window.LS_AUDIO.stopAmbience(); } catch (_) {}
      try { window.LS_AUDIO.stopEnding(); } catch (_) {}
    } else if (name === STATES.OPENING) {
      // ambiencetitlle.mp3 already started by title.js — keep playing
    } else if (name === STATES.MAIN) {
      // Crossfade title ambience -> main ambience handled by storm-eas.js
      // when the main-scene fade completes. Here we just signal the
      // transition; storm-eas.js schedules the actual crossfade + 120s timer.
    } else if (name === STATES.ENDING) {
      // Ending ambience handled by ending.js
    }
  }

  function getState() { return current; }
  function getFlags() { return { ...flags }; }

  function setFlag(name, value) {
    if (!(name in flags)) return;
    flags[name] = value;
    // Notify flag change
    document.dispatchEvent(new CustomEvent("ls:flagChange", {
      detail: { flag: name, value: value, state: current, flags: { ...flags } }
    }));
  }

  // ---------- State entry handlers ----------

  function enterTitle() {
    setState(STATES.TITLE);
    // Ensure the title screen is visible (the CSS default is opacity:0;
    // the .is-active class is what makes it visible — see css/narrative.css).
    const titleEl = document.getElementById("ls-title-screen");
    if (titleEl) {
      titleEl.classList.add("is-active");
      titleEl.setAttribute("aria-hidden", "false");
    }
    // Hide every other top-level overlay.
    ["ls-opening", "ls-corridor", "ls-eas", "ls-newer-phone",
     "ls-man-silhouette", "ls-notification", "ls-inbox-takeover",
     "ls-credit-card", "ls-lightning-exposure", "ls-fade"
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove("is-active", "is-revealed", "is-fading", "is-flashing", "is-holding");
        el.setAttribute("aria-hidden", "true");
      }
    });
    // Reset all flags here.
    flags.flashlightOn = false;
    flags.corridorActive = false;
    flags.easActive = false;
    flags.notificationActive = false;
    flags.naditoOpened = false;
    flags.manRevealed = false;
    flags.newerPhoneActive = false;
    flags.danteAlertActive = false;
    flags.cassCodeAccepted = false;
    flags.cassPlayed = false;
    flags.cassReturned = false;
  }

  function enterOpening() {
    setState(STATES.OPENING);
  }

  function enterMain() {
    setState(STATES.MAIN);
    mainTimerStart = performance.now();
  }

  function enterEnding() {
    setState(STATES.ENDING);
  }

  // ---------- Replay (full reset back to title) ----------

  function replay() {
    // Clear all sub-module state
    try { window.LS_AUDIO.stopAll(); } catch (_) {}
    // Hide every overlay
    document.querySelectorAll("#ls-overlays > *").forEach(el => {
      el.classList.remove("is-active", "is-fading", "is-revealed", "is-flashing", "is-hidden");
      el.setAttribute("aria-hidden", "true");
    });
    // Reset body classes
    document.body.classList.remove(
      "ls-state-title", "ls-state-opening", "ls-state-main", "ls-state-ending",
      "ls-flashlight-on", "ls-flashlight-off", "ls-corridor-active"
    );
    // Reset flags
    Object.keys(flags).forEach(k => {
      flags[k] = false;
    });
    // Reset the vintage phone back to off
    try {
      if (window.LASTSEEN && typeof window.LASTSEEN.powerOff === "function") {
        window.LASTSEEN.powerOff();
      }
    } catch (_) {}
    // Re-enter title
    setTimeout(() => {
      enterTitle();
      // (enterTitle already adds .is-active to the title screen)
      // Restart title ambience after a short delay (audio unlocked already)
      setTimeout(() => {
        try { window.LS_AUDIO.playTitle(); } catch (_) {}
      }, 200);
    }, 1200);
  }

  // ---------- Public API ----------

  window.LS_NARRATIVE = {
    STATES,
    getState,
    getFlags,
    setFlag,
    setState,
    enterTitle,
    enterOpening,
    enterMain,
    enterEnding,
    replay,
    get mainTimerStart() { return mainTimerStart; },
    set mainTimerStart(v) { mainTimerStart = v; }
  };

  // ---------- Bootstrap ----------

  // Wait for DOMContentLoaded, then enter title state
  function start() {
    if (started) return;
    started = true;
    enterTitle();
    // Initial title ambience is started by title.js once the user clicks Play
    // (we need a user gesture to unlock audio).
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  // ---------- Cross-module event bridging ----------

  // When the user accepts the cassette code, set the flag
  document.addEventListener("ls:cassetteCodeAccepted", () => {
    setFlag("cassCodeAccepted", true);
  });

  // When the user plays the cassette, set the flag
  document.addEventListener("ls:cassettePlayed", () => {
    setFlag("cassPlayed", true);
  });

  // When the cassette is returned to the desk AFTER code accepted
  document.addEventListener("ls:cassetteReturned", () => {
    setFlag("cassReturned", true);
    // Trigger ending only if all three conditions are met:
    // code accepted + cassette played + cassette returned
    if (flags.cassCodeAccepted && flags.cassPlayed && flags.cassReturned) {
      // Dispatch event for ending.js to surface the notification
      document.dispatchEvent(new CustomEvent("ls:triggerNotification"));
    }
  });

  // When the Nadito na ako message is opened, set the flag
  document.addEventListener("ls:naditoMessageOpened", () => {
    if (flags.naditoOpened) return;
    setFlag("naditoOpened", true);
    // Dispatch event for ending.js to start the 10s timer
    document.dispatchEvent(new CustomEvent("ls:triggerEndingSequence"));
  });

  // When the user presses the title Play button, hand off to title.js
  // (title.js will call window.LS_NARRATIVE.enterOpening() at the right moment)

  // Page hide — full cleanup
  window.addEventListener("pagehide", () => {
    try { window.LS_AUDIO.stopAll(); } catch (_) {}
  }, { once: true });
})();
