/* LearnZì UI, part 5d: Customise → Theme. The theme, light or dark, colours, background scene, shapes
 * and whether your avatar matches the theme (moved here from Settings, next to the other unlocks).
 * Fonts and text size stay in Settings → Text and fonts; box layout in Settings → Box layout. */

function themeEditor(v) {
  const sw = h("div", { class: "swatches", role: "group", "aria-label": "Theme" });
  for (const [key, p] of Object.entries(PRESETS)) {
    const dots = h("span", { class: "dots" });
    const colors = key === "custom" ? (state.custom ? [state.custom.bg, state.custom.accent, state.custom.surface, state.custom.ink] : []) : isAltMode(key) ? p.alt : p.dots;
    if (key === "custom" && !colors.length) dots.append(h("i", { class: "rainbow" }));
    colors.forEach(c => { const i = h("i"); i.style.background = c; dots.append(i); });
    const bonus = BONUS_THEMES[key];
    const locked = !!bonus && !unlocked(bonus);
    const secret = !!bonus && keepSecret(bonus);
    sw.append(h("button", { class: "swatch" + (locked ? " locked" : "") + (secret ? " is-secret" : ""), type: "button", disabled: locked,
      "aria-pressed": String(state.preset === key), "aria-label": secret ? secretLabel(bonus) : null, onclick: () => {
        if (key === "custom" && !state.custom) commit({ custom: currentColors() });
        commit({ preset: key }); applyLook(); render(false);
      } }, dots, h("b", null, secret ? "???" : p.label),
      h("span", { class: "muted small" }, secret ? "Unlocks at " + lockText(bonus) : key === "custom" ? p.note : p.note + " · " + modeFor(key) + (locked ? " · " + lockText(bonus) : ""))));
  }
  const color = h("input", { type: "color", id: "accent", "aria-label": "Accent colour" });
  color.value = state.accent || (getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().match(/^#[0-9a-f]{6}$/i) || ["#c2362b"])[0];
  color.addEventListener("input", () => { state.accent = color.value.toLowerCase(); applyLook(); });
  color.addEventListener("change", () => commit({ accent: color.value.toLowerCase() }));
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Theme"), sw,
    setRow("mode", "Light or dark", setSeg("mode", MODES, state.mode, k => { commit({ mode: k }); applyLook(); render(false); }),
      state.preset === "custom" ? "Custom uses the colours you pick, so this doesn't change it" : "Every theme has a light and a dark look. Theme's own uses the one it was made with."),
    state.preset === "custom" && state.custom ? customEditor() : null,
    state.preset === "custom" ? null : setRow("accent", "Accent colour", h("div", { class: "row" }, color,
      h("button", { class: "btn", type: "button", onclick: () => { commit({ accent: "" }); applyLook(); render(false); } }, "Reset")))));
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Theme extras"),
    setRow("zen", "Background scene", setToggle("zen", state.zen, on => { commit({ zen: on }); applyLook(); }), "A faint scene behind the app that matches the theme"),
    setRow("shapes", "Theme shapes", setToggle("shapes", state.shapes, on => { commit({ shapes: on }); applyLook(); refreshAvatars(); }), "Hand-drawn, soft, cut-corner, neon, pixel or polygon edges, plus theme fonts, depending on the theme"),
    setRow("avmatch", "Avatar matches theme", setToggle("avmatch", state.avMatch, on => { commit({ avMatch: on }); refreshAvatars(); }), "Draws my avatar in the theme's own look: ink sketch for Ink, pixels for Arcade, neon for Cyber. Off: always the standard look")));
}
