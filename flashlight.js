/* LAST SEEN — flashlight.js
   A real 2D flashlight compositor, not a brightness sticker.

   The canvas draws an opaque near-black room veil, then uses Canvas
   destination-out compositing to cut a transparent aperture through that veil.
   The actual scene is therefore visible through the beam while the rest of
   the room remains occluded. A separate warm optical spill and a narrow
   hotspot provide restrained light response. F is the only flashlight toggle;
   there is no double-click or two-finger toggle.
*/
(function () {
  "use strict";

  const canvas = document.getElementById("ls-flashlight");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;
  let on = false;
  let targetX = innerWidth * .5;
  let targetY = innerHeight * .5;
  let currentX = targetX;
  let currentY = targetY;
  let rafId = 0;
  let dpr = 1;
  let radius = 260;
  let flicker = 1;
  let flickerTarget = 1;
  let nextFlicker = 0;

  // The first playable room frame is intentionally unlit. F is the only
  // control that can open the flashlight.
  document.body.classList.add("ls-flashlight-off");

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(innerWidth * dpr));
    canvas.height = Math.max(1, Math.round(innerHeight * dpr));
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    radius = Math.max(150, Math.min(innerWidth, innerHeight) * .235);
    currentX = Math.min(innerWidth, Math.max(0, currentX));
    currentY = Math.min(innerHeight, Math.max(0, currentY));
  }

  function setTarget(x, y) {
    targetX = Math.min(innerWidth, Math.max(0, x));
    targetY = Math.min(innerHeight, Math.max(0, y));
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });

  // Track the cursor even while the light is off, so activating F reveals the
  // place the player is actually pointing at instead of snapping from center.
  document.addEventListener("pointermove", event => {
    setTarget(event.clientX, event.clientY);
  }, { passive: true });

  // Touch can aim the already-enabled flashlight, but never toggles it.
  document.addEventListener("pointerdown", event => {
    if (!on) return;
    if (event.target.closest("button, [data-key], input, [role=dialog]")) return;
    setTarget(event.clientX, event.clientY);
  }, { passive: true });

  function updateFlicker(now) {
    if (reducedMotion) { flicker = 1; return; }
    if (now >= nextFlicker) {
      // Real flashlights have small electrical/exposure changes, not strobing.
      flickerTarget = .91 + Math.random() * .09;
      nextFlicker = now + 180 + Math.random() * 720;
    }
    flicker += (flickerTarget - flicker) * .08;
  }

  function radial(ctx2, x, y, inner, outer, stops) {
    const gradient = ctx2.createRadialGradient(x, y, inner, x, y, outer);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    return gradient;
  }

  function drawFlashlight(now) {
    if (!on) { rafId = 0; return; }
    updateFlicker(now);

    const lerp = reducedMotion ? 1 : .14;
    currentX += (targetX - currentX) * lerp;
    currentY += (targetY - currentY) * lerp;

    // Work in CSS pixels after the DPR transform. This avoids a soft scaled
    // mask and keeps the transparent aperture aligned with the pointer.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    const r = radius * flicker;
    const outer = r * 1.62;

    // 1. Opaque veil: this is what makes the room genuinely dark outside the
    // beam instead of merely adding a bright radial gradient over everything.
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(0, 2, 3, .93)";
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    // 2. Transparent aperture: destination-out removes the veil where the
    // flashlight reaches, exposing the actual room below this canvas.
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = radial(ctx, currentX, currentY, 0, outer, [
      [0, "rgba(0,0,0,1)"],
      [.38, "rgba(0,0,0,.99)"],
      [.64, "rgba(0,0,0,.9)"],
      [.83, "rgba(0,0,0,.48)"],
      [1, "rgba(0,0,0,0)"]
    ]);
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    // 3. Interior optical spill: a restrained warm hotspot and a wider haze
    // are drawn only inside the aperture. These are light response layers,
    // not the visibility mechanism.
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = radial(ctx, currentX, currentY, 0, r * .86, [
      [0, `rgba(255,244,220,${.22 * flicker})`],
      [.22, `rgba(255,228,185,${.12 * flicker})`],
      [.68, `rgba(191,172,133,${.035 * flicker})`],
      [1, "rgba(0,0,0,0)"]
    ]);
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    // Small hotspot feather: makes nearby edges read as illuminated without
    // turning the whole screen white.
    ctx.fillStyle = radial(ctx, currentX, currentY, 0, r * .28, [
      [0, `rgba(255,250,237,${.12 * flicker})`],
      [.7, `rgba(242,219,178,${.025 * flicker})`],
      [1, "rgba(0,0,0,0)"]
    ]);
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    ctx.globalCompositeOperation = "source-over";
    rafId = requestAnimationFrame(drawFlashlight);
  }

  function toggle(force) {
    const next = typeof force === "boolean" ? force : !on;
    if (next === on) return;
    on = next;
    canvas.classList.toggle("is-on", on);
    canvas.setAttribute("aria-hidden", String(!on));
    document.body.classList.toggle("ls-flashlight-on", on);
    document.body.classList.toggle("ls-flashlight-off", !on);
    try { window.LS_NARRATIVE?.setFlag("flashlightOn", on); } catch (_) {}

    if (on) {
      if (!rafId) rafId = requestAnimationFrame(drawFlashlight);
    } else {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  document.addEventListener("keydown", event => {
    if (event.repeat) return;
    if (event.key !== "f" && event.key !== "F") return;
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)) return;
    const state = window.LS_NARRATIVE?.getState?.();
    if (state !== "main") return;
    if (window.LS_CORRIDOR?.isActive?.() && window.LS_STORM?.isEasActive?.()) return;
    event.preventDefault();
    toggle();
  });

  document.addEventListener("ls:narrativeState", event => {
    if (event.detail.to !== "main") {
      toggle(false);
    } else if (!on) {
      // Replay removes transient body classes; restore the explicit dark
      // flashlight-off state before the room becomes visible again.
      document.body.classList.add("ls-flashlight-off");
      document.body.classList.remove("ls-flashlight-on");
    }
  });

  window.LS_FLASHLIGHT = {
    toggle,
    isOn: () => on,
    getPosition: () => ({ x: currentX, y: currentY, radius })
  };
})();
