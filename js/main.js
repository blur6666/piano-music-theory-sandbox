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
    SP.keyboard.setLatch(latchOn);
    latchBtn.classList.toggle("on", latchOn);
    latchBtn.textContent = "Latch: " + (latchOn ? "on" : "off");
  }
  latchBtn.addEventListener("click", () => { latchOn = !latchOn; applyLatch(); });
  applyLatch();

  const flatsBtn = document.getElementById("flatsBtn");
  let flatsOn = SP.config.flats;
  function applyFlats(){
    SP.keyboard.setFlats(flatsOn);
    SP.results.setFlats(flatsOn);
    flatsBtn.classList.toggle("on", flatsOn);
    flatsBtn.textContent = "Flats: " + (flatsOn ? "on" : "off");
    SP.state.notify();   // re-render the held chord in the new spelling immediately
  }
  flatsBtn.addEventListener("click", () => { flatsOn = !flatsOn; applyFlats(); });
  applyFlats();

  document.getElementById("clearBtn").addEventListener("click", () => SP.state.clear());

  const labelsToggle = document.getElementById("labelsToggle");
  labelsToggle.checked = SP.config.showLabels;
  labelsToggle.addEventListener("change", e => SP.keyboard.setLabels(e.target.checked));

  SP.state.notify();   // initial paint
})();
