import asyncio, sys, json
from playwright.async_api import async_playwright
from lz import setup, PHONE
from cut1 import ST, HI
tag = sys.argv[1]
JS = """() => [...document.querySelectorAll('.view .fold-head, #pv .fold-head')].filter(e => e.offsetParent).map(e => {
  const l = e.querySelector('.fold-label'), t = e.querySelector('.fold-title'), r = t.getBoundingClientRect();
  const over = [...e.children].filter(c => c !== t).some(c => { const q = c.getBoundingClientRect(); return q.width && q.left < r.left + l.scrollWidth + 20 && q.top < r.bottom && q.bottom > r.top; });
  return [l.textContent.trim().slice(0, 30), Math.round(e.getBoundingClientRect().height), l.scrollWidth > l.clientWidth + 1 || over]; })"""
async def main():
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for theme in ["silver", "cyber", "arcade", "ink", "porcelain", "imperial", "jade", "peach", "lantern"]:
            for w in (340, 360, 412):
                o = dict(PHONE); o["viewport"] = {"width": w, "height": 860}
                ctx, pg, errs = await setup(b, o, {**ST, "preset": theme}, HI)
                await pg.goto("http://localhost:8765/preview.html#home"); await pg.wait_for_function("!document.querySelector('.dict-progress')", timeout=30000); await pg.wait_for_timeout(800)
                await pg.evaluate("document.querySelector('#toast') && document.querySelector('#toast').remove()")
                for v in ["home", "decks", "mycards", "settings", "myzi", "tones", "stats", "me", "lookup", "grammar"]:
                    await pg.evaluate(f"location.hash='{v}'"); await pg.wait_for_timeout(700)
                    out[f"{theme} {w} {v}"] = await pg.evaluate(JS)
                await pg.evaluate("location.hash='home'"); await pg.wait_for_timeout(500)
                g = pg.locator(".wotd .glyph")
                if await g.count():
                    
                    try:
                        await g.first.click(timeout=4000); await pg.wait_for_timeout(900); out[f"{theme} {w} popup"] = await pg.evaluate(JS)
                    except Exception as ex: print('popup skipped', theme, w)
                if errs: print(theme, w, errs)
                await ctx.close()
        await b.close()
    json.dump(out, open(f"fh_{tag}.json", "w"), ensure_ascii=False)
    bad = [(k, x[0]) for k, v in out.items() for x in v if x[2]]
    print(tag, "headings:", sum(len(v) for v in out.values()), "overlapping:", len(bad)); [print(" ", b) for b in bad[:40]]
asyncio.run(main())
