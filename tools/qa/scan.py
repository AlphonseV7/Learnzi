import asyncio, time, json
from playwright.async_api import async_playwright
from lz import setup, PHONE, DESK
now = int(time.time()*1000); m = now // 60000
VIEWS = ["home", "lookup", "reader", "photo", "watch", "myzi", "mycards", "decks", "stats", "study", "tones", "me", "settings", "debug", "grammar", "journey", "scrolls"]
BAD = r"/\bnull\b|\bundefined\b|\bNaN\b|\[object |Infinity/"
SCAN = """() => { const bad = new RegExp(%s.source); const out = [];
  const t = document.body.innerText; for (const line of t.split('\\n')) if (bad.test(line)) out.push('TEXT: ' + line.slice(0, 90));
  for (const el of document.querySelectorAll('[aria-label],[title],[placeholder],[style]')) for (const a of ['aria-label','title','placeholder']) { const v = el.getAttribute(a); if (v && bad.test(v)) out.push(a + ': ' + v.slice(0, 80)); }
  for (const el of document.querySelectorAll('[style]')) { const v = el.getAttribute('style'); if (/NaN|undefined/.test(v)) out.push('style: ' + v.slice(0,80)); }
  return [...new Set(out)]; }""" % BAD
def cards():
    c = {}
    words = [("你好","ni3 hao3"),("谢谢","xie4 xie5"),("朋友","peng2 you5"),("学生","xue2 sheng5"),("老师","lao3 shi1"),("中国","zhong1 guo2")]
    for i,(s,p) in enumerate(words):
        for t in "mlrw": c[f"{s}|{p}|{t}"] = [3.2, 5.1, m - 10 + i, m - 3000, 3, 1, 30, 2, 0]
    return c
STATES = {
  "new": (None, None),
  "busy": ({"nickname": "Kuzi", "saved": [{"s": "你好", "p": "ni3 hao3", "at": now}, {"s": "朋友", "p": "peng2 you5", "at": now}], "decks": [{"id": "uabcd1", "name": "Mine", "words": ["你好|ni3 hao3", "朋友|peng2 you5"]}], "writing": True},
           {"cards": cards(), "act": {f"2026-10-{d:02d}": [10, 20, 5, 1, 4, 2] for d in range(1, 13)}, "adj": [1, 30000], "garden": [12, 30], "updatedAt": 1}),
}
async def visit(pg, label):
    found = {}
    for v in VIEWS:
        await pg.evaluate(f"location.hash = '{v}'"); await pg.wait_for_timeout(350)
        oa = pg.locator(".view .btn:has-text('Open all')")
        if await oa.count(): await oa.first.click(); await pg.wait_for_timeout(250)
        r = await pg.evaluate(SCAN)
        if r: found[v] = r
        if v == "study":
            for _ in range(6):
                sa = pg.locator(".view button:has-text('Show answer'), .view button:has-text('Study now'), .view button:has-text('Start')")
                if await sa.count(): await sa.first.click(); await pg.wait_for_timeout(350)
                r = await pg.evaluate(SCAN)
                if r: found["study-session"] = r
                g = pg.locator(".grade.g3")
                if await g.count(): await g.first.click(); await pg.wait_for_timeout(350)
    # word pop-up
    await pg.evaluate("location.hash = 'lookup'"); await pg.wait_for_timeout(300)
    await pg.fill("#q", "hao"); await pg.wait_for_timeout(900)
    res = pg.locator(".res").first
    if await res.count(): await res.click(); await pg.wait_for_timeout(1200)
    op = pg.locator("#panel .btn:has-text('Open all')")
    if await op.count(): await op.first.click(); await pg.wait_for_timeout(600)
    r = await pg.evaluate(SCAN)
    if r: found["popup"] = r
    print(label, json.dumps(found, ensure_ascii=False) if found else "clean")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for name, (ss, sp) in STATES.items():
            for dev, opts in [("phone", PHONE), ("desk", DESK)]:
                ctx, pg, errs = await setup(b, opts, ss, sp)
                await pg.goto("http://localhost:8765/preview.html#home"); await pg.wait_for_function("!document.querySelector('.dict-progress')", timeout=30000); await pg.wait_for_timeout(800)
                if name == "new":
                    sk = pg.locator("text=Skip set-up")
                    if await sk.count(): await sk.click(); await pg.wait_for_timeout(500)
                    await pg.keyboard.press("Escape")
                await visit(pg, f"{name}/{dev}")
                if errs: print("  ERRORS", errs[:5])
                await ctx.close()
        await b.close()
asyncio.run(main())
