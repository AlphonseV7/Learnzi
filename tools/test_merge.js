// Checks that flashcard progress from two devices merges without losing reviews. Pass/fail only.
const fs = require("fs"), vm = require("vm");
const ctx = { localStorage: { getItem: () => null, setItem() {} }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + "/../src/ui/00-core.js", "utf8") + "\nthis.api = { sanitizeProgress, mergeProgress, progressSig };", ctx);
const { sanitizeProgress, mergeProgress, progressSig } = ctx.api;
let pass = 0, fail = 0;
const check = (n, ok) => { if (ok) pass++; else { fail++; console.log("FAIL", n); } };
const card = (last, reps) => [3, 5, last + 100, last, reps, 0, reps * 10, 2, 0];
const phone = sanitizeProgress({ cards: { "a|a1|m": card(1000, 2), "b|b1|m": card(500, 1) }, act: { "2026-10-11": [4, 3, 2] }, updatedAt: 5 });
const pc = sanitizeProgress({ cards: { "a|a1|m": card(900, 1), "c|c1|m": card(800, 1) }, act: { "2026-10-11": [10, 1, 1], "2026-10-10": [2, 5, 1] }, updatedAt: 9 });
const m1 = mergeProgress(phone, pc), m2 = mergeProgress(pc, phone);
check("merge keeps every card", Object.keys(m1.cards).length === 3);
check("newest review of a card wins", m1.cards["a|a1|m"][3] === 1000);
check("daily counts keep the larger value", m1.act["2026-10-11"].join() === "10,3,2,0,0,0,0,0" && m1.act["2026-10-10"].join() === "2,5,1,0,0,0,0,0");
// an older copy without the watching-XP slot must not wipe it out
const oldCopy = { ...pc, act: { "2026-10-11": [1, 1, 1, 0, 0] } }, newCopy = sanitizeProgress({ ...pc, act: { "2026-10-11": [1, 1, 1, 0, 0, 7] } });
check("watching XP survives a merge with an older copy", mergeProgress(newCopy, oldCopy).act["2026-10-11"][5] === 7 && mergeProgress(oldCopy, newCopy).act["2026-10-11"][5] === 7);
const goalA = sanitizeProgress({ ...pc, act: { "2026-10-15": [0, 9, 1, 0, 0, 0, 420, 0] } }), goalB = sanitizeProgress({ ...pc, act: { "2026-10-15": [0, 20, 2, 0, 0, 0, 640, 1] } });
check("practice time and goal days survive a merge", mergeProgress(goalA, goalB).act["2026-10-15"].slice(6).join() === "640,1" && mergeProgress(goalB, oldCopy).act["2026-10-15"].slice(6).join() === "640,1");
check("merge order doesn't matter", progressSig(m1) === progressSig(m2));
check("merging twice changes nothing", progressSig(mergeProgress(m1, pc)) === progressSig(m1));
const bad = sanitizeProgress({ cards: { "x|y|m": "oops", "no-pipes": card(1, 1), "d|d1|z": card(1, 1), "e|e1|m": [1, 2, 3] }, act: { "nope": [1, 2, 3] } });
check("bad data is dropped", Object.keys(bad.cards).length === 0 && Object.keys(bad.act).length === 0);
console.log(`pass=${pass} fail=${fail}`);
// Reset from Debug settings must win over an older copy on another device.
{
  const T = 2000 * 60000;
  const old = sanitizeProgress({ cards: { "a|a1|m": card(1000, 3), "b|b1|m": card(2500, 1) }, act: { "2026-10-11": [9, 9, 9] }, epoch: 0 });
  const reset = sanitizeProgress({ cards: {}, act: {}, adj: [T, 0], epoch: T });
  const m = mergeProgress(old, reset), m2 = mergeProgress(reset, old);
  check("reset drops reviews made before it", !m.cards["a|a1|m"] && !!m.cards["b|b1|m"] && Object.keys(m.act).length === 0);
  check("reset merge is symmetric", progressSig(m) === progressSig(m2));
  const adjA = sanitizeProgress({ adj: [5, -40] }), adjB = sanitizeProgress({ adj: [9, 100] });
  check("latest XP adjustment wins", mergeProgress(adjA, adjB).adj[1] === 100 && mergeProgress(adjB, adjA).adj[1] === 100);
  const gA = sanitizeProgress({ garden: [12, 10] }), gB = sanitizeProgress({ garden: [30, 22] });
  check("garden keeps the larger count from either device", mergeProgress(gA, gB).garden.join() === "30,22" && mergeProgress(gB, gA).garden.join() === "30,22");
  check("bad garden values become zero", sanitizeProgress({ garden: ["x", -5] }).garden.join() === "0,0");
  console.log(`after reset checks: pass=${pass} fail=${fail}`);
}
