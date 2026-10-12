"""Pick beginner sentences for Home's "Sentence of the day": dist/daily.txt (same columns as sentences.tsv).

A sentence is kept when it is 5–14 characters long and every word in it is HSK 1–2 (punctuation aside).
Usage: python3 -I tools/build_daily.py   (after build_dict.py and build_data.py)
"""
import os
import random
import re

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dist = os.path.join(root, "dist")

level = {}
for line in open(os.path.join(dist, "dict.txt"), encoding="utf8"):
    c = line.rstrip("\n").split("\t")
    if len(c) != 6:
        continue
    h = int(c[4] or 0)
    for form in {c[0], c[1]}:
        if form and h:
            level[form] = min(level.get(form, 99), h)
MAXLEN = 6
CJK = re.compile(r"[㐀-鿿]")


def easy(zh):
    i = 0
    while i < len(zh):
        if not CJK.match(zh[i]):
            i += 1
            continue
        for n in range(min(MAXLEN, len(zh) - i), 0, -1):
            w = zh[i:i + n]
            if w in level:
                if level[w] > 2:
                    return False
                i += n
                break
        else:
            return False
    return True


kept = []
for line in open(os.path.join(dist, "sentences.tsv"), encoding="utf8"):
    c = line.rstrip("\n").split("\t")
    if len(c) != 4:
        continue
    n = len(CJK.findall(c[1]))
    if 5 <= n <= 14 and len(c[3]) <= 70 and easy(c[1]):
        kept.append(c)
random.Random(2026).shuffle(kept)
kept = kept[:1000]
with open(os.path.join(dist, "daily.txt"), "w", encoding="utf8") as f:
    for c in kept:
        f.write("\t".join(c) + "\n")
print("daily sentences:", len(kept), "kept,", os.path.getsize(os.path.join(dist, "daily.txt")), "bytes")
