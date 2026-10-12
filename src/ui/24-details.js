/* LearnZì UI, part 3c: extra word details in the word panel. Each can be switched off in
 * Settings → Word details: pronunciation tips, stroke order and writing practice, character
 * stories, words that use a character, how common a word is, example sentences and your notes. */

const DETAILS = {
  tips: "Pronunciation tips", write: "Stroke order and writing", story: "Character stories",
  words: "Words that use this character", freq: "How common a word is", examples: "Example sentences", notes: "My notes",
};
const showDetail = k => state.details[k] !== false;

// ---------- how common ----------
function freqBadge(e) {
  let { level, label } = Engine.commonness(e);
  if (level < 4 && WELCOME.some(([s, p]) => s === e.s && p === e.p)) { level = 4; label = "Very common"; }
  return h("span", { class: "badge freq", title: "How often this word appears in everyday Chinese" },
    h("span", { class: "freq-dots", "aria-hidden": "true" }, [1, 2, 3, 4].map(i => h("i", { class: i <= level ? "on" : null }))), label);
}

// ---------- pronunciation tips (tone changes in speech) ----------
function pronunciationTip(e) {
  const sylls = e.p.split(/\s+/);
  const chars = [...e.s];
  if (sylls.length !== chars.length || sylls.length < 1) return null;
  const tones = sylls.map(s => Number((/([1-5])$/.exec(s) || [0, 0])[1]));
  const said = tones.slice();
  const notes = [];
  for (let i = 0; i < chars.length - 1; i++) {
    const next = tones[i + 1];
    if (chars[i] === "不" && tones[i] === 4 && next === 4) { said[i] = 2; notes.push("不 bù is said bú before a 4th tone."); }
    if (chars[i] === "一" && tones[i] === 1 && chars[i - 1] !== "第" && !/[一二三四五六七八九十百千万零]/.test(chars[i + 1])) {
      if (next === 4) { said[i] = 2; notes.push("一 yī is said yí before a 4th tone."); }
      else if (next >= 1 && next <= 3) { said[i] = 4; notes.push("一 yī is said yì before tones 1, 2 and 3."); }
    }
  }
  for (let i = 0; i < tones.length - 1; i++) {
    if (tones[i] === 3 && tones[i + 1] === 3) {
      said[i] = 2;
      if (!notes.some(n => n.startsWith("Two 3rd"))) notes.push("Two 3rd tones in a row: the first one rises, like a 2nd tone.");
    }
  }
  if (tones.includes(5) && tones.length > 1) notes.push("The " + (tones[tones.length - 1] === 5 ? "last syllable is" : "unmarked syllable is") + " said lightly and quickly (neutral tone).");
  if (!notes.length) return null;
  const changed = said.some((t, i) => t !== tones[i]);
  const saidPy = sylls.map((s, i) => s.replace(/[1-5]$/, String(said[i]))).join(" ");
  return h("div", { class: "tip" },
    h("span", { class: "eyebrow" }, "Pronunciation tip"),
    changed ? h("p", null, "Said as ", pyEl(saidPy, "py tip-py"), " ",
      h("button", { class: "btn icon", type: "button", "aria-label": "Listen slowly", title: "Listen slowly", onclick: () => speakSlow(e.s) }, icon("play"))) : null,
    notes.map(n => h("p", { class: "muted small" }, n)));
}
function speakSlow(text, p) { speak(text, p, { slow: true }); }

