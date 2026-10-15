/* Settings rows, shared with Customise → Theme. */
const setRow = (id, label, control, hint) => h("div", { class: "set-row" },
  h("div", { class: "set-label" }, h("label", { for: id }, label), hint ? h("span", { class: "muted small" }, hint) : null), control);
function setToggle(id, on, change) {
  const inp = h("input", { type: "checkbox", id, role: "switch" });
  inp.checked = on;
  inp.addEventListener("change", () => change(inp.checked));
  return h("span", { class: "toggle" }, inp, h("span"));
}
function setSeg(id, opts, val, pick) {
  const g = h("div", { class: "seg", role: "group", id });
  for (const [k, label] of opts) {
    g.append(h("button", { type: "button", "aria-pressed": String(k === val), onclick: ev => {
      g.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === ev.currentTarget)));
      pick(k);
    } }, label));
  }
  return g;
}
function setSelect(id, table, val, change) {
  const s = h("select", { id });
  for (const [k, f] of Object.entries(table)) { const o = h("option", { value: k }, f.label); if (k === val) o.selected = true; s.append(o); }
  s.addEventListener("change", () => change(s.value));
  return s;
}

/* LearnZì UI, part 6: Settings. */

/** Settings search: each row matches on its words (and its box's title); boxes with no match hide,
 *  and folded boxes open while you search (they fold back when the search is cleared). */
const SET_WORDS = { voice: "sound audio speech recording listen speaker", "text and fonts": "size font typeface bigger smaller letters", flashcards: "review cards goal daily session typing sentence streak",
  "stroke order": "writing animation radical", profile: "name sync account", "box layout": "folds move boxes", reset: "factory tour erase start again", "word details": "pop-up panel boxes" };
