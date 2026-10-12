"""Build LearnZì's character and sentence data files (all inputs are parsed as data, never run).

Usage:
    python3 -I tools/build_data.py <hanzi-writer-data dir> <makemeahanzi dictionary.txt> \
        <tatoeba sentences.json> <cedict all.js> <out dir>

Outputs (in <out dir>):
  strokes/sNN.json  stroke data for every character, split into 48 files by code point (code point % 48)
                    Arphic Public License (via Make Me a Hanzi / hanzi-writer-data)
  chars.json        character stories: {char: [type, hint, semantic, phonetic, radical, decomposition]}
                    GNU LGPL 3 (Make Me a Hanzi dictionary.txt)
  sentences.tsv     short Chinese–English sentence pairs, filtered for a beginner app:
                    zhId \t chinese \t enId \t english     CC BY 2.0 FR (Tatoeba)
Prints counts and sizes only.
"""
import json
import os
import re
import sys

CHUNKS = 48
STRONG = ("vulgar", "obscen", "sexual", "erotic", "porn", "profan", "derog", "pejorative", "offensive")
EN_BLOCK = re.compile(
    r"\b(fuck\w*|shit\w*|bitch\w*|bastard\w*|cunt|dick|cock|pussy|porn\w*|sex\w*|naked|nude|rape\w*|"
    r"suicide|murder\w*|kill\w*|drugs?|cocaine|heroin|whore\w*|slut\w*|nazi\w*|terroris\w*|gun|guns|corpse|"
    r"damn\w*|hell|ass|asshole\w*|piss\w*|breasts?|condom\w*|prostitut\w*|erotic\w*|drunk\w*|"
    r"stupid|idiot\w*|hate|hates|hated|ugly|fat|die|died|dead|death)\b", re.I)


def stroke_chunks(src_dir, out_dir):
    os.makedirs(os.path.join(out_dir, "strokes"), exist_ok=True)
    chunks = [dict() for _ in range(CHUNKS)]
    for name in os.listdir(src_dir):
        if not name.endswith(".json"):
            continue
        ch = name[:-5]
        if len(ch) != 1:
            continue
        with open(os.path.join(src_dir, name), encoding="utf8") as f:
            data = json.load(f)
        if not isinstance(data.get("strokes"), list) or not isinstance(data.get("medians"), list):
            continue
        chunks[ord(ch) % CHUNKS][ch] = {"strokes": data["strokes"], "medians": data["medians"],
                                        "radStrokes": data.get("radStrokes", [])}
    total = sizes = 0
    for i, c in enumerate(chunks):
        path = os.path.join(out_dir, "strokes", "s%02d.json" % i)
        with open(path, "w", encoding="utf8") as f:
            json.dump(c, f, ensure_ascii=False, separators=(",", ":"))
        total += len(c)
        sizes = max(sizes, os.path.getsize(path))
    print(f"stroke data: {total} characters in {CHUNKS} files, largest file {sizes / 1e6:.2f} MB")


def stories(dict_path, out_dir):
    out = {}
    with open(dict_path, encoding="utf8") as f:
        for line in f:
            r = json.loads(line)
            ch = r.get("character")
            if not isinstance(ch, str) or len(ch) != 1:
                continue
            ety = r.get("etymology") or {}
            out[ch] = [ety.get("type", ""), ety.get("hint", "") or "", ety.get("semantic", "") or "",
                       ety.get("phonetic", "") or "", r.get("radical", "") or "", r.get("decomposition", "") or ""]
    path = os.path.join(out_dir, "chars.json")
    with open(path, "w", encoding="utf8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"character stories: {len(out)} characters, {os.path.getsize(path) / 1e6:.2f} MB")


def crude_words(cedict_path):
    raw = open(cedict_path, encoding="utf8").read().strip()
    data = json.loads(raw[len("export default "):].rstrip(";"))["all"]
    words = set()
    for trad, simp, _p, defs, *_ in data:
        senses = defs if isinstance(defs, list) else str(defs).split(" / ")
        if senses and any(m in str(senses[0]).lower() for m in STRONG):
            words.add(simp)
            words.add(trad)
    return words


def sentences(tatoeba_path, cedict_path, out_dir):
    pairs = json.load(open(tatoeba_path, encoding="utf8"))
    bad_zh = crude_words(cedict_path)
    seen, kept, dropped = set(), [], 0
    for item in pairs:
        if not (isinstance(item, list) and len(item) == 4):
            continue
        zid, zh, eid, en = item
        if not (isinstance(zh, str) and isinstance(en, str)):
            continue
        zh, en = zh.strip(), en.strip()
        hanzi = sum(1 for c in zh if "㐀" <= c <= "鿿")
        if not (3 <= hanzi <= 16) or len(en) > 80 or "\t" in zh + en or "\n" in zh + en:
            continue
        if zh in seen:
            continue
        if EN_BLOCK.search(en) or any(w in zh for w in bad_zh if len(w) > 1):
            dropped += 1
            continue
        seen.add(zh)
        kept.append((int(zid), zh, int(eid), en))
    kept.sort(key=lambda r: (len(r[1]), r[0]))
    path = os.path.join(out_dir, "sentences.tsv")
    with open(path, "w", encoding="utf8") as f:
        for r in kept:
            f.write("\t".join(str(x) for x in r) + "\n")
    print(f"sentences: {len(kept)} kept, {dropped} filtered out as unsuitable, {os.path.getsize(path) / 1e6:.2f} MB")


if __name__ == "__main__":
    if len(sys.argv) != 6:
        raise SystemExit(__doc__)
    hw, mmah, tato, cedict, out = sys.argv[1:]
    stroke_chunks(hw, out)
    stories(mmah, out)
    sentences(tato, cedict, out)
