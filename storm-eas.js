/* LAST SEEN — storm-eas.js
   Owns the post-opening 120-second timer, LCD-native EAS takeover,
   bounded 25–90 second lightning, brighter environmental exposure, and
   thunder playback. Phone-only UI is queued while the camera is in the
   corridor and cannot render there.
*/
(function () {
  "use strict";

  const eas = document.getElementById("ls-eas");
  const scene = document.querySelector("main.scene");
  const lcdFrame = document.querySelector(".lcd-frame");
  const flash = document.querySelector(".storm-flash");
  const windowShadow = document.querySelector(".window-shadow");
  const exposure = document.getElementById("ls-lightning-exposure");
  const area = document.getElementById("ls-eas-area");
  const message = document.getElementById("ls-eas-message");
  const time = document.getElementById("ls-eas-time");

  if (!eas || !scene) return;

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;
  const MAIN_DELAY = 120000;
  const EAS_HOLD = 15000;

  let mainTimer = null;
  let lightningTimer = null;
  let easTimer = null;
  let active = false;
  let stormStarted = false;
  let easQueued = false;
  let strikeToken = 0;

  const LOCATION = "SAINT FRANCIS AREA · ISABELA";
  const PHONE_TIME = "07:12 · 16-02-1999";

  function isCorridor() {
    return Boolean(window.LS_CORRIDOR?.isActive?.() || window.LS_NARRATIVE?.getFlags?.().corridorActive);
  }

  function positionOnPhone() {
    if (!lcdFrame) return;
    const rect = lcdFrame.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    eas.style.inset = "auto";
    eas.style.right = "auto";
    eas.style.bottom = "auto";
    eas.style.left = `${rect.left + rect.width / 2}px`;
    eas.style.top = `${rect.top + rect.height / 2}px`;
    eas.style.width = `${rect.width}px`;
    eas.style.height = `${rect.height}px`;
    eas.style.transform = "translate(-50%, -50%)";
  }

  function populate() {
    if (area) area.textContent = LOCATION;
    if (message) message.textContent = "Malakas na pag-ulan at hangin. Manatili sa loob ng bahay. Mag-ingat sa pagbaha at pagguho sa mga kalsada.";
    if (time) time.textContent = `ISSUED ${PHONE_TIME}`;
  }

  function setTakeover(on) {
    if (on) {
      if (isCorridor()) { easQueued = true; return false; }
      populate();
      positionOnPhone();
      eas.classList.add("is-active");
      eas.setAttribute("aria-hidden", "false");
      try { window.LS_NARRATIVE.setFlag("easActive", true); } catch (_) {}
      return true;
    }
    eas.classList.remove("is-active");
    eas.setAttribute("aria-hidden", "true");
    try { window.LS_NARRATIVE.setFlag("easActive", false); } catch (_) {}
    return false;
  }

  function flashWorld() {
    const token = ++strikeToken;
    const duration = reducedMotion ? 900 : 1200;
    const fromCorridor = isCorridor();
    document.body.classList.remove("ls-lightning-active", "ls-lightning-secondary");
    scene.classList.remove("ls-lightning-active", "ls-lightning-secondary");
    if (flash) flash.classList.remove("is-flashing");
    if (windowShadow) windowShadow.classList.remove("is-flashing");
    if (exposure) exposure.classList.remove("is-active", "is-corridor");
    void scene.offsetWidth;

    // Main exposure burst: this brightens the actual room layers and window
    // frame, while the Canvas flashlight remains a separate occlusion system.
    document.body.classList.add("ls-lightning-active");
    scene.classList.add("ls-lightning-active");
    if (flash) flash.classList.add("is-flashing");
    if (windowShadow) windowShadow.classList.add("is-flashing");
    if (exposure) {
      exposure.classList.toggle("is-corridor", fromCorridor);
      exposure.classList.add("is-active");
    }
    document.dispatchEvent(new CustomEvent("ls:lightning", {
      detail: { source: "window", location: LOCATION }
    }));

    // A short secondary pulse gives the strike a natural electrical rhythm.
    const secondaryDelay = reducedMotion ? 260 : 150 + Math.random() * 280;
    const secondary = window.setTimeout(() => {
      if (token !== strikeToken) return;
      document.body.classList.add("ls-lightning-secondary");
      scene.classList.add("ls-lightning-secondary");
    }, secondaryDelay);

    const variant = `thunder${1 + Math.floor(Math.random() * 3)}`;
    const thunderDelay = reducedMotion ? 220 : 420 + Math.random() * 2800;
    window.setTimeout(() => {
      if (token !== strikeToken) return;
      try { window.LS_AUDIO.playThunder(variant); } catch (_) {}
    }, thunderDelay);

    window.setTimeout(() => {
      if (token !== strikeToken) return;
      window.clearTimeout(secondary);
      document.body.classList.remove("ls-lightning-active", "ls-lightning-secondary");
      scene.classList.remove("ls-lightning-active", "ls-lightning-secondary");
      if (flash) flash.classList.remove("is-flashing");
      if (windowShadow) windowShadow.classList.remove("is-flashing");
      if (exposure) exposure.classList.remove("is-active", "is-corridor");
    }, duration);
  }

  function scheduleLightning(first = false) {
    if (!active) return;
    if (lightningTimer) window.clearTimeout(lightningTimer);
    const min = 25000;
    const max = first ? 45000 : 90000;
    lightningTimer = window.setTimeout(() => {
      if (active) flashWorld();
      scheduleLightning(false);
    }, min + Math.random() * (max - min));
  }

  function displayEas() {
    if (!active || !stormStarted) return;
    if (isCorridor()) { easQueued = true; return; }
    easQueued = false;
    try {
      if (window.LASTSEEN && !window.LASTSEEN.getPowered()) window.LASTSEEN.powerOn();
    } catch (_) {}
    setTakeover(true);
    try { window.LS_AUDIO.playEAS(); } catch (_) {}
    if (easTimer) window.clearTimeout(easTimer);
    easTimer = window.setTimeout(() => {
      setTakeover(false);
      try { window.LS_AUDIO.stopEAS(); } catch (_) {}
    }, EAS_HOLD);
  }

  function showEas() {
    if (!active || stormStarted) return;
    stormStarted = true;
    if (isCorridor()) {
      easQueued = true;
      try { window.LS_AUDIO.playEAS(); } catch (_) {}
    } else {
      displayEas();
    }
    scheduleLightning(true);
  }

  function stopStorm() {
    active = false;
    stormStarted = false;
    easQueued = false;
    if (mainTimer) window.clearTimeout(mainTimer);
    if (lightningTimer) window.clearTimeout(lightningTimer);
    if (easTimer) window.clearTimeout(easTimer);
    mainTimer = lightningTimer = easTimer = null;
    setTakeover(false);
    try { window.LS_AUDIO.stopEAS(); } catch (_) {}
    document.body.classList.remove("ls-lightning-active", "ls-lightning-secondary");
    scene.classList.remove("ls-lightning-active", "ls-lightning-secondary");
    if (flash) flash.classList.remove("is-flashing");
    if (windowShadow) windowShadow.classList.remove("is-flashing");
    if (exposure) exposure.classList.remove("is-active", "is-corridor");
  }

  function startAfterOpening() {
    stopStorm();
    active = true;
    try { window.LS_NARRATIVE.mainTimerStart = performance.now(); } catch (_) {}
    mainTimer = window.setTimeout(showEas, MAIN_DELAY);
  }

  document.addEventListener("ls:openingComplete", startAfterOpening);
  document.addEventListener("ls:narrativeState", event => {
    if (event.detail.to !== "main") stopStorm();
  });
  document.addEventListener("ls:flagChange", event => {
    if (event.detail.flag !== "corridorActive") return;
    if (event.detail.value) {
      // Hide the takeover immediately when the phone leaves the camera view,
      // but keep it queued so it can return when the room is visible again.
      if (eas.classList.contains("is-active")) {
        easQueued = true;
        setTakeover(false);
      }
    } else if (easQueued && stormStarted) {
      displayEas();
    }
  });
  window.addEventListener("resize", () => {
    if (eas.classList.contains("is-active")) positionOnPhone();
  }, { passive: true });

  window.LS_STORM = {
    startAfterOpening,
    stop: stopStorm,
    flash: flashWorld,
    isActive: () => active,
    isEasActive: () => eas.classList.contains("is-active")
  };
})();
