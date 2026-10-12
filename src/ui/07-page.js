/* LearnZì UI, part 1a2: the header box at the top of every page (title, Chinese with pinyin, a line about
 * the page) with Fold all / Open all and, once you've removed boxes, a button to bring them back. */

const PAGES = {
  home: () => ({ title: "Home", zh: "主页", py: "zhu3 ye4", desc: "Your day at a glance. Fold, move or remove any box." }),
  lookup: () => ({ title: "Look up", zh: "查词", py: "cha2 ci2", desc: "Search by characters (simplified or traditional), pinyin with or without tones, or English." }),
  decks: () => ({ title: "Decks", zh: "卡组", py: "ka3 zu3", desc: "Flashcard decks. A word you know in one deck counts in every deck." }),
  deck: () => { const b = BUILTIN[ui.deckId]; return { title: deckExists(ui.deckId) ? deckName(ui.deckId) : "Deck", zhPlain: b ? b.zh : null, desc: b ? b.note : "Your own deck.", back: ["Decks", "decks"] }; },
  study: () => ({ title: "Study", zh: "学习", py: "xue2 xi2", desc: "Today's flashcards, with new words mixed in." }),
  reader: () => ({ title: "Reader", zh: "阅读", py: "yue4 du2", desc: "Paste Chinese text or import a text file. Tap a word to see its meaning; tap it again to hear it." }),
  watch: () => (isAudio()
    ? { title: "Listen", zh: "听书", py: "ting1 shu1", desc: "Play an audiobook or recording from your device with its Chinese text. Tap any word to pause and look it up. Each sentence you hear earns 1 XP (up to " + MEDIA_CAP + " a day, shared with Watch)." }
    : { title: "Watch", zh: "看视频", py: "kan4 shi4 pin2", desc: "Play a video from your device with its Chinese subtitles. Tap any word to pause and look it up. Each line you watch earns 1 XP (up to " + MEDIA_CAP + " a day, shared with Listen)." }),
  photo: () => ({ title: "Photo to words", zh: "拍照识字", py: "pai1 zhao4 shi2 zi4", desc: "Read the Chinese in a photo or screenshot, then make flashcards from its words." }),
  tones: () => ({ title: "Tone trainer", zh: "声调", py: "sheng1 diao4", desc: "Listen, then pick the tone. Every correct answer earns 2 XP (up to " + TONE_CAP + " a day) and grows your water garden." }),
  myzi: () => ({ title: "My Zì", zh: "我的字", py: "wo3 de5 zi4", desc: "My level, my cards, my decks and my progress." }),
  mycards: () => ({ title: "My cards", zh: "我的卡片", py: "wo3 de5 ka3 pian4", desc: "Every word I've saved and how its flashcards are going.", back: ["My Zì", "myzi"] }),
  stats: () => ({ title: "My progress", zh: "我的进步", py: "wo3 de5 jin4 bu4", desc: "How my studying is going.", back: ["My Zì", "myzi"] }),
  me: () => ({ title: "Customise", zh: "装扮", py: "zhuang1 ban4", desc: "Dress up my avatar, choose my clock and pick my theme.", back: ["My Zì", "myzi"] }),
  settings: () => ({ title: "Settings", zh: "设置", py: "she4 zhi4", desc: "How LearnZì looks, sounds and studies." }),
  debug: () => ({ title: "Debug settings", zh: "调试", py: "tiao2 shi4", desc: "Testing tools. Changes made here are real and sync to your other devices, except the clock, which stays on this device.", back: ["Settings", "settings"] }),
};
const hiddenOn = page => (state.hidden && state.hidden[page]) || [];

