// Typed answers: pinyin, characters and meanings (src/ui/35b-answers.js). Run: node tools/test_answers.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/engine.js"), "utf8").replace(/^const Engine/m, "var Engine"), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/ui/35b-answers.js"), "utf8").replace(/^function /gm, "var _f = function ").replace(/var _f = function (\w+)/g, "var $1 = function $1"), ctx);
let pass = 0, fail = 0;
const check = (name, ok, got) => { if (ok) pass++; else { fail++; console.log("FAIL", name, got === undefined ? "" : JSON.stringify(got)); } };
const py = (t, p) => ctx.checkPinyin(t, p);
const kind = (t, p, k) => { const r = py(t, p); check(t + " vs " + p + " → " + k, r.kind === k, r); return r; };

kind("ni3hao3", "ni3 hao3", "right");
kind("ni3 hao3", "ni3 hao3", "right");
kind("nǐhǎo", "ni3 hao3", "right");
kind("Nǐ hǎo", "ni3 hao3", "right");
check("ní hǎo is the spoken tone change", (() => { const r = kind("ni2hao3", "ni3 hao3", "right"); return r.sandhi === true; })());
kind("nihao", "ni3 hao3", "notones");
check("one wrong tone marked", (() => { const r = kind("ni3hao4", "ni3 hao3", "tones"); return r.wrong.join() === "1"; })());
check("a missing tone is marked", (() => { const r = kind("ni3hao", "ni3 hao3", "tones"); return r.wrong.join() === "1"; })());
kind("nihoa3", "ni3 hao3", "typo");
kind("nhao", "ni3 hao3", "typo");
kind("ma", "ma1", "notones");
kind("me", "ma1", "wrong");          // short words: no typo allowance
kind("lv4", "lu:4", "right");
kind("lü4", "lu:4", "right");
kind("lu:4", "lu:4", "right");
kind("nu3", "nu:3", "wrong");        // nü is not nu
kind("dong1xi", "dong1 xi5", "right");   // neutral: no tone needed
kind("dong1xi1", "dong1 xi5", "right");  // or the original tone
kind("dong1xi5", "dong1 xi5", "right");
kind("dong5xi5", "dong1 xi5", "tones");
kind("yi2ding4", "yi1 ding4", "right");  // 一定 yídìng
kind("yi4qi3", "yi1 qi3", "right");      // 一起 yìqǐ
kind("bu2shi4", "bu4 shi4", "right");    // 不是 búshì
kind("bu2hao3", "bu4 hao3", "tones");    // 不好 stays bù
kind("xi'an1", "Xi1 an1", "tones");      // the apostrophe is ignored; xi needs its tone
kind("xi1'an1", "Xi1 an1", "right");
kind("zhongguoren", "Zhong1 guo2 ren2", "notones");
kind("zhong1guo2ren2", "Zhong1 guo2 ren2", "right");
kind("zhong1guo2ren", "Zhong1 guo2 ren2", "tones");
kind("zhonguoren2", "Zhong1 guo2 ren2", "typo");
kind("", "ni3 hao3", "empty");
kind("123", "ni3 hao3", "empty");
kind("cat", "mao1", "wrong");

// characters
const rd = (t, e, k) => { const r = ctx.checkReading(t, e); check(t + " → " + k, r.kind === k, r); return r; };
const NIHAO = { s: "你好", t: "你好", p: "ni3 hao3" };
rd("你好", NIHAO, "right");
rd(" 你好 ", NIHAO, "right");
check("one wrong character", rd("你号", NIHAO, "close").wrong.join() === "1");
rd("我", NIHAO, "wrong");
rd("學習", { s: "学习", t: "學習", p: "xue2 xi2" }, "right");
rd("学习", { s: "学习", t: "學習", p: "xue2 xi2" }, "right");

// meanings
const mn = (t, senses, k) => { const r = ctx.checkMeaning(t, senses); check("'" + t + "' → " + k, r.kind === k, r); return r; };
mn("hello", ["hello", "hi"], "right");
mn("Hi!", ["hello", "hi"], "right");
mn("like", ["to like", "to be fond of"], "right");
mn("to like", ["to like", "to be fond of"], "right");
mn("fond", ["to like", "to be fond of"], "right");
mn("be fond of", ["to like", "to be fond of"], "right");
mn("love", ["to like", "to be fond of"], "nomatch");
mn("cats", ["cat (CL:隻|只[zhi1])"], "right");
mn("cat", ["cat (CL:隻|只[zhi1])"], "right");
mn("computer", ["computer", "(Taiwan) computer"], "right");
mn("thanks", ["to thank", "thanks"], "right");
mn("thank you", ["to thank", "thanks"], "right");
mn("beautifull", ["beautiful", "pretty"], "typo");
mn("beatiful", ["beautiful", "pretty"], "typo");
mn("bus", ["bus"], "right");
mn("bud", ["bus"], "nomatch");      // short words: no typo allowance
mn("good looking", ["good-looking", "nice"], "right");
mn("to", ["to like"], "empty");
mn("teacher", ["teacher", "CL:個|个[ge4],位[wei4]"], "right");
mn("come", ["to come back", "to return"], "right");
mn("return", ["to come back", "to return"], "right");
mn("go out", ["to come back", "to return"], "nomatch");
mn("not like", ["to like"], "nomatch");
mn("you", ["you (informal)"], "right");
mn("very good", ["good", "well"], "right");

// verdicts
check("right suggests Good", ctx.verdictOf({ kind: "right" }).grade === 3);
check("typo suggests Good", ctx.verdictOf({ kind: "typo" }).grade === 3);
check("wrong tones suggest Hard", ctx.verdictOf({ kind: "tones", wrong: [1] }).grade === 2);
check("no tones suggests Hard", ctx.verdictOf({ kind: "notones" }).grade === 2);
check("wrong suggests Again", ctx.verdictOf({ kind: "wrong" }).grade === 1);
check("no meaning match leaves the grade to you", ctx.verdictOf({ kind: "nomatch" }).grade === 0);
check("edit distance counts a swap as one", ctx.editDistance("hoa", "hao") === 1);
console.log("pass=" + pass + " fail=" + fail);
process.exitCode = fail ? 1 : 0;
