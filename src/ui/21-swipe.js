/* LearnZì UI, part 2a: on phones, pull the word pop-up down to close it (only when it's scrolled to the top). */

function setupPanelSwipe() {
  const p = $("#panel");
  if (!p) return;
  let startY = 0, dy = 0, startT = 0, tracking = false, dragging = false;
  const noDrag = "input, textarea, select, .writer-box, .fc-writer, .seg, [contenteditable]";
  p.addEventListener("touchstart", ev => {
    tracking = false; dragging = false; dy = 0;
    if (wide.matches || !p.classList.contains("open") || ev.touches.length !== 1) return;
    if (p.scrollTop > 0 || ev.target.closest(noDrag)) return;
    tracking = true;
    startY = ev.touches[0].clientY;
    startT = Date.now();
  }, { passive: true });
  p.addEventListener("touchmove", ev => {
    if (!tracking) return;
    dy = ev.touches[0].clientY - startY;
    if (!dragging) {
      if (dy < 6) { if (dy < -4) tracking = false; return; }   // moving up: let the sheet scroll as usual
      dragging = true;
      p.classList.add("dragging");
    }
    ev.preventDefault();
    const pull = Math.max(0, dy);
    p.style.transform = "translateY(" + pull + "px)";
    $("#scrim").style.opacity = String(Math.max(0, 1 - pull / (p.offsetHeight || 600)));
  }, { passive: false });
  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;
    p.classList.remove("dragging");
    const fast = dy > 40 && Date.now() - startT < 250;
    p.style.transform = "";
    $("#scrim").style.opacity = "";
    if (dy > Math.min(140, p.offsetHeight * 0.28) || fast) closePanel();
  };
  p.addEventListener("touchend", end);
  p.addEventListener("touchcancel", end);
}