function pageHead(view, v) {
  const info = ((mleOn() && PAGES_MLE[view]) || PAGES[view] || (() => null))();
  if (!info) return null;
  const tools = h("div", { class: "row page-tools" });
  const head = h("div", { class: "card page-head" },
    h("div", { class: "row page-head-top" },
      info.back ? h("button", { class: "btn icon page-back", type: "button", "aria-label": "Back to " + info.back[0], title: "Back to " + info.back[0], onclick: () => go(info.back[1]) }, icon("back")) : null,
      h("h1", { class: "row title-row" }, info.title,
        info.zh ? h("span", { class: "title-zh" }, rubyHz(info.zh, info.py)) : info.zhPlain ? h("span", { class: "title-zh hz" }, info.zhPlain) : null),
      tools),
    info.desc ? h("p", { class: "muted page-desc" }, info.desc) : null);
  fillPageTools(tools, v, view);
  return head;
}
/** Fold all / Open all for the page's boxes, and Bring back when some were removed. */
function fillPageTools(tools, v, page) {
  tools.replaceChildren();
  const boxes = () => [...v.querySelectorAll(".fold")];
  if (boxes().length) {
    const label = () => (boxes().some(x => !x.classList.contains("closed")) ? "Fold all" : "Open all");
    const b = h("button", { class: "btn small page-fold", type: "button", onclick: () => {
      const all = boxes(), close = all.some(x => !x.classList.contains("closed"));
      const folds = { ...state.folds };
      for (const x of all) { setFolded(x, close); folds[x.dataset.fold] = close ? 1 : 0; }
      commit({ folds });
      b.textContent = label();
    } }, label());
    tools.append(b);
  }
  const gone = hiddenOn(page).length;
  if (gone) {
    tools.append(h("button", { class: "btn small page-restore", type: "button", title: "Bring back the " + gone + " box" + (gone === 1 ? "" : "es") + " you removed from this page",
      onclick: () => { commit({ hidden: { ...state.hidden, [page]: [] } }); render(false); toast("Boxes are back"); } },
      icon("rotate"), "Bring back " + gone));
  }
}
function refreshPageTools() {
  const v = $("#view .view"), tools = $("#view .page-tools");
  if (v && tools) fillPageTools(tools, v, ui.view);
}

/** Removes a box (remembered and synced), with a few seconds to undo. */
function removeBox(el) {
  const page = el.dataset.page, id = el.dataset.fold;
  const name = (el.querySelector(".fold-label") || {}).textContent || "box";
  const hidden = { ...state.hidden, [page]: [...new Set([...hiddenOn(page), id])] };
  el.remove();
  commit({ hidden });
  if (page === "pv") updatePvTools(); else refreshPageTools();
  undoToast("Removed “" + name.trim() + "”", () => {
    commit({ hidden: { ...state.hidden, [page]: hiddenOn(page).filter(x => x !== id) } });
    if (page === "pv") renderPanel(); else render(false);
  });
}
let undoTimer = 0;
function undoToast(msg, undo) { actionToast(msg, "Undo", undo); }
/** A toast with one button (Undo, Open…), shown for 5 seconds. */
function actionToast(msg, label, run) {
  const el = $("#toast");
  el.replaceChildren(h("span", null, msg), h("button", { class: "toast-undo", type: "button", onclick: () => { clearTimeout(undoTimer); el.classList.remove("show", "with-action"); run(); } }, label));
  el.classList.add("show", "with-action");
  clearTimeout(toastTimer); clearTimeout(undoTimer);
  undoTimer = setTimeout(() => el.classList.remove("show", "with-action"), 5000);
}

/** Home: a hello in Chinese for the time of day. */
function greetingBox() {
  const hr = new Date(clock()).getHours();
  const [zh, py, en] = hr < 5 ? ["夜深了", "ye4 shen1 le5", "It's late"] : hr < 11 ? ["早上好", "zao3 shang5 hao3", "Good morning"]
    : hr < 13 ? ["中午好", "zhong1 wu3 hao3", "Good day"] : hr < 18 ? ["下午好", "xia4 wu3 hao3", "Good afternoon"] : ["晚上好", "wan3 shang5 hao3", "Good evening"];
  const name = state.nickname;
  return h("div", { class: "card greeting-card" },
    h("div", { class: "row spread" }, h("span", { class: "eyebrow" }, "Greeting"),
      withVoice(h("button", { class: "btn icon", type: "button", "aria-label": "Listen to " + zh, onclick: () => speak(zh, py) }, icon("play")), { text: zh, p: py, compact: true })),
    h("p", { class: "greeting-zh" }, rubyHz(zh, py), name ? h("span", { class: "greeting-name" }, "，" + name) : null),
    h("p", { class: "muted" }, en + (name ? ", " + name : "") + "."));
}
