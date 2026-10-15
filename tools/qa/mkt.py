s = open("/home/claude/dist/preview.html").read()
i = s.rindex("\n})();\n")
hooks = ("avatarSvg, setMood, wornAvatar, RANKS, rankFor, AV, showLevelUp, refreshAvatars, Sync, createDeck, updateDeck, commit, getState: () => state, getProgress: () => progress, "
         "fetchPacked, CharData, loadGrammar, loadGrammarLevel, grammar, ocrLoad, audioIndex, gainBonus, go, getUi: () => ui, doneCount, speak, buildTonePools, gardenScene, GARDEN, drill, "
         "makeQuestion, answerDrill, nextDrill, startDrill, setTonePools: () => { tonePools = buildTonePools(); }, checkJourney, QUESTS, SCROLLS, currentStop, chapterDone, "
         "openWord, closePanel, startStudy, study, reveal, grade, nextCard, Engine, cardKeys, studyPlan, clozeLoad, clozeFor, Cloze, streak, practiced, todaySecs, goalMet, checkPinyin, deckWords, BUILTIN, factoryReset, enterMle, leaveMle, render, openScroll, sanitize, LS_KEY, jCount, doneCount")
s = s[:i] + "\nwindow.__t = { " + hooks + " };" + s[i:]
open("/home/claude/dist/t.html", "w").write(s)
