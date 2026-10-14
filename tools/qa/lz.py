"""Shared test helpers: seeded state, local copies of the Google fonts, error capture."""
import json, os, glob
FONTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts/node_modules/@fontsource")
FAMS = {"Press Start 2P": "press-start-2p", "Tiny5": "tiny5", "Orbitron": "orbitron", "Chakra Petch": "chakra-petch",
  "LXGW WenKai TC": "lxgw-wenkai-tc", "Quicksand": "quicksand", "Cormorant Garamond": "cormorant-garamond", "Literata": "literata",
  "Alegreya": "alegreya", "Alegreya Sans": "alegreya-sans", "Monoton": "monoton", "Bungee": "bungee", "Fraunces": "fraunces",
  "Cinzel": "cinzel", "EB Garamond": "eb-garamond", "Permanent Marker": "permanent-marker", "Barlow": "barlow", "Syne": "syne", "Space Grotesk": "space-grotesk", "Lexend": "lexend"}
def font_css():
    css = ""
    for name, d in FAMS.items():
        for f in glob.glob(f"{FONTDIR}/{d}/files/{d}-latin*-*.woff2"):
            parts = f[:-6].split("-")
            w, st = parts[-2], parts[-1]
            if not w.isdigit(): continue
            rng = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1EFF" if "latin-ext" in f else "U+0000-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122"
            css += f"@font-face{{font-family:'{name}';font-weight:{w};font-style:{st};unicode-range:{rng};src:url('https://fonts.local/{os.path.relpath(f, FONTDIR)}')}}\n"
    return css
async def setup(b, opts, seed_state=None, seed_progress=None):
    ctx = await b.new_context(**opts)
    sp = seed_progress or {"cards": {}, "act": {}, "adj": [1, 20000], "updatedAt": 1}
    ss = dict(seed_state or {})
    if ss and 'onboarded' not in ss: ss.update(onboarded=True, toured=True)   # older tests: skip the first-time welcome
    await ctx.add_init_script(f"if (!sessionStorage.getItem('s')) {{ sessionStorage.setItem('s','1'); localStorage.setItem('learnzi.progress.v1', {json.dumps(json.dumps(sp))}); localStorage.setItem('learnzi.state.v1', {json.dumps(json.dumps(ss))}); }}")
    css = font_css()
    async def gf(route): await route.fulfill(status=200, content_type="text/css", body=css)
    async def fl(route):
        path = os.path.join(FONTDIR, route.request.url.split("fonts.local/")[1])
        await route.fulfill(status=200, content_type="font/woff2", body=open(path, "rb").read())
    await ctx.route("https://fonts.googleapis.com/**", gf)
    await ctx.route("https://fonts.local/**", fl)
    pg = await ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and "ERR_TUNNEL" not in m.text else None)
    return ctx, pg, errs
PHONE = dict(viewport={"width": 400, "height": 860}, is_mobile=True, has_touch=True, device_scale_factor=2)
DESK = dict(viewport={"width": 1280, "height": 900})
