// Engine checks. Prints only pass/fail and timings (never dictionary contents).
const fs = require("fs");
const Engine = require("../src/engine.js");
const t0 = Date.now();
const n = Engine.parse(fs.readFileSync(process.argv[2], "utf8"));
const tParse = Date.now() - t0;
let pass = 0, fail = 0;
function check(name, ok, detail) { if (ok) pass++; else { fail++; console.log("FAIL", name, detail === undefined ? "" : detail); } }
function rankOf(groups, simp, groupTitle) {
  const g = groupTitle ? groups.find(x => x.title.startsWith(groupTitle)) : groups[0];
  if (!g) return "no group";
  const k = g.items.findIndex(e => e.s === simp);
  return k;
}

check("entries loaded", n > 120000, n);
const marks = [["ni3 hao3", "nǐ hǎo"], ["lu:4", "lǜ"], ["nu:3 er2", "nǚ ér"], ["xiu1", "xiū"], ["gui4", "guì"], ["ma5", "ma"], ["Zhong1 guo2", "Zhōng guó"], ["er4", "èr"], ["dou1", "dōu"], ["lve4", "lüè"]];
for (const [a, b] of marks) check("tone marks " + a, Engine.toMarks(a) === b, Engine.toMarks(a));
check("syllable tones", Engine.syllables("ni3 hao3 ma5").map(x => x.tone).join() === "3,3,5");

const t1 = Date.now();
const top = [
  ["你好", "你好", null], ["nihao", "你好", "Pinyin"], ["ni3hao3", "你好", "Pinyin"], ["nǐ hǎo", "你好", "Pinyin"],
  ["ni hao", "你好", "Pinyin"], ["water", "水", "English"], ["eat", "吃", "English"], ["teacher", "老师", "English"],
  ["to eat", "吃", "English"], ["China", "中国", "English"], ["thank you", "谢谢", "English"], ["學生", "学生", null],
  ["xie4xie5", "谢谢", "Pinyin"], ["zhongguo", "中国", "Pinyin"], ["cat", "猫", "English"], ["book", "书", "English"],
];
for (const [q, want, g] of top) {
  const r = rankOf(Engine.search(q), want, g);
  check(`search "${q}" top result`, r === 0, "rank " + r);
}
const firstEnglish = (Engine.search("hello").find(g => g.title === "English") || { items: [] }).items.findIndex(e => e.s === "你好");
check("hello finds nihao in top 5", firstEnglish >= 0 && firstEnglish < 5, firstEnglish);
const ma1 = Engine.search("ma1");
check("ma1 finds mum", rankOf(ma1, "妈", "Pinyin") >= 0 && rankOf(ma1, "妈", "Pinyin") < 5, rankOf(ma1, "妈", "Pinyin"));
check("prefix search 'zhon' offers words", Engine.search("zhon").some(g => g.items.length > 0));
const tSearch = Date.now() - t1;

const seg = [
  ["我是学生。", "我|是|学生|。"], ["我喜欢喝中国茶", "我|喜欢|喝|中国|茶"], ["今天天气很好", "今天|天气|很|好"],
  ["你叫什么名字？", "你|叫|什么|名字|？"], ["他们在学校学习汉语", "他们|在|学校|学习|汉语"], ["Hi 你好!", "Hi |你好|!"],
];
for (const [text, want] of seg) {
  const got = Engine.segment(text).map(x => x.text).join("|");
  check("split " + want, got === want, got.split("|").length + " parts");
}
const w = Engine.wordOfDay(new Date(2026, 9, 11));
check("word of the day is HSK 1", w && w.h === 1);
check("measure words parsed", Engine.lookup("书").some(e => Engine.measureWords(e).length > 0));
check("character breakdown", Engine.chars("学生").length === 2 && Engine.chars("学生").every(c => c.entry));

const t2 = Date.now();
let long = ""; for (let i = 0; i < 200; i++) long += "我们今天在北京的学校里学习了很多新的汉字和词语。";
Engine.segment(long);
const tSeg = Date.now() - t2;
console.log(`pass=${pass} fail=${fail} | parse ${tParse}ms, searches ${tSearch}ms (incl. English index), split ${[...long].length} chars ${tSeg}ms`);
