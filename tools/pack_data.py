"""Pack LearnZì's big data files so more fits in the app's 256 MB, without changing a single byte.

Each file is compressed with gzip (lossless; gzip also stores a CRC-32 checksum, so a damaged copy is
refused instead of being read wrongly) and written as base64 text next to it as <name>.gz.txt, because
the artifact host only serves web file types. The app unpacks them in the browser (fetchPacked in
src/ui/00-core.js). After writing, every packed file is unpacked again here and compared byte for byte,
and by SHA-256, with the original; any difference stops the script with an error.

Usage: python3 -I tools/pack_data.py dist
Writes dist/<file>.gz.txt for every file in PACK and dist/packed.json (name → sizes and SHA-256 of the
original, used by tools/test_packed.js).
"""
import base64, glob, gzip, hashlib, json, os, sys

dist = sys.argv[1]
PACK = ["dict.txt", "sentences.txt", "chars.json", "audio/index.txt", "ocr/ort-wasm-simd-threaded.wasm"] \
    + sorted(os.path.relpath(p, dist) for p in glob.glob(os.path.join(dist, "strokes", "s*.json"))) \
    + sorted(os.path.relpath(p, dist) for p in glob.glob(os.path.join(dist, "grammar", "*.json")))
# The photo reader's two models were already stored as base64 text: pack the model bytes inside them.
FROM_BASE64 = {"ocr/det.ort.txt": "ocr/det.ort", "ocr/rec.onnx.txt": "ocr/rec.onnx"}

manifest, before, after = {}, 0, 0
def pack(name, data, src_size):
    global before, after
    gz = gzip.compress(data, compresslevel=9, mtime=0)
    text = base64.b64encode(gz)
    # check: unpack exactly as the app will, and compare with the original
    back = gzip.decompress(base64.b64decode(text))
    if back != data or hashlib.sha256(back).digest() != hashlib.sha256(data).digest():
        raise SystemExit("MISMATCH after packing " + name)
    out = os.path.join(dist, name + ".gz.txt")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "wb") as f:
        f.write(text)
    manifest[name] = {"bytes": len(data), "packed": len(text), "sha256": hashlib.sha256(data).hexdigest()}
    before += src_size; after += len(text)

for name in PACK:
    data = open(os.path.join(dist, name), "rb").read()
    pack(name, data, len(data))
for src, name in FROM_BASE64.items():
    raw = open(os.path.join(dist, src), "rb").read()
    pack(name, base64.b64decode(raw), len(raw))

json.dump(manifest, open(os.path.join(dist, "packed.json"), "w"), indent=1, sort_keys=True)
print(len(manifest), "files packed and verified: %.1f MB -> %.1f MB" % (before / 1e6, after / 1e6))
