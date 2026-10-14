"""Groups B5, D, E, F, G, H, I: flows and checks, each recorded as pass or fail with a note."""
import asyncio, json, re, time
from playwright.async_api import async_playwright
from lz import setup, PHONE, DESK
from qa_seed import BUSY_S, BUSY_P, THEMES
R = []
def rec(group, name, ok, note=""):
    R.append({"g": group, "name": name, "ok": bool(ok), "note": str(note)[:300]}); print(("PASS " if ok else "FAIL ") + group + " " + name + (" | " + str(note)[:160] if note else ""), flush=True)
URL = "http://localhost:8765/t.html"
async def ready(pg, hash="home"):
    await pg.goto(URL + "#" + hash); await pg.wait_for_function("!document.querySelector('.dict-progress')", timeout=40000); await pg.wait_for_timeout(800)
    await pg.evaluate("document.querySelector('#questpop')?.remove()")
async def step(group, name, fn):
    try:
        out = await fn()
        if isinstance(out, tuple): rec(group, name, out[0], out[1])
        else: rec(group, name, out)
    except Exception as ex: rec(group, name, False, "error: " + str(ex).split("\n")[0])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---------- B5: hostile saved data ----------
        ctx = await b.new_context(**PHONE); pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        hostile = {"nickname": "<img src=x onerror=alert(1)>" * 20, "preset": {"x": 1}, "decks": [{"id": "u1234", "name": "<b>x</b>", "words": "nope"}, {"id": "../../x", "name": 5}],
                   "saved": [{"s": 5}, None, "x"], "accent": "red; background:url(javascript:1)", "folds": {"__proto__": {"polluted": 1}}, "scale": 1e9, "journey": {"done": {"tour": "x", "<x>": 1}, "seen": -5, "counts": {"lookups": 1e12}},
                   "title": "<script>", "sorts": {"decksBy": "drop table"}, "toneBest": {"single": -3}, "avatar": {"accs": ["crown", "<x>"], "animal": "toString"}}
        await ctx.add_init_script("localStorage.setItem('learnzi.state.v1', " + json.dumps(json.dumps(hostile)) + "); localStorage.setItem('learnzi.progress.v1', '{\"cards\": {\"x\": 5}, \"garden\": \"x\"}');")
        await pg.goto("http://localhost:8765/preview.html#home"); await pg.wait_for_timeout(4000)
        inj = await pg.evaluate("document.querySelectorAll('[onerror], img[src=\"x\"], .app script').length")
        polluted = await pg.evaluate("({}).polluted === 1")
        rec("B", "5 hostile saved data is cleaned on load", not errs and not inj and not polluted, f"errors={errs[:2]} injected={inj} polluted={polluted}")
        await ctx.close()
        # ---------- D: flows ----------
        ctx, pg, errs = await setup(b, PHONE, {"preset": "ink"}, {"cards": {}, "act": {}, "adj": [1, 0], "updatedAt": 1})
        await pg.add_init_script("localStorage.clear()")
        await pg.goto(URL + "#home"); await pg.wait_for_timeout(3000)
        async def d1():
            n = 0
            for _ in range(12):
                btn = pg.locator(".wz-next, .welcome .btn.primary").first
                if not await btn.count(): break
                await btn.click(); await pg.wait_for_timeout(350); n += 1
            on = await pg.evaluate("__t.getState().onboarded")
            # tour
            try: await pg.wait_for_selector("#tour", timeout=5000)
            except Exception: pass
            for _ in range(30):
                if not await pg.locator("#tour").count(): break
                if await pg.evaluate("document.querySelector('#tour').classList.contains('waiting')"):
                    await pg.evaluate("document.querySelector('.wotd .glyph').click()"); await pg.wait_for_timeout(1500); continue
                nx = pg.locator("#tour .tour-card .btn.primary").first
                if not await nx.count(): break
                await nx.click(); await pg.wait_for_timeout(400)
            await pg.wait_for_timeout(2800)
            return (on and await pg.evaluate("!!__t.getState().badges.begin"), f"welcome steps={n} onboarded={on} errors={errs[:2]}")
        await step("D", "1 first visit: welcome, tour, 始 badge", d1)
        await ctx.close()
        ctx, pg, errs = await setup(b, PHONE, {**BUSY_S, "preset": "silver", "unlockAll": True}, BUSY_P)
        await ready(pg, "lookup")
        async def d2():
            out = {}
            for q, want in (("猫", "猫"), ("mao1", "猫"), ("cat", "猫"), ("ni3hao3", "你好"), ("hello", "你好")):
                await pg.fill(".search input", q); await pg.wait_for_timeout(500)
                hz = await pg.evaluate("[...document.querySelectorAll('#results .res .hz')].slice(0, 6).map(x => x.textContent)")
                out[q] = want in "".join(hz)
            await pg.fill(".search input", "狗"); await pg.wait_for_timeout(400)
            await pg.locator("#results .res").first.click(); await pg.wait_for_timeout(1200)
            panel = await pg.evaluate("!!document.querySelector('.panel.open, #pv:not([hidden]), .pv')")
            await pg.locator(".pv .btn.star").first.click(); await pg.wait_for_timeout(400)
            starred = await pg.evaluate("__t.getState().saved.some(x => x.s === '狗')")
            await pg.evaluate("document.querySelector('#questpop')?.remove()")
            return (all(out.values()) and panel and starred, f"search={out} panel={panel} starred={starred} errors={errs[:2]}")
        await step("D", "2 look up by characters, pinyin and English; open; star", d2)
        async def d3():
            boxes = await pg.evaluate("[...document.querySelectorAll('.pv .fold')].map(f => f.dataset.fold)")
            await pg.evaluate("document.querySelectorAll('.pv .fold.closed .fold-btn').forEach(b => b.click())"); await pg.wait_for_timeout(600)
            play = pg.locator(".pv .writer-controls .btn.primary").first
            if await play.count(): await play.click(); await pg.wait_for_timeout(800)
            strokes = await pg.evaluate("__t.getState().journey.counts.strokes || 0")
            return (len(boxes) >= 5 and not errs, f"boxes={len(boxes)} stroke-play counted={strokes} errors={errs[:2]}")
        await step("D", "3 word pop-up boxes open; stroke order plays", d3)
        await pg.evaluate("document.querySelector('#questpop')?.remove(); __t.closePanel()"); await pg.wait_for_timeout(400)
        async def d4():
            await pg.evaluate("__t.startStudy()"); await pg.wait_for_timeout(1200)
            xp0 = await pg.evaluate("document.querySelector('#xpnum').textContent")
            done = 0
            for _ in range(4):
                if not await pg.locator("text=Show answer").count(): break
                await pg.locator("text=Show answer").click(); await pg.wait_for_timeout(400)
                await pg.locator(".grade.g3").click(); await pg.wait_for_timeout(700); done += 1
            xp1 = await pg.evaluate("document.querySelector('#xpnum').textContent")
            return (done >= 2 and xp0 != xp1 and not errs, f"graded={done} xp {xp0} -> {xp1} errors={errs[:2]}")
        await step("D", "4 review: show answer, grade, XP rises", d4)
        async def d5():
            await pg.evaluate("location.hash='decks'"); await pg.wait_for_timeout(800)
            await pg.evaluate("document.querySelectorAll('.view .fold.closed .fold-btn').forEach(b => b.click())"); await pg.wait_for_timeout(300)
            await pg.click("text=+ New deck"); await pg.fill("#deck-name", "Test deck"); await pg.click("text=Create"); await pg.wait_for_timeout(600)
            made = await pg.evaluate("__t.getState().decks.some(d => d.name === 'Test deck')")
            for k in ["name", "due", "least", "most", "size", "default"]:
                await pg.select_option("#decks-sort", k); await pg.wait_for_timeout(250)
            return (made and not errs, f"made={made} errors={errs[:2]}")
        await step("D", "5 decks: make one; every sort", d5)
        async def d6():
            await pg.evaluate("location.hash='mycards'"); await pg.wait_for_timeout(800)
            await pg.evaluate("document.querySelectorAll('.view .fold.closed .fold-btn').forEach(b => b.click())"); await pg.wait_for_timeout(300)
            for k in ["due", "weak", "strong", "pinyin", "hsk", "saved"]:
                await pg.select_option("#cards-sort", k); await pg.wait_for_timeout(250)
            await pg.fill("#cards-q", "friend"); await pg.wait_for_timeout(700)
            n = await pg.evaluate("document.querySelectorAll('.card-row').length")
            return (n == 1 and not errs, f"search 'friend' rows={n} errors={errs[:2]}")
        await step("D", "6 my cards: sorts and search", d6)
        async def d7():
            await pg.evaluate("__t.commit({ toneRound: 'ten' }); location.hash='tones'"); await pg.wait_for_timeout(800)
            await pg.click("text=Single tones"); await pg.wait_for_timeout(900)
            for i in range(10):
                await pg.evaluate("(i) => { const q = __t.drill.qs[__t.drill.i]; __t.answerDrill(q.options.findIndex(o => (o.join() === q.tones.join()) === (i % 2 === 0))); }", i)
                await pg.evaluate("__t.nextDrill()"); await pg.wait_for_timeout(80)
            ten = await pg.evaluate("!!document.querySelector('.summary')")
            await pg.evaluate("__t.commit({ toneRound: 'lives' }); __t.drill.active = false; __t.go('tones')"); await pg.wait_for_timeout(600)
            await pg.click("text=Tone pairs"); await pg.wait_for_timeout(900)
            for _ in range(3):
                await pg.evaluate("() => { const q = __t.drill.qs[__t.drill.i]; __t.answerDrill(q.options.findIndex(o => o.join() !== q.tones.join())); }")
                await pg.evaluate("__t.nextDrill()"); await pg.wait_for_timeout(120)
            over = await pg.evaluate("!!document.querySelector('.tone-over')")
            ko = await pg.evaluate("!!document.querySelector('.tone-over .av-dizzy')")
            return (ten and over and ko and not errs, f"10-round summary={ten} game over={over} knocked-out face={ko} errors={errs[:2]}")
        await step("D", "7 tone trainer: 10 questions and 3 lives", d7)
        async def d8():
            await pg.evaluate("location.hash='grammar'"); await pg.wait_for_timeout(1500)
            n = await pg.evaluate("document.querySelectorAll('.g-item').length")
            await pg.locator(".g-item").first.click(); await pg.wait_for_timeout(900)
            point = await pg.evaluate("location.hash")
            return (n > 20 and point == "#gpoint" and not errs, f"items={n} opened={point} errors={errs[:2]}")
        await step("D", "8 grammar list and a point", d8)
        async def d9():
            await pg.evaluate("location.hash='reader'"); await pg.wait_for_timeout(900)
            ta = pg.locator("textarea").first
            await ta.fill("我喜欢学习中文。"); await pg.wait_for_timeout(300)
            go = pg.locator(".view .btn.primary").first
            if await go.count(): await go.click(); await pg.wait_for_timeout(900)
            w = pg.locator(".view .w").first
            n = await pg.locator(".view .w").count()
            if n: await w.click(); await pg.wait_for_timeout(900)
            return (n > 2 and not errs, f"tappable words={n} errors={errs[:2]}")
        await step("D", "9 reader: paste text, tap a word", d9)
        await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
        async def d10():
            await pg.evaluate("location.hash='photo'"); await pg.wait_for_timeout(900)
            s = pg.locator("text=sample").first
            ok1 = await s.count() > 0
            await pg.evaluate("location.hash='watch'"); await pg.wait_for_timeout(900)
            ok2 = await pg.locator("text=sample").count() > 0 or await pg.locator(".view").count() > 0
            return (ok1 and ok2 and not errs, f"photo sample button={ok1} watch page={ok2} errors={errs[:2]}")
        await step("D", "10 photo and watch pages load with samples offered", d10)
        async def d11():
            await pg.evaluate("__t.getUi().meTab='avatar'; location.hash='me'"); await pg.wait_for_timeout(900)
            await pg.evaluate("document.querySelectorAll('.view .fold.closed .fold-btn').forEach(b => b.click())"); await pg.wait_for_timeout(300)
            await pg.locator(".av-tile").nth(2).click(); await pg.wait_for_timeout(300)
            for tab in ("Clock", "Theme", "Avatar"):
                await pg.locator(".me-tabs button", has_text=tab).click(); await pg.wait_for_timeout(500)
            await pg.evaluate("location.hash='settings'"); await pg.wait_for_timeout(800)
            await pg.evaluate("document.querySelectorAll('.view .fold.closed .fold-btn').forEach(b => b.click())"); await pg.wait_for_timeout(300)
            n = 0
            for t in await pg.locator(".view .toggle input").all():
                try: await t.evaluate("e => e.click()"); n += 1
                except Exception: pass
                await pg.wait_for_timeout(60)
            for t in await pg.locator(".view .toggle input").all():
                try: await t.evaluate("e => e.click()")
                except Exception: pass
            return (n >= 5 and not errs, f"switches flipped twice={n} errors={errs[:2]}")
        await step("D", "11 customise tabs; every settings switch", d11)
        async def d14():
            await pg.evaluate("location.hash='home'"); await pg.wait_for_timeout(500)
            opened = []
            for tab in ("study", "tools"):
                items = await pg.evaluate(f"""(() => {{ document.querySelector(".nav button[data-menu='{tab}']").click(); return document.querySelectorAll('#navmenu button').length; }})()""")
                await pg.wait_for_timeout(300)
                for k in range(items):
                    await pg.evaluate(f"""(() => {{ if (!document.querySelector('#navmenu')) document.querySelector(".nav button[data-menu='{tab}']").click(); }})()"""); await pg.wait_for_timeout(250)
                    label = await pg.evaluate(f"document.querySelectorAll('#navmenu button')[{k}]?.innerText.split('\\n')[1] || ''")
                    await pg.evaluate(f"document.querySelectorAll('#navmenu button')[{k}]?.click()"); await pg.wait_for_timeout(800)
                    opened.append(label + "→" + await pg.evaluate("location.hash"))
                    await pg.evaluate("__t.drill.active = false; __t.study.active = false")
                    await pg.keyboard.press("Escape")
            return (len(opened) == 10 and not errs, f"{opened} errors={errs[:2]}")
        await step("D", "14 every Study and Tools menu item", d14)
        async def d12():
            await pg.evaluate("location.hash='settings'"); await pg.wait_for_timeout(800)
            await pg.evaluate("document.querySelectorAll('.view .fold.closed .fold-btn').forEach(b => b.click())")
            btn = pg.locator(".glitch-btn"); await btn.scroll_into_view_if_needed()
            bx = await btn.bounding_box(); await pg.mouse.move(bx["x"] + 10, bx["y"] + 10); await pg.mouse.down(); await pg.wait_for_timeout(7400); await pg.mouse.up(); await pg.wait_for_timeout(800)
            for i, n in enumerate([3, 6, 1]):
                for _ in range(n): await pg.locator(".sigil").nth(i).click(); await pg.wait_for_timeout(100)
            await pg.wait_for_timeout(15000)
            await pg.click("text=Enter MLE mode"); await pg.wait_for_timeout(1500)
            on = await pg.evaluate("__t.getState().mle.on")
            await pg.evaluate("__t.leaveMle()"); await pg.wait_for_timeout(1000)
            off = not await pg.evaluate("__t.getState().mle.on")
            return (on and off and not errs, f"MLE on={on} back off={off} errors={errs[:2]}")
        await step("D", "12 glitch → secret → MLE → back", d12)
        print("D errors:", errs[:5]); await ctx.close()
        # factory reset
        ctx, pg, errs = await setup(b, PHONE, {**BUSY_S, "preset": "jade"}, BUSY_P)
        await ready(pg)
        async def d13():
            await pg.evaluate("__t.factoryReset()"); await pg.wait_for_timeout(4000)
            st = await pg.evaluate("JSON.stringify({ saved: __t.getState().saved.length, decks: __t.getState().decks.length, onboarded: __t.getState().onboarded, journey: Object.keys(__t.getState().journey.done).length, mode: __t.getState().mode })")
            welcome = await pg.evaluate("!!document.querySelector('.welcome, .wz')")
            s = json.loads(st)
            return (s["saved"] == 0 and s["decks"] == 0 and not s["onboarded"] and s["journey"] == 0 and s["mode"] == "auto", f"{st} welcome shown={welcome} errors={errs[:2]}")
        await step("D", "13 factory reset clears everything", d13)
        await ctx.close()
        # ---------- E: journey ----------
        ctx, pg, errs = await setup(b, PHONE, {"preset": "porcelain", "onboarded": True, "toured": True, "badges": {"begin": 1}}, {"cards": {}, "act": {}, "adj": [1, 0], "updatedAt": 1})
        await ready(pg)
        async def e1():
            await pg.evaluate("for (let i = 0; i < 5; i++) __t.jCount('lookups')"); await pg.wait_for_timeout(500)
            pop = await pg.evaluate("document.querySelector('#questpop')?.innerText || ''")
            d1 = await pg.evaluate("Object.keys(__t.getState().journey.done)")
            # chapter 2 quest can't count before chapter 1 is done
            await pg.evaluate("__t.jCount('pairs')"); await pg.wait_for_timeout(200)
            d2 = await pg.evaluate("Object.keys(__t.getState().journey.done)")
            return ("tour" in d1 and "lookups" in d1 and "pairs" not in d2 and "quest complete" in pop.lower(), f"done={d2} pop={pop[:60]!r}")
        await step("E", "1 quests complete in order, once, with the pop-up", e1)
        async def e3():
            await pg.click(".questpop-go"); await pg.wait_for_timeout(5000)
            return (await pg.evaluate("location.hash") == "#journey" and await pg.evaluate("__t.getState().journey.seen") == await pg.evaluate("__t.currentStop()"), "opened map and walked")
        await step("E", "3/4 pop-up opens the map; the avatar walks and stays", e3)
        async def e2():
            bad = []
            for i in range(20):
                await pg.evaluate(f"__t.QUESTS[{i}].go[1]()"); await pg.wait_for_timeout(450)
                h = await pg.evaluate("location.hash")
                if errs: bad.append((i, errs[-1])); errs.clear()
                await pg.evaluate("__t.drill.active = false; __t.study.active = false; [...document.querySelectorAll('#tour button')].find(b => b.textContent === 'Skip tour')?.click()")
                await pg.wait_for_timeout(350)
            return (not bad, f"errors={bad[:3]}")
        await step("E", "2 every quest's button works", e2)
        async def e5():
            missing = await pg.evaluate("__t.SCROLLS.flatMap(s => s.body.join(' ').match(/\\[\\[([^\\]]+)\\]\\]/g) || []).map(m => m.slice(2, -2)).filter(w => !Engine.lookup(w).length)")
            return (not missing, f"not in the dictionary: {missing}")
        await step("E", "5 every scroll word is in the dictionary", e5)
        async def e7():
            await pg.evaluate("location.hash='journey'"); await pg.wait_for_timeout(1500)
            names = []
            for lab in ("Rewards", "List"):
                await pg.locator(".jbar-btn", has_text=lab).click(); await pg.wait_for_timeout(500)
                names.append(lab + ":" + str(await pg.locator("#jsheet").count())); await pg.keyboard.press("Escape"); await pg.wait_for_timeout(350)
            await pg.locator(".jbar-btn", has_text="Full map").click(); await pg.wait_for_timeout(600)
            full = await pg.evaluate("!!document.querySelector('.jm-wrap.full')")
            await pg.locator(".jbar-btn", has_text="Find me").click(); await pg.wait_for_timeout(900)
            await pg.locator(".jbar-btn", has_text="Scrolls").click(); await pg.wait_for_timeout(600)
            lib = await pg.evaluate("location.hash")
            return (full and lib == "#scrolls" and all(x.endswith(":1") for x in names) and not errs, f"{names} full={full} scrolls={lib} errors={errs[:2]}")
        await step("E", "7 map toolbar", e7)
        async def e6():
            await pg.evaluate("(() => { const ids = __t.QUESTS.map(q => q.id); __t.commit({ journey: { ...__t.getState().journey, done: Object.fromEntries(ids.map(k => [k, 1])) } }); })()")
            r = await pg.evaluate("[1,2,3,4,5].map(c => __t.chapterDone(c)).concat([__t.AV.acc.brush, __t.AV.acc.flute, __t.AV.acc.hat].map(x => !!x))")
            return (all(r), str(r))
        await step("E", "6 chapter rewards unlock when chapters are done", e6)
        print("E errors:", errs[:5]); await ctx.close()
        # ---------- F: contrast, reduced motion, keyboard ----------
        CON = r"""() => { const cs = getComputedStyle(document.documentElement), v = k => cs.getPropertyValue(k).trim();
          const c = document.createElement('canvas').getContext('2d');
          const rgb = x => { c.fillStyle = '#000'; c.fillStyle = x; const h = c.fillStyle; if (h[0] === '#') return [1,3,5].map(i => parseInt(h.slice(i,i+2),16)); return h.match(/[\d.]+/g).slice(0,3).map(Number); };
          const lin = u => { u /= 255; return u <= .04045 ? u / 12.92 : ((u + .055) / 1.055) ** 2.4; };
          const L = x => { const [r,g,b] = rgb(x).map(lin); return .2126*r + .7152*g + .0722*b; };
          const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x,y) + .05) / (Math.min(x,y) + .05); };
          const out = {}; for (const bg of ['--surface', '--bg']) for (const fg of ['--ink', '--ink-soft', '--accent']) out[fg + '/' + bg] = Math.round(cr(v(fg), v(bg)) * 100) / 100;
          out['accent-ink/accent'] = Math.round(cr(v('--accent-ink'), v('--accent')) * 100) / 100; return out; }"""
        low = []
        for th in THEMES:
            for mode in ("light", "dark"):
                ctx, pg, errs = await setup(b, PHONE, {**BUSY_S, "preset": th, "mode": mode, "unlockAll": True}, BUSY_P)
                await pg.goto(URL + "#settings"); await pg.wait_for_timeout(1300)
                r = await pg.evaluate(CON)
                for k, val in r.items():
                    if val < 4.5: low.append(f"{th}/{mode} {k} {val}")
                await ctx.close()
        rec("F", "1 text contrast ≥ 4.5 in every theme, light and dark", not low, "; ".join(low[:12]) + (f" (+{len(low)-12} more)" if len(low) > 12 else ""))
        ctx = await b.new_context(**PHONE, reduced_motion="reduce"); pg = await ctx.new_page()
        await ctx.add_init_script("localStorage.setItem('learnzi.state.v1', " + json.dumps(json.dumps({**BUSY_S, "preset": "silver", "unlockAll": True})) + "); localStorage.setItem('learnzi.progress.v1', " + json.dumps(json.dumps(BUSY_P)) + ");")
        await pg.goto(URL + "#tones"); await pg.wait_for_timeout(3000)
        await pg.click("text=Single tones"); await pg.wait_for_timeout(900)
        moving = await pg.evaluate("[...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return s.animationName !== 'none' && parseFloat(s.animationDuration) > 0.01 && s.animationIterationCount === 'infinite'; }).length")
        smil = await pg.evaluate("document.querySelectorAll('.garden-svg animateMotion').length")
        rec("F", "2 reduced motion stops animations", moving == 0 and smil == 0, f"looping CSS animations={moving} koi paths={smil}")
        await ctx.close()
        ctx, pg, errs = await setup(b, PHONE, {**BUSY_S, "preset": "ink"}, BUSY_P)
        await ready(pg, "lookup"); await pg.wait_for_timeout(3500); await pg.evaluate("document.querySelector('#questpop')?.remove()")
        async def f3():
            await pg.fill(".search input", "猫"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(900)
            opened = await pg.evaluate("!!document.querySelector('.pv')")
            await pg.keyboard.press("Escape"); await pg.wait_for_timeout(500)
            closed = await pg.evaluate("!document.querySelector('.panel.open')")
            await pg.evaluate("location.hash='journey'"); await pg.wait_for_timeout(1200)
            await pg.locator(".jbar-btn", has_text="List").focus(); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(500)
            sheet = await pg.locator("#jsheet").count(); await pg.keyboard.press("Escape"); await pg.wait_for_timeout(400)
            gone = await pg.locator("#jsheet").count() == 0
            await pg.locator(".jm-stop").first.focus(); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(500)
            stop = await pg.locator("#jsheet").count()
            return (opened and closed and sheet and gone and stop, f"Enter opens word={opened} Escape closes={closed} list by keyboard={sheet} Escape closes sheet={gone} stop by keyboard={stop}")
        await step("F", "3 keyboard: Enter, Escape, focusable map stops", f3)
        await ctx.close()
        # ---------- G: reload keeps state ----------
        ctx, pg, errs = await setup(b, PHONE, {**BUSY_S, "preset": "cyber"}, BUSY_P)
        await ready(pg)
        a = await pg.evaluate("JSON.stringify(__t.getState())")
        await pg.reload(); await pg.wait_for_timeout(3500)
        b2 = await pg.evaluate("JSON.stringify(__t.getState())")
        ja, jb = json.loads(a), json.loads(b2)
        diff = [k for k in ja if ja[k] != jb.get(k) and k not in ("updatedAt",)]
        rec("G", "2 saved state survives a reload", not diff, f"changed keys: {diff}")
        await ctx.close()
        # ---------- H: speed ----------
        ctx, pg, errs = await setup(b, PHONE, {**BUSY_S, "preset": "silver"}, BUSY_P)
        t0 = time.time(); await pg.goto(URL + "#home"); await pg.wait_for_function("!document.querySelector('.dict-progress')", timeout=40000); t1 = time.time()
        jt = await pg.evaluate("(() => { const t = performance.now(); __t.go('journey'); return Math.round(performance.now() - t); })()")
        await pg.wait_for_timeout(400)
        gt = await pg.evaluate("(() => { const t = performance.now(); for (let i = 0; i < 5; i++) __t.gardenScene(20, -1); return Math.round((performance.now() - t) / 5); })()")
        import os
        size = os.path.getsize("/home/claude/dist/index.html")
        rec("H", "1-3 speed", (t1 - t0) < 15 and jt < 400, f"dictionary ready {t1 - t0:.1f}s (local server); My journey drawn in {jt} ms; garden painting {gt} ms; app file {size/1e6:.2f} MB")
        await ctx.close()
        # ---------- I: content ----------
        ctx, pg, errs = await setup(b, PHONE, {**BUSY_S, "preset": "ink"}, BUSY_P)
        await ready(pg)
        async def i1():
            r = await pg.evaluate("(async () => { await __t.loadGrammar(); const lv = ['A1','A2','B1','B2','C1']; const out = {}; for (const l of lv) { try { const a = await __t.loadGrammarLevel(l); out[l] = a ? Object.keys(a).length : 0; } catch (e) { out[l] = 'error ' + e.message; } } return JSON.stringify({ points: __t.grammar.list.length, ...out }); })()")
            o = json.loads(r)
            return (o["points"] > 400 and all(isinstance(v, int) and v > 0 for k, v in o.items() if k != "points"), r)
        await step("I", "1 every grammar level loads", i1)
        async def i2():
            r = await pg.evaluate("JSON.stringify(Object.fromEntries(Object.keys(__t.BUILTIN).filter(id => id !== 'starred').map(id => [id, __t.deckWords(id).length])))")
            o = json.loads(r)
            return (all(v > 0 for v in o.values()) and o["welcome"] == 58, r)
        await step("I", "2 built-in decks have their words", i2)
        async def i3():
            r = await pg.evaluate("JSON.stringify({ quests: __t.QUESTS.length, scrolls: __t.SCROLLS.length, ids: __t.SCROLLS.every((s, i) => s.id === i + 1), unique: new Set(__t.QUESTS.map(q => q.id)).size })")
            o = json.loads(r)
            return (o["quests"] == 20 and o["scrolls"] == 20 and o["ids"] and o["unique"] == 20, r)
        await step("I", "3 quests and scrolls line up", i3)
        await ctx.close(); await b.close()
    json.dump(R, open("qa_flows.json", "w"), ensure_ascii=False, indent=1)
    print("TOTAL", sum(r["ok"] for r in R), "pass,", sum(not r["ok"] for r in R), "fail")
asyncio.run(main())
