"""Group C: every page, every theme, light and dark, phone and computer."""
import asyncio, json, sys
from playwright.async_api import async_playwright
from lz import setup, PHONE, DESK
from qa_seed import BUSY_S, BUSY_P, THEMES
VIEWS = ["home", "lookup", "reader", "photo", "watch", "myzi", "mycards", "decks", "deck", "stats", "study", "tones", "me", "settings", "debug", "grammar", "gpoint", "journey", "scrolls", "scroll"]
CHECK = r"""(view) => {
  const vis = el => !!(el.offsetParent || el.getClientRects().length);
  const app = document.querySelector('.app') || document.body;
  let text = app.innerText;
  if (view === 'debug') text = text.replace(/the word "null"/g, '');
  const bad = (text.match(/\b(null|undefined|NaN)\b|\[object Object\]/g) || []).slice(0, 3);
  const over = document.documentElement.scrollWidth - innerWidth;
  const wide = over > 1 ? [...document.querySelectorAll('.view *')].filter(e => vis(e) && e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.heat-scroll, .g-table-wrap, .jbar, .chips, .seg')).slice(0, 3).map(e => e.className.baseVal !== undefined ? e.tagName : (e.tagName + '.' + String(e.className).split(' ')[0])) : [];
  const unnamed = [...document.querySelectorAll('button, [role=button], a[href], input:not([type=hidden]), select, textarea')].filter(vis).filter(e => {
    if (e.getAttribute('aria-label') || e.getAttribute('title') || e.getAttribute('aria-labelledby')) return false;
    if ((e.tagName === 'INPUT' || e.tagName === 'SELECT' || e.tagName === 'TEXTAREA')) { if (e.id && document.querySelector('label[for="' + e.id + '"]')) return false; if (e.closest('label')) return false; return !e.placeholder; }
    return !(e.textContent || '').trim() && !e.querySelector('svg[aria-label], img[alt]');
  }).slice(0, 4).map(e => e.tagName + '.' + String(e.className).split(' ')[0]);
  const overlap = [...document.querySelectorAll('.view .fold-head')].filter(vis).filter(h => {
    const l = h.querySelector('.fold-label'), t = h.querySelector('.fold-title'), tools = h.querySelector('.fold-tools'); if (!l || !t || !tools) return false;
    const a = l.getBoundingClientRect(), b = tools.getBoundingClientRect(); return a.right > b.left + 2 && a.bottom > b.top + 2 && a.top < b.bottom - 2;
  }).length;
  return { bad, over: over > 1 ? over : 0, wide, unnamed, overlap };
}"""
async def main():
    only = sys.argv[1:] or THEMES
    res = []
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for th in only:
            for mode in ("light", "dark"):
                for opts, dev in ((PHONE, "phone"), (DESK, "desk")):
                    ctx, pg, errs = await setup(b, opts, {**BUSY_S, "preset": th, "mode": mode, "unlockAll": True}, BUSY_P)
                    await pg.goto("http://localhost:8765/t.html#home"); await pg.wait_for_function("!document.querySelector('.dict-progress')", timeout=40000); await pg.wait_for_timeout(900)
                    await pg.evaluate("document.querySelector('#questpop')?.remove()")
                    for v in VIEWS:
                        n0 = len(errs)
                        if v == "deck": await pg.evaluate("__t.getUi().deckId = 'welcome'")
                        if v == "gpoint": await pg.evaluate("(async () => { await __t.loadGrammar(); __t.getUi().gram = __t.grammar.list[3].id; })()"); await pg.wait_for_timeout(300)
                        if v == "scroll": await pg.evaluate("__t.getUi().scrollId = 1")
                        await pg.evaluate(f"location.hash = '{v}'"); await pg.wait_for_timeout(650)
                        await pg.evaluate("document.querySelectorAll('.view .fold.closed .fold-btn').forEach(b => b.click())"); await pg.wait_for_timeout(250)
                        r = await pg.evaluate(CHECK, v)
                        r["errors"] = errs[n0:]
                        if r["bad"] or r["over"] or r["unnamed"] or r["overlap"] or r["errors"]:
                            res.append({"theme": th, "mode": mode, "dev": dev, "view": v, **r})
                    await pg.evaluate("location.hash='home'"); await ctx.close()
            print(th, "done, issues so far:", len(res), flush=True)
        await b.close()
    json.dump(res, open("qa_c.json", "w"), ensure_ascii=False, indent=0)
asyncio.run(main())