function settingsSearch() {
  const view = $(".view.settings-view");
  if (!view) return;
  const terms = (ui.setQ || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
  view.classList.toggle("searching", terms.length > 0);
  let shown = 0;
  for (const card of view.querySelectorAll(":scope > .card:not(.set-find)")) {
    const title = ((card.querySelector(".fold-label, .h-card") || {}).textContent || "").toLowerCase().trim();
    const extra = SET_WORDS[title] || "";
    // A row that matches on its own words shows alone; if none does, a match on the box's title or
    // its extra words (voice → "sound") shows the whole box.
    const own = text => terms.every(t => text.toLowerCase().includes(t));
    const boxWide = terms.length && terms.every(t => (title + " " + extra).includes(t));
    const rows = [...card.querySelectorAll(".set-row")];
    let any = false;
    if (rows.length) {
      const hits = rows.map(r => !terms.length || own(r.textContent));
      const whole = !hits.some(Boolean) && boxWide;
      rows.forEach((r, i) => r.classList.toggle("set-miss", !(hits[i] || whole)));
      any = hits.some(Boolean) || whole;
    } else any = !terms.length || boxWide || own(card.textContent);
    card.classList.toggle("set-hide", !any);
    if (any) shown++;
  }
  const note = view.querySelector(".set-none-note");
  if (note) note.hidden = !terms.length || shown > 0;
}

/** Settings → Voice → Check every voice: says 谢谢 with each voice in turn and reports what happened,
 *  so a voice that doesn't work on this phone shows why (a screenshot of this helps fix it). */
const VOICE_ERR = {
  index: "couldn't load the list of recordings", missing: "no recording of this word", download: "couldn't download the recording (network or storage)",
  nosound: "this browser can't play app sounds", decode: "the phone couldn't open the recording file", blocked: "sound is blocked until you tap the page",
};
async function voiceCheck(out) {
  if (!out) return;
  out.replaceChildren(h("p", { class: "muted small" }, "Checking… you should hear 谢谢 three times."));
  const lines = [];
  for (const [src, label] of [["word", "Recording"], ["syllables", "Syllables"], ["browser", "Browser voice"]]) {
    AUDIO.err = "";
    let got = null;
    try { got = await speak("谢谢", "xie4 xie5", { only: src }); } catch { got = null; }
    if (got && src !== "browser" && audioCtx && audioCtx.state !== "running") { got = null; AUDIO.err = "blocked"; }
    const why = src === "browser" ? (hasTTS() ? (zhVoice ? "" : "no Chinese voice installed on this phone") : "this browser has no voice") : VOICE_ERR[AUDIO.err] || "didn't play";
    lines.push(h("li", { class: got ? "vc-ok" : "vc-bad" }, h("b", null, (got ? "✓ " : "✗ ") + label), got ? " played" + (src === "browser" && why ? " (" + why + ")" : "") : ": " + why));
    out.replaceChildren(h("ul", { class: "voice-list" }, lines));
    await new Promise(r => setTimeout(r, 1500));
  }
  out.append(h("p", { class: "muted small" }, "Sound context: " + (audioCtx ? audioCtx.state : "none") + " · Recordings listed: " + ((await audioIndex()).size || 0)));
}

function viewSettings() {
  const v = h("section", { class: "view settings-view" });
  // Search: shows only the settings that match, opening their boxes while you search.
  const find = h("input", { type: "search", id: "set-q", class: "set-search", placeholder: "Search settings", "aria-label": "Search settings", autocomplete: "off", enterkeyhint: "search" });
  find.value = ui.setQ || "";
  find.addEventListener("input", () => { ui.setQ = find.value; settingsSearch(); });
  v.append(h("div", { class: "card set-find", "data-keep": "" }, icon("search"), find, h("p", { class: "muted small set-none-note", hidden: true }, "No settings match.")));
  queueMicrotask(settingsSearch);
  const row = setRow, toggleCtl = setToggle, seg = setSeg, select = setSelect;

  // Profile (with sync: the button shows how syncing is going, tap it for the details)
  const syncInfo = h("div", { class: "stack-tight sync-info", hidden: true },
    h("p", { class: "muted", id: "sync-note" }, PILL[Sync.status][1]),
    h("p", { class: "muted small" }, "Synced: your nickname, My Zì, flashcard progress and XP, badges, recent lookups, reader text and these settings. Stored privately for your account; nobody else can read them."));
  const syncBtn = () => {
    const b = h("button", { class: "btn sync", id: "sync", type: "button", "aria-expanded": "false", onclick: () => { syncInfo.hidden = !syncInfo.hidden; b.setAttribute("aria-expanded", String(!syncInfo.hidden)); } },
      h("span", { class: "sync-text" }, PILL[Sync.status][0]));
    b.dataset.s = Sync.status;
    return b;
  };
  const nick = h("input", { type: "text", id: "nickname", maxlength: "24", placeholder: "Your name", autocomplete: "nickname", spellcheck: "false" });
  nick.value = state.nickname;
  let nickTimer = 0;
  const saveNick = () => { clearTimeout(nickTimer); const n = cleanLine(nick.value, 24); if (n !== state.nickname) commit({ nickname: n }); };
  nick.addEventListener("input", () => { clearTimeout(nickTimer); nickTimer = setTimeout(saveNick, 700); });
  nick.addEventListener("change", saveNick);
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Profile"),
    row("nickname", "Nickname", nick),
    row("level", "My Chinese", select("level", LEVELS, state.level, k => { commit({ level: k }); }), "Sets the word of the day and the Reader's sample text. Decks and new words a day are under Flashcards."),
    h("div", { class: "row" }, syncBtn()),
    syncInfo));

  // Reading
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Reading"),
    row("script", "Characters", seg("script", [["s", "Simplified 简"], ["t", "Traditional 繁"]], state.script, k => { commit({ script: k }); renderPanel(); })),
    row("pinyin", "Show pinyin", toggleCtl("pinyin", state.pinyin, on => { commit({ pinyin: on }); applyLook(); }), "Small, above the characters, everywhere in the app"),
    row("tones", "Tone colours", toggleCtl("tones", state.tones, on => { commit({ tones: on }); applyLook(); }),
      h("span", { class: "tone-demo" }, pyEl("ma1 ma2 ma3 ma4 ma5"))),
    toneEditor()));

  // Text and fonts (themes, colours, scenes and shapes are in Customise → Theme)
  const scaleOut = h("span", { class: "muted small num" }, Math.round(state.scale * 100) + "%");
  const scale = h("input", { type: "range", id: "scale", min: "85", max: "130", step: "5" });
  scale.value = String(Math.round(state.scale * 100));
  scale.addEventListener("input", () => { scaleOut.textContent = scale.value + "%"; document.documentElement.style.setProperty("--scale", String(scale.value / 100)); });
  scale.addEventListener("change", () => commit({ scale: scale.value / 100 }));
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Text and fonts"),
    row("font", "Chinese font", select("font", FONTS, state.font, k => { commit({ font: k }); applyLook(); }),
      h("span", { class: "font-demo-word" }, h("span", { class: "hz font-demo" }, state.script === "t" ? "漢字" : "汉字"), h("span", { class: "small" }, "hànzì"), h("span", { class: "muted small" }, "· Chinese characters"))),
    row("uifont", "English font", select("uifont", UIFONTS, state.uiFont, k => { commit({ uiFont: k }); applyLook(); }), "Menus, buttons, headings and meanings"),
    row("scale", "Text size", h("div", { class: "row" }, scale, scaleOut))));

  // Study
  const perDay = h("select", { id: "newperday" });
  for (const n of [5, 10, 15, 20, 30]) { const o = h("option", { value: String(n) }, n + " a day"); if (n === state.newPerDay) o.selected = true; perDay.append(o); }
  perDay.addEventListener("change", () => commit({ newPerDay: Number(perDay.value) }));
  const pick = (id, opts, cur, key) => {
    const sel = h("select", { id });
    for (const [val, label] of opts) { const o = h("option", { value: String(val) }, label); if (val === cur) o.selected = true; sel.append(o); }
    sel.addEventListener("change", () => commit({ [key]: Number(sel.value) }));
    return sel;
  };
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Flashcards"),
    row("dailygoal", "Daily goal", pick("dailygoal", [[0, "No goal"], [5, "5 minutes"], [10, "10 minutes"], [15, "15 minutes"], [20, "20 minutes"]], state.dailyGoal, "dailyGoal"),
      "Practice time to aim for each day: flashcards and the tone trainer. Your streak grows on days you reach it (with no goal, any review counts)."),
    row("sessionsize", "Session length", pick("sessionsize", [[20, "20 cards (about 5 min)"], [40, "40 cards"], [60, "60 cards"]], state.sessionSize, "sessionSize"),
      "Cards in one review. The most overdue come first; you can always keep going after."),
    row("newperday", "New cards", perDay, "How many new cards to start each day"),
    row("typeanswers", "Type your answers", toggleCtl("typeanswers", state.typeAnswers, on => commit({ typeAnswers: on })),
      "Type the pinyin, characters or meaning, then check. Small typos still count; wrong tones are shown"),
    row("sentencecards", "Sentence cards", toggleCtl("sentencecards", state.sentenceCards, on => commit({ sentenceCards: on })),
      "Fill the gap in a short sentence once you've known a word for 5 days"),
    row("listen", "Listening cards", toggleCtl("listen", state.listen, on => commit({ listen: on })), "Turn off where you can't play sound"),
    row("writing", "Writing cards", toggleCtl("writing", state.writing, on => commit({ writing: on })), "Write words from memory once you know them (12 days)"),
    row("drawchars", "Draw characters on cards", toggleCtl("drawchars", state.drawChars, on => commit({ drawChars: on })), "Each card's characters quickly draw themselves, stroke by stroke"),
    row("autoplay", "Play sound automatically", toggleCtl("autoplay", state.autoplay, on => commit({ autoplay: on })), "When a card's answer is shown"),
    row("sounds", "Level-up sound", toggleCtl("sounds", state.sounds, on => commit({ sounds: on })), "A soft gong when you reach a new Zì level"),
    h("p", { class: "muted small" }, "Meaning cards come first. Listening cards unlock once you remember a word for 3 days, Sentence cards (fill the gap) at 5 days, Recall cards (English to Chinese) at 8 days, and Writing cards (if switched on) at 12 days.")));

  // Word details
  const details = h("div", { class: "detail-toggles" }, Object.entries(DETAILS).map(([k, label]) =>
    row("d-" + k, label, toggleCtl("d-" + k, showDetail(k), on => { const d = { ...state.details }; if (on) delete d[k]; else d[k] = false; commit({ details: d }); renderPanel(); }))));
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Word details"), details));

  // Stroke order
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Stroke order"),
    row("strokespeed", "Animation speed", seg("strokespeed", [[0.5, "Slow"], [1, "Normal"], [2, "Fast"]], state.strokeSpeed, k => commit({ strokeSpeed: k }))),
    row("radical", "Highlight the radical", toggleCtl("radical", state.radical, on => commit({ radical: on })), "Draws the radical (the part that hints at meaning) in your accent colour")));

  // Voice
  const rateOut = h("span", { class: "muted small num" }, state.rate.toFixed(1) + "×");
  const rate = h("input", { type: "range", id: "rate", min: "5", max: "13", step: "1" });
  rate.value = String(Math.round(state.rate * 10));
  rate.addEventListener("input", () => { rateOut.textContent = (rate.value / 10).toFixed(1) + "×"; });
  rate.addEventListener("change", () => commit({ rate: rate.value / 10 }));
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Voice"),
    row("voice", "Voice", seg("voice", [["auto", "Automatic"], ["word", "Recording"], ["syllables", "Syllables"], ["browser", "Browser"]], state.voiceSrc, k => commit({ voiceSrc: k })),
      "Recording: a native speaker saying the whole word (8,569 HSK words). Syllables: the word built from recorded syllables. Browser: your phone's own voice. Automatic picks the best one for each word. A sentence, or a word with no recording, uses the next voice that can say it."),
    row("rate", "Browser voice speed", h("div", { class: "row" }, rate, rateOut)),
    h("div", { class: "row" },
      h("button", { class: "btn", type: "button", onclick: () => speak("谢谢", "xie4 xie5") }, icon("play"), "Test: 谢谢"),
      h("button", { class: "btn", type: "button", onclick: ev => voiceCheck(ev.currentTarget.parentElement.nextElementSibling) }, "Check every voice")),
    h("div", { class: "voice-check", "aria-live": "polite" }),
    h("span", { class: "muted small", id: "voice-note" }, voiceNote())));

  // Box layout, Glitch, then Reset: replay the tour and the factory reset (51-reset)
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Box layout"), boxLayoutRow()));
  // Glitch (moved from Debug): a tap breaks the screen; holding the button still opens the secret (61-secret)
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Glitch"),
    h("p", { class: "muted small" }, "Breaks the screen, then goes completely black. Tap the black screen 5 times or press Escape to come back."),
    h("div", { class: "row" }, glitchButton())));
  v.append(resetBox());

  // About
  const a = (href, text) => h("a", { href, target: "_blank", rel: "noopener noreferrer" }, text);
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "About"),
    h("div", { class: "credits" },
      h("p", null, "LearnZì · updated " + UPDATES[0][0] + " · " + (ui.dict === "ready" ? Engine.size.toLocaleString("en-GB") + " dictionary entries" : "dictionary loading")),
      h("p", null, "Dictionary: ", a("https://cc-cedict.org/wiki/", "CC-CEDICT"), " by MDBG and contributors, licensed ",
        a("https://creativecommons.org/licenses/by-sa/4.0/", "CC BY-SA 4.0"), ". LearnZì's dictionary file is a derived work under the same licence."),
      h("p", null, "Spaced repetition: the FSRS-4.5 memory model from the Open Spaced Repetition project (MIT), written into LearnZì from its published formulas."),
      h("p", null, "Stroke order: ", a("https://hanziwriter.org/", "Hanzi Writer"), " (MIT). Stroke shapes: ", a("https://github.com/skishore/makemeahanzi", "Make Me a Hanzi"),
        " from Arphic fonts (Arphic Public License). Character stories: Make Me a Hanzi dictionary (GNU LGPL 3)."),
      h("p", null, "Example sentences: ", a("https://tatoeba.org/", "Tatoeba"), " contributors (CC BY 2.0 FR); each sentence links to its page."),
      h("p", null, "Recordings: ", a("https://github.com/hugolpz/audio-cmn", "audio-cmn"), " by Hugo Lopez (PLIDAM, INALCO); syllables spoken by Chen Wang, HSK words by Yue Tan (from Shtooka / SWAC). Licensed ",
        a("https://creativecommons.org/licenses/by-sa/4.0/", "CC BY-SA"), "."),
      h("p", null, "Grammar: ", a("https://resources.allsetlearning.com/chinese/grammar/", "AllSet Learning Chinese Grammar Wiki"), " ©2021 AllSet Learning, licensed ",
        a("https://creativecommons.org/licenses/by-nc-sa/3.0/", "CC BY-NC-SA 3.0"), " (non-commercial). LearnZì's grammar files are a converted copy (October 2023 edition) under the same licence."),
      h("p", null, "HSK 3.0 word list (2025 syllabus): ", a("https://hearmandarin.com/datasets/", "HearMandarin"), " (CC BY 4.0). Older HSK 2.0 levels: hsk-words (MIT). Word frequencies: jieba (MIT). Fonts: Google Fonts (SIL Open Font License); pixel Chinese font ",
        a("https://github.com/ACh-K/Cubic-11", "Cubic 11"), " (SIL Open Font License)."),
      h("p", null, "App code: MIT licence. No trackers, analytics or ads."))));
  return v;
}

