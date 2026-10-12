/* LearnZì UI, part 7: loading the dictionary and starting the app. */

function applyAll() {
  // Your synced settings arrived on a new device: no welcome needed after all.
  if (state.onboarded && $("#welcome") && wz && wz.step === 0) closeWelcome();
  applyLook();
  updateTopbar();
  const active = document.activeElement;
  const typing = active && ["reader-input", "q", "nickname", "note-input", "new-deck-name", "deck-name", "deck-rename"].includes(active.id);
  if (!typing && ui.view !== "study") render(false);
  else if (ui.view === "lookup") fillResults($("#results"));
  if (!(active && active.id === "note-input")) renderPanel();
}
async function loadDict() {
  try {
    const res = await fetch(DICT_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    let text;
    if (res.body && res.body.getReader) {
      const rd = res.body.getReader();
      const chunks = [];
      let got = 0, lastPaint = 0;
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        chunks.push(value); got += value.length;
        ui.progress = Math.min(0.99, got / DICT_BYTES);
        if (got - lastPaint > 250000) { lastPaint = got; document.querySelectorAll(".dict-progress").forEach(el => { el.textContent = progressText(); }); }
      }
      const all = new Uint8Array(got);
      let o = 0;
      for (const c of chunks) { all.set(c, o); o += c.length; }
      text = new TextDecoder("utf-8").decode(all);
    } else text = await res.text();
    ui.progress = 1;
    document.querySelectorAll(".dict-progress").forEach(el => { el.textContent = progressText(); });
    await new Promise(r => setTimeout(r, 40));
    if (Engine.parse(text) < 1000) throw new Error("dictionary looks empty");
    ui.dict = "ready";
  } catch (err) {
    ui.dict = "error";
  }
  applyAll();
  if (ui.dict === "ready") setTimeout(() => Engine.warm(), 500);
}
function start() {
  applyLook();
  updateTopbar();
  setupNav();
  setupDesk();
  setupPanelSwipe();
  $("#gear").append(icon("gear"));
  let lastGear = 0;
  $("#gear").addEventListener("click", () => {
    // Double-tap the cog while already on Settings to open the hidden Debug settings.
    if (ui.view !== "settings") { lastGear = 0; go("settings"); return; }
    const now = Date.now();
    if (now - lastGear < 450) { lastGear = 0; go("debug"); toast("Debug settings"); return; }
    lastGear = now;
  });
  $("#clock-badge").addEventListener("click", () => go("debug"));
  $("#me").addEventListener("click", () => go("myzi"));
  $("#lvl").addEventListener("click", () => go("myzi"));
  $("#scrim").addEventListener("click", closePanel);
  window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (VIEWS.includes(v) && v !== ui.view) go(v); });
  document.addEventListener("paste", photoPaste);
  // Your avatar dozes off when you leave the app alone, wakes when you come back, and winks when tapped.
  for (const t of ["keydown", "wheel", "touchstart", "scroll"]) document.addEventListener(t, nudgeAvatar, { passive: true, capture: true });
  document.addEventListener("pointerdown", ev => {
    nudgeAvatar();
    const av = ev.target.closest && ev.target.closest("svg.avatar");
    if (av && !av.closest(".av-tile")) winkAvatar();
  }, { passive: true, capture: true });
  armIdle();
  setupTopbar();
  firstRun();
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") { if (!closeTour() && !closeResetAsk() && !closeSecret() && !closeNavMenu() && !endGlitch() && !closeLevelUp()) closePanel(); } else if (!mleKeys(ev) && !toneKeys(ev) && !watchKeys(ev)) studyKeys(ev); });
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.addEventListener("voiceschanged", pickVoice); }
  const first = (location.hash || "").slice(1);
  ui.view = VIEWS.includes(first) ? first : "home";
  render(false);
  renderPanel();
  Sync.set("local");
  Sync.start();
  loadDict();
}
start();
