/* LearnZì UI, part 9: hidden Debug settings (double-tap the cog while on Settings).
 * Updates, XP and level tools, a pretend clock for flashcard testing, and a glitch effect. */

function shiftText(ms) {
  const h = Math.round(ms / 3600e3);
  if (h < 24) return h + " h";
  const d = Math.round(h / 24);
  return d === 1 ? "1 day" : d + " days";
}
function setClockShift(ms) {
  clockShift = Math.max(0, ms);
  try { if (clockShift) localStorage.setItem(CLOCK_KEY, String(clockShift)); else localStorage.removeItem(CLOCK_KEY); } catch { /* fine */ }
  updateTopbar();
  render(false);
}
/** A button that asks "Tap again to confirm" before doing something that can't be undone. */
function confirmBtn(label, confirmLabel, action) {
  let armed = false, timer = 0;
  const b = h("button", { class: "btn danger", type: "button" }, label);
  b.addEventListener("click", () => {
    if (!armed) {
      armed = true; b.textContent = confirmLabel; b.classList.add("armed");
      timer = setTimeout(() => { armed = false; b.textContent = label; b.classList.remove("armed"); }, 4000);
      return;
    }
    clearTimeout(timer);
    action();
  });
  return b;
}

function viewDebug() {
  const v = h("section", { class: "view" });
  // In MLE mode, the way back comes first.
  if (mleOn()) {
    v.append(h("div", { class: "card set mle-revert" }, h("h2", { class: "h-card" }, "Revert to normal mode"),
      h("p", { class: "muted small" }, "Leave MLE mode and go back to LearnZì with your own theme and Chinese progress. MLE mode stays unlocked, and its progress is kept."),
      h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: leaveMle }, icon("back"), "Revert to normal mode"))));
  }

  // Updates
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Updates"),
    h("ul", { class: "updates" }, UPDATES.map(([when, what]) => h("li", null, h("span", { class: "muted small num" }, when), h("span", null, what))))));

  // Level and XP
  const lv = levelNow();
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Zì level"),
    levelBar(lv),
    h("p", { class: "muted small" }, "Total XP: " + totalXp().toLocaleString("en-GB")),
    h("div", { class: "row" },
      h("button", { class: "btn primary", type: "button", onclick: () => debugXp(100) }, "+100 XP"),
      h("button", { class: "btn", type: "button", onclick: () => debugXp(1000) }, "+1,000 XP"),
      confirmBtn("Reset level", "Tap again to reset to level 1", () => {
        progress.adj = [Date.now(), -rawXp()];
        commitProgress();
        toast("Level reset. You're back to Zì level 1 with 0 XP.");
        render(false);
      }))));

  // Pretend clock
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Time"),
    h("p", null, clockShift ? "The clock is " + shiftText(clockShift) + " ahead of real time." : "The clock is on real time."),
    h("div", { class: "row" },
      h("button", { class: "btn", type: "button", onclick: () => setClockShift(clockShift + 3600e3) }, "+1 hour"),
      h("button", { class: "btn", type: "button", onclick: () => setClockShift(clockShift + 864e5) }, "+1 day"),
      h("button", { class: "btn", type: "button", onclick: () => setClockShift(clockShift + 7 * 864e5) }, "+1 week"),
      h("button", { class: "btn", type: "button", disabled: !clockShift, onclick: () => setClockShift(0) }, "Back to real time")),
    h("p", { class: "muted small" }, "Skipping time makes flashcards come due sooner. Reviews done while skipped are saved with the skipped date, so they'll look further ahead once you return to real time. Use the reset below to start clean.")));

  // Flashcards
  const cards = Object.keys(progress.cards).length;
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Flashcards"),
    h("p", { class: "muted small" }, cards + (cards === 1 ? " card has" : " cards have") + " progress. Your My Zì words stay; only their review history is cleared."),
    h("div", { class: "row" },
      confirmBtn("Reset all flashcard progress", "Tap again to clear every card", () => {
        // Fresh copy everywhere: cards, daily activity and level all start again.
        const now = Date.now();
        progress = { cards: {}, act: {}, adj: [now, 0], epoch: now, updatedAt: now };
        commitProgress();
        toast("Flashcard progress cleared.");
        render(false);
      }))));

  // MLE mode, once the secret has been solved
  if (state.mle.unlocked && !mleOn()) {
    v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "MLE mode"),
      h("p", { class: "muted small" }, "The secret you unlocked: Multicultural London English slang, flashcards and quiz."),
      h("div", { class: "row" }, mleOn() ? h("button", { class: "btn", type: "button", onclick: leaveMle }, "Back to LearnZì")
        : h("button", { class: "btn primary", type: "button", onclick: enterMle }, "Switch to MLE mode"))));
  }

  // Unlock everything
  const unlockSw = h("input", { type: "checkbox", id: "unlock-all", role: "switch" });
  unlockSw.checked = state.unlockAll;
  unlockSw.addEventListener("change", () => { commit({ unlockAll: unlockSw.checked }); toast(unlockSw.checked ? "Everything unlocked" : "Back to normal unlocks"); updateTopbar(); render(false); });
  const showSw = h("input", { type: "checkbox", id: "show-locked", role: "switch" });
  showSw.checked = state.showLocked;
  showSw.addEventListener("change", () => { commit({ showLocked: showSw.checked }); toast(showSw.checked ? "Locked items show their names" : "Locked items are secret again"); });
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Unlocks"),
    h("div", { class: "set-row" }, h("div", { class: "set-label" }, h("label", { for: "show-locked" }, "Show locked items"),
      h("span", { class: "muted small" }, "Off: anything you haven't unlocked is a shadow with ??? for a name, plus what unlocks it. On: you can see what's coming.")),
      h("span", { class: "toggle" }, showSw, h("span"))),
    h("div", { class: "set-row" }, h("div", { class: "set-label" }, h("label", { for: "unlock-all" }, "Unlock everything"),
      h("span", { class: "muted small" }, "Every animal, eye, accessory, aura, extra, bonus theme, clock face and clock effect, whatever your level or streak. Turn it off to go back; your XP isn't changed.")),
      h("span", { class: "toggle" }, unlockSw, h("span")))));

  // Glitch
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Glitch"),
    h("p", { class: "muted small" }, "Breaks the screen, then goes completely black. Tap the black screen 5 times or press Escape to come back."),
    h("div", { class: "row" }, glitchButton())));
  return v;
}
function debugXp(n) {
  const before = levelNow().level;
  progress.adj = [Date.now(), progress.adj[1] + n];
  commitProgress();
  afterXp(before, n);
  render(false);
}

// ---------- glitch ----------
let glitchTaps = 0;
function startGlitch() {
  if ($("#glitch")) return;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.body.classList.add("glitching");
  const layer = h("div", { class: "glitch", id: "glitch", "aria-hidden": "true" },
    Array.from({ length: 7 }, (_, i) => {
      const bar = h("i");
      bar.style.setProperty("--y", (8 + i * 13) + "%");
      bar.style.setProperty("--hh", (2 + (i % 3) * 3) + "%");
      bar.style.setProperty("--delay", (i * 0.07) + "s");
      return bar;
    }));
  glitchTaps = 0;
  layer.addEventListener("click", () => { if (layer.classList.contains("black") && ++glitchTaps >= 5) endGlitch(); });
  document.body.append(layer);
  setTimeout(() => { document.body.classList.remove("glitching"); layer.classList.add("black"); }, calm ? 0 : 1600);
}
function endGlitch() {
  const layer = $("#glitch");
  if (!layer) return false;
  layer.remove();
  document.body.classList.remove("glitching");
  return true;
}
