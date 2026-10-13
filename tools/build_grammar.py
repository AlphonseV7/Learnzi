"""Turn the AllSet Learning Chinese Grammar Wiki archive into LearnZì's grammar files.

Source: https://github.com/ivankra/asg (wiki/ASGxxxxx.txt, crawled October 2023), a copy of the
AllSet Learning Chinese Grammar Wiki (https://resources.allsetlearning.com/chinese/grammar/),
©2021 AllSet Learning, CC BY-NC-SA 3.0. This conversion is a derivative work under the same licence:
non-commercial only, credit with a link on every view, share alike.

Usage: python3 -I tools/build_grammar.py <path to asg/wiki> <out dir, e.g. dist/grammar>
Writes:
  index.json   every grammar point: [id, title, level, kind, pattern, related words, HSK, used for, also known as]
  a1.json … c1.json   the articles of one level: { id: blocks }
Blocks (all text is shown as plain text by the app):
  ["h", 2|3, text]           a heading
  ["p", runs]                a paragraph
  ["pat", [runs, ...]]       structure lines
  ["ex", [item, ...]]        examples; item = {z: runs (Chinese, words separated by spaces), p: runs (pinyin),
                             t: runs (English), e: runs (note), m: "o" right / "x" wrong / "" , s: speaker}
  ["ul", [runs, ...]]        a bullet list
  ["tb", [[runs, ...], ...]] a table, first row may be headers
  ["see", [id, ...]]         "See also" links
Runs: a list of plain strings and [text, style] pairs: style "e" highlighted, "b" bold, "i" italic,
"l" a link to another grammar point (a third item holds its id).
"""
import csv, html, json, os, re, sys

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)

titles = {}
with open(os.path.join(src, "index.tsv"), encoding="utf8") as f:
    for row in csv.DictReader(f, delimiter="\t"):
        titles[row["ID"]] = re.sub(r"\s+", " ", row["Title"].replace("_", " ")).strip()
by_title = {re.sub(r"\s+", " ", t.replace("_", " ")).strip().lower(): i for i, t in titles.items()}

def link_id(target):
    t = re.sub(r"\s+", " ", target.split("#")[0].replace("_", " ")).strip().lower()
    if t.startswith("asg") and t.upper() in titles:
        return t.upper()
    return by_title.get(t)

TOKEN = re.compile(r"(<em>|</em>|<strong>|</strong>|'''|''|<b>|</b>|<i>|</i>|\[\[(?:[^\]]|\](?!\]))+\]\]|<br\s*/?>)")

def runs(text):
    """Inline wiki/HTML markup → runs."""
    text = re.sub(r"<ref[^>]*>.*?</ref>|<ref[^>]*/>", "", text, flags=re.S)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"</?(span|div|sup|sub|small|big|u|font|li|ul|ol|nowiki)[^>]*>", "", text)
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    text = html.unescape(text)   # a few articles write their tags as &lt;em&gt;
    out, style = [], {"e": False, "b": False, "i": False}
    def push(s):
        if not s:
            return
        st = "e" if style["e"] else "b" if style["b"] else "i" if style["i"] else ""
        if out and isinstance(out[-1], str) and not st:
            out[-1] += s
        elif out and not isinstance(out[-1], str) and len(out[-1]) == 2 and out[-1][1] == st:
            out[-1][0] += s
        else:
            out.append(s if not st else [s, st])
    for part in TOKEN.split(text):
        if not part:
            continue
        if part in ("<em>", "</em>"):
            style["e"] = part == "<em>"
        elif part in ("<strong>", "</strong>", "<b>", "</b>", "'''"):
            style["b"] = (not style["b"]) if part == "'''" else part in ("<strong>", "<b>")
        elif part in ("''", "<i>", "</i>"):
            style["i"] = (not style["i"]) if part == "''" else part == "<i>"
        elif part.startswith("<br"):
            push(" ")
        elif part.startswith("[["):
            inner = part[2:-2]
            if inner.lower().startswith(("category:", "file:", "image:")):
                continue
            target, _, label = inner.partition("|")
            label = re.sub(r"'{2,3}|<[^>]+>", "", label or target)
            gid = link_id(target)
            if gid:
                out.append([label, "l", gid])
            else:
                push(label)
        else:
            push(re.sub(r"<[^>]+>", "", part))
    # tidy spaces
    cleaned = []
    for r in out:
        if isinstance(r, str):
            r = re.sub(r"[ \t]+", " ", r)
        else:
            r = [re.sub(r"[ \t]+", " ", r[0])] + r[1:]
        cleaned.append(r)
    if cleaned and isinstance(cleaned[0], str):
        cleaned[0] = cleaned[0].lstrip()
    if cleaned and isinstance(cleaned[-1], str):
        cleaned[-1] = cleaned[-1].rstrip()
    return [r for r in cleaned if (r if isinstance(r, str) else r[0])]

