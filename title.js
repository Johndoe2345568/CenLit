/* ============================================================
   LAST SEEN — title.js
   Pitch-black title screen + opening cinematic.
   - Title: only "LAST SEEN" and a Play button visible.
   - Opening: ambiencetitlle.mp3, warm candle-like glow (no visible
     candle), stark beats "Nuyda productions presents:" then "LAST SEEN",
     then exactly three Filipino pages in order. Click/Enter/Space to
     advance (no visible "continue" text). After last page, fade into
     the main scene with NO hard cut, then dispatch ls:openingComplete
     so storm-eas.js can start the 120-second timer.
   ============================================================ */

(function () {
  "use strict";

  const titleScreen = document.getElementById("ls-title-screen");
  const titleText = document.getElementById("ls-title-text");
  const playBtn = document.getElementById("ls-title-play");
  const opening = document.getElementById("ls-opening");
  const openingText = document.getElementById("ls-opening-text");
  const candleGlow = document.getElementById("ls-candle-glow");
  const fadeEl = document.getElementById("ls-fade");

  if (!titleScreen || !playBtn || !opening || !openingText) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The EXACT opening strings from the spec. Do not reorder, translate,
  // or "fix" them.
  const PRESENTER = "Nuyda productions presents:";
  const TITLE_CARD = "LAST SEEN";
  const PAGES = [
    "Pagkatapos mo Kunin ang iyong certificates sa bahay ng iyong ina may nakita Ikaw na voice tape kasama sa drawer",
    "Inuwi mo ito at nakita mo na para kay Tito Ato mo ang voice tape na ito at pagkatapos nakita mo na may PIN para ito'y maparingan",
    "Kaya naisipan mo pumunta sa abandona na bahay ng iyong Tito , dito mo nahanap ang isang cellphone"
  ];

  let inOpening = false;
  let openingAdvanceToken = 0; // increments when state changes
  let titleAmbienceStarted = false;

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Race a timeout against a user-gesture advance (click/Enter/Space).
  // Whichever fires first wins; the loser is a no-op.
  function holdUntilGestureOrTimeout(minMs, maxMs) {
    const myToken = ++openingAdvanceToken;
    let resolved = false;
    return new Promise(resolve => {
      let elapsed = 0;
      const tick = 100;
      const interval = setInterval(() => {
        if (myToken !== openingAdvanceToken) {
          // state changed; abort
          clearInterval(interval);
          if (!resolved) { resolved = true; resolve("aborted"); }
          return;
        }
        elapsed += tick;
        if (elapsed >= maxMs) {
          clearInterval(interval);
          if (!resolved) { resolved = true; resolve("timeout"); }
        }
      }, tick);

      const onGesture = () => {
        if (resolved) return;
        if (myToken !== openingAdvanceToken) return;
        // Enforce minimum hold — if user mashes too fast, ignore until min
        if (elapsed < minMs) return;
        clearInterval(interval);
        document.removeEventListener("pointerdown", onGesture);
        document.removeEventListener("keydown", onKey, true);
        resolved = true;
        resolve("gesture");
      };
      const onKey = (e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          onGesture();
        }
      };
      document.addEventListener("pointerdown", onGesture, { passive: true });
      document.addEventListener("keydown", onKey, true);
    });
  }

  async function showBeat(text, opts = {}) {
    openingText.className = "";
    openingText.textContent = text;
    if (opts.presenter) openingText.classList.add("is-presenter");
    if (opts.titleCard) openingText.classList.add("is-title-card");
    // Force reflow for transition to take effect
    void openingText.offsetWidth;
    openingText.classList.add("is-visible");
    // Hold
    await holdUntilGestureOrTimeout(opts.min || 2400, opts.max || 5000);
    // Fade out
    openingText.classList.add("is-fading");
    openingText.classList.remove("is-visible");
    await wait(reducedMotion ? 250 : 1300);
    openingText.classList.remove("is-fading");
  }

  async function runOpening() {
    if (inOpening) return;
    inOpening = true;

    // Start ambiencetitlle.mp3 (or synth fallback)
    try { window.LS_AUDIO.playTitle(); } catch (_) {}
    titleAmbienceStarted = true;

    // Show opening overlay + candle glow
    opening.classList.add("is-active");
    opening.setAttribute("aria-hidden", "false");
    candleGlow.style.opacity = "";
    // Tiny initial delay so the ambience lands
    await wait(reducedMotion ? 200 : 900);

    // Beat 1: presenter
    await showBeat(PRESENTER, {
      presenter: true,
      min: reducedMotion ? 1200 : 2400,
      max: reducedMotion ? 2500 : 4600
    });

    // Beat 2: title card
    await showBeat(TITLE_CARD, {
      titleCard: true,
      min: reducedMotion ? 1500 : 3200,
      max: reducedMotion ? 3000 : 6000
    });

    // Pages 1..3 (exact order, exact strings)
    for (let i = 0; i < PAGES.length; i++) {
      await showBeat(PAGES[i], {
        min: reducedMotion ? 1800 : 3800,
        max: reducedMotion ? 3600 : 8000
      });
    }

    // Fade to black, then transition into main scene with no hard cut.
    // The candle glow lingers briefly then dims.
    fadeEl.classList.add("is-fading");
    await wait(reducedMotion ? 400 : 1400);
    fadeEl.classList.add("is-holding");
    // Hide opening overlay
    opening.classList.remove("is-active");
    opening.setAttribute("aria-hidden", "true");
    candleGlow.style.opacity = "0";

    // Keep the screen fully black while the audio layers crossfade. The
    // narrative MAIN state and its 120-second timer are not entered until
    // the black hold is finished, so the timer cannot start early.
    try { window.LS_AUDIO.stopTitle(800); } catch (_) {}
    try { window.LS_AUDIO.playAmbience(); } catch (_) {}
    await wait(reducedMotion ? 300 : 700);

    // Fade up from black into the main scene, then hand off ownership.
    fadeEl.classList.remove("is-holding");
    fadeEl.classList.remove("is-fading");
    try { window.LS_NARRATIVE.enterMain(); } catch (_) {}
    // Dispatch event for storm-eas.js to start the 120s timer + storm schedulers
    document.dispatchEvent(new CustomEvent("ls:openingComplete"));
    inOpening = false;
  }

  function onPlayClick() {
    if (inOpening) return;
    // Hide title screen
    titleScreen.classList.remove("is-active");
    titleScreen.setAttribute("aria-hidden", "true");
    // Brief black beat between title and opening
    setTimeout(() => {
      try { window.LS_NARRATIVE.enterOpening(); } catch (_) {}
      runOpening();
    }, reducedMotion ? 200 : 800);
  }

  // ---------- Wire up ----------

  playBtn.addEventListener("click", onPlayClick);
  playBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      onPlayClick();
    }
  });

  // On narrative state changes back to TITLE (replay), re-show the title.
  document.addEventListener("ls:narrativeState", (e) => {
    const to = e.detail.to;
    if (to === "title") {
      titleScreen.classList.add("is-active");
      titleScreen.setAttribute("aria-hidden", "false");
      inOpening = false;
      // Restart title ambience after a short delay (audio unlocked already)
      setTimeout(() => {
        try { window.LS_AUDIO.playTitle(); } catch (_) {}
      }, 400);
    }
  });

  // Expose nothing — title.js is self-contained.
})();
