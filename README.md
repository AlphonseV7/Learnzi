# LearnZì 学字

An open-source Chinese word-learning app for beginners, built as a single web page that runs in the browser on a phone or a computer. Nothing needs installing.

## What it does
- **Look up** words by characters (simplified or traditional), pinyin with or without tones, or English. Each word shows pinyin, tone colours, meanings, stroke-order animations, character stories, example sentences and real-voice recordings.
- **Reader:** paste or import Chinese text and tap any word.
- **Flashcards** with spaced repetition (FSRS), decks (Welcome, HSK 1–6, your own), levels, XP and streaks.
- **Tone trainer** with a water garden that grows as you practise.
- **Photo to words:** reads Chinese in photos and screenshots on your device (PaddleOCR models in ONNX Runtime Web), then makes a deck from the words.
- **Watch:** plays a video from your device with its Chinese subtitles. Tap a word to pause and look it up, and make flashcards that play the moment the word is said.
- Themes with light and dark looks, avatars, a clock, and boxes you can fold, move and remove.

## How it's built
`src/` holds the page shell, styles, a dictionary engine (`engine.js`), the spaced-repetition maths (`srs.js`) and the interface in numbered parts (`src/ui/`). `tools/build.py` joins them into one page (`dist/index.html`). The other scripts in `tools/` build the data files from open-source sources (see ATTRIBUTION.md). Tests: `tools/test_engine.js`, `tools/test_srs.js` and `tools/test_merge.js`.

`HANDOFF.md` is the full technical reference.

## Licence
App code: MIT (see LICENSE). Data comes from open-source projects under their own licences (see ATTRIBUTION.md).
