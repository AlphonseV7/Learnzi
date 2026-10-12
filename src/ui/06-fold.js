/* LearnZì UI, part 1a: boxes that fold away. Tap a box's title bar to minimise it to just that bar,
 * tap again to open it. Each box remembers its state (synced), by name, so "Examples" stays folded
 * for every word until you open it again. */

let foldSeq = 0;
const FOLD_HEAD = "h2.h-card, .eyebrow";
const foldName = (prefix, text) => (prefix + "-" + text.toLowerCase().replace(/\d+/g, "").replace(/[^a-z]+/g, "-").replace(/^-+|-+$/g, "").replace(/s$/, "")).slice(0, 40);
function foldIsOpen(id, closedByDefault) {
  const f = state.folds || {};
  return Object.hasOwn(f, id) ? f[id] === 0 : !closedByDefault;
}
function setFolded(el, closed) {
  el.classList.toggle("closed", closed);
  const btn = el.querySelector(":scope > .fold-head .fold-btn");
  if (btn) btn.setAttribute("aria-expanded", String(!closed));
}

/** Turns a box whose first child is its heading (or a row starting with its heading) into a folding box. */
function foldBox(el, prefix, closedByDefault) {
  const first = el.firstElementChild;
  if (!first || el.classList.contains("fold")) return null;
  let title, extras = [];
  if (first.matches(FOLD_HEAD)) title = first;
  else if (first.matches(".row") && first.firstElementChild && first.firstElementChild.matches(FOLD_HEAD)) {
    title = first.firstElementChild;
    extras = [...first.children].slice(1);
  } else return null;
  const text = title.textContent;
  const id = el.dataset.foldId || foldName(prefix, text);
  if (title.tagName === "LABEL") {
    // A text box keeps its name when its label becomes the title bar.
    const target = title.htmlFor && el.querySelector("#" + CSS.escape(title.htmlFor));
    if (target) target.setAttribute("aria-label", text);
    const span = h("span", { class: title.className });
    span.append(...title.childNodes);
    title = span;
  }
  const rest = [...el.children].filter(c => c !== first);
  const open = foldIsOpen(id, closedByDefault.includes(id));
  const bodyId = "fold-" + (++foldSeq);
  const btn = h("button", { class: "fold-btn", type: "button", "aria-expanded": String(open), "aria-controls": bodyId },
    h("span", { class: "fold-chev", "aria-hidden": "true" }, icon("next")),
    h("span", { class: "fold-label" }, [...title.childNodes]));
  title.replaceChildren(btn);
  title.classList.add("fold-title");
  const grip = h("button", { class: "fold-grip", type: "button", "aria-label": "Move the " + text.trim() + " box (drag, or use the arrow keys)", title: "Drag to move" }, GRIP_SVG());
  // Settings and Debug boxes can't be removed, nor can search results (data-keep).
  const removable = !NO_REMOVE.includes(prefix) && !el.hasAttribute("data-keep");
  const remove = removable ? h("button", { class: "fold-remove", type: "button", "aria-label": "Remove the " + text.trim() + " box", title: "Remove this box",
    onclick: () => removeBox(el) }, icon("close")) : null;
  el.replaceChildren(
    h("div", { class: "fold-head" }, title, extras.length ? h("div", { class: "fold-extras row" }, extras) : null, grip, remove),
    h("div", { class: "fold-body", id: bodyId }, h("div", { class: "fold-inner" }, rest)));
  el.classList.add("fold");
  el.dataset.fold = id;
  el.dataset.page = prefix;
  setupGrip(grip, el);
  if (!open) el.classList.add("closed");
  btn.addEventListener("click", () => {
    const closed = !el.classList.contains("closed");
    setFolded(el, closed);
    commit({ folds: { ...state.folds, [id]: closed ? 1 : 0 } });
    if (el.closest("#pv")) updateFoldAll();
  });
  return el;
}
/** Folds every matching box inside a view or panel, then puts them in the order you arranged. */
function foldify(root, prefix, selector, closedByDefault = []) {
  const hidden = hiddenOn(prefix);
  for (const el of root.querySelectorAll(selector)) {
    foldBox(el, prefix, closedByDefault);
    if (el.dataset.fold && hidden.includes(el.dataset.fold) && !el.hasAttribute("data-keep")) el.remove();
  }
  applyOrder(root, prefix);
}
const NO_REMOVE = ["settings", "debug"];

// ---------- moving boxes ----------
const GRIP_SVG = () => sv("svg", { viewBox: "0 0 12 18", width: 12, height: 18, "aria-hidden": "true" },
  [3, 9].flatMap(x => [3, 9, 15].map(y => sv("circle", { cx: x, cy: y, r: 1.6, fill: "currentColor" }))));
