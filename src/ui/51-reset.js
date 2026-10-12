/* LearnZì UI, part 6b: Settings → Reset. Put boxes back how they were, or reset LearnZì to how it
 * was the first time you opened it. A factory reset asks first, then plays a wipe: a glitch, a brush
 * sweeping the screen clean, and 清 (qīng, clear) before a fresh Home. It erases this device's copy and
 * the synced copy (otherwise sync would bring everything straight back). */

function resetBox() {
  return h("div", { class: "card set reset-card" }, h("h2", { class: "h-card" }, "Reset"),
    boxLayoutRow(),
    h("div", { class: "stack-tight" }, h("b", null, "Factory reset"),
      h("span", { class: "muted small" }, "Start again from scratch: every setting, saved word, deck, flashcard and level, on every device you sync with."),
      h("div", { class: "row" }, h("button", { class: "btn danger", type: "button", onclick: askFactoryReset }, icon("rotate"), "Reset to factory settings"))));
}

function closeResetAsk() {
  const ov = $("#reset-ask");
  if (!ov) return false;
  ov.remove();
  return true;
}
function askFactoryReset() {
  closeResetAsk();
  const cancel = h("button", { class: "btn primary", type: "button", onclick: closeResetAsk }, "Keep everything");
  const go = h("button", { class: "btn danger", type: "button", onclick: () => { closeResetAsk(); factoryReset(); } }, "Yes, reset everything");
  const ov = h("div", { class: "reset-ask", id: "reset-ask", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "reset-title", "aria-describedby": "reset-what" },
    h("div", { class: "card reset-ask-card" },
      h("span", { class: "reset-glyph hz", "aria-hidden": "true" }, "清"),
      h("h2", { id: "reset-title" }, "Reset LearnZì?"),
      h("div", { id: "reset-what", class: "stack-tight" },
        h("p", null, "This erases everything and can't be undone:"),
        h("ul", { class: "reset-list" },
          h("li", null, "Your level, XP, streak and every flashcard's progress"),
          h("li", null, "Saved words, your decks and the moments saved from videos"),
          h("li", null, "Settings, theme, avatar, clock and Reader text"),
          h("li", null, "MLE mode, remembered video places and tap-along timings"),
          h("li", null, "The synced copy, so your other devices start fresh too")),
        h("p", { class: "muted small" }, "The dictionary, recordings and photo reader stay; the photo reader downloads its files again next time.")),
      h("div", { class: "row reset-buttons" }, cancel, go)));
  ov.addEventListener("click", ev => { if (ev.target === ov) closeResetAsk(); });
  ov.addEventListener("keydown", ev => { if (ev.key === "Escape") { ev.stopPropagation(); closeResetAsk(); } });
  document.body.append(ov);
  cancel.focus({ preventScroll: true });
}

/** The wipe. Resolves when the screen is fully covered, so the reset happens out of sight. */
function wipeAnimation() {
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const layer = h("div", { class: "wipe" + (calm ? " calm" : ""), id: "wipe", "aria-hidden": "true" },
    h("div", { class: "wipe-cover" }), h("div", { class: "wipe-brush" }),
    h("div", { class: "wipe-mark" }, h("span", { class: "hz" }, "清"), h("span", { class: "wipe-py" }, "qīng · clear"), h("span", { class: "wipe-sub" }, "Starting fresh")));
  if (!calm) document.body.classList.add("glitching");
  document.body.append(layer);
  if (state.sounds && !calm) try { gong(0.25); } catch { /* sound is optional */ }
  return new Promise(res => setTimeout(() => { document.body.classList.remove("glitching"); res(layer); }, calm ? 250 : 1500));
}

async function factoryReset() {
  const shown = wipeAnimation();
  const now = Date.now();
  // Fresh copies, newer than anything synced, so they replace it everywhere (progress via its reset epoch).
  progress = sanitizeProgress({ cards: {}, act: {}, adj: [now, 0], epoch: now, updatedAt: now });
  state = sanitize({}); state.updatedAt = now;
  reader = sanitizeReader({}); reader.updatedAt = now;
  writeJSON(PROGRESS_KEY, progress); writeJSON(LS_KEY, state); writeJSON(READER_KEY, reader);
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("learnzi") && ![LS_KEY, PROGRESS_KEY, READER_KEY].includes(k)) localStorage.removeItem(k);
    sessionStorage.clear();
  } catch { /* storage blocked: nothing else to clear */ }
  try { if (window.caches) for (const k of await caches.keys()) if (k.startsWith("learnzi")) await caches.delete(k); } catch { /* no cache storage here */ }
  clockShift = 0;
  await Promise.race([Sync.flushAll(), new Promise(r => setTimeout(r, 4000))]);
  const layer = await shown;
  // Start the app again behind the cover, then lift it.
  Object.assign(ui, { view: "home", stack: [], focus: null, picker: false, meTab: "avatar", deckId: null, cardsDeck: "all", cardsStatus: "all", cardsQ: "", cardsShow: 100 });
  study.active = false; drill.active = false;
  closePanel();
  applyAll();
  go("home");
  setMood("surprised", 2500);
  layer.classList.add("lift");
  setTimeout(() => { layer.remove(); toast("LearnZì is fresh again. 你好！"); }, 1100);
}
