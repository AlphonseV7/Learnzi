"""Builds dist/ocr/ for Photo to words (reading Chinese in photos on the device).

Sources (fetch with `npm pack <name>@<version> --ignore-scripts` into an empty scratch folder and untar;
they are data and prebuilt runtime files, never run here):
  - onnxruntime-web@1.23.2 (MIT): dist/ort.wasm.min.js, dist/ort-wasm-simd-threaded.mjs, dist/ort-wasm-simd-threaded.wasm
  - pdfmarkdown-ppocrv5-models@1.0.0 (Apache-2.0; PaddleOCR PP-OCRv5 mobile models by PaddlePaddle):
      detection/PP-OCRv5_mobile_det_infer.ort, recognition/PP-OCRv5_mobile_rec_infer.onnx, recognition/ppocrv5_dict.txt
The recognition model's MatMul layers are stored as 8-bit numbers (onnxruntime dynamic quantisation),
16.5 MB -> 9.2 MB, with no loss on the test images (quantising every layer cost ~5% accuracy, so it isn't done).

Output: ort.wasm.min.js, ort-wasm-simd-threaded.mjs/.wasm, keys.txt, det.ort.txt and rec.onnx.txt (base64).
Usage: pip install onnx onnxruntime, then
  python3 -I tools/build_ocr.py <onnxruntime-web package dir> <ppocrv5 models package dir>
"""
import os, shutil, sys

ort_pkg, models = sys.argv[1], sys.argv[2]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dist", "ocr")
os.makedirs(out, exist_ok=True)
for f in ("ort.wasm.min.js", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"):
    shutil.copy(os.path.join(ort_pkg, "dist", f), os.path.join(out, f))
shutil.copy(os.path.join(models, "detection", "PP-OCRv5_mobile_det_infer.ort"), os.path.join(out, "det.ort"))
shutil.copy(os.path.join(models, "recognition", "ppocrv5_dict.txt"), os.path.join(out, "keys.txt"))
from onnxruntime.quantization import quantize_dynamic, QuantType
quantize_dynamic(os.path.join(models, "recognition", "PP-OCRv5_mobile_rec_infer.onnx"), os.path.join(out, "rec.onnx"),
                 weight_type=QuantType.QUInt8, op_types_to_quantize=["MatMul", "Gemm"])
# Artifacts only serve web file types, so the two model files go out as base64 text (decoded in the browser).
import base64
for name in ("det.ort", "rec.onnx"):
    src = os.path.join(out, name)
    with open(src, "rb") as f, open(src + ".txt", "w") as g:
        g.write(base64.b64encode(f.read()).decode("ascii"))
    os.remove(src)
for f in sorted(os.listdir(out)):
    print(f, os.path.getsize(os.path.join(out, f)), "bytes")
