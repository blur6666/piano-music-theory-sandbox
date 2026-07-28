// Builds the on-screen piano and paints it from the selection Set.
(function(){
  const C = SP.config, D = SP.data;
  const keyEls = {};   // MIDI note number -> key element
  const mouseHeld = new Set();   // notes currently down via mouse, momentary mode only
  let latch = C.latch;   // mirrors SP.midi's flag; kept in sync by main.js's applyLatch()

  function press(m){
    if (latch) SP.state.toggle(m);
    else { mouseHeld.add(m); SP.state.set(m, true); }
  }

  // Bound to window, not the key, so a release anywhere on the page --
  // cursor drifted off the key, or off the page entirely -- still clears
  // it. Otherwise a stray release could strand a note on.
  function releaseHeld(){
    if (latch) return;
    for (const m of mouseHeld) SP.state.set(m, false);
    mouseHeld.clear();
  }

  SP.keyboard = {

    init(){
      const kb = document.getElementById("kb");
      // Derived, not hardcoded, so LOW/HIGH in config.js are real knobs.
      let whiteTotal = 0;
      for (let m = C.LOW; m <= C.HIGH; m++) if (!D.NAMES[m % 12].includes("#")) whiteTotal++;
      const wW = 100 / whiteTotal;
      let wIdx = 0;
      for (let m = C.LOW; m <= C.HIGH; m++){
        const name = D.NAMES[m % 12], black = name.includes("#");
        const el = document.createElement("div");
        el.className = "pkey " + (black ? "black" : "white");
        if (!black){
          el.style.width = wW + "%";
          el.style.left = (wIdx * wW) + "%";
          wIdx++;
        } else {
          el.style.width = (wW * 0.62) + "%";
          el.style.left = (wIdx * wW - wW * 0.31) + "%";
        }
        const lbl = document.createElement("span");
        lbl.textContent = name;
        lbl.className = "klabel";
        el.appendChild(lbl);
        el.addEventListener("mousedown", () => press(m));
        kb.appendChild(el);
        keyEls[m] = el;
      }
      window.addEventListener("mouseup", releaseHeld);
      this.setLabels(C.showLabels);
    },

    // Full repaint from the Set. Cheap at 61 keys, and it keeps the DOM in
    // sync with state by construction rather than by bookkeeping.
    repaint(sel){
      for (const m in keyEls) keyEls[m].classList.toggle("active", sel.has(+m));
    },

    setLabels(on){
      for (const m in keyEls) keyEls[m].firstChild.style.display = on ? "block" : "none";
    },

    // Called by main.js's applyLatch() alongside SP.midi.setLatch(), so both
    // input paths always agree on the current mode.
    setLatch(on){ latch = on; }
  };
})();
