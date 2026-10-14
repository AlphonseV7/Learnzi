import time
day = time.strftime("%Y-%m-%d")
m = int(time.time() // 60)
C = lambda s, due, st=2: [s, 5, due, 0, 0, 0, 0, st, 0]
W = lambda *ws: [{"s": s, "p": p} for s, p in ws]
SAVED = [("你好","ni3 hao3"),("谢谢","xie4 xie5"),("朋友","peng2 you5"),("学习","xue2 xi2"),("老师","lao3 shi1"),("中国","Zhong1 guo2"),("学生","xue2 sheng5"),("水","shui3"),("人","ren2"),("大","da4"),("猫","mao1"),("吃","chi1")]
BUSY_P = {"cards": {"你好|ni3 hao3|m": C(30, m + 2880), "谢谢|xie4 xie5|m": C(3, m - 10), "朋友|peng2 you5|m": C(5, m + 1440), "学习|xue2 xi2|m": C(1, m + 30, 1)},
          "act": {day: [4, 12, 3, 1, 6, 2]}, "adj": [1, 40000], "updatedAt": 1, "garden": [52, 50]}
BUSY_S = {"onboarded": True, "toured": True, "badges": {"begin": 1, "study": 1}, "toneBest": {"single": 7},
          "saved": [{"s": s, "p": p, "at": i} for i, (s, p) in enumerate(SAVED)], "recent": ["你好", "朋友", "老师"],
          "activeDecks": ["starred", "welcome", "uphoto1", "nhsk1"],
          "decks": [{"id": "uphoto1", "name": "Photo · 12 Oct", "words": W(("你好", "ni3 hao3"), ("谢谢", "xie4 xie5")), "m": 1}],
          "journey": {"counts": {"lookups": 5, "pairs": 1}}}
THEMES = ["ink", "jade", "porcelain", "lantern", "nightmarket", "peach", "imperial", "arcade", "cyber", "silver"]