/** Tone colour presets plus one colour picker per tone (changing a picker makes a custom set). */
function toneEditor() {
  const box = h("div", { class: "tone-editor" });
  const current = () => {
    const css = getComputedStyle(document.documentElement);
    return [1, 2, 3, 4, 5].map(i => {
      const v = css.getPropertyValue("--t" + i).trim();
      return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : "#888888";
    });
  };
  const preset = h("select", { id: "tonepalette", "aria-label": "Tone colour set" });
  for (const [k, p] of Object.entries(TONE_PALETTES)) { const o = h("option", { value: k }, p.label); if (k === state.tonePalette) o.selected = true; preset.append(o); }
  const customOpt = h("option", { value: "custom" }, "Your own colours");
  if (state.tonePalette === "custom") customOpt.selected = true;
  preset.append(customOpt);
  const pickers = h("div", { class: "row tone-pickers" });
  const draw = () => {
    pickers.replaceChildren();
    const now = current();
    ["ā 1st", "á 2nd", "ǎ 3rd", "à 4th", "a neutral"].forEach((label, i) => {
      const inp = h("input", { type: "color", id: "tone" + (i + 1), "aria-label": label.split(" ")[1] + " tone colour" });
      inp.value = now[i];
      inp.addEventListener("input", () => {
        const colors = current();
        colors[i] = inp.value.toLowerCase();
        state.tonePalette = "custom"; state.toneColors = colors; preset.value = "custom";
        applyLook();
      });
      inp.addEventListener("change", () => commit({ tonePalette: "custom", toneColors: current() }));
      pickers.append(h("label", { class: "tone-pick", for: "tone" + (i + 1) }, inp, h("span", { class: "t" + (i + 1) }, label.split(" ")[0])));
    });
  };
  preset.addEventListener("change", () => {
    if (preset.value === "custom") commit({ tonePalette: "custom", toneColors: current() });
    else commit({ tonePalette: preset.value });
    applyLook();
    draw();
  });
  draw();
  box.append(h("div", { class: "set-row" }, h("div", { class: "set-label" }, h("label", { for: "tonepalette" }, "Tone colour set")), preset), pickers);
  return box;
}