def span(item, cls):
    m = re.search(r'<span class="' + cls + r'"[^>]*>(.*?)</span>', item, flags=re.S)
    return m.group(1) if m else ""

def example(item):
    mark = ""
    m = re.match(r'\s*<li class="([oxq])"', item)
    if m:
        mark = m.group(1) if m.group(1) in "ox" else ""
    speaker = re.sub(r"<[^>]+>", "", span(item, "speaker")).strip()
    zh = re.split(r'<span class="(?:pinyin|trans|expl)"', re.sub(r'<span class="speaker"[^>]*>.*?</span>', "", item, flags=re.S), maxsplit=1)[0]
    zh = re.sub(r"^\s*(\*+|<li[^>]*>)", "", zh)
    ex = {"z": runs(zh)}
    for key, cls in (("p", "pinyin"), ("t", "trans"), ("e", "expl")):
        r = runs(span(item, cls))
        if r:
            ex[key] = r
    if mark:
        ex["m"] = mark
    if speaker:
        ex["s"] = speaker
    return ex if ex["z"] else None

def table(lines):
    rows = []
    if lines and lines[0].lstrip().startswith("{|"):   # wiki table
        row = []
        for l in lines[1:]:
            l = l.strip()
            if l.startswith("|}"):
                break
            if l.startswith("|-"):
                if row: rows.append(row)
                row = []
            elif l.startswith("|+"):
                continue
            elif l.startswith(("!", "|")):
                cells = re.split(r"\s*(?:!!|\|\|)\s*", l[1:])
                for c in cells:
                    if "|" in c and not c.startswith("[["):
                        head, _, rest = c.partition("|")
                        if "=" in head and "[[" not in head:
                            c = rest
                    row.append(runs(c))
        if row: rows.append(row)
    else:   # html table
        body = " ".join(lines)
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", body, flags=re.S):
            rows.append([runs(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, flags=re.S)])
    return [r for r in rows if any(r)]

STOP = re.compile(r"sources\s+and\s+further\s+reading", re.I)

def article(text):
    lines = text.split("\n")
    blocks, para = [], []
    def flush():
        if para:
            r = runs(" ".join(para))
            if r: blocks.append(["p", r])
            para.clear()
    i, n, section = 0, len(lines), ""
    while i < n:
        line = lines[i]
        s = line.strip()
        h = re.match(r"^(={2,4})\s*(.*?)\s*\1\s*$", s)
        if h:
            flush()
            title = re.sub(r"\s+", " ", h.group(2))
            section = title.lower()
            if STOP.search(title):
                # skip book and website lists, keep a later "See also"
                i += 1
                while i < n and not re.match(r"^==\s*see\s+also\s*==\s*$", lines[i].strip(), re.I):
                    i += 1
                continue
            if section != "see also":
                blocks.append(["h", min(3, len(h.group(1))), title])
            i += 1
            continue
        if section == "see also":
            ids = [link_id(t.split("|")[0]) for t in re.findall(r"\[\[([^\]]+)\]\]", s)]
            ids = [x for x in ids if x]
            if ids:
                if blocks and blocks[-1][0] == "see":
                    blocks[-1][1].extend(x for x in ids if x not in blocks[-1][1])
                else:
                    blocks.append(["see", ids])
            i += 1
            continue
        if s.startswith('<div class="jiegou"'):
            flush()
            pat = []
            rest = s.split(">", 1)[1] if ">" in s else ""
            buf = [rest] if rest and "</div>" not in rest else []
            if "</div>" in rest:
                buf = [rest.split("</div>")[0]]
            else:
                i += 1
                while i < n and "</div>" not in lines[i]:
                    buf.append(lines[i]); i += 1
                if i < n: buf.append(lines[i].split("</div>")[0])
            for b in buf:
                for piece in re.split(r"<br\s*/?>", b):
                    r = runs(piece)
                    if r: pat.append(r)
            if pat: blocks.append(["pat", pat])
            i += 1
            continue
        if s.startswith('<div class="liju"') or s.startswith('<ul class="dialog"'):
            flush()
            depth, buf = 0, []
            closer = "</div>" if s.startswith("<div") else "</ul>"
            i += 1
            while i < n and not (lines[i].strip().startswith(closer) and depth == 0):
                l = lines[i]
                if l.strip().startswith('<ul class="dialog"'):
                    depth += 1
                elif l.strip().startswith("</ul>") and depth:
                    depth -= 1
                else:
                    buf.append(l)
                i += 1
            items, cur = [], ""
            for l in buf:
                ls = l.strip()
                if ls.startswith("*") or ls.startswith("<li"):
                    if cur: items.append(cur)
                    cur = ls
                elif cur and ls and not ls.startswith(("</li>", "<ul", "</ul>")):
                    cur += " " + ls
            if cur: items.append(cur)
            exs = [e for e in (example(it) for it in items) if e]
            if exs:
                if blocks and blocks[-1][0] == "ex" and closer == "</ul>":
                    blocks[-1][1].extend(exs)
                else:
                    blocks.append(["ex", exs])
            i += 1
            continue
        if s.startswith("{|") or s.startswith("<table"):
            flush()
            buf = []
            end = "|}" if s.startswith("{|") else "</table>"
            while i < n:
                buf.append(lines[i])
                if end in lines[i] and (len(buf) > 1 or end == "</table>"):
                    break
                i += 1
            t = table(buf)
            if t: blocks.append(["tb", t])
            i += 1
            continue
        if s.startswith("*") or s.startswith("#"):
            flush()
            items = []
            while i < n and lines[i].strip().startswith(("*", "#")):
                r = runs(lines[i].strip().lstrip("*#").strip())
                if r: items.append(r)
                i += 1
            if items: blocks.append(["ul", items])
            continue
        if not s or s.startswith(("{{", "[[Category", "<!--", "</div>", "<div", "__", "<youtube", "</youtube")):
            flush()
            i += 1
            continue
        para.append(s)
        i += 1
    flush()
    # drop empty headings (a heading followed by another heading of the same or higher rank, or nothing)
    keep = []
    for j, b in enumerate(blocks):
        if b[0] == "h":
            nxt = next((x for x in blocks[j + 1:]), None)
            if nxt is None or (nxt[0] == "h" and nxt[1] <= b[1]):
                continue
        keep.append(b)
    return keep

