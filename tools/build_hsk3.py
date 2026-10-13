"""HSK 3.0 (the 2025 syllabus) word lists for LearnZì's "HSK 3.0" decks.

Source: HSK 3.0 word list by HearMandarin (https://hearmandarin.com/datasets/), CC BY 4.0
("copy, adapt, and use it for any purpose, including commercially, as long as you give credit"),
version 2026-09-28: 11,147 words in bands 1–7 (band 7 covers the syllabus's levels 7–9).
Each word is matched to its CC-CEDICT entry in dist/dict.txt (same simplified form and pinyin), so it
gets LearnZì's meanings, recordings and flashcards. Words with no matching entry are left out and
counted.

Usage: python3 -I tools/build_hsk3.py <hsk-3-0-words.csv> dist
Writes dist/hsk3.txt: one line per word in syllabus order, "band<TAB>simplified<TAB>CC-CEDICT pinyin".
"""
import csv, re, sys, os, collections

src, dist = sys.argv[1], sys.argv[2]

def norm(p):
    p = p.lower().replace("u:", "v").replace("ü", "v")
    return re.sub(r"[^a-z0-9]", "", p)
def toneless(p):
    return re.sub(r"[0-9]", "", norm(p))

entries = collections.defaultdict(list)   # simplified → [CC-CEDICT pinyin, ...] in dictionary order
with open(os.path.join(dist, "dict.txt"), encoding="utf8") as f:
    for line in f:
        c = line.rstrip("\n").split("\t")
        if len(c) >= 3 and c[1]:
            entries[c[1]].append(c[2])

rows = [r for r in csv.DictReader(open(src, encoding="utf-8-sig")) if r.get("hsk3_band", "").strip() in list("1234567")]
rows.sort(key=lambda r: (int(r["hsk3_band"]), int(r["hsk3_seq"] or 0)))
out, missing, seen = [], collections.Counter(), set()
how = collections.Counter()
for r in rows:
    s = r["simplified"].strip()
    want = r["pinyin_num"].split("/")[0].strip()
    cands = entries.get(s, [])
    pick = next((p for p in cands if norm(p) == norm(want)), None)
    if pick: how["exact"] += 1
    else:
        # a tone written differently (e.g. a neutral tone): same syllables
        pick = next((p for p in cands if toneless(p) == toneless(want)), None)
        if pick: how["same syllables"] += 1
        elif len(cands) == 1:
            pick = cands[0]; how["only reading"] += 1
    if not pick:
        missing[r["hsk3_band"]] += 1
        continue
    key = (s, pick)
    if key in seen:
        continue
    seen.add(key)
    out.append(r["hsk3_band"] + "\t" + s + "\t" + pick)

with open(os.path.join(dist, "hsk3.txt"), "w", encoding="utf8") as f:
    f.write("\n".join(out) + "\n")
bands = collections.Counter(l.split("\t")[0] for l in out)
print(len(out), "words matched", dict(sorted(bands.items())), "| how:", dict(how), "| not in the dictionary:", dict(sorted(missing.items())), "of", len(rows))
