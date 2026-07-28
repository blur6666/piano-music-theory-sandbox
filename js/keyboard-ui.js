// Builds the on-screen piano and paints it from the selection Set.
(function(){
  const C = SP.config, D = SP.data;
  const keyEls = {};   // MIDI note number -> key element

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
        el.addEventListener("click", () => SP.state.toggle(m));
        kb.appendChild(el);
        keyEls[m] = el;
      }
      this.setLabels(C.showLabels);
    },

    // Full repaint from the Set. Cheap at 61 keys, and it keeps the DOM in
    // sync with state by construction rather than by bookkeeping.
    repaint(sel){
      for (const m in keyEls) keyEls[m].classList.toggle("active", sel.has(+m));
    },

    setLabels(on){
      for (const m in keyEls) keyEls[m].firstChild.style.display = on ? "block" : "none";
    }
  };
})();
