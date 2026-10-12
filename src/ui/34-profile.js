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
    v.append(h("div", { class: "card stack" }, h("div", { class: "row spread" }, h("h2", { class: "h-card" }, title),
      key === "acc" ? h("span", { class: "muted small" }, "Wear as many as you like") : null), grid));
  }
  const extras = h("div", { class: "av-grid" });
  for (const [k, item] of AV_EXTRAS) {
    const open = unlocked(item);
    extras.append(h("button", { class: "av-tile" + (keepSecret(item) ? " is-secret" : ""), type: "button", disabled: !open, "aria-pressed": String(a[k]),
      "aria-label": open ? item.label : secretLabel(item), onclick: () => setAvatar({ [k]: !a[k] }) },
      avatarSvg({ ...base, [k]: true, plain: keepSecret(item) }, 64, secretName(item)), h("b", { class: "small" }, secretName(item) + (a[k] ? " on" : "")),
      open ? null : h("span", { class: "lock small" }, icon("lock"), lockText(item))));
  }
  v.append(h("div", { class: "card stack" }, h("div", { class: "row spread" }, h("h2", { class: "h-card" }, "Extras"),
    h("span", { class: "muted small" }, "Tap to turn on or off")), extras));
  v.append(rankLadder(lv.level));
  return v;
}
/** Every rank, the ones you've reached first. Tap one to open the word. */
function rankLadder(level) {
  const cur = rankFor(level).rank;
  const list = h("ol", { class: "rank-ladder" });
  for (const r of RANKS) {
    const got = level >= r.lv;
    list.append(h("li", { class: (got ? "got" : "ahead") + (r === cur ? " now" : "") },
      h("button", { class: "plain-btn rank-row", type: "button", onclick: () => openWord(r.s), "aria-label": r.en + ", " + r.s + ", level " + r.lv + (r === cur ? ", my rank" : got ? ", reached" : "") },
        h("span", { class: "hz rank-zh" }, r.s),
        h("span", { class: "stack-tight rank-text" }, h("b", null, r.en), h("span", { class: "muted small" }, Engine.toMarks(r.p) + " · " + r.note)),
        h("span", { class: "badge num" }, r === cur ? "Me" : "Lv " + r.lv))));
  }
  return h("div", { class: "card stack" }, h("h2", { class: "h-card" }, "Ranks ", h("span", { class: "hz" }, "科举")),
    h("p", { class: "muted small" }, "Climb the exams that scholars sat for over a thousand years. With daily study, 状元 takes about a year."), list);
}
