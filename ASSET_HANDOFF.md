# LAST SEEN — asset handoff

This code-only ZIP intentionally does not include image or audio assets because the project owner already has them. Keep the existing assets in the same relative locations when merging this package:

## Audio

Place the seven MP3 files under `assets/audio/` with these exact names:

- `ambience.mp3`
- `thunder1.mp3`
- `thunder2.mp3`
- `thunder3.mp3`
- `eas.mp3`
- `ambiencetitlle.mp3`
- `ambienceending.mp3`

## Images

The HTML expects these image paths under `assets/images/`:

- `eyes.svg`
- `screen-cracks.svg`
- `blood-splatter.svg`
- `man-silhouette.svg`

The code uses the owner’s existing files when they are present. The audio manager has procedural fallback behavior for development, but the final MP3 files should be restored before release. Do not change the relative paths or filenames.