// ---------- stroke order and writing practice ----------
let panelWriter = null;
function writeSection(e0) {
  const chars = [...disp(e0)].filter(c => Engine.isCJK(c));
  if (!chars.length) return null;
  if (ui.writeIdx >= chars.length) ui.writeIdx = 0;
  const ch = chars[ui.writeIdx || 0];
  const box = h("div", { class: "writer-box", "aria-label": "Stroke order for " + ch, role: "img" });
  const status = h("p", { class: "muted small writer-status", "aria-live": "polite" }, "");
  const sec = h("section", { class: "write" },
    h("div", { class: "row spread" }, h("span", { class: "eyebrow" }, "Stroke order"), h("span", { class: "muted small num stroke-count" }, "")),
    chars.length > 1 ? h("div", { class: "seg char-pick", role: "group", "aria-label": "Character" }, chars.map((c, i) =>
      h("button", { type: "button", class: "hz", "aria-pressed": String(i === (ui.writeIdx || 0)), onclick: () => { ui.writeIdx = i; renderPanel(); } }, c))) : null,
    box, status);
  if (!writerReady()) {
    box.classList.add("missing");
    box.append(h("span", { class: "hz" }, ch));
    status.textContent = "Stroke animations couldn't load. They need cdn.jsdelivr.net, which may be blocked on this network.";
    return sec;
  }
  let strokes = 0;
  const setCount = n => { const el = sec.querySelector(".stroke-count"); if (el) el.textContent = n + (n === 1 ? " stroke" : " strokes"); };
  CharData.strokes(ch).then(d => {
    if (!d) { status.textContent = "No stroke data for this character."; return; }
    strokes = d.strokes.length;
    setCount(strokes);
  });
  const size = Math.min(240, Math.max(170, Math.round((wide.matches ? 300 : window.innerWidth - 120))));
  let writer = makeWriter(box, ch, size);
  panelWriter = writer;
  const fresh = (extra) => { box.replaceChildren(); writer = makeWriter(box, ch, size, extra); panelWriter = writer; return writer; };
  const btn = (label, fn, cls) => h("button", { class: "btn" + (cls ? " " + cls : ""), type: "button", onclick: fn }, label);
  let step = 0;
  const controls = h("div", { class: "row writer-controls" },
    btn("Play", () => { fresh().animateCharacter({ onComplete: () => { status.textContent = ""; } }); status.textContent = "Watch the order of the strokes."; }, "primary"),
    btn("Step", () => {
      if (!strokes) return;
      if (step === 0) fresh({ showCharacter: false });
      writer.animateStroke(step);
      step++;
      status.textContent = "Stroke " + step + " of " + strokes + (step === strokes ? ". Tap Step to start again." : "");
      if (step === strokes) step = 0;
    }),
    btn("Loop", () => { fresh().loopCharacterAnimation(); status.textContent = "Looping. Tap Play or Step to stop."; }),
    btn("Trace", () => {
      fresh({ showCharacter: false, showOutline: true });
      status.textContent = "Trace each stroke over the outline, in order.";
      writer.quiz({ showHintAfterMisses: 2, onCorrectStroke: s => { status.textContent = "Stroke " + (s.strokeNum + 1) + " of " + strokes; },
        onComplete: s => { status.textContent = s.totalMistakes ? "Done, with " + s.totalMistakes + (s.totalMistakes === 1 ? " slip." : " slips.") : "Perfect tracing!"; } });
    }),
    btn("From memory", () => {
      fresh({ showCharacter: false, showOutline: false });
      status.textContent = "Write it without the outline. A hint appears after 3 misses.";
      writer.quiz({ showHintAfterMisses: 3, onCorrectStroke: s => { status.textContent = "Stroke " + (s.strokeNum + 1) + " of " + strokes; },
        onComplete: s => {
          const good = s.totalMistakes <= Math.max(1, Math.floor(strokes / 4));
          status.textContent = good ? "Written from memory! +3 XP" + (s.totalMistakes ? " (" + s.totalMistakes + " slips)" : "") : "Finished with " + s.totalMistakes + " slips. Try again for XP.";
          if (good) gainBonus(3);
        } });
    }));
  sec.append(controls);
  return sec;
}

