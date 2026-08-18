# LAST SEEN — implementation research notes

The flashlight rework uses the Canvas 2D compositing model documented by MDN. The dark veil is drawn over the room and the beam aperture uses `destination-out` to preserve the underlying room pixels only where the light reaches them. This is intentionally different from a screen-blended brightness circle.

- MDN Canvas compositing: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation
- MDN WebGL overview and hardware-accelerated Canvas rendering: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API
- PAGASA Tropical Cyclone Wind Signal reference: https://pagasa.dost.gov.ph/learning-tools/tropical-cyclone-wind-signal
- PAGASA public bulletin resources were used only as structural reference. The game alert remains fictional and does not reproduce an official seal, broadcast, or government recording.

The storm lighting is implemented as a window-sourced environmental exposure event: the room, window frame shadow, phone, desk, floor, and corridor receive different response layers. The EAS and Inbox states are positioned from the actual `.lcd-frame` bounds so they stay inside the vintage phone instead of becoming neon full-page overlays.