def templates(text, name):
    return [m for m in re.findall(r"\{\{\s*" + name + r"\s*\|([^{}]*)\}\}", text)]

LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
index, by_level = [], {}
for gid, title in sorted(titles.items(), key=lambda x: x[1].lower()):
    path = os.path.join(src, gid + ".txt")
    if not os.path.exists(path):
        continue
    text = open(path, encoding="utf8").read()
    text = re.sub(r"^<!--.*?-->\s*", "", text, count=1, flags=re.S)
    bg = templates(text, "Basic Grammar")
    parts = [p.strip() for p in bg[0].split("|")] if bg else []
    level = parts[1] if len(parts) > 1 and parts[1] in LEVELS else ""
    if not level:
        m = re.search(r"\[\[Category:\s*([ABC][12]) grammar points\]\]", text)
        level = m.group(1) if m else "B1"
    kind = "c" if (len(parts) > 4 and "comparison" in parts[4].lower()) or re.search(r"\[\[Category:\s*grammar comparison", text, re.I) else "p"
    pattern = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", parts[2])).strip() if len(parts) > 2 else ""
    rel = []
    for c in ([parts[0]] if parts else []) + [p.strip() for p in templates(text, "Rel char")]:
        c = re.sub(r"<[^>]+>", "", c).strip()
        if c and re.search(r"[㐀-鿿]", c) and c not in rel:
            rel.append(c)
    hsk = re.search(r"\{\{HSK\|HSK(\d)\}\}", text)
    used = [u.strip() for u in templates(text, "Used for") if u.strip()]
    aka = [a.strip() for t in templates(text, "AKA") for a in t.split("|") if a.strip()]
    blocks = article(text)
    if not blocks:
        continue
    index.append([gid, title, level, kind, pattern, rel, int(hsk.group(1)) if hsk else 0, used[:6], aka[:6]])
    by_level.setdefault(level.lower(), {})[gid] = blocks

json.dump({"source": "AllSet Learning Chinese Grammar Wiki (https://resources.allsetlearning.com/chinese/grammar/), ©2021 AllSet Learning, CC BY-NC-SA 3.0; archive: github.com/ivankra/asg (October 2023); converted for LearnZì (same licence)",
           "points": index}, open(os.path.join(out, "index.json"), "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
for lv, arts in by_level.items():
    json.dump(arts, open(os.path.join(out, lv + ".json"), "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
counts = {lv: len(a) for lv, a in sorted(by_level.items())}
print(len(index), "grammar points", counts, "comparisons:", sum(1 for x in index if x[3] == "c"))
