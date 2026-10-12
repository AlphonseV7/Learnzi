"""Prints torn-paper (deckle) clip-path polygons for the Ink theme. Usage: python3 -I tools/gen_deckle.py"""
import random


def deckle(seed, n, amp):
    r = random.Random(seed)
    j = lambda: round(r.uniform(0, amp), 1)
    pts = [f"{round(i * 100 / n, 1)}% {j()}px" for i in range(n)]
    pts += [f"calc(100% - {j()}px) {round(i * 100 / n, 1)}%" for i in range(n)]
    pts += [f"{round(100 - i * 100 / n, 1)}% calc(100% - {j()}px)" for i in range(n)]
    pts += [f"{j()}px {round(100 - i * 100 / n, 1)}%" for i in range(n)]
    return "polygon(" + ", ".join(pts) + ")"


if __name__ == "__main__":
    for name, seed, n, amp in (("--deckle-a", 1, 18, 2.6), ("--deckle-b", 2, 18, 2.6), ("--deckle-c", 3, 18, 2.6), ("--deckle-btn", 9, 6, 2.2)):
        print(f"  {name}: {deckle(seed, n, amp)};")
