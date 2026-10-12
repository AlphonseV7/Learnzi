"""Join the LearnZì source files into one page: dist/index.html.

Usage: python3 -I tools/build.py   (run from the project folder)
"""
import os
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.path.join(root, "src")
dist = os.path.join(root, "dist")


def read(name):
    with open(os.path.join(src, name), encoding="utf8") as f:
        return f.read()


engine, srs, shell = read("engine.js"), read("srs.js"), read("shell.html")
# Styles: the main sheet, then the extra theme sheets in src/themes/ (sorted), so themes can override.
theme_dir = os.path.join(src, "themes")
themes = sorted(n for n in os.listdir(theme_dir) if n.endswith(".css")) if os.path.isdir(theme_dir) else []
css = read("styles.css") + "".join("\n" + read(os.path.join("themes", n)) for n in themes)
# The UI is split into numbered parts in src/ui/; they share one private scope in the page.
parts = sorted(n for n in os.listdir(os.path.join(src, "ui")) if n.endswith(".js"))
ui = "(() => {\n\"use strict\";\n" + "\n".join(read(os.path.join("ui", n)) for n in parts) + "\n})();\n"
for name, code in (("engine.js", engine), ("srs.js", srs), ("ui", ui)):
    if "</script" in code.lower():
        sys.exit(name + " must not contain a closing script tag")
dict_path = os.path.join(dist, "dict.txt")
if not os.path.exists(dict_path):
    sys.exit("Build dist/dict.txt first (see build_dict.py)")
ui = ui.replace("__DICT_BYTES__", str(os.path.getsize(dict_path)))
page = shell.replace("/*@CSS*/", css).replace("/*@ENGINE*/", engine).replace("/*@SRS*/", srs).replace("/*@UI*/", ui)
with open(os.path.join(dist, "index.html"), "w", encoding="utf8") as f:
    f.write(page)
print("dist/index.html", len(page.encode("utf8")), "bytes")

# Local preview only: the same page inside the skeleton Claude adds when publishing. The CDN can't be
# reached from the build machine, so the preview loads a local copy of the same file (same fingerprint).
preview = page.replace("https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.3/dist/hanzi-writer.min.js", "hanzi-writer.min.js")
with open(os.path.join(dist, "preview.html"), "w", encoding="utf8") as f:
    f.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" '
            'content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + preview + "</body></html>")
