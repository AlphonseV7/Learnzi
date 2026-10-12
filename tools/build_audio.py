"""Pack the audio-cmn recordings into a few files the app can load: dist/audio/.

Source: https://github.com/hugolpz/audio-cmn (the 24k-abr folder). Syllables recorded by Chen Wang,
HSK words by Yue Tan, both CC BY-SA; curated by Hugo Lopez. The MP3s are copied byte for byte.
  w00.mp3 … w47.mp3   HSK words and characters (key: simplified hanzi)
  s00.mp3 … s07.mp3   every syllable in every tone (key: pinyin with tone number, ü written v)
  index.txt           kind, key, file, offset, length (tab separated)
A key goes into the file numbered (sum of its character codes) % number of files; the app does the same.
Usage: python3 -I tools/build_audio.py <audio-cmn/24k-abr folder>
"""
import os
import sys

NW, NS = 48, 8
src = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist", "audio")
os.makedirs(out, exist_ok=True)
bucket = lambda key, n: sum(ord(c) for c in key) % n

packs = {}
for kind, folder, n in (("w", "hsk", NW), ("s", "syllabs", NS)):
    for name in sorted(os.listdir(os.path.join(src, folder))):
        if not (name.startswith("cmn-") and name.endswith(".mp3")):
            continue
        key = name[4:-4]
        if kind == "w" and "_" in key:
            continue                       # grammar patterns like 一_就_ aren't single words
        key = key.lstrip("_").lower() if kind == "s" else key
        with open(os.path.join(src, folder, name), "rb") as f:
            data = f.read()
        packs.setdefault((kind, bucket(key, n)), []).append((key, data))

lines, total = [], 0
for (kind, b), items in sorted(packs.items()):
    fname = f"{kind}{b:02d}.mp3"
    off = 0
    with open(os.path.join(out, fname), "wb") as f:
        for key, data in items:
            f.write(data)
            lines.append(f"{kind}\t{key}\t{b}\t{off}\t{len(data)}")
            off += len(data)
    total += off
with open(os.path.join(out, "index.txt"), "w", encoding="utf8") as f:
    f.write("\n".join(lines) + "\n")
sizes = [os.path.getsize(os.path.join(out, x)) for x in os.listdir(out) if x.endswith(".mp3")]
print(f"audio: {sum(1 for l in lines if l[0] == 'w')} words, {sum(1 for l in lines if l[0] == 's')} syllables, "
      f"{len(sizes)} files, {total / 1e6:.1f} MB, largest {max(sizes) / 1e6:.2f} MB, index {os.path.getsize(os.path.join(out, 'index.txt')) / 1e3:.0f} KB")