/** The current theme's main colours as hex, used to start a custom theme. */
/** Settings → Box layout: put boxes back how they were. */
function boxLayoutRow() {
  return h("div", { class: "stack-tight box-layout" },
    h("span", { class: "muted small" }, "Applies to every page and the word pop-up."),
    h("div", { class: "row" },
      h("button", { class: "btn small", type: "button", onclick: () => { commit({ order: {} }); render(false); renderPanel(); toast("Every box is back in its original place"); } }, "Original order"),
      h("button", { class: "btn small", type: "button", onclick: () => { commit({ hidden: {} }); render(false); renderPanel(); toast("Removed boxes are back"); } }, "Show removed boxes"),
      h("button", { class: "btn small", type: "button", onclick: () => { commit({ folds: {} }); render(false); renderPanel(); toast("Every box is open"); } }, "Open all boxes"),
      h("button", { class: "btn small", type: "button", onclick: () => { commit({ order: {}, hidden: {}, folds: {} }); render(false); renderPanel(); toast("Boxes are back to how they started"); } }, "Reset all boxes")));
}
function currentColors() {
  const hex = c => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
    return m ? "#" + [m[1], m[2], m[3]].map(x => Number(x).toString(16).padStart(2, "0")).join("") : "#888888";
  };
  return { bg: hex(cssColor("--bg", "")), surface: hex(cssColor("--surface", "")), ink: hex(cssColor("--ink", "")), accent: hex(cssColor("--accent", "")),
    base: state.preset === "custom" ? state.custom.base : (SHAPE_BASES.includes(state.preset) ? state.preset : "ink") };
}
function customEditor() {
  const box = h("div", { class: "custom-editor" });
  const warn = h("p", { class: "small warn", "aria-live": "polite" });
  const check = () => {
    const c = state.custom, msgs = [];
    if (contrast(c.ink, c.bg) < 4.5 || contrast(c.ink, c.surface) < 4.5) msgs.push("Text may be hard to read: pick a text colour that stands out more from the background and cards.");
    if (contrast(c.accent, c.surface) < 2.2) msgs.push("The accent is hard to see on cards.");
    warn.textContent = msgs.join(" ");
    warn.hidden = !msgs.length;
  };
  const picker = (key, label) => {
    const inp = h("input", { type: "color", id: "custom-" + key });
    inp.value = state.custom[key];
    inp.addEventListener("input", () => { state.custom = { ...state.custom, [key]: inp.value.toLowerCase() }; applyLook(); check(); });
    inp.addEventListener("change", () => commit({ custom: { ...state.custom, [key]: inp.value.toLowerCase() } }));
    return h("label", { class: "custom-pick", for: "custom-" + key }, inp, h("span", { class: "small" }, label));
  };
  const base = h("select", { id: "custom-base" });
  for (const k of SHAPE_BASES.filter(k => !BONUS_THEMES[k] || unlocked(BONUS_THEMES[k]))) { const o = h("option", { value: k }, PRESETS[k].label); if (k === state.custom.base) o.selected = true; base.append(o); }
  base.addEventListener("change", () => { commit({ custom: { ...state.custom, base: base.value } }); applyLook(); });
  box.append(
    h("div", { class: "row custom-picks" }, picker("bg", "Background"), picker("surface", "Cards"), picker("ink", "Text"), picker("accent", "Accent")),
    h("div", { class: "set-row" }, h("div", { class: "set-label" }, h("label", { for: "custom-base" }, "Shapes and scene from"),
      h("span", { class: "muted small" }, "Which theme's edges and background picture to use")), base),
    warn);
  check();
  return box;
}
