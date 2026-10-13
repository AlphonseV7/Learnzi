/* LearnZì UI, part 4a: the top bar's XP capsule, and on phones a top bar that follows you down the page.
 * XP capsule: the level pill fills up (#xpbar, a layer inside it) with your progress to the next level,
 * with the numbers inside. When you earn XP, tiny characters (from the word you just studied, or 经验值
 * "experience points") drift into the end of the fill, which shimmers with moving dots.
 * Following bar (phones and tablets, not the desktop layout): it sticks to the top while you scroll,
 * tucks itself away after a few quiet seconds, and comes back when you scroll again, earn XP or
 * your avatar reacts. */

// ---------- XP bar ----------
let xpShown = null;   // what the bar last showed: { level, frac, mle }
const pct = f => (Math.max(0, Math.min(1, f)) * 100).toFixed(2) + "%";
/** Set the bar to `info` ({ level, into, need }). A new level fills it up, flashes, then starts again. */
function xpBarShow(info) {
  const bar = $("#xpbar");
  if (!bar) return;
  const fill = bar.firstElementChild, frac = info.need ? info.into / info.need : 0, mle = mleOn();
  const snap = f => { fill.classList.add("snap"); fill.style.width = pct(f); void fill.offsetWidth; fill.classList.remove("snap"); };
  if (!xpShown || xpShown.mle !== mle || info.level < xpShown.level) snap(frac);
  else if (info.level > xpShown.level) {
    fill.style.width = "100%";
    bar.classList.add("full");
    setTimeout(() => { snap(0); bar.classList.remove("full"); fill.style.width = pct(frac); }, 1300);
  } else if (frac !== xpShown.frac) {
    fill.style.width = pct(frac);
    if (frac > xpShown.frac) { bar.classList.remove("filling"); void bar.offsetWidth; bar.classList.add("filling"); clearTimeout(bar.fillTimer); bar.fillTimer = setTimeout(() => bar.classList.remove("filling"), 1600); }
  }
  xpShown = { level: info.level, frac, mle };
  const num = $("#xpnum");
  if (num) num.textContent = info.into + "/" + info.need;
}
/** Tiny characters drift from the level pill into the end of the bar. */
function xpFlow(chars, gained) {
  const bar = $("#xpbar"), top = $(".topbar"), pill = $("#lvl");
  if (!bar || !top || !pill || gained <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let glyphs = [...(chars || "")].filter(c => Engine.isCJK(c));
  if (!glyphs.length) glyphs = [..."经验值"];
  const n = Math.max(2, Math.min(6, Math.ceil(gained / 2.5)));
  const T = top.getBoundingClientRect(), B = bar.getBoundingClientRect(), P = pill.getBoundingClientRect();
  const frac = bar.classList.contains("full") ? 1 : xpShown ? xpShown.frac : 0;
  const ex = B.left - T.left + Math.max(6, B.width * frac), ey = B.top - T.top + B.height / 2;
  const sx = P.left - T.left + P.width / 2, sy = P.top - T.top + P.height / 2;
  for (let i = 0; i < n; i++) {
    const g = h("span", { class: "xp-glyph hz", "aria-hidden": "true" }, glyphs[i % glyphs.length]);
    top.append(g);
    const jx = sx + (Math.random() - 0.5) * 34, mx = (jx + ex) / 2 + (Math.random() - 0.5) * 40, my = Math.min(sy, ey) - 8 - Math.random() * 10;
    const a = g.animate([
      { transform: `translate(${jx}px, ${sy}px) translate(-50%, -50%) scale(.5)`, opacity: 0 },
      { transform: `translate(${mx}px, ${my}px) translate(-50%, -50%) scale(1.1)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${ex}px, ${ey}px) translate(-50%, -50%) scale(.35)`, opacity: 0.2 },
    ], { duration: 820 + i * 60, delay: i * 85, easing: "cubic-bezier(.45, 0, .55, 1)", fill: "backwards" });
    a.onfinish = () => {
      g.remove();
      bar.classList.remove("ping"); void bar.offsetWidth; bar.classList.add("ping");
    };
  }
}

// ---------- the following top bar (not on the desktop layout) ----------
const BAR_REST_MS = 2800;   // quiet time before the bar tucks away
let barTimer = 0;
const barFollows = () => !document.documentElement.classList.contains("desk");
const pageScrolled = () => window.scrollY > 28;
function setBarOffset(shown) {
  const top = $(".topbar");
  const off = shown && barFollows() && pageScrolled() && top ? top.offsetHeight + 8 : 0;
  document.documentElement.style.setProperty("--bar-off", off + "px");
}
function showBar() {
  const top = $(".topbar");
  if (!top) return;
  top.classList.remove("tucked");
  setBarOffset(true);
}
function tuckLater(ms) {
  clearTimeout(barTimer);
  barTimer = setTimeout(() => {
    const top = $(".topbar");
    if (!top || !barFollows() || !pageScrolled()) return;
    if (top.matches(":focus-within") || document.querySelector("#navmenu, #tour")) { tuckLater(BAR_REST_MS); return; }
    top.classList.add("tucked");
    setBarOffset(false);
  }, ms);
}
/** Bring the bar back for a moment (XP, a reaction), then let it tuck away again. */
function revealBar(ms = 3200) {
  if (!barFollows()) return;
  showBar();
  tuckLater(ms);
}
function setupTopbar() {
  const top = $(".topbar");
  if (!top) return;
  window.addEventListener("scroll", () => {
    if (!barFollows()) { top.classList.remove("tucked"); setBarOffset(false); return; }
    showBar();
    if (pageScrolled()) tuckLater(BAR_REST_MS); else clearTimeout(barTimer);
  }, { passive: true });
  top.addEventListener("pointerdown", () => { if (barFollows() && pageScrolled()) tuckLater(BAR_REST_MS); }, { passive: true });
}
