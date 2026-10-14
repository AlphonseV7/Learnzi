"""Daily goal, typed answers and Sentence cards, in the browser."""
import asyncio, json, copy
from playwright.async_api import async_playwright
from lz import setup, PHONE, DESK
from qa_seed import BUSY_S, BUSY_P
URL = "http://localhost:8765/t.html"
R = []
def rec(name, ok, note=""):
    R.append(ok); print(("PASS " if ok else "FAIL ") + name + " | " + str(note)[:260])
async def ready(pg, hash="home"):
    await pg.goto(URL + "#" + hash); await pg.wait_for_function("!document.querySelector('.dict-progress')", timeout=40000); await pg.wait_for_timeout(800)
    await pg.evaluate("document.querySelector('#questpop')?.remove()")
SHOT = "/tmp/claude-0/-home-claude-learnzi/09f5072a-d5cd-5ee7-833d-039ebd283ba5/scratchpad/shots/"
async def main():
    import os; os.makedirs(SHOT, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        prog = copy.deepcopy(BUSY_P)
        day = list(prog["act"].keys())[0]
        prog["act"][day] = [4, 12, 3, 1, 6, 2, 240, 0]
        ctx, pg, errs = await setup(b, PHONE, {**BUSY_S, "preset": "ink"}, prog)
        await ready(pg)
        ring = await pg.evaluate("[!!document.querySelector('.study-prompt .goal-ring'), document.querySelector('.study-prompt .goal')?.getAttribute('aria-label')]")
        rec("A1 Home shows the goal ring", ring[0] and "4 of 10" in (ring[1] or ""), ring)
        await pg.screenshot(path=SHOT + "home.png")
        await pg.evaluate("location.hash='settings'"); await pg.wait_for_timeout(700)
        rows = await pg.evaluate("['dailygoal','sessionsize','typeanswers','sentencecards'].map(id => !!document.getElementById(id))")
        rec("A2 settings rows", all(rows), rows)
        # Session length 20
        await pg.evaluate("__t.commit({ activeDecks: ['starred','welcome','nhsk1'] }); __t.startStudy()"); await pg.wait_for_timeout(900)
        total = await pg.evaluate("__t.study.queue.length + 1")
        rec("A3 a session holds at most 20 cards", 0 < total <= 20, total)
        # Typed answer: right
        async def answer_right():
            cur = await pg.evaluate("[__t.study.cur.k, __t.study.cur.e.p, __t.Engine.senses(__t.study.cur.e)[0]]")
            t = cur[0][-1]
            text = cur[2].split(';')[0].replace('to ', '') if t == 'm' else cur[1].replace(' ', '')
            await pg.fill("#ta-input", text); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(500)
            return cur, text
        has_input = await pg.evaluate("!!document.querySelector('#ta-input') && document.activeElement && document.activeElement.id === 'ta-input'")
        rec("B1 typing box shows and is ready to type", has_input, has_input)
        cur, text = await answer_right()
        fb = await pg.evaluate("[document.querySelector('.ta-fb')?.className, document.querySelector('.ta-fb b')?.textContent, !!document.querySelector('.grade.suggested.g3')]")
        rec("B2 a right answer says so and suggests Good", fb[0] and "ta-good" in fb[0] and fb[2], [cur[0], text, fb])
        await pg.screenshot(path=SHOT + "typed_right.png", full_page=True)
        secs0 = await pg.evaluate("__t.todaySecs()"); done0 = await pg.evaluate("__t.study.done")
        await pg.keyboard.press("Enter"); await pg.wait_for_timeout(600)
        done1 = await pg.evaluate("__t.study.done"); secs1 = await pg.evaluate("__t.todaySecs()")
        rec("B3 Enter takes the suggested grade; practice time counts", done1 == done0 + 1 and secs1 > secs0, [done0, done1, secs0, secs1])
        # Typed answer with a wrong tone, on a forced Recall card
        await pg.evaluate("""(() => { const e = __t.Engine.lookup('你好')[0]; __t.study.queue.unshift({ k: '你好|ni3 hao3|r', e }); __t.nextCard(); __t.render(false); })()""")
        await pg.wait_for_timeout(300)
        await pg.fill("#ta-input", "ni3hao4"); await pg.click(".ta-form button"); await pg.wait_for_timeout(500)
        fb = await pg.evaluate("[document.querySelector('.ta-fb')?.className, document.querySelector('.ta-fb .ta-bad')?.textContent, !!document.querySelector('.grade.suggested.g2')]")
        rec("B4 a wrong tone is pointed out and suggests Hard", fb[0] and "ta-near" in fb[0] and fb[1] == "hǎo" and fb[2], fb)
        await pg.screenshot(path=SHOT + "typed_tone.png", full_page=True)
        await pg.click(".grade.g2"); await pg.wait_for_timeout(500)
        # Sentence card
        await pg.evaluate("__t.clozeLoad()"); await pg.wait_for_timeout(2500)
        info = await pg.evaluate("""(() => { const e = __t.Engine.lookup('你好')[0]; return [__t.cardKeys(e), __t.clozeFor(e).map(x => x.zh)]; })()""")
        rec("C1 a known word gets a Sentence card with easy sentences", any(k.endswith("|c") for k in info[0]) and len(info[1]) >= 1, info)
        await pg.evaluate("""(() => { const e = __t.Engine.lookup('你好')[0]; __t.study.queue.unshift({ k: '你好|ni3 hao3|c', e }); __t.nextCard(); __t.render(false); })()""")
        await pg.wait_for_timeout(500)
        front = await pg.evaluate("[document.querySelectorAll('.cz-gap .cz-box').length, document.querySelector('.cz-en')?.textContent, document.querySelector('.cz-line')?.textContent.includes('你好')]")
        rec("C2 the sentence shows a two-box gap and its English, without the word", front[0] == 2 and front[1] and not front[2], front)
        await pg.screenshot(path=SHOT + "cloze_front.png", full_page=True)
        await pg.fill("#ta-input", "你好"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(500)
        back = await pg.evaluate("[!!document.querySelector('.cz-back .cz-word'), document.querySelector('.ta-fb')?.className]")
        rec("C3 the answer shows the whole sentence with the word marked", back[0] and "ta-good" in (back[1] or ""), back)
        await pg.screenshot(path=SHOT + "cloze_back.png", full_page=True)
        await pg.click(".grade.g3"); await pg.wait_for_timeout(500)
        has_c = await pg.evaluate("!!__t.getProgress().cards['你好|ni3 hao3|c']")
        rec("C4 grading saves the Sentence card", has_c, has_c)
        # Goal reached
        n0 = await pg.evaluate("__t.streak()")
        await pg.evaluate("__t.commit({ dailyGoal: 5 }); __t.practiced(400, true)"); await pg.wait_for_timeout(300)
        g = await pg.evaluate("[__t.goalMet(), document.querySelector('.toast')?.textContent || '', __t.streak()]")
        rec("A4 reaching the goal marks the day, says so and counts for the streak", g[0] and "Daily goal reached" in g[1] and g[2] >= 1, [n0, g])
        # Typing off
        await pg.evaluate("__t.commit({ typeAnswers: false }); __t.startStudy()"); await pg.wait_for_timeout(700)
        off = await pg.evaluate("[!!document.querySelector('#ta-input'), document.querySelector('.flashcard .big-btn')?.className]")
        rec("B5 typing off: back to Show answer", not off[0] and "primary" in (off[1] or ""), off)
        # Sentence cards off
        await pg.evaluate("__t.commit({ sentenceCards: false })")
        k = await pg.evaluate("__t.cardKeys(__t.Engine.lookup('你好')[0])")
        rec("C5 Sentence cards switch off", not any(x.endswith("|c") for x in k), k)
        rec("no errors", not errs, errs[:3])
        await ctx.close()
        # Old days still count for the streak (before the goal arrived)
        prog2 = {"cards": {}, "act": {"2026-10-13": [0, 5, 1, 0, 0, 0], "2026-10-14": [0, 3, 1, 0, 0, 0]}, "adj": [1, 0], "updatedAt": 1}
        ctx, pg, errs = await setup(b, PHONE, {**BUSY_S}, prog2)
        await ctx.add_init_script("Date.now = (n => () => n)(new Date('2026-10-14T20:00:00').getTime());")
        await ready(pg)
        s = await pg.evaluate("__t.streak()")
        rec("A5 days before the goal keep their streak", s == 2, s)
        await ctx.close()
        # Every theme: sentence card front and typed feedback on phone, light and dark
        for theme in ["ink", "arcade", "cyber", "silver", "porcelain"]:
            for mode in ["light", "dark"]:
                ctx, pg, errs = await setup(b, PHONE, {**BUSY_S, "preset": theme, "mode": mode}, BUSY_P)
                await ready(pg)
                await pg.evaluate("__t.clozeLoad()"); await pg.wait_for_timeout(1500)
                await pg.evaluate("""(() => { __t.startStudy(); const e = __t.Engine.lookup('你好')[0]; __t.study.queue.unshift({ k: '你好|ni3 hao3|c', e }); __t.nextCard(); __t.render(false); })()""")
                await pg.wait_for_timeout(600)
                over = await pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
                await pg.screenshot(path=SHOT + f"cz_{theme}_{mode}.png")
                await pg.fill("#ta-input", "ni3hao4"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(500)
                await pg.screenshot(path=SHOT + f"fb_{theme}_{mode}.png", full_page=True)
                rec(f"looks {theme} {mode}: no overflow, no errors", not over and not errs, [over, errs[:2]])
                await ctx.close()
        await b.close()
    print("TOTAL", sum(R), "pass,", len(R) - sum(R), "fail")
asyncio.run(main())
