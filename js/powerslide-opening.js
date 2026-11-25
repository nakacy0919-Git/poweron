/* PowerSlide opening: runs once on each document load, never touches lesson state. */
(function () {
  "use strict";
  if (document.getElementById("ps-intro")) return;
  // Do not introduce a blocking overlay if its stylesheet did not load.
  const screen = document.createElement("div");
  screen.id = "ps-intro";
  screen.setAttribute("role", "dialog");
  screen.setAttribute("aria-modal", "true");
  screen.setAttribute("aria-label", "PowerSlide オープニング");
  screen.innerHTML = '<div class="ps-nebula" aria-hidden="true"></div><div class="ps-stars" aria-hidden="true"></div><div class="ps-vignette" aria-hidden="true"></div><div class="ps-orbit" aria-hidden="true"></div><div class="ps-orbit ps-orbit-two" aria-hidden="true"></div><div class="ps-sweep" aria-hidden="true"></div><div class="ps-logo-stage"><div class="ps-logo-disc"><img src="img/powerslide-logo.avif" alt="PowerSlide" width="256" height="256"></div><span class="ps-overline">A NEW WAY TO LEARN</span></div><div class="ps-title-stage"><span class="ps-overline">PowerSlide Presents</span><div class="ps-title">POWER <em>ON</em> Ⅲ</div><div class="ps-rule" aria-hidden="true"></div><span class="ps-subtitle">YOUR ENGLISH JOURNEY BEGINS</span></div><button class="ps-skip" type="button">スキップ <span aria-hidden="true">→</span></button><div class="ps-progress" aria-hidden="true"></div>';
  document.body.prepend(screen);
  if (getComputedStyle(screen).position !== "fixed") {
    screen.remove();
    return;
  }
  const skip = screen.querySelector(".ps-skip");
  const previousFocus = document.activeElement;
  const disabled = [];
  let finished = false, timer;
  function isolate() {
    if (finished) return;
    for (const node of document.body.children) {
      if (node === screen || node.matches("script,style,link") || node.inert) continue;
      if ("inert" in node) { node.inert = true; disabled.push(node); }
    }
    skip.focus({preventScroll:true});
  }
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    window.removeEventListener("keydown", onKey, true);
    document.removeEventListener("DOMContentLoaded", isolate);
    for (const node of disabled) node.inert = false;
    screen.remove();
    if (previousFocus && previousFocus !== document.body && previousFocus.isConnected) {
      previousFocus.focus({preventScroll:true});
    }
  }
  function onKey(event) {
    if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); finish(); }
    else if (event.key === "Tab") { event.preventDefault(); event.stopImmediatePropagation(); skip.focus(); }
    else if (event.target !== skip || !["Enter"," "].includes(event.key)) {
      event.stopImmediatePropagation();
    }
  }
  skip.addEventListener("click", finish);
  window.addEventListener("keydown", onKey, true);
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  timer = window.setTimeout(finish, reduced ? 200 : 5600);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", isolate, {once:true});
  else isolate();
  const image = screen.querySelector("img");
  function logoFallback() {
    const parent = image.parentElement;
    if (!parent) return;
    parent.classList.add("ps-logo-fallback");
    image.remove();
    parent.textContent = "PowerSlide";
  }
  image.addEventListener("error", logoFallback, {once:true});
  if (image.complete && !image.naturalWidth) logoFallback();
  if (!reduced) {
    const stars = screen.querySelector(".ps-stars"), fragment = document.createDocumentFragment();
    for (let i = 0; i < 68; i++) {
      const x = (i * 37.17 + 13) % 100, y = (i * 71.39 + 9) % 100;
      const star = document.createElement("span");
      star.className = "ps-star";
      star.style.left = x + "%"; star.style.top = y + "%";
      star.style.width = star.style.height = (i % 9 === 0 ? 3 : 1.5) + "px";
      star.style.setProperty("--ps-dx", ((x-50)*.32) + "vw");
      star.style.setProperty("--ps-dy", ((y-50)*.32) + "vh");
      fragment.append(star);
    }
    stars.append(fragment);
  }
})();
