// Scheduler checks. Prints pass/fail only.
const SRS = require("../src/srs.js");
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) pass++; else { fail++; console.log("FAIL", name, detail === undefined ? "" : JSON.stringify(detail)); } };
const T0 = new Date(2026, 9, 11, 18, 0).getTime();
const MIN = 60000, DAY = 1440 * MIN;

// New card
const p0 = SRS.preview(null, T0);
check("new card labels", p0.join() === "1 min,6 min,10 min,14 days", p0);
let c = SRS.review(null, 3, T0);
check("good on new card is a learning step", c[7] === 1 && c[8] === 1 && c[2] === Math.floor(T0 / MIN) + 10, c);
check("xp for good", c[6] === 10, c[6]);
let t = T0 + 10 * MIN;
c = SRS.review(c, 3, t);
check("second good graduates", c[7] === 2 && c[4] === 2, c);
const dueDays = (c[2] * MIN - t) / DAY;
check("graduated interval is a few days", dueDays > 2 && dueDays < 6, dueDays);

// Review on time grows the interval; forgetting shrinks stability
t = c[2] * MIN + 2 * 3600e3;
const before = c[0];
const good = SRS.review(c, 3, t);
check("successful review raises stability", good[0] > before * 1.5, [before, good[0]]);
const again = SRS.review(c, 1, t);
check("forgetting lowers stability and relearns", again[0] < before && again[7] === 3 && again[5] === 1, again);
const labels = SRS.preview(c, t);
check("review buttons in order", labels[0] === "10 min" && /day|mo/.test(labels[3]), labels);
const outs = SRS.outcomes(c, t);
check("hard < good < easy", outs[1][2] < outs[2][2] && outs[2][2] < outs[3][2], outs.map(o => o[2]));
check("difficulty stays in 1..10", outs.every(o => o[1] >= 1 && o[1] <= 10));

// A year of Good answers stays sane
let x = null, now = T0;
for (let i = 0; i < 12; i++) { x = SRS.review(x, 3, now); now = Math.max(now + MIN, x[2] * MIN); }
check("long run interval capped and growing", x[0] > 100 && (x[2] * MIN - now) / DAY <= 3650, x[0]);

// Due and days
check("not due before time", !SRS.isDue(c, c[2] * MIN - MIN) && SRS.isDue(c, c[2] * MIN));
check("study day starts 04:00", SRS.dayKey(new Date(2026, 9, 12, 3, 30).getTime()) === "2026-10-11" && SRS.dayKey(new Date(2026, 9, 12, 4, 30).getTime()) === "2026-10-12");

// Levels
const L = SRS.levelInfo;
check("levels", L(0).level === 1 && L(99).level === 1 && L(100).level === 2 && L(249).level === 2 && L(250).level === 3 && L(250).need === 200, [L(100), L(250)]);
console.log(`pass=${pass} fail=${fail}`);
