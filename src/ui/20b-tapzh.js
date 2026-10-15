/* LearnZì UI, part 3b: tap any Chinese. Tapping Chinese text anywhere in the app (page titles like
 * 主页, ranks, the clock's date, scrolls, grammar, quest names, sentences) opens the word pop-up for the
 * word under your finger. Things that already do something when tapped keep doing it: buttons and
 * links (word chips, the bottom tabs 家 学 具 字, flashcard characters that play their sound), inputs,
 * the secret lock, and anything marked data-notap. Inside the word pop-up, the word opens on top. */

const TAP_SKIP = "button, a, input, textarea, select, label, summary, [role=button], [contenteditable], [data-notap], .nav, #levelup, #tour, .secret, .glitch, .jsheet";
const CJK_CHAR = /[㐀-䶿一-鿿豈-﫿]/;

/** The text node and character offset under a point, or null. */
function textAtPoint(x, y) {
  try {
    if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (p && p.offsetNode) return { node: p.offsetNode, at: p.offset }; }
    if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (r) return { node: r.startContainer, at: r.startOffset }; }
  } catch { /* not supported here */ }
  return null;
}
/** The dictionary word in `text` around character index `at` (a run of Chinese, split into words). */
function wordInText(text, at) {
  let a = Math.min(at, text.length), b = a;
  if (!CJK_CHAR.test(text[a] || "") && CJK_CHAR.test(text[a - 1] || "")) a = b = a - 1;   // tapped just after a character
  if (!CJK_CHAR.test(text[a] || "")) return null;
  while (a > 0 && CJK_CHAR.test(text[a - 1])) a--;
  while (b < text.length && CJK_CHAR.test(text[b])) b++;
  const run = text.slice(a, b), pos = at - a;
  let i = 0;
  for (const sg of Engine.segment(run)) {
    const end = i + sg.text.length;
    if (pos < end) return sg.entries.length ? sg.text : [...sg.text][0];
    i = end;
  }
  return null;
}
function tapChinese(ev) {
  if (ev.defaultPrevented || ev.button > 0 || ui.dict !== "ready") return;
  const t = ev.target;
  if (!(t instanceof Element) || t.closest(TAP_SKIP)) return;
  const sel = window.getSelection && window.getSelection();
  if (sel && !sel.isCollapsed) return;                       // selecting text, not tapping
  let word = null;
  // A word shown with its pinyin above (ruby): the whole word, even when the pinyin is tapped.
  const ruby = t.closest("ruby");
  if (ruby) { const hz = ruby.querySelector(".hz") || ruby; const s = [...hz.childNodes].filter(n => n.nodeName !== "RT").map(n => n.textContent).join(""); if (CJK_CHAR.test(s)) word = s.replace(/[^㐀-鿿豈-﫿]/g, ""); }
  if (!word) {
    const hit = textAtPoint(ev.clientX, ev.clientY);
    if (hit && hit.node && hit.node.nodeType === 3 && t.contains(hit.node)) word = wordInText(hit.node.textContent, hit.at);
  }
  if (!word) {                                                // SVG labels and the like: the element's own short text
    const own = (t.textContent || "").trim();
    if (own.length <= 12 && CJK_CHAR.test(own)) word = wordInText(own, own.search(CJK_CHAR));
  }
  if (!word || !Engine.lookup(word).length) return;
  if (t.closest("#panel")) pushWord(word); else openWord(word);
}
