/* LearnZì UI, part 6c: Sentence cards (fill the gap). Once you've known a word for 5 days, it gets a
 * Sentence card: a short example sentence (Tatoeba, CC BY 2.0 FR) with the word missing, its English,
 * and a hint of the meaning. Type the missing word (or think of it and show the answer).
 * Sentences are picked to be short and easy: written in your script (simplified or traditional), the
 * word appears once, at most one other word is uncommon, and the English uses one of the word's meanings
 * (so it really is that word in the sentence). Each review rotates between the best three.
 * The sentence file is fetched only once some word is ready for a Sentence card (or one is due). */

const Cloze = { rows: null, byChar: null, cache: new Map(), loading: null, failed: false, script: "" };
const CLOZE_MAX_CHARS = 18;

function clozeLoad() {
  if (Cloze.rows) return Promise.resolve(true);
  if (Cloze.loading) return Cloze.loading;
  Cloze.loading = CharData.allSentences().then(all => {
    if (!all || !all.length) { Cloze.failed = true; return false; }
    // Index the short sentences by character, so finding a word's sentences is quick.
    const byChar = new Map();
    all.forEach((r, i) => {
      if ([...r[1]].length > CLOZE_MAX_CHARS) return;
      for (const c of new Set(r[1])) if (Engine.isCJK(c)) { let a = byChar.get(c); if (!a) byChar.set(c, (a = [])); a.push(i); }
    });
    Cloze.rows = all; Cloze.byChar = byChar;
    return true;
  }).catch(() => { Cloze.failed = true; return false; }).finally(() => { Cloze.loading = null; });
  return Cloze.loading;
}
/** The form of the word in your script. */
const clozeForm = e => (state.script === "t" && e.t ? e.t : e.s);
/** Up to three good sentences for a word: [{id, zh, en, at}] (at = where the word starts). [] if none
 *  or the sentences aren't loaded. */
function clozeFor(e) {
  if (!Cloze.rows || ui.dict !== "ready") return [];
  if (Cloze.script !== state.script) { Cloze.cache.clear(); Cloze.script = state.script; }
  const form = clozeForm(e), key = form + "|" + e.p;
  if (Cloze.cache.has(key)) return Cloze.cache.get(key);
  const out = [];
  const chars = [...new Set(form)].filter(c => Engine.isCJK(c));
  if (chars.length) {
    const lists = chars.map(c => Cloze.byChar.get(c) || []);
    const list = lists.reduce((a, b) => (b.length < a.length ? b : a));
    const trad = state.script === "t", n = [...form].length;
    // The English must use one of the word's meanings, so the word really is the word in this sentence
    // (你好香 is "you smell nice", not "hello").
    const keys = new Set(Engine.senses(e).flatMap(x => enWords(x)));
    for (const i of list) {
      const [id, zh, , en] = Cloze.rows[i];
      const at = zh.indexOf(form);
      if (at < 0 || zh.indexOf(form, at + 1) >= 0 || [...zh].length < n + 2) continue;
      const segs = Engine.segment(zh);
      if (!segs.some(sg => sg.word && sg.text === form)) continue;
      let ok = true, hard = 0;
      for (const sg of segs) {
        if (!sg.word || sg.text === form) continue;
        const match = sg.entries.find(x => (trad ? x.t : x.s) === sg.text);
        if (!match) { ok = false; break; }                       // another script, or not in the dictionary
        if (Engine.commonness(match).level < 3) hard++;
      }
      if (!ok || hard > 1 || !enWords(en).some(w => keys.has(w))) continue;
      out.push({ id, zh, en, at });
      if (out.length >= 3) break;
    }
  }
  Cloze.cache.set(key, out);
  return out;
}
/** Can this word have a Sentence card right now? */
const clozeReady = e => !!Cloze.rows && clozeFor(e).length > 0;
/** The sentence for this review of the card (rotates with each review). */
function clozePick(k, e) {
  const list = clozeFor(e);
  if (!list.length) return null;
  const reps = (progress.cards[k] || [])[4] || 0;
  return list[reps % list.length];
}
/** After the dictionary loads: fetch the sentences if any word is ready for a Sentence card (or has
 *  one), then refresh the pages that count cards. */
function clozeWarm() {
  if (!state.sentenceCards || Cloze.rows || Cloze.failed || ui.dict !== "ready") return;
  const want = activeWords().some(e => {
    const base = cardBase(e), m = progress.cards[base + "|m"];
    return progress.cards[base + "|c"] || (m && m[7] === 2 && SRS.stability(m) >= UNLOCK.c);
  });
  if (!want) return;
  clozeLoad().then(ok => { if (ok && ["home", "myzi", "deck", "mycards"].includes(ui.view)) render(false); });
}
