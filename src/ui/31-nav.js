/* LearnZì UI, part 4b: the main tabs. Home · Study · Tools · My Zì. Study and Tools open a small
 * menu (above the tab bar on phones, beside the side rail on wide screens). New tools go in NAV_MENUS. */

const NAV_MENUS = {
  study: [
    { zh: "学", label: "Study now", sub: () => { const p = ui.dict === "ready" ? studyPlan() : null; const n = p ? p.due.length + p.fresh.length : 0; return n ? n + (n === 1 ? " card ready" : " cards ready") : "All caught up"; },
      run: () => { const p = ui.dict === "ready" ? studyPlan() : null; if (p && p.due.length + p.fresh.length) startStudy(); else { toast("All caught up. Pick a deck to add new words."); go("decks"); } } },
    { zh: "卡", label: "Decks", sub: () => "Flashcard decks and word lists", run: () => go("decks") },
    { zh: "查", label: "Look up", sub: () => "Characters, pinyin or English", run: () => go("lookup") },
  ],
  tools: [
    { zh: "读", label: "Reader", sub: () => "Paste or import Chinese, tap any word", run: () => go("reader") },
    { zh: "看", label: "Watch", sub: () => "Videos with Chinese subtitles", run: () => { setWatchTab("video"); go("watch"); } },
    { zh: "听", label: "Listen", sub: () => "Audiobooks that follow along", run: () => { setWatchTab("audio"); go("watch"); } },
    { zh: "拍", label: "Photo to words", sub: () => "Read Chinese in a photo, make a deck", run: () => go("photo") },
    { zh: "声", label: "Tone trainer", sub: () => "Hear a word, pick its tones", run: () => { drill.active = false; go("tones"); } },
  ],
};
// Which tab lights up for each page.
const NAV_TAB = { home: "home", lookup: "study", decks: "study", deck: "study", study: "study", reader: "tools", photo: "tools", watch: "tools", tones: "tools", myzi: "myzi", mycards: "myzi", stats: "myzi", me: "myzi" };

function closeNavMenu() {
  const m = $("#navmenu");
  if (!m) return false;
  m.remove();
  document.querySelectorAll(".nav button[data-menu]").forEach(b => b.setAttribute("aria-expanded", "false"));
  deskNavMaybeHide();
  return true;
}
function openNavMenu(btn) {
  const key = btn.dataset.menu;
  const wasOpen = btn.getAttribute("aria-expanded") === "true";
  closeNavMenu();
  if (wasOpen) return;
  const items = (mleOn() ? NAV_MENUS_MLE : NAV_MENUS)[key].map(it => h("button", { class: "navmenu-item", type: "button", role: "menuitem", onclick: () => { closeNavMenu(); it.run(); } },
    h("span", { class: "ico hz", "aria-hidden": "true" }, it.zh),
    h("span", { class: "navmenu-text" }, h("b", null, it.label), h("span", { class: "muted small" }, it.sub()))));
  const menu = h("div", { class: "navmenu", id: "navmenu", role: "menu", "aria-label": btn.textContent.replace(/^\S+/, "").trim() || key }, items);
  document.body.append(menu);
  btn.setAttribute("aria-expanded", "true");
  // Place it next to its tab: above the bar on phones, to the right of the rail on wide screens.
  const r = btn.getBoundingClientRect();
  const rail = window.matchMedia("(min-width: 760px)").matches;
  if (rail) {
    menu.style.left = (r.right + 8) + "px";
    menu.style.top = Math.min(r.top, window.innerHeight - menu.offsetHeight - 12) + "px";
  } else {
    const left = Math.max(10, Math.min(r.left + r.width / 2 - menu.offsetWidth / 2, window.innerWidth - menu.offsetWidth - 10));
    menu.style.left = left + "px";
    menu.style.bottom = (window.innerHeight - r.top + 10) + "px";
  }
  menu.classList.add(rail ? "from-rail" : "from-bar");
  const first = menu.querySelector(".navmenu-item");
  if (first) first.focus({ preventScroll: true });
}
function setupNav() {
  document.querySelectorAll(".nav button").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.menu) openNavMenu(b);
    else { closeNavMenu(); go(b.dataset.view); }
  }));
  // Tap anywhere else to close an open menu.
  document.addEventListener("pointerdown", ev => {
    if ($("#navmenu") && !ev.target.closest("#navmenu, .nav button[data-menu]")) closeNavMenu();
  }, true);
  window.addEventListener("resize", closeNavMenu);
  window.addEventListener("resize", fitClockMinis);
}
function markNav() {
  const tab = NAV_TAB[ui.view];
  document.querySelectorAll(".nav button").forEach(b => {
    const here = (b.dataset.view || b.dataset.menu) === tab;
    if (here) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
}
