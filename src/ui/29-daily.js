/* LearnZì UI, part 5a2: Home's sentence of the day. One short beginner sentence a day (HSK 1–2 words),
 * picked from tools/build_daily.py's list of Tatoeba sentences (CC BY 2.0 FR). */

let dailyList = null;
function loadDaily() {
  if (!dailyList) {
    dailyList = fetch("daily.txt").then(r => (r.ok ? r.text() : "")).then(t => t.split("\n").map(l => l.split("\t"))
      .filter(c => c.length === 4 && /^\d+$/.test(c[0]))).catch(() => []);
  }
  return dailyList;
}
function dailyBox() {
  const line = h("div", { class: "ex-zh hz daily-zh", lang: "zh" }, h("span", { class: "muted small" }, "Loading…"));
  const en = h("p", { class: "daily-en", hidden: true });
  const reveal = h("button", { class: "btn small", type: "button", onclick: () => { en.hidden = !en.hidden; reveal.textContent = en.hidden ? "Show English" : "Hide English"; } }, "Show English");
  const listen = h("button", { class: "btn icon", type: "button", "aria-label": "Listen to the sentence", disabled: true }, icon("play"));
  const credit = h("a", { class: "small muted", target: "_blank", rel: "noopener noreferrer", title: "Sentence from Tatoeba (CC BY 2.0 FR)" }, "Tatoeba");
  const box = h("div", { class: "card stack daily-card" },
    h("div", { class: "row spread" }, h("span", { class: "eyebrow" }, "Sentence of the day"), listen),
    line, h("div", { class: "row spread" }, reveal, credit), en);
  loadDaily().then(list => {
    if (!list.length) { line.replaceChildren(h("span", { class: "muted small" }, "No sentence today.")); return; }
    const day = Math.floor((clock() - 4 * 3600e3 - new Date(clock()).getTimezoneOffset() * 60e3) / 86400e3);
    const [zid, zh, , english] = list[((day % list.length) + list.length) % list.length];
    drawReader(line, zh);
    line.addEventListener("click", ev => { const b = ev.target.closest(".w"); if (b) openWord(b.dataset.form); });
    en.textContent = english;
    credit.href = "https://tatoeba.org/en/sentences/show/" + zid;
    listen.disabled = false;
    listen.addEventListener("click", () => speak(zh));

  });
  return box;
}
