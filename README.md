# LAST SEEN — corrected static HTML5 build

This is a code-only correction package. It intentionally excludes the project’s existing image and audio assets; restore them at the paths documented in `ASSET_HANDOFF.md`.

This package fixes the title-screen boot problem in the submitted build and preserves the supplied monolithic phone archive as the main `index.html`.

## Corrected boot flow

1. The document starts in `ls-state-title` before the first frame.
2. The main phone scene is hidden and non-interactive during title and opening.
3. The legacy inline ambience and lightning schedulers are disabled before the inline phone renderer runs.
4. The invalid `lcd` diagnostic reference is fixed so the inline script completes.
5. `title.js` owns the play-to-opening transition.
6. The main state and 120-second timer begin only after the opening fade completes.
7. `storm-eas.js` owns the EAS timer, phone-screen bulletin, lightning schedule, thunder, and window-light event.
8. `ending.js` owns the notification, the actual Inbox insertion, the ten-second reveal, the black fade, the newer phone, final alert, and replay.

## Quality corrections in this revision

- The flashlight uses a Canvas occlusion aperture with `destination-out`, exposing the actual room through the beam rather than drawing only a brightness circle.
- When F is off, the room is crushed to near-black and only a powered LCD remains visible; lightning temporarily overrides that exposure.
- Flashlight activation is F-only; there is no double-click or two-finger toggle.
- EAS and ending notification layers are positioned against the real LCD bounds, styled as pixel-phone states, and queued while the camera is in the corridor.
- The new message is inserted into the actual Inbox archive and must be opened from the Inbox list instead of appearing directly after the cassette click.
- Lightning now drives a brighter multi-stage room exposure, window-shadow response, corridor flash, and thunder variation.
- The ending contains an explicit black hold before the newer-phone reveal, a `LAST SEEN` / `by: Nuyda Productions` credit card, and only then returns to the interactive title screen.

## Repository layout

- `index.html` — main application and original phone/story archive.
- `css/` — narrative, title, flashlight, corridor, storm, ending, newer-phone, and quality-fix styles.
- `js/` — title, narrative, flashlight, corridor, audio, storm, and ending controllers.
- `ASSET_HANDOFF.md` — exact paths and filenames required by this code-only ZIP.
- `RESEARCH_NOTES.md` — web references used for the Canvas flashlight compositor, WebGL capability planning, and Philippine warning structure.

## Controls

- Activate the title play button to begin.
- `F` toggles the flashlight during the main scene.
- `Z` enters the left corridor; press `Z` again to return.
- Use the existing phone keys or keyboard controls for the vintage handset.
- Use Escape or the existing close/back controls for dialogs.

## Static hosting

Serve the repository root through any static server or GitHub Pages. Do not open only the HTML through a file URL when testing modules and audio. All paths are relative and the project has no runtime CDN dependency.

## Audio

The code recognizes exactly these user-provided files under `assets/audio/`:

- `ambience.mp3`
- `thunder1.mp3`
- `thunder2.mp3`
- `thunder3.mp3`
- `eas.mp3`
- `ambiencetitlle.mp3`
- `ambienceending.mp3`

During development, the audio manager uses Web Audio fallback layers if a supplied file has not yet been placed in the folder. Add the real recordings before release and verify their decoding.

## Validation performed

- HTML and JavaScript were checked for syntax-level errors.
- The broken `lcd` reference from the submitted index was corrected.
- All CSS and JavaScript paths referenced by `index.html` are included in this package.
- The missing storm and ending controllers were added.
- The first-paint title gate was added so the phone cannot appear before the title controller.
- The code-only archive intentionally omits the existing image and audio assets; restore them using `ASSET_HANDOFF.md`.

A final browser smoke test should still be run in the target browser with the seven real MP3 files installed.
