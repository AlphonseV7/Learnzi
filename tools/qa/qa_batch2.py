"""15 Oct batch: back history, tap any Chinese, deck tiles, clock, review waiting, one play button,
settings search, voice check, unlock everything, journey seal and sheets, top bar on narrow phones."""
import asyncio, json
from playwright.async_api import async_playwright
from lz import setup, PHONE
from qa_seed import BUSY_S, BUSY_P, THEMES
URL = "http://localhost:8765/t.html"
A360 = {"viewport": {"width": 360, "height": 780}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True}
R = []
def rec(name, ok, note=""):
    R.append(bool(ok)); print(("PASS " if ok else "FAIL ") + name + " | " + str(note)[:260])
async def ready(pg, hash="home"):
    await pg.goto(URL + "#" + hash); await pg.wait_for_function("!document.querySelector('.dict-progress')", timeout=40000); await pg.wait_for_timeout(900)
    await pg.evaluate("document.querySelectorAll('.toast').forEach(t => t.remove())")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx, pg, errs = await setup(b, A360, {**BUSY_S, "preset": "ink"}, BUSY_P)
        await ready(pg)
        # back history
        await pg.evaluate("__t.go('lookup')"); await pg.wait_for_timeout(300)
        await pg.evaluate("__t.go('settings')"); await pg.wait_for_timeout(300)
        await pg.evaluate("history.back()"); await pg.wait_for_timeout(500)
        v1 = await pg.evaluate("__t.getUi().view")
        await pg.evaluate("__t.openWord('你好')"); await pg.wait_for_timeout(500)
        await pg.evaluate("history.back()"); await pg.wait_for_timeout(500)
        v2 = await pg.evaluate("[__t.getUi().view, document.querySelector('#panel').classList.contains('open')]")
        await pg.evaluate("history.back()"); await pg.wait_for_timeout(500)
        v3 = await pg.evaluate("__t.getUi().view")
        rec("back goes back a page, and closes a pop-up first", v1 == "lookup" and v2 == ["lookup", False] and v3 == "home", [v1, v2, v3])
        # tap any Chinese: the page title 主页 and the clock's date
        await pg.evaluate("__t.go('home')"); await pg.wait_for_timeout(400)
        el = pg.locator(".page-head .hz, .page-zh, h1 .hz").first
        if not await el.count(): el = pg.locator("text=主页").first
        await el.click(); await pg.wait_for_timeout(500)
        got = await pg.evaluate("[document.querySelector('#panel').classList.contains('open'), document.querySelector('#pv .hz')?.textContent]")
        rec("tapping Chinese in a page title opens the word", got[0] and "主页" in (got[1] or ""), got)
        await pg.evaluate("__t.closePanel()"); await pg.wait_for_timeout(300)
        await pg.locator(".nav button").first.click(); await pg.wait_for_timeout(400)
        nav = await pg.evaluate("[document.querySelector('#panel').classList.contains('open'), __t.getUi().view]")
        rec("the bottom tabs still just change page", nav == [False, "home"], nav)
        # clock: no Change link, side by side
        ck = await pg.evaluate("[!![...document.querySelectorAll('.clock-card button')].find(b => b.textContent === 'Change'), !!document.querySelector('.clock-body.layout-side')]")
        rec("clock: no Change link; side by side by default", ck == [False, True], ck)
        # deck tiles the same height
        hs = await pg.evaluate("[...document.querySelectorAll('.deck-mini')].map(x => Math.round(x.getBoundingClientRect().height))")
        rec("Your decks: every tile the same height", len(hs) >= 2 and max(hs) - min(hs) <= 2, hs)
        # one play button: no voice buttons anywhere
        await pg.evaluate("__t.openWord('谢谢')"); await pg.wait_for_timeout(700)
        vb = await pg.evaluate("document.querySelectorAll('.voice-src').length")
        rec("only a play button (no voice buttons)", vb == 0, vb)
        await pg.evaluate("__t.closePanel()")
        # review: a card you're still learning waits for its time
        await pg.evaluate("__t.startStudy()"); await pg.wait_for_timeout(700)
        await pg.evaluate("__t.commit({ typeAnswers: false })")
        await pg.evaluate("__t.reveal()"); await pg.wait_for_timeout(200)
        k = await pg.evaluate("__t.study.cur.k")
        await pg.evaluate("__t.grade(1)"); await pg.wait_for_timeout(300)
        w = await pg.evaluate(f"[__t.study.waiting.map(x => x.k), __t.study.queue.some(x => x.k === {json.dumps(k)})]")
        rec("Again: the card waits for its time instead of coming back 3 cards later", k in w[0] and not w[1], [k, w])
        await pg.evaluate("__t.study.queue = []; __t.nextCard(); __t.render(false)"); await pg.wait_for_timeout(300)
        wt = await pg.evaluate("document.querySelector('.summary.wait h2')?.textContent || ''")
        await pg.locator("text=Review it now").click(); await pg.wait_for_timeout(400)
        now = await pg.evaluate("__t.study.cur && __t.study.cur.k")
        rec("only waiting cards left: 'Next card in …', and Review it now works", wt.startswith("Next card in") and now == k, [wt, now])
        # settings search
        await pg.evaluate("__t.go('settings')"); await pg.wait_for_timeout(700)
        await pg.fill("#set-q", "goal"); await pg.wait_for_timeout(300)
        vis = await pg.evaluate("[...document.querySelectorAll('.settings-view .set-row')].filter(r => r.offsetParent).map(r => r.querySelector('label')?.textContent)")
        await pg.fill("#set-q", "zzzz"); await pg.wait_for_timeout(200)
        none = await pg.evaluate("!document.querySelector('.set-none-note').hidden")
        await pg.fill("#set-q", ""); await pg.wait_for_timeout(200)
        allc = await pg.evaluate("[...document.querySelectorAll('.settings-view > .card')].filter(c => c.offsetParent).length")
        rec("settings search: finds Daily goal, says when nothing matches, clears", "Daily goal" in vis and len(vis) <= 3 and none and allc >= 8, [vis, none, allc])
        # nothing wider than the screen at 100% with every box open
        await pg.evaluate("__t.commit({ scale: 1 }); document.querySelectorAll('.view .fold.closed .fold-btn').forEach(b => b.click())"); await pg.wait_for_timeout(600)
        sw = await pg.evaluate("document.documentElement.scrollWidth")
        rec("Settings at 100% on a 360-px phone: nothing wider than the screen", sw <= 360, sw)
        # voice check
        await pg.locator("text=Check every voice").click(); await pg.wait_for_timeout(6500)
        vc = await pg.evaluate("[...document.querySelectorAll('.voice-list li')].map(l => l.textContent)")
        rec("Check every voice reports all three voices", len(vc) == 3, vc)
        # unlock everything: garden and journey (display only)
        before = await pg.evaluate("JSON.stringify(__t.getState().journey)")
        await pg.evaluate("__t.commit({ unlockAll: true }); __t.render(false)")
        await pg.evaluate("__t.go('journey')"); await pg.wait_for_timeout(1800)
        u = await pg.evaluate("[__t.doneCount(), document.querySelector('.j-status b')?.textContent]")
        await pg.evaluate("__t.commit({ unlockAll: false })")
        after = await pg.evaluate("JSON.stringify(__t.getState().journey)")
        rec("Unlock everything shows the whole journey, without changing real progress", u[0] == 20 and "complete" in (u[1] or "").lower() and before == after, u)
        # journey sheets: × closes; the toolbar's sheets
        await pg.evaluate("__t.go('home')"); await pg.evaluate("__t.go('journey')"); await pg.wait_for_timeout(1600)
        await pg.locator(".jbar-btn", has_text="List").click(); await pg.wait_for_timeout(500)
        x = await pg.evaluate("!!document.querySelector('#jsheet .jsheet-x') && ![...document.querySelectorAll('#jsheet button')].some(b => b.textContent === 'Close')")
        await pg.click("#jsheet .jsheet-x"); await pg.wait_for_timeout(400)
        gone = await pg.evaluate("!document.querySelector('#jsheet')")
        rec("journey sheets: × at the top, no Close at the bottom, × closes", x and gone, [x, gone])
        # swipe down to close a sheet
        await pg.locator(".jbar-btn", has_text="Rewards").click(); await pg.wait_for_timeout(500)
        await pg.evaluate("""(() => { const p = document.querySelector('.jsheet-panel'); const r = p.getBoundingClientRect();
          const t = (y) => new Touch({ identifier: 1, target: p, clientX: r.left + 40, clientY: y });
          p.dispatchEvent(new TouchEvent('touchstart', { touches: [t(r.top + 30)], bubbles: true, cancelable: true }));
          for (let y = 40; y <= 260; y += 30) p.dispatchEvent(new TouchEvent('touchmove', { touches: [t(r.top + y)], bubbles: true, cancelable: true }));
          p.dispatchEvent(new TouchEvent('touchend', { touches: [], bubbles: true, cancelable: true })); })()""")
        await pg.wait_for_timeout(500)
        rec("pulling a sheet down closes it", await pg.evaluate("!document.querySelector('#jsheet')"))
        rec("no errors", not errs, errs[:3])
        await ctx.close()
        # the top bar on a 360-px phone in every theme: the name fits, nothing overflows
        bad = []
        for t in THEMES:
            ctx, pg, errs = await setup(b, A360, {**BUSY_S, "preset": t, "nickname": "LearnZì"}, BUSY_P)
            await ready(pg)
            r = await pg.evaluate("[document.documentElement.scrollWidth, (n => n.scrollWidth <= n.clientWidth + 1)(document.querySelector('.me-name'))]")
            if r[0] > 360 or not r[1] or errs: bad.append((t, r, errs[:1]))
            await ctx.close()
        rec("top bar on a 360-px phone, all 10 themes: name fits, no overflow", not bad, bad)
        await b.close()
    print("TOTAL", sum(R), "pass,", len(R) - sum(R), "fail")
asyncio.run(main())
