/* LearnZì UI, part 5c: the profile page (tap your avatar or name): dress up your avatar. */

const AV_GROUPS = [["animal", "Animal"], ["expr", "Expression"], ["eyes", "Eyes"], ["acc", "Accessory"], ["aura", "Aura"]];
function setAvatar(patch) {
  commit({ avatar: { ...wornAvatar(), ...patch } });
  updateTopbar();
  render(false);
}
function viewMe() {
  const v = h("section", { class: "view" });
  const tab = (id, label) => h("button", { type: "button", "aria-pressed": String(ui.meTab === id), onclick: () => { ui.meTab = id; render(false); } }, label);
  v.append(h("div", { class: "row me-tabs" },
    h("div", { class: "seg", role: "group", "aria-label": "Customise" }, tab("avatar", "Avatar"), tab("clock", "Clock"))));
  if (ui.meTab === "clock") { clockEditor(v); return v; }
  const a = wornAvatar();
  const lv = levelNow();
  let have = 0, all = 0;
  for (const [k] of AV_GROUPS) for (const it of Object.values(AV[k])) { all++; if (unlocked(it)) have++; }
  all++; if (unlocked(AV.sparkles.on)) have++;
  v.append(h("div", { class: "me-hero card" },
    h("div", { class: "me-avatar" }, avatarSvg(a, 168, "Your avatar: " + AV.animal[a.animal].label)),
    h("div", { class: "stack-tight me-info" },
      h("h1", null, state.nickname || "Your profile"),
      h("p", { class: "muted" }, AV.animal[a.animal].label + " ", h("span", { class: "hz" }, AV.animal[a.animal].zh), " · " + have + " of " + all + " unlocked"),
      levelBar(lv),
      h("button", { class: "plain-btn build-link small", type: "button", onclick: () => { go("settings"); const n = $("#nickname"); if (n) n.focus(); } }, state.nickname ? "Change nickname" : "Set your nickname"))));
  for (const [key, title] of AV_GROUPS) {
    const grid = h("div", { class: "av-grid" });
    for (const [id, item] of Object.entries(AV[key])) {
      const open = unlocked(item);
      const isAcc = key === "acc";
      const on = isAcc ? (id === "none" ? !a.accs.length : a.accs.includes(id)) : a[key] === id;
      const preview = isAcc ? { ...a, accs: id === "none" ? [] : [...new Set([...a.accs, id])] } : { ...a, [key]: id };
      const choose = () => {
        if (!isAcc) setAvatar({ [key]: id });
        else if (id === "none") setAvatar({ accs: [] });
        else setAvatar({ accs: on ? a.accs.filter(x => x !== id) : [...a.accs, id] });
      };
      grid.append(h("button", { class: "av-tile", type: "button", disabled: !open, "aria-pressed": String(on),
        "aria-label": item.label + (open ? "" : ", locked until " + lockText(item)), onclick: choose },
        avatarSvg(preview, 64, item.label), h("b", { class: "small" }, item.label),
        open ? null : h("span", { class: "lock small" }, icon("lock"), lockText(item))));
    }
    v.append(h("div", { class: "card stack" }, h("div", { class: "row spread" }, h("h2", { class: "h-card" }, title),
      key === "acc" ? h("span", { class: "muted small" }, "Wear as many as you like") : null), grid));
  }
  const styles = h("div", { class: "av-grid" });
  for (const [id, label] of Object.entries(AV_STYLES)) {
    const shown = id === "auto" ? label + " (" + AV_STYLES[avStyle({ style: "auto" })] + ")" : label;
    styles.append(h("button", { class: "av-tile", type: "button", "aria-pressed": String(a.style === id), onclick: () => setAvatar({ style: id }) },
      avatarSvg({ ...a, style: id }, 64, label), h("b", { class: "small" }, shown)));
  }
  v.append(h("div", { class: "card stack" }, h("div", { class: "row spread" }, h("h2", { class: "h-card" }, "Art style"),
    h("span", { class: "muted small" }, "Always unlocked")), styles));
  const sparkOpen = unlocked(AV.sparkles.on);
  const extra = (label, on, patch, locked) => h("button", { class: "av-tile", type: "button", disabled: !!locked, "aria-pressed": String(on), onclick: () => setAvatar(patch) },
    avatarSvg({ ...a, ...patch }, 64), h("b", { class: "small" }, label), locked ? h("span", { class: "lock small" }, icon("lock"), locked) : null);
  v.append(h("div", { class: "card stack" }, h("h2", { class: "h-card" }, "Extras"),
    h("div", { class: "av-grid" },
      extra("Blush", a.blush, { blush: true }), extra("No blush", !a.blush, { blush: false }),
      extra(a.sparkles ? "Sparkles on" : "Sparkles", a.sparkles, { sparkles: !a.sparkles }, sparkOpen ? null : lockText(AV.sparkles.on))),
    h("p", { class: "muted small" }, "New animals arrive at levels 2 to 5. More expressions, eyes, accessories and auras unlock up to level 10, and some only with a study streak.")));
  return v;
}