// ---------- characters: meaning, story, parts ----------
const STORY_TYPE = { pictographic: "Picture", ideographic: "Idea", pictophonetic: "Meaning + sound" };
function charactersSection(e0) {
  const chars = Engine.chars(disp(e0));
  if (!chars.length) return null;
  const single = chars.length === 1 && [...disp(e0)].length === 1;
  const sec = h("div", { class: "chars", "data-fold-id": "pv-character" }, h("span", { class: "eyebrow" }, single ? "Character story" : "Characters"));
  for (const c of chars) {
    const storyBox = h("div", { class: "story small" });
    const row = h("div", { class: "char-card" },
      h("button", { class: "char-row", type: "button", disabled: single, onclick: () => pushWord(c.ch) },
        c.entry ? rubyHz(c.ch, c.entry.p) : h("span", { class: "hz" }, c.ch),
        h("span", { class: "def" }, c.entry ? shortDef(c.entry, single ? 3 : 1) : "Not in the dictionary")),
      showDetail("story") ? storyBox : null);
    sec.append(row);
    if (!showDetail("story")) continue;
    CharData.story(c.ch).then(s => {
      if (!s || !storyBox.isConnected) return;
      const [type, hint, semantic, phonetic, radical] = s;
      const part = (ch, role) => {
        const e = Engine.lookup(ch)[0];
        return h("button", { class: "chip part", type: "button", onclick: () => pushWord(ch) }, h("span", { class: "hz" }, ch),
          h("span", { class: "muted" }, role + (e ? ": " + (role === "sound" ? Engine.toMarks(e.p) : plainSense(Engine.senses(e)[0] || "")) : "")));
      };
      storyBox.append(
        type ? h("span", { class: "badge" }, STORY_TYPE[type] || type) : null,
        hint ? h("span", null, " " + hint.charAt(0).toUpperCase() + hint.slice(1) + (/[.!?]$/.test(hint) ? "" : ".")) : null,
        (semantic || phonetic || (radical && radical !== c.ch)) ? h("div", { class: "row parts" },
          semantic && semantic !== c.ch ? part(semantic, "meaning") : null,
          phonetic && phonetic !== c.ch ? part(phonetic, "sound") : null,
          radical && radical !== c.ch && radical !== semantic ? part(radical, "radical") : null) : null);
    });
  }
  return sec;
}

// ---------- words that use this character ----------
function wordsWithSection(e0) {
  const chars = [...e0.s];
  if (chars.length !== 1) return null;
  const words = Engine.wordsWith(e0.s, 8);
  if (!words.length) return null;
  return h("div", { class: "stack-tight" }, h("span", { class: "eyebrow" }, "Words with " + disp(e0)),
    h("div", { class: "row chips" }, words.map(w => h("button", { class: "chip", type: "button", title: shortDef(w, 1), onclick: () => pushWord(w.s) }, rubyHz(disp(w), w.p)))));
}

// ---------- example sentences (Tatoeba, CC BY 2.0 FR) ----------
function examplesSection(e0) {
  const box = h("div", { class: "examples" }, h("span", { class: "eyebrow" }, "Examples"));
  const list = h("div", { class: "stack-tight" }, h("p", { class: "muted small" }, "Finding examples…"));
  box.append(list);
  CharData.allSentences().then(all => {
    if (!list.isConnected) return;
    const forms = [e0.s, e0.t];
    const found = [];
    for (const row of all) {
      if (!forms.some(f => row[1].includes(f))) continue;
      if (Engine.segment(row[1]).some(sg => forms.includes(sg.text))) found.push(row);
      if (found.length >= 3) break;
    }
    list.replaceChildren();
    if (!found.length) { list.append(h("p", { class: "muted small" }, "No short example sentences for this word yet.")); return; }
    for (const [zid, zh, , en] of found) {
      const line = h("div", { class: "ex-zh hz", lang: "zh" });
      drawReader(line, zh);
      line.addEventListener("click", ev => { const b = ev.target.closest(".w"); if (b) pushWord(b.dataset.form); });
      list.append(h("div", { class: "example" }, line,
        h("div", { class: "row spread" }, h("span", { class: "muted small" }, en),
          h("span", { class: "row ex-tools" },
            h("button", { class: "btn icon", type: "button", "aria-label": "Listen to this sentence", onclick: () => speak(zh) }, icon("play")),
            h("a", { class: "small muted", href: "https://tatoeba.org/en/sentences/show/" + zid, target: "_blank", rel: "noopener noreferrer", title: "Sentence from Tatoeba (CC BY 2.0 FR)" }, "Tatoeba")))));
    }
  });
  return box;
}

// ---------- my notes ----------
let noteTimer = 0;
function notesSection(e0) {
  const key = keyOf(e0);
  const ta = h("textarea", { id: "note-input", class: "note", rows: "3", maxlength: "300", placeholder: "A memory trick, a sentence you heard, anything that helps…" });
  ta.value = state.notes[key] || "";
  ta.addEventListener("input", () => {
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      const notes = { ...state.notes };
      const text = ta.value.slice(0, 300);
      if (text.trim()) notes[key] = text; else delete notes[key];
      commit({ notes });
    }, 600);
  });
  return h("div", { class: "stack-tight" }, h("label", { class: "eyebrow", for: "note-input" }, "My notes"), ta);
}
