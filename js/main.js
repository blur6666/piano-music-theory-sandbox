// The only file that runs anything on load. Everything above it just defines.
(function(){

  SP.keyboard.init();
  SP.results.init();

  SP.state.subscribe(sel => SP.keyboard.repaint(sel));
  SP.state.subscribe(sel => SP.results.render(sel));

  SP.midi.init();

  const latchBtn = document.getElementById("latchBtn");
  let latchOn = SP.config.latch;
  function applyLatch(){
    SP.midi.setLatch(latchOn);
    latchBtn.classList.toggle("on", latchOn);
    latchBtn.textContent = "Latch: " + (latchOn ? "on" : "off");
  }
  latchBtn.addEventListener("click", () => { latchOn = !latchOn; applyLatch(); });
  applyLatch();

  document.getElementById("clearBtn").addEventListener("click", () => SP.state.clear());

  const labelsToggle = document.getElementById("labelsToggle");
  labelsToggle.checked = SP.config.showLabels;
  labelsToggle.addEventListener("change", e => SP.keyboard.setLabels(e.target.checked));

  SP.state.notify();   // initial paint
})();
