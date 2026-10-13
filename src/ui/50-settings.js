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

function viewSettings() {
  const v = h("section", { class: "view" });
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
      h("span", { class: "hz font-demo" }, "学习汉字 · 學習漢字")),
    row("uifont", "English font", select("uifont", UIFONTS, state.uiFont, k => { commit({ uiFont: k }); applyLook(); }),
      "Menus, buttons, headings and meanings"),
    row("scale", "Text size", h("div", { class: "row" }, scale, scaleOut))));

  // Study
  const perDay = h("select", { id: "newperday" });
  for (const n of [5, 10, 15, 20, 30]) { const o = h("option", { value: String(n) }, n + " a day"); if (n === state.newPerDay) o.selected = true; perDay.append(o); }
  perDay.addEventListener("change", () => commit({ newPerDay: Number(perDay.value) }));
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Flashcards"),
    row("newperday", "New cards", perDay, "How many new cards to start each day"),
    row("listen", "Listening cards", toggleCtl("listen", state.listen, on => commit({ listen: on })), "Turn off where you can't play sound"),
    row("writing", "Writing cards", toggleCtl("writing", state.writing, on => commit({ writing: on })), "Write words from memory once you know them (12 days)"),
    row("drawchars", "Draw characters on cards", toggleCtl("drawchars", state.drawChars, on => commit({ drawChars: on })), "Each card's characters quickly draw themselves, stroke by stroke"),
    row("autoplay", "Play sound automatically", toggleCtl("autoplay", state.autoplay, on => commit({ autoplay: on })), "When a card's answer is shown"),
    row("sounds", "Level-up sound", toggleCtl("sounds", state.sounds, on => commit({ sounds: on })), "A soft gong when you reach a new Zì level"),
    h("p", { class: "muted small" }, "Meaning cards come first. Listening cards unlock once you remember a word for 3 days, Recall cards (English to Chinese) at 8 days, and Writing cards (if switched on) at 12 days.")));

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
    row("voice", "Voice", seg("voice", [["auto", "Automatic"], ["word", "Recording"], ["syllables", "Syllables"], ["browser", "Browser"]], state.voiceSrc, k => { commit({ voiceSrc: k }); for (const b of document.querySelectorAll(".voice-src")) if (b.voiceShow) b.voiceShow(); }),
      "Automatic: a native speaker's recording of the whole word when there is one, otherwise the word built from recorded syllables; long sentences use the browser voice when your device has a Chinese one. Pick one to hear it first everywhere. The speaker beside any Listen button flicks through them too."),
    row("rate", "Browser voice speed", h("div", { class: "row" }, rate, rateOut)),
    h("div", { class: "row" }, withVoice(h("button", { class: "btn", type: "button", onclick: () => speak("你好，我在学习汉语。") }, icon("play"), "Test voice"), { text: "你好，我在学习汉语。" }),
      h("span", { class: "muted small", id: "voice-note" }, voiceNote()))));

  // Box layout, then Reset: replay the tour and the factory reset (51-reset)
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Box layout"), boxLayoutRow()));
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
