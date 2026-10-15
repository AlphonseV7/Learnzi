import asyncio
from playwright.async_api import async_playwright
from lz import setup
from qa_seed import BUSY_S, BUSY_P, THEMES
A360 = {"viewport": {"width": 360, "height": 780}, "device_scale_factor": 1, "is_mobile": True, "has_touch": True}
VIEWS = ["home", "lookup", "reader", "photo", "watch", "myzi", "mycards", "decks", "stats", "tones", "me", "settings", "debug", "grammar", "journey", "scrolls"]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); bad = []
        for t in THEMES:
            for mode in ["light", "dark"]:
                ctx, pg, errs = await setup(b, A360, {**BUSY_S, "preset": t, "mode": mode, "scale": 1, "pinyin": True}, BUSY_P)
                await pg.goto("http://localhost:8765/t.html#home"); await pg.wait_for_function("!document.querySelector('.dict-progress')", timeout=40000); await pg.wait_for_timeout(700)
                for v in VIEWS:
                    await pg.evaluate(f"__t.go('{v}')"); await pg.wait_for_timeout(350)
                    await pg.evaluate("document.querySelectorAll('.view .fold.closed .fold-btn').forEach(b => b.click()); __t.getUi().meTab")
                    await pg.wait_for_timeout(250)
                    w = await pg.evaluate("document.documentElement.scrollWidth")
                    if w > 361: bad.append((t, mode, v, w, await pg.evaluate("""[...document.querySelectorAll('.view *, .topbar *')].filter(e => e.getBoundingClientRect().right > 362 && e.offsetParent && ![...e.children].some(c => c.getBoundingClientRect().right > 362)).slice(0, 2).map(e => e.tagName + '.' + e.className + ' ' + (e.textContent||'').slice(0,30))""")))
                if errs: bad.append((t, mode, "errors", errs[:2]))
                await ctx.close()
        await b.close()
        print("problems:", len(bad))
        for x in bad[:30]: print(x)
asyncio.run(main())
