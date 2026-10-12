"""Build LearnZi's compact dictionary file.

Usage:
    python3 -I build_dict.py <cedict_all.js> <hsk.json> <jieba_dict.txt.big> <out_dict.txt>

Inputs (all open source, see ATTRIBUTION.md):
  - CC-CEDICT, via the `cc-cedict` npm package (data/all.js)   CC BY-SA 4.0
  - HSK 2.0 word levels, via the `hsk-words` npm package          MIT
  - Word frequencies from jieba's dict.txt.big                    MIT

Output: one entry per line, tab separated, most frequent words first:
    traditional  simplified  pinyin(numbered)  definitions(" / ")  hsk(0-6)  frequency
Traditional is left blank when it equals simplified; frequency is blank when unknown.
Measure words appear as a final CEDICT-style sense: "CL:個|个[ge4],本[ben3]".

The input files are only ever parsed as data (JSON / plain text), never executed.
"""
import json
import sys


def load_cedict(path):
    raw = open(path, encoding="utf8").read().strip()
    prefix = "export default "
    if not raw.startswith(prefix):
        raise SystemExit("Unexpected cc-cedict format")
    data = json.loads(raw[len(prefix):].rstrip(";"))
    return data["all"], data.get("classifierLookup", [])


def load_freq(path):
    freq = {}
    for line in open(path, encoding="utf8"):
        parts = line.split()
        if len(parts) >= 2 and parts[1].isdigit():
            word, n = parts[0], int(parts[1])
            freq[word] = max(freq.get(word, 0), n)
    return freq


# Beginner-friendly: leave out crude, slang and adult entries.
EXCLUDE_MARKERS = ("vulgar", "(slang)", "slang)", "euphemis", "obscen", "offensive",
                   "sexual", "erotic", "porn", "profan", "derog", "pejorative")


def is_excluded(sense):
    low = sense.lower()
    return any(m in low for m in EXCLUDE_MARKERS)


def filter_senses(senses):
    """Drop crude senses. If the main (first) sense is crude, the whole entry is dropped;
    otherwise only the marked senses go, so everyday words such as 去 or 牛 stay."""
    if not senses or is_excluded(senses[0]):
        return []
    return [x for x in senses if not is_excluded(x)]


def norm_py(p):
    return "".join(p.lower().split()).replace("u:", "v")


def clean(text):
    # Tabs/newlines would break the file format.
    return " ".join(str(text).replace("\t", " ").split())


def main(cedict_path, hsk_path, freq_path, out_path):
    entries, classifier_lookup = load_cedict(cedict_path)
    freq = load_freq(freq_path)
    hsk_rows = json.load(open(hsk_path, encoding="utf8"))

    # HSK tag: match on simplified form + pinyin; fall back to first entry with that form.
    hsk_by_key = {}
    hsk_by_simp = {}
    for level, simp, py in hsk_rows:
        hsk_by_key.setdefault((simp, norm_py(py)), level)
        hsk_by_simp.setdefault(simp, level)

    rows = []
    tagged_simp = set()
    for trad, simp, pinyin, defs, _variants, classifiers in entries:
        senses = defs if isinstance(defs, list) else str(defs).split(" / ")
        senses = filter_senses([str(x) for x in senses])
        if not senses:
            continue
        defs = " / ".join(senses)
        # Measure words are stored separately in the package; put them back as a
        # CEDICT-style "CL:" sense so the file keeps its six columns.
        cls = []
        for k in classifiers or []:
            if isinstance(k, int) and 0 <= k < len(classifier_lookup):
                ct, cs, cp = classifier_lookup[k]
                cls.append(f"{ct}[{cp}]" if ct == cs else f"{ct}|{cs}[{cp}]")
        if cls and "CL:" not in defs:
            defs += " / CL:" + ",".join(cls)
        level = hsk_by_key.get((simp, norm_py(pinyin)), 0)
        if level:
            tagged_simp.add(simp)
        f = max(freq.get(simp, 0), freq.get(trad, 0))
        rows.append([clean(trad), clean(simp), clean(pinyin), clean(defs), level, f])

    # Second pass: HSK words whose pinyin didn't match exactly.
    seen = set()
    for r in rows:
        simp = r[1]
        if r[4] == 0 and simp in hsk_by_simp and simp not in tagged_simp and simp not in seen:
            r[4] = hsk_by_simp[simp]
            seen.add(simp)

    rows.sort(key=lambda r: (-r[5], len(r[1])))
    with open(out_path, "w", encoding="utf8") as out:
        for r in rows:
            r = list(r)
            if r[0] == r[1]:
                r[0] = ""  # traditional == simplified: leave blank to save space
            if r[5] == 0:
                r[5] = ""
            out.write("\t".join(str(x) for x in r) + "\n")

    tagged = sum(1 for r in rows if r[4])
    print(f"entries={len(rows)} hsk_tagged={tagged} of {len(hsk_rows)}")


if __name__ == "__main__":
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
