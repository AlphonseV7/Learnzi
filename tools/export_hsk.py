import json, sqlite3, sys
con = sqlite3.connect("file:" + sys.argv[1] + "?mode=ro", uri=True)
rows = [[int(l), s, p] for l, s, p in con.execute("SELECT level, simplified, pronunciation FROM Words")]
json.dump(rows, open(sys.argv[2], "w", encoding="utf8"), ensure_ascii=False)
print("hsk rows", len(rows))
