/* LearnZì UI, part 4c: desktop layout (wide screen with a mouse). The top bar runs edge to edge; the
 * menu (left) and word details (right) hide off-screen and slide in when the mouse comes near their
 * edge, then slide away when it leaves. Opening a word slides the details in by itself. Both start just
 * below the top bar (--side-top follows its bottom edge as you scroll), so they never cover it. The thin
 * strips at the edges show a small arrow, and every 20 seconds a sheen runs down them until you've
 * opened each side a few times (counted on this device only).
 * Phones and touch tablets keep the tab bar and the bottom sheet. */

const desk = window.matchMedia("(min-width: 760px) and (hover: hover) and (pointer: fine)");
const deskSide = { nav: { timer: 0 }, panel: { timer: 0, pinned: false, entered: false } };

const EDGE_KEY = "learnzi.edges.v1", EDGE_KNOWN = 3;
function edgeUses() { try { return JSON.parse(localStorage.getItem(EDGE_KEY) || "{}") || {}; } catch { return {}; } }
function markEdges() {
  const u = edgeUses();
  for (const side of ["nav", "panel"]) document.documentElement.classList.toggle("edge-known-" + side, (u[side] || 0) >= EDGE_KNOWN);
}
function slideIn(el, side) {
  clearTimeout(deskSide[side].timer);
  if (!el.classList.contains("shown")) {
    const u = edgeUses();
    if ((u[side] || 0) < EDGE_KNOWN) { u[side] = (u[side] || 0) + 1; try { localStorage.setItem(EDGE_KEY, JSON.stringify(u)); } catch { /* fine */ } markEdges(); }
  }
  el.classList.add("shown");
}
/** Where the side bars start: just below the top bar, or the top of the screen once it has scrolled away. */
let sideFrame = 0;
function placeSides() {
  cancelAnimationFrame(sideFrame);
  sideFrame = requestAnimationFrame(() => {
    const t = $(".topbar");
    const top = desk.matches && t ? Math.max(0, Math.round(t.getBoundingClientRect().bottom)) : 0;
    document.documentElement.style.setProperty("--side-top", top + "px");
  });
}
function slideOut(el, side, delay = 350) {
  clearTimeout(deskSide[side].timer);
  deskSide[side].timer = setTimeout(() => {
    if (side === "nav" && ($("#navmenu") || el.matches(":hover") || el.contains(document.activeElement))) return;
    if (side === "panel" && (el.matches(":hover") || el.querySelector(".moving") || document.body.classList.contains("moving-box"))) return;
    el.classList.remove("shown");
  }, delay);
}
/** Called when a word opens: on desktop the details slide in and stay until you've been in and out. */
function deskShowPanel() {
  if (!desk.matches) return;
  const p = $("#panel");
  deskSide.panel.pinned = true; deskSide.panel.entered = p.matches(":hover");
  slideIn(p, "panel");
}
function deskHidePanel() { const p = $("#panel"); if (p) { clearTimeout(deskSide.panel.timer); p.classList.remove("shown"); } }
/** When a Study or Tools menu closes, the menu bar can slide away again. */
function deskNavMaybeHide() { if (desk.matches) slideOut($(".nav"), "nav", 250); }

function setupDesk() {
  const root = document.documentElement, nav = $(".nav"), panel = $("#panel");
  const apply = () => {
    root.classList.toggle("desk", desk.matches);
    if (!desk.matches) { nav.classList.remove("shown"); panel.classList.remove("shown"); }
    else if (panel.classList.contains("open")) $("#scrim").classList.remove("open");
  };
  apply();
  desk.addEventListener("change", () => { apply(); placeSides(); });
  markEdges();
  placeSides();
  window.addEventListener("scroll", placeSides, { passive: true });
  window.addEventListener("resize", placeSides);
  if (window.ResizeObserver && $(".topbar")) new ResizeObserver(placeSides).observe($(".topbar"));
  const edge = (side, cls, label) => {
    const e = h("div", { class: "edge " + cls, "aria-hidden": "true", title: label });
    document.body.append(e);
    return e;
  };
  const left = edge("nav", "edge-left", "Menu"), right = edge("panel", "edge-right", "Word details");
  // Left: the menu bar
  left.addEventListener("mouseenter", () => desk.matches && slideIn(nav, "nav"));
  left.addEventListener("mouseleave", () => desk.matches && slideOut(nav, "nav"));
  nav.addEventListener("mouseenter", () => desk.matches && slideIn(nav, "nav"));
  nav.addEventListener("mouseleave", () => desk.matches && slideOut(nav, "nav"));
  nav.addEventListener("focusin", () => desk.matches && slideIn(nav, "nav"));
  nav.addEventListener("focusout", () => desk.matches && slideOut(nav, "nav", 100));
  nav.addEventListener("click", ev => { if (desk.matches && ev.target.closest("button[data-view]")) slideOut(nav, "nav", 150); });
  // Right: word details
  right.addEventListener("mouseenter", () => { if (desk.matches) { deskSide.panel.pinned = false; slideIn(panel, "panel"); } });
  right.addEventListener("mouseleave", () => { if (desk.matches && !deskSide.panel.pinned) slideOut(panel, "panel"); });
  panel.addEventListener("mouseenter", () => { if (desk.matches) { deskSide.panel.entered = true; slideIn(panel, "panel"); } });
  panel.addEventListener("mouseleave", () => {
    if (!desk.matches) return;
    if (deskSide.panel.pinned && !deskSide.panel.entered) return;   // just opened: wait until you've looked
    deskSide.panel.pinned = false;
    slideOut(panel, "panel", 450);
  });
  panel.addEventListener("focusin", () => desk.matches && slideIn(panel, "panel"));
}
