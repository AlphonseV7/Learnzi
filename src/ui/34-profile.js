/* LearnZì UI, part 5c: the profile page (tap your avatar or name): dress up your avatar. */

const AV_GROUPS = [["animal", "Animal"], ["eyes", "Eyes"], ["acc", "Accessory"], ["aura", "Aura"]];
const AV_EXTRAS = [["sparkles", AV.sparkles.on], ["halo", AV.halo.on]];
function setAvatar(patch) {
  const { expr, ...a } = { ...wornAvatar(), ...patch };
  commit({ avatar: a });
  updateTopbar();
  render(false);
}
/** Customise: your avatar, name, level and rank at the top of every tab, then the tab itself. */
function viewMe() {
  const v = h("section", { class: "view" });
  const a = wornAvatar();
  const lv = levelNow();
  let have = 0, all = 0;
  for (const [k] of AV_GROUPS) for (const it of Object.values(AV[k])) { all++; if (unlocked(it)) have++; }
  for (const [, it] of AV_EXTRAS) { all++; if (unlocked(it)) have++; }
  v.append(h("div", { class: "me-hero card" },
    h("div", { class: "me-avatar" }, liveAvatar(168, "My avatar: " + AV.animal[a.animal].label)),
    h("div", { class: "stack-tight me-info" },
      h("h1", null, state.nickname || "My profile"),
      h("p", { class: "muted" }, AV.animal[a.animal].label + " ", h("span", { class: "hz" }, AV.animal[a.animal].zh), " · " + have + " of " + all + " unlocked"),
      levelBar(lv),
      h("button", { class: "plain-btn build-link small", type: "button", onclick: () => { go("settings"); const n = $("#nickname"); if (n) n.focus(); } }, state.nickname ? "Change nickname" : "Set my nickname"))));
  const tab = (id, label) => h("button", { type: "button", "aria-pressed": String(ui.meTab === id), onclick: () => { ui.meTab = id; render(false); } }, label);
  v.append(h("div", { class: "row me-tabs" },
    h("div", { class: "seg", role: "group", "aria-label": "Customise" }, tab("avatar", "Avatar"), tab("clock", "Clock"), tab("theme", "Theme"))));
  if (ui.meTab === "clock") { clockEditor(v); return v; }
  if (ui.meTab === "theme") { themeEditor(v); return v; }
  const base = { ...a, expr: "calm" };   // the tiles show a calm face; only the big one reacts
  for (const [key, title] of AV_GROUPS) {
    const grid = h("div", { class: "av-grid" });
    for (const [id, item] of Object.entries(AV[key])) {
      const open = unlocked(item);
      const isAcc = key === "acc";
      const on = isAcc ? (id === "none" ? !a.accs.length : a.accs.includes(id)) : a[key] === id;
      const preview = isAcc ? { ...base, accs: id === "none" ? [] : [...new Set([...a.accs, id])] } : { ...base, [key]: id };
      const choose = () => {
        if (!isAcc) setAvatar({ [key]: id });
        else if (id === "none") setAvatar({ accs: [] });
        else setAvatar({ accs: on ? a.accs.filter(x => x !== id) : [...a.accs, id] });
      };
      const secret = keepSecret(item);
      grid.append(h("button", { class: "av-tile" + (secret ? " is-secret" : ""), type: "button", disabled: !open, "aria-pressed": String(on),
        "aria-label": open ? item.label : secretLabel(item), onclick: choose },
        avatarSvg(secret ? { ...preview, plain: true } : preview, 64, secretName(item)), h("b", { class: "small" }, secretName(item)),
        key === "animal" ? h("span", { class: "hz small muted" }, secret ? "？" : item.zh) : null,
        open ? null : h("span", { class: "lock small" }, icon("lock"), lockText(item))));
    }
    v.append(h("div", { class: "card stack" }, h("h2", { class: "h-card" }, title), grid));
  }
  const extras = h("div", { class: "av-grid" });
  for (const [k, item] of AV_EXTRAS) {
    const open = unlocked(item);
    extras.append(h("button", { class: "av-tile" + (keepSecret(item) ? " is-secret" : ""), type: "button", disabled: !open, "aria-pressed": String(a[k]),
      "aria-label": open ? item.label : secretLabel(item), onclick: () => setAvatar({ [k]: !a[k] }) },
      avatarSvg({ ...base, [k]: true, plain: keepSecret(item) }, 64, secretName(item)), h("b", { class: "small" }, secretName(item) + (a[k] ? " on" : "")),
      open ? null : h("span", { class: "lock small" }, icon("lock"), lockText(item))));
  }
  v.append(h("div", { class: "card stack" }, h("h2", { class: "h-card" }, "Extras"), extras));
  v.append(rankLadder(lv.level));
  return v;
}
/** Every rank. The ones you haven't reached are a shadow with ??? and their level (Debug → Show locked
 *  items reveals them). Tap a reached one to open the word; Use shows it as your title instead of your
 *  newest rank (state.title), until you pick another or go back to your newest. */
