/* LearnZì UI, part 7: loading the dictionary and starting the app. */

function applyAll() {
  // Your synced settings arrived on a new device: no welcome needed after all.
  if (state.onboarded && $("#welcome") && wz && wz.step === 0) closeWelcome();
  applyLook();
  updateTopbar();
  const active = document.activeElement;
  const typing = active && ["reader-input", "q", "nickname", "note-input", "new-deck-name", "deck-name", "deck-rename"].includes(active.id);
  if (!typing && (ui.view !== "study" || !study.active)) render(false);
  else if (ui.view === "lookup") fillResults($("#results"));
  if (!(active && active.id === "note-input")) renderPanel();
}
async function loadDict() {
  try {
    let got = 0, lastPaint = 0;
    const hsk3 = fetchPackedText("hsk3.txt").catch(() => "");   // small: the HSK 3.0 word list
    const text = await fetchPackedText(DICT_URL, n => {
      got += n;
      ui.progress = Math.min(0.99, got / DICT_BYTES);
      if (got - lastPaint > 250000) { lastPaint = got; document.querySelectorAll(".dict-progress").forEach(el => { el.textContent = progressText(); }); }
    });
    ui.progress = 1;
    document.querySelectorAll(".dict-progress").forEach(el => { el.textContent = progressText(); });
    await new Promise(r => setTimeout(r, 40));
    if (Engine.parse(text) < 1000) throw new Error("dictionary looks empty");
    hsk3Ready(await hsk3);
    ui.dict = "ready";
  } catch (err) {
    ui.dict = "error";
  }
  applyAll();
  if (ui.dict === "ready") { setTimeout(() => Engine.warm(), 500); setTimeout(loadGrammar, 2500); setTimeout(clozeWarm, 4000); }
}
/** Close whatever pop-up is on top (Escape, or Back). True if something closed. */
function closeTopLayer() {
  if (closeJSheet() || closeTour() || closeResetAsk() || closeSecret() || closeNavMenu() || endGlitch() || closeLevelUp()) return true;
  const panel = $("#panel");
  if (panel && panel.classList.contains("open")) { closePanel(); return true; }
  return false;
}
function start() {
  applyLook();
  updateTopbar();
  setupNav();
  setupDesk();
  setupPanelSwipe();
  $("#gear").append(icon("gear"));
  $("#jtop").addEventListener("click", () => { closePanel(); go("journey"); });
  window.addEventListener("resize", fitName);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitName);
  let lastGear = 0;
  $("#gear").addEventListener("click", () => {
    // Double-tap the cog while already on Settings to open the hidden Debug settings.
    if (ui.view !== "settings") { lastGear = 0; go("settings"); return; }
    const now = Date.now();
    if (now - lastGear < 450) { lastGear = 0; go("debug"); toast("Debug settings"); return; }
    lastGear = now;
  });
  $("#clock-badge").addEventListener("click", () => go("debug"));
  $("#me").addEventListener("click", () => go("me"));   // avatar and name: Customise; level and XP: My Zì
  $("#lvl").addEventListener("click", () => go("myzi"));
  $("#scrim").addEventListener("click", closePanel);
  // Back (Android's back swipe or button): close the top pop-up if one is open and stay on the page,
  // otherwise show the page we came from.
  window.addEventListener("popstate", () => {
    if (closeTopLayer()) { try { history.pushState(null, "", "#" + ui.view); } catch { /* fine */ } return; }
    const v = location.hash.slice(1);
    if (VIEWS.includes(v) && v !== ui.view) go(v, true);
  });
  window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (VIEWS.includes(v) && v !== ui.view) go(v, true); });
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
  silverSheen();
  firstRun();
  document.addEventListener("click", tapChinese);
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") closeTopLayer(); else if (!mleKeys(ev) && !toneKeys(ev) && !watchKeys(ev)) studyKeys(ev); });
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
