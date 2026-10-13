// Checks that every packed data file (tools/pack_data.py) unpacks to exactly the original bytes:
// base64 → gunzip (gzip's own CRC-32 is checked too) → SHA-256 compared with dist/packed.json, and,
// where the original is still on disk, compared byte for byte. Usage: node tools/test_packed.js dist
const fs = require("fs"), path = require("path"), zlib = require("zlib"), crypto = require("crypto");
const dist = process.argv[2] || "dist";
const manifest = JSON.parse(fs.readFileSync(path.join(dist, "packed.json"), "utf8"));
let pass = 0, fail = 0;
for (const [name, info] of Object.entries(manifest)) {
  const packed = fs.readFileSync(path.join(dist, name + ".gz.txt"), "utf8");
  const bytes = zlib.gunzipSync(Buffer.from(packed, "base64"));
  let ok = bytes.length === info.bytes && crypto.createHash("sha256").update(bytes).digest("hex") === info.sha256;
  const orig = path.join(dist, name);
  if (ok && fs.existsSync(orig)) ok = Buffer.compare(bytes, fs.readFileSync(orig)) === 0;
  // the photo reader's models were base64 text before: compare with that too
  else if (ok && fs.existsSync(orig + ".txt")) ok = Buffer.compare(bytes, Buffer.from(fs.readFileSync(orig + ".txt", "utf8"), "base64")) === 0;
  if (ok) pass++; else { fail++; console.log("FAIL", name); }
}
console.log("pass=" + pass + " fail=" + fail);
process.exit(fail ? 1 : 0);