function rankLadder(level) {
  const newest = rankFor(level).rank, shown = shownRank(level);
  const use = s => { commit({ title: s }); render(false); toast(s ? "Your title is now " + (RANKS.find(r => r.s === s) || TRAVELLER).en + " " + s : "Your title follows your newest rank again"); };
  const list = h("ol", { class: "rank-ladder" });
  for (const r of RANKS) {
    const got = level >= r.lv, secret = !got && !state.showLocked;
    list.append(h("li", { class: (got ? "got" : "ahead") + (r === shown ? " now" : "") + (secret ? " is-secret" : "") },
      h("button", { class: "plain-btn rank-row", type: "button", disabled: secret, onclick: () => openWord(r.s),
        "aria-label": secret ? "Locked rank, unlocks at level " + r.lv : r.en + ", " + r.s + ", level " + r.lv + (r === shown ? ", my title" : got ? ", reached" : "") },
        h("span", { class: "hz rank-zh" }, secret ? "??" : r.s),
        h("span", { class: "stack-tight rank-text" }, h("b", null, secret ? "???" : r.en),
          secret ? null : h("span", { class: "muted small" }, (got && r !== shown ? "Lv " + r.lv + " · " : "") + Engine.toMarks(r.p) + " · " + r.note)),
        got && r !== shown ? null : h("span", { class: "badge num" }, r === shown ? "Me" : "Lv " + r.lv)),
      got && r !== shown ? h("button", { class: "btn small rank-use", type: "button", "aria-label": "Use " + r.en + " as my title", onclick: () => use(r === newest ? "" : r.s) }, "Use") : null));
  }
  return h("div", { class: "card stack" }, h("h2", { class: "h-card" }, "Ranks ", h("span", { class: "hz" }, "科举")),
    h("p", { class: "muted small" }, "Climb the exams that scholars sat for over a thousand years. With daily study, the top rank takes about a year. Tap Use on any rank you've reached to show it as your title."),
    shown !== newest ? h("div", { class: "row spread rank-choice" }, h("span", { class: "muted small" }, "Showing " + shown.en + " instead of your newest rank, " + newest.en + "."),
      h("button", { class: "btn small", type: "button", onclick: () => use("") }, "Use my newest rank")) : null,
    list,
    chapterDone(5) ? h("div", { class: "rank-special stack-tight" }, h("span", { class: "eyebrow" }, "Special title"),
      h("div", { class: "row spread" }, h("span", null, h("b", { class: "hz" }, TRAVELLER.s), " " + Engine.toMarks(TRAVELLER.p) + " · " + TRAVELLER.en + ", for finishing the Journey"),
        shown === TRAVELLER ? h("span", { class: "badge num" }, "Me") : h("button", { class: "btn small", type: "button", onclick: () => use(TRAVELLER.s) }, "Use"))) : null);
}
