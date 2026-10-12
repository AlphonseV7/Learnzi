# Security

LearnZì is a single-user web page hosted as a private Claude artifact.

- **No servers of its own, no trackers, no analytics, no secret keys.** Progress syncs through the artifact's private per-user storage.
- **Files you open stay on your device.** Photos, videos, subtitles and text files are read in the browser and never uploaded or stored elsewhere. Photo reading runs on the device.
- **Imported text is never run.** Subtitles, imported text and anything from storage are validated and shown as text only (no `innerHTML`).
- **Videos are checked before playing.** The first bytes must match a real video container (MP4/MOV, MKV/WebM or Ogg). Playback uses the browser's own sandboxed media player. Re-encoding videos isn't done, because nothing is shared with other people. It would be needed if sharing were ever added.
- **Outside code is pinned.** Hanzi Writer loads from jsDelivr at an exact version with an integrity hash. The photo reader runtime and models are served with the app.

## Known limits
- Protection against bugs in the browser's own image or video decoders comes from the browser itself (keep Chrome up to date).
- Anyone with the artifact link and access can use the app; access is controlled by Claude's sharing settings.

Report problems by opening an issue on this repository.
