# LearnZì test list

What to check before every release. Groups A–C and most of D–I are automated (`tools/test_*.js`, and the
browser runners in `tools/qa/`); the rest is a short hands-on checklist at the end.

## A. Unit tests (node)
1. Dictionary engine: parsing, search by characters, pinyin (with/without tones), English, segmentation (`test_engine.js`)
2. Spaced repetition: scheduling, levels, XP (`test_srs.js`)
3. Merging two devices' progress (`test_merge.js`)
4. Sync: per-deck documents, card shards, size limits, write-before-read guard, old-format migration (`test_sync.js`)
5. Packed data: every packed file unpacks byte-for-byte to the original (`test_packed.js`)
6. Audio processing (`test_dsp.js`)

## B. Build and safety
1. The build runs and the page loads with no errors
2. No text is inserted as HTML (`innerHTML`, `insertAdjacentHTML`, `outerHTML`, `document.write`, `eval`, `new Function`)
3. Every script or stylesheet from outside is pinned to an exact version, and scripts carry an integrity hash
4. No trackers, analytics or secret keys in the code
5. Saved data is checked on load: rubbish or hostile values in storage can't break the app or inject anything

## C. Every page, every look
For each page (Home, Look up, Reader, Photo, Watch & listen, My Zì, My cards, My decks, a deck, Stats, Review,
Tone trainer, Customise, Settings, Debug, Grammar, a grammar point, My journey, Scrolls, a scroll), in all 10
themes, light and dark, on a phone and a computer:
1. No errors in the browser console
2. No "null", "undefined", "NaN" or "[object Object]" on screen
3. Nothing wider than the screen (no sideways scrolling)
4. No box title running under its buttons
5. Every button and control has a name (for screen readers)

## D. Main flows
1. First visit: welcome steps → tour → Home; the tour badge is earned
2. Look up by characters, pinyin and English; open a word; star it; add it to a deck
3. Word pop-up: every box opens; stroke order plays; Listen works
4. Review: show answer, grade, XP goes up, the next card comes; tap the character to hear it
5. Decks: make, rename, add words, delete with undo; sort and filter
6. My cards: search, filters and every sort
7. Tone trainer: a 10-question round to the results; a 3 lives round to game over (knocked-out avatar)
8. Grammar: list, search, level chips, open a point
9. Reader: paste text, tap a word
10. Photo to words and Watch & listen: the samples load
11. Customise: avatar, clock, theme, rank title; Settings: every switch
12. Glitch → secret lock → MLE mode → back to normal
13. Factory reset clears everything, then the welcome shows again
14. Every menu item in Study and Tools opens its page without errors

## E. My journey
1. Quests complete in order, chapter by chapter, and only once
2. Each quest's button goes where it says without errors
3. The quest pop-up appears; its button opens the map
4. The avatar walks to the new stop, then stays there on the next visit
5. Every scroll's tappable words exist in the dictionary
6. Chapter rewards unlock (brush, flute, seal clock, garden lantern, hat, Traveller title)
7. Toolbar: Scrolls, Rewards, List, Full map, Find me, Daily

## F. Accessibility
1. Text contrast meets the standard (4.5 : 1) in every theme, light and dark
2. Reduced motion stops the animations
3. Everything can be reached and used with the keyboard; Escape closes pop-ups

## G. Data and sync
1. Big libraries stay within the sync store's size limits
2. Saved state survives a reload unchanged

## H. Speed
1. Time until the dictionary is ready and Home is usable
2. Time to draw My journey and the water garden
3. Size of the app file

## I. Content
1. Every grammar level loads
2. HSK 2.0 and 3.0 decks have the expected number of words
3. The 20 scrolls, 20 quests and 5 chapters line up

## Hands-on checklist (needs a real phone)
- Recordings play; the browser voice works when a recording is missing
- Photo to words with the camera
- Sync between two devices
- Installing to the home screen
