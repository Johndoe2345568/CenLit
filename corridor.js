/* ============================================================
   LAST SEEN — corridor.js
   Z-key smooth turn from main view into left corridor and back.
   FNAF6-inspired continuous pivot feeling (no asset/code/ui
   copying). Toggle behavior: Z once → corridor; Z again → main.
   Ignores key-repeat while held. No overlapping transitions.
   Rare, cooldown-controlled psychological events:
   image-based eyes, distant shadow figure. No jumpscares.
   Eyes retreat/close/fade when directly illuminated by the
   flashlight.
   ============================================================ */

(function () {
  "use strict";

  const corridor = document.getElementById("ls-corridor");
  if (!corridor) return;
  const eyesEl = corridor.querySelector(".ls-corridor-eyes");
  const figureEl = corridor.querySelector(".ls-corridor-figure");
  const stormFlashEl = corridor.querySelector(".ls-corridor-storm-flash");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let active = false;
  let transitioning = false;
  let zHeld = false; // ignore key-repeat while held
  let eventScheduler = null;
  let eyeVisibilityTimeout = null;
  let figureVisibilityTimeout = null;

  // ---------- Toggle ----------
  function turnTo(target) {
    if (transitioning) return;
    if (target === active) return;
    // Only allow corridor turn during main scene
    const state = (window.LS_NARRATIVE && window.LS_NARRATIVE.getState) ? window.LS_NARRATIVE.getState() : null;
    if (state !== "main") return;
    // Don't allow during modal interactions
    if (document.querySelector('[role="dialog"].is-open, [role="dialog"][aria-hidden="false"]')) return;

    transitioning = true;
    active = target;
    if (active) {
      corridor.classList.add("is-active");
      corridor.setAttribute("aria-hidden", "false");
      document.body.classList.add("ls-corridor-active");
      try { window.LS_NARRATIVE.setFlag("corridorActive", true); } catch (_) {}
      startEventScheduler();
    } else {
      corridor.classList.remove("is-active");
      corridor.setAttribute("aria-hidden", "true");
      document.body.classList.remove("ls-corridor-active");
      try { window.LS_NARRATIVE.setFlag("corridorActive", false); } catch (_) {}
      stopEventScheduler();
      // Force hide any active events
      if (eyesEl) eyesEl.classList.remove("is-visible");
      if (figureEl) figureEl.classList.remove("is-visible");
    }
    // Wait for the CSS transition to settle
    setTimeout(() => { transitioning = false; }, reducedMotion ? 200 : 800);
  }

  // ---------- Z key binding ----------
  document.addEventListener("keydown", (e) => {
    // Ignore inside text inputs
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;
    if (e.key === "z" || e.key === "Z") {
      if (zHeld) return; // ignore key-repeat
      if (e.repeat) { zHeld = true; return; }
      zHeld = true;
      // Only operate in main scene
      const state = (window.LS_NARRATIVE && window.LS_NARRATIVE.getState) ? window.LS_NARRATIVE.getState() : null;
      if (state !== "main") return;
      if (document.querySelector('[role="dialog"].is-open, [role="dialog"][aria-hidden="false"]')) return;
      e.preventDefault();
      turnTo(!window.LS_CORRIDOR.isActive());
    }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "z" || e.key === "Z") {
      zHeld = false;
    }
  });

  // Touch fallback for corridor: three-finger tap toggles corridor
  // (icon-only, no visible tutorial text)
  let threeFingerCount = 0;
  let threeFingerTimer = null;
  document.addEventListener("pointerdown", (e) => {
    const state = (window.LS_NARRATIVE && window.LS_NARRATIVE.getState) ? window.LS_NARRATIVE.getState() : null;
    if (state !== "main") return;
    if (e.target.closest("button, [data-key], input, [role=dialog]")) return;
    threeFingerCount++;
    if (threeFingerCount === 1) {
      threeFingerTimer = setTimeout(() => { threeFingerCount = 0; }, 500);
    } else if (threeFingerCount === 3) {
      clearTimeout(threeFingerTimer);
      threeFingerCount = 0;
      turnTo(!window.LS_CORRIDOR.isActive());
    }
  }, { passive: true });
  document.addEventListener("pointerup", () => {
    setTimeout(() => { threeFingerCount = 0; }, 100);
  }, { passive: true });

  // ---------- Rare psychological event scheduler ----------
  // Eyes appear briefly and retreat. Figure crosses distantly. Both with
  // cooldowns. NO jumpscares, NO screams.

  function startEventScheduler() {
    if (eventScheduler) return;
    scheduleNextEvent();
  }
  function stopEventScheduler() {
    if (eventScheduler) clearTimeout(eventScheduler);
    eventScheduler = null;
    if (eyeVisibilityTimeout) { clearTimeout(eyeVisibilityTimeout); eyeVisibilityTimeout = null; }
    if (figureVisibilityTimeout) { clearTimeout(figureVisibilityTimeout); figureVisibilityTimeout = null; }
  }

  function scheduleNextEvent() {
    if (!active) return;
    // Bounded cooldown: 25-65s between events (rare)
    const next = 25000 + Math.random() * 40000;
    eventScheduler = setTimeout(() => {
      if (!active) return;
      // Choose an event
      const roll = Math.random();
      if (roll < 0.6) {
        showEyes();
      } else {
        showFigure();
      }
      scheduleNextEvent();
    }, reducedMotion ? next * 0.5 : next);
  }

  function showEyes() {
    if (!eyesEl) return;
    // Briefly visible, then fades
    eyesEl.classList.add("is-visible");
    const duration = reducedMotion ? 1500 : 4000 + Math.random() * 3000;
    eyeVisibilityTimeout = setTimeout(() => {
      eyesEl.classList.remove("is-visible");
      eyeVisibilityTimeout = null;
    }, duration);
  }

  function showFigure() {
    if (!figureEl) return;
    figureEl.classList.add("is-visible");
    const duration = reducedMotion ? 1000 : 2500 + Math.random() * 2000;
    figureVisibilityTimeout = setTimeout(() => {
      figureEl.classList.remove("is-visible");
      figureVisibilityTimeout = null;
    }, duration);
  }

  // ---------- Flashlight detection on eyes ----------
  // When the flashlight is on AND its current position overlaps the eyes'
  // bounding box, mark the body with `ls-corridor-eyes-lit` so the CSS
  // fades the eyes out (retreat / close).
  function checkEyesIllumination() {
    if (!active || !eyesEl) return;
    if (!window.LS_FLASHLIGHT || !window.LS_FLASHLIGHT.isOn()) {
      document.body.classList.remove("ls-corridor-eyes-lit");
      return;
    }
    const pos = window.LS_FLASHLIGHT.getPosition();
    const rect = eyesEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    // Distance from flashlight center to eyes center
    const ecx = rect.left + rect.width / 2;
    const ecy = rect.top + rect.height / 2;
    const dist = Math.hypot(pos.x - ecx, pos.y - ecy);
    // If within 1.4x radius, eyes are lit
    if (dist < pos.radius * 1.4) {
      document.body.classList.add("ls-corridor-eyes-lit");
    } else {
      document.body.classList.remove("ls-corridor-eyes-lit");
    }
  }

  // Throttled rAF loop for illumination check
  let checkRaf = null;
  function illuminationLoop() {
    checkEyesIllumination();
    if (active) {
      checkRaf = requestAnimationFrame(illuminationLoop);
    } else {
      checkRaf = null;
    }
  }
  document.addEventListener("ls:flagChange", (e) => {
    if (e.detail.flag === "corridorActive") {
      if (e.detail.value && !checkRaf) {
        checkRaf = requestAnimationFrame(illuminationLoop);
      } else if (!e.detail.value && checkRaf) {
        cancelAnimationFrame(checkRaf);
        checkRaf = null;
        document.body.classList.remove("ls-corridor-eyes-lit");
      }
    }
  });

  // ---------- Lightning flash in corridor ----------
  // When storm-eas.js dispatches ls:lightning, also flash the corridor
  // storm flash element if the corridor is active.
  document.addEventListener("ls:lightning", () => {
    if (!active || !stormFlashEl) return;
    stormFlashEl.classList.remove("is-flashing");
    void stormFlashEl.offsetWidth;
    stormFlashEl.classList.add("is-flashing");
  });

  // ---------- Narrative state gating ----------
  document.addEventListener("ls:narrativeState", (e) => {
    if (e.detail.to !== "main") {
      // Force corridor off when leaving main scene
      turnTo(false);
    }
  });

  // ---------- Public API ----------
  window.LS_CORRIDOR = {
    isActive: () => active,
    turnTo
  };
})();
