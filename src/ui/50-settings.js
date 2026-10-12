/* LearnZì UI, part 6: Settings. */

function viewSettings() {
  const v = h("section", { class: "view" });
  const row = (id, label, control, hint) => h("div", { class: "set-row" },
    h("div", { class: "set-label" }, h("label", { for: id }, label), hint ? h("span", { class: "muted small" }, hint) : null), control);
  const toggleCtl = (id, on, change) => {
    const inp = h("input", { type: "checkbox", id, role: "switch" });
    inp.checked = on;
    inp.addEventListener("change", () => change(inp.checked));
    return h("span", { class: "toggle" }, inp, h("span"));
  };
  const seg = (id, opts, val, pick) => {
    const g = h("div", { class: "seg", role: "group", id });
    for (const [k, label] of opts) {
      g.append(h("button", { type: "button", "aria-pressed": String(k === val), onclick: ev => {
        g.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === ev.currentTarget)));
        pick(k);
      } }, label));
    }
    return g;
  };
  const select = (id, table, val, change) => {
    const s = h("select", { id });
    for (const [k, f] of Object.entries(table)) { const o = h("option", { value: k }, f.label); if (k === val) o.selected = true; s.append(o); }
    s.addEventListener("change", () => change(s.value));
    return s;
  };

  // Profile
  const nick = h("input", { type: "text", id: "nickname", maxlength: "24", placeholder: "Your name", autocomplete: "nickname", spellcheck: "false" });
  nick.value = state.nickname;
  let nickTimer = 0;
  const saveNick = () => { clearTimeout(nickTimer); const n = cleanLine(nick.value, 24); if (n !== state.nickname) commit({ nickname: n }); };
  nick.addEventListener("input", () => { clearTimeout(nickTimer); nickTimer = setTimeout(saveNick, 700); });
  nick.addEventListener("change", saveNick);
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Profile"),
    row("nickname", "Nickname", nick)));

  // Reading
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Reading"),
    row("script", "Characters", seg("script", [["s", "Simplified 简"], ["t", "Traditional 繁"]], state.script, k => { commit({ script: k }); renderPanel(); })),
    row("pinyin", "Show pinyin", toggleCtl("pinyin", state.pinyin, on => { commit({ pinyin: on }); applyLook(); }), "Small, above the characters, everywhere in the app"),
    row("tones", "Tone colours", toggleCtl("tones", state.tones, on => { commit({ tones: on }); applyLook(); }),
      h("span", { class: "tone-demo" }, pyEl("ma1 ma2 ma3 ma4 ma5"))),
    toneEditor()));

  // Look
  const sw = h("div", { class: "swatches", role: "group", "aria-label": "Theme" });
  for (const [key, p] of Object.entries(PRESETS)) {
    const dots = h("span", { class: "dots" });
    const colors = key === "custom" ? (state.custom ? [state.custom.bg, state.custom.accent, state.custom.surface, state.custom.ink] : []) : isAltMode(key) ? p.alt : p.dots;
    if (key === "custom" && !colors.length) dots.append(h("i", { class: "rainbow" }));
    colors.forEach(c => { const i = h("i"); i.style.background = c; dots.append(i); });
    const bonus = BONUS_THEMES[key];
    const locked = bonus && !state.unlockAll && levelNow().level < bonus.lv;
    sw.append(h("button", { class: "swatch" + (locked ? " locked" : ""), type: "button", disabled: locked, "aria-pressed": String(state.preset === key), onclick: () => {
      if (key === "custom" && !state.custom) commit({ custom: currentColors() });
      commit({ preset: key }); applyLook(); render(false);
    } }, dots, h("b", null, p.label), h("span", { class: "muted small" }, key === "custom" ? p.note : p.note + " · " + modeFor(key))));
  }
  const color = h("input", { type: "color", id: "accent", "aria-label": "Accent colour" });
  color.value = state.accent || (getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().match(/^#[0-9a-f]{6}$/i) || ["#c2362b"])[0];
  color.addEventListener("input", () => { state.accent = color.value.toLowerCase(); applyLook(); });
  color.addEventListener("change", () => commit({ accent: color.value.toLowerCase() }));
  const scaleOut = h("span", { class: "muted small num" }, Math.round(state.scale * 100) + "%");
  const scale = h("input", { type: "range", id: "scale", min: "85", max: "130", step: "5" });
  scale.value = String(Math.round(state.scale * 100));
  scale.addEventListener("input", () => { scaleOut.textContent = scale.value + "%"; document.documentElement.style.setProperty("--scale", String(scale.value / 100)); });
  scale.addEventListener("change", () => commit({ scale: scale.value / 100 }));
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Look"),
    h("span", { class: "eyebrow" }, "Theme"), sw,
    row("mode", "Light or dark", seg("mode", MODES, state.mode, k => { commit({ mode: k }); applyLook(); render(false); }),
      state.preset === "custom" ? "Custom uses the colours you pick, so this doesn't change it" : "Every theme has a light and a dark look. Theme's own uses the one it was made with."),
    state.preset === "custom" && state.custom ? customEditor() : null,
    state.preset === "custom" ? null : row("accent", "Accent colour", h("div", { class: "row" }, color,
      h("button", { class: "btn", type: "button", onclick: () => { commit({ accent: "" }); applyLook(); render(false); } }, "Reset"))),
    row("zen", "Background scene", toggleCtl("zen", state.zen, on => { commit({ zen: on }); applyLook(); }), "A faint scene behind the app that matches the theme"),
    h("div", { class: "stack-tight box-layout" }, h("b", null, "Box layout"),
      h("span", { class: "muted small" }, "Applies to every page and the word pop-up."),
      h("div", { class: "row" },
        h("button", { class: "btn small", type: "button", onclick: () => { commit({ order: {} }); render(false); renderPanel(); toast("Every box is back in its original place"); } }, "Original order"),
        h("button", { class: "btn small", type: "button", onclick: () => { commit({ hidden: {} }); render(false); renderPanel(); toast("Removed boxes are back"); } }, "Show removed boxes"),
        h("button", { class: "btn small", type: "button", onclick: () => { commit({ folds: {} }); render(false); renderPanel(); toast("Every box is open"); } }, "Open all boxes"),
        h("button", { class: "btn small", type: "button", onclick: () => { commit({ order: {}, hidden: {}, folds: {} }); render(false); renderPanel(); toast("Boxes are back to how they started"); } }, "Reset everything"))),
    row("shapes", "Theme shapes", toggleCtl("shapes", state.shapes, on => { commit({ shapes: on }); applyLook(); }), "Hand-drawn, soft, cut-corner, neon, pixel or polygon edges, plus theme fonts, depending on the theme"),
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
    row("autoplay", "Play sound automatically", toggleCtl("autoplay", state.autoplay, on => commit({ autoplay: on })), "When a card's answer is shown"),
    row("sounds", "Level-up sound", toggleCtl("sounds", state.sounds, on => commit({ sounds: on })), "A soft gong when you reach a new Zì level"),
    h("p", { class: "muted small" }, "Meaning cards come first. Listening cards unlock once you remember a word for 3 days, Recall cards (English to Chinese) at 8 days, and Writing cards (if switched on) at 12 days.")));

  // Word details
  const details = h("div", { class: "detail-toggles" }, Object.entries(DETAILS).map(([k, label]) =>
    row("d-" + k, label, toggleCtl("d-" + k, showDetail(k), on => { const d = { ...state.details }; if (on) delete d[k]; else d[k] = false; commit({ details: d }); renderPanel(); }))));
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Word details"),
    h("p", { class: "muted small" }, "What the word panel shows. Turn off anything you don't need."),
    details,
    h("span", { class: "eyebrow" }, "Stroke order"),
    row("strokespeed", "Animation speed", seg("strokespeed", [[0.5, "Slow"], [1, "Normal"], [2, "Fast"]], state.strokeSpeed, k => commit({ strokeSpeed: k }))),
    row("radical", "Highlight the radical", toggleCtl("radical", state.radical, on => commit({ radical: on })), "Draws the radical (the part that hints at meaning) in your accent colour")));

  // Voice
  const rateOut = h("span", { class: "muted small num" }, state.rate.toFixed(1) + "×");
  const rate = h("input", { type: "range", id: "rate", min: "5", max: "13", step: "1" });
  rate.value = String(Math.round(state.rate * 10));
  rate.addEventListener("input", () => { rateOut.textContent = (rate.value / 10).toFixed(1) + "×"; });
  rate.addEventListener("change", () => commit({ rate: rate.value / 10 }));
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Voice"),
    row("voice", "Voice", seg("voice", [["real", "Real recordings"], ["browser", "Browser voice"]], state.voice, k => commit({ voice: k })),
      "Real recordings are native speakers: whole words when there's a recording, otherwise the word built from recorded syllables. Long sentences use the browser voice when your device has a Chinese one."),
    row("rate", "Browser voice speed", h("div", { class: "row" }, rate, rateOut)),
    h("div", { class: "row" }, h("button", { class: "btn", type: "button", onclick: () => speak("你好，我在学习汉语。") }, icon("play"), "Test voice"),
      h("span", { class: "muted small", id: "voice-note" }, voiceNote()))));

  // Sync
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Sync"),
    h("p", { class: "muted", id: "sync-note" }, PILL[Sync.status][1]),
    h("p", { class: "muted small" }, "Synced: your nickname, My Zì, flashcard progress and XP, recent lookups, reader text and these settings. Stored privately for your account; nobody else can read them.")));

  // About
  const a = (href, text) => h("a", { href, target: "_blank", rel: "noopener noreferrer" }, text);
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "About"),
    h("div", { class: "credits" },
      h("p", null, "LearnZì · " + BUILD + " · " + (ui.dict === "ready" ? Engine.size.toLocaleString("en-GB") + " dictionary entries" : "dictionary loading")),
      h("p", null, "Dictionary: ", a("https://cc-cedict.org/wiki/", "CC-CEDICT"), " by MDBG and contributors, licensed ",
        a("https://creativecommons.org/licenses/by-sa/4.0/", "CC BY-SA 4.0"), ". LearnZì's dictionary file is a derived work under the same licence."),
      h("p", null, "Spaced repetition: the FSRS-4.5 memory model from the Open Spaced Repetition project (MIT), written into LearnZì from its published formulas."),
      h("p", null, "Stroke order: ", a("https://hanziwriter.org/", "Hanzi Writer"), " (MIT). Stroke shapes: ", a("https://github.com/skishore/makemeahanzi", "Make Me a Hanzi"),
        " from Arphic fonts (Arphic Public License). Character stories: Make Me a Hanzi dictionary (GNU LGPL 3)."),
      h("p", null, "Example sentences: ", a("https://tatoeba.org/", "Tatoeba"), " contributors (CC BY 2.0 FR); each sentence links to its page."),
      h("p", null, "Recordings: ", a("https://github.com/hugolpz/audio-cmn", "audio-cmn"), " by Hugo Lopez (PLIDAM, INALCO); syllables spoken by Chen Wang, HSK words by Yue Tan (from Shtooka / SWAC). Licensed ",
        a("https://creativecommons.org/licenses/by-sa/4.0/", "CC BY-SA"), "."),
      h("p", null, "HSK levels: hsk-words (MIT). Word frequencies: jieba (MIT). Fonts: Google Fonts (SIL Open Font License)."),
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
  for (const k of SHAPE_BASES) { const o = h("option", { value: k }, PRESETS[k].label); if (k === state.custom.base) o.selected = true; base.append(o); }
  base.addEventListener("change", () => { commit({ custom: { ...state.custom, base: base.value } }); applyLook(); });
  box.append(
    h("div", { class: "row custom-picks" }, picker("bg", "Background"), picker("surface", "Cards"), picker("ink", "Text"), picker("accent", "Accent")),
    h("div", { class: "set-row" }, h("div", { class: "set-label" }, h("label", { for: "custom-base" }, "Shapes and scene from"),
      h("span", { class: "muted small" }, "Which theme's edges and background picture to use")), base),
    warn);
  check();
  return box;
}