const foldSiblings = el => [...el.parentElement.children].filter(c => c.classList.contains("fold") && c.dataset.page === el.dataset.page);
/** Known boxes take the slots known boxes already fill, in your saved order; new boxes stay where they are. */
function applyOrder(root, page) {
  const saved = state.order[page];
  if (!saved || !saved.length) return;
  const boxes = [...root.children].filter(c => c.classList.contains("fold") && c.dataset.page === page && saved.includes(c.dataset.fold));
  if (boxes.length < 2) return;
  const slots = boxes.map(b => { const mark = document.createComment("slot"); b.before(mark); return mark; });
  boxes.sort((a, b) => saved.indexOf(a.dataset.fold) - saved.indexOf(b.dataset.fold));
  slots.forEach((mark, i) => { mark.replaceWith(boxes[i]); });
}
function saveOrder(el) {
  const page = el.dataset.page;
  commit({ order: { ...state.order, [page]: foldSiblings(el).map(b => b.dataset.fold) } });
}
function moveBox(el, dir) {
  const sibs = foldSiblings(el), i = sibs.indexOf(el), j = i + dir;
  if (j < 0 || j >= sibs.length) return false;
  if (dir < 0) sibs[j].before(el); else sibs[j].after(el);
  return true;
}
function scroller(el) { return el.closest("#panel") ? $("#panel") : null; }
function setupGrip(grip, el) {
  grip.addEventListener("keydown", ev => {
    if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;
    ev.preventDefault();
    if (moveBox(el, ev.key === "ArrowUp" ? -1 : 1)) { saveOrder(el); grip.focus(); }
  });
  // Moving the box in the page drops the grip's pointer capture, so the drag listens on the whole document.
  let active = false, lastY = 0, timer = 0, ghost = null, start = null;
  // The ghost: a lifted copy of the box that follows the finger, while the box itself becomes an empty slot.
  const makeGhost = ev => {
    const r = el.getBoundingClientRect();
    ghost = el.cloneNode(true);
    ghost.removeAttribute("id");
    ghost.querySelectorAll("[id]").forEach(n => n.removeAttribute("id"));
    ghost.classList.remove("moving");
    ghost.classList.add("fold-ghost");
    ghost.setAttribute("aria-hidden", "true");
    Object.assign(ghost.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    document.body.append(ghost);
    start = { x: ev.clientX, y: ev.clientY };
    follow(ev);
  };
  const follow = ev => {
    if (!ghost) return;
    const dx = Math.max(-40, Math.min(40, ev.clientX - start.x)), dy = ev.clientY - start.y;
    ghost.style.transform = "translate(" + dx + "px, " + dy + "px) rotate(1.2deg) scale(1.02)";
  };
  const dropGhost = () => {
    const g = ghost; ghost = null;
    if (!g) return;
    const r = el.getBoundingClientRect(), calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const done = () => { g.remove(); el.classList.remove("moving"); };
    if (calm) { done(); return; }
    // Glide into the slot, then swap back to the real box.
    g.classList.add("landing");
    g.style.transform = "translate(" + (r.left - parseFloat(g.style.left)) + "px, " + (r.top - parseFloat(g.style.top)) + "px)";
    g.addEventListener("transitionend", done, { once: true });
    setTimeout(done, 260);
  };
  const place = () => {
    const sibs = foldSiblings(el);
    for (const other of sibs) {
      if (other === el) continue;
      const r = other.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const before = sibs.indexOf(other) < sibs.indexOf(el);
      if (before && lastY < mid) { other.before(el); return; }
      if (!before && lastY > mid) { other.after(el); return; }
    }
  };
  const move = ev => { if (!active) return; ev.preventDefault(); lastY = ev.clientY; follow(ev); place(); };
  const stop = () => {
    if (!active) return;
    active = false; clearInterval(timer);
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", stop);
    document.removeEventListener("pointercancel", stop);
    document.body.classList.remove("moving-box");
    saveOrder(el);
    dropGhost();
  };
  grip.addEventListener("pointerdown", ev => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    active = true; lastY = ev.clientY;
    makeGhost(ev);
    el.classList.add("moving");
    document.body.classList.add("moving-box");
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", stop);
    document.addEventListener("pointercancel", stop);
    if (navigator.vibrate) try { navigator.vibrate(12); } catch { /* not allowed here */ }
    // Near the top or bottom edge, keep scrolling so a box can travel down a long page.
    timer = setInterval(() => {
      if (!active) return;
      const box = scroller(el);
      const top = box ? box.getBoundingClientRect().top : 0, bottom = box ? box.getBoundingClientRect().bottom : window.innerHeight - (wide.matches ? 0 : 70);
      const step = lastY < top + 60 ? -12 : lastY > bottom - 60 ? 12 : 0;
      if (step) { if (box) box.scrollBy(0, step); else window.scrollBy(0, step); place(); }
    }, 30);
  });
}
// Views whose boxes fold. The study screen, tone trainer and reader stay as they are.
const FOLD_VIEWS = ["home", "lookup", "myzi", "decks", "deck", "stats", "me", "settings", "debug"];

/** The word pop-up's top bar: Fold all, and Bring back when some of its boxes were removed. */
function updatePvTools() {
  updateFoldAll();
  const tools = $("#pv .pv-tools");
  if (!tools) return;
  const old = tools.querySelector(".page-restore");
  if (old) old.remove();
  const gone = hiddenOn("pv").length;
  if (gone) tools.prepend(h("button", { class: "btn small page-restore", type: "button", title: "Bring back the " + gone + " removed box" + (gone === 1 ? "" : "es"),
    onclick: () => { commit({ hidden: { ...state.hidden, pv: [] } }); renderPanel(); } }, icon("back"), " " + gone));
}
/** "Open all" / "Fold all" for the word panel. */
function foldAllBtn() {
  const b = h("button", { class: "btn small fold-all", type: "button", onclick: () => {
    const boxes = [...document.querySelectorAll("#pv .fold")];
    const close = boxes.some(x => !x.classList.contains("closed"));
    const folds = { ...state.folds };
    for (const x of boxes) { setFolded(x, close); folds[x.dataset.fold] = close ? 1 : 0; }
    commit({ folds });
    updateFoldAll();
  } });
  return b;
}
function updateFoldAll() {
  const b = $("#pv .fold-all");
  if (!b) return;
  const anyOpen = [...document.querySelectorAll("#pv .fold")].some(x => !x.classList.contains("closed"));
  b.textContent = anyOpen ? "Fold all" : "Open all";
}
