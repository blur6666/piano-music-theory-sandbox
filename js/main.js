// The only file that runs anything on load. Everything above it just defines.
(function(){

  SP.keyboard.init();
  SP.results.init();

  SP.state.subscribe(sel => SP.keyboard.repaint(sel));
  SP.state.subscribe(sel => SP.results.render(sel));

  document.getElementById("addMidiBtn").addEventListener("click", () => SP.midi.init());

  const latchToggle = document.getElementById("latchBtn");
  const latchText = document.getElementById("latchText");
  let latchOn = SP.config.latch;
  function applyLatch(){
    SP.midi.setLatch(latchOn);
    SP.keyboard.setLatch(latchOn);
    latchToggle.checked = latchOn;
  }
  latchToggle.addEventListener("change", () => { latchOn = latchToggle.checked; applyLatch(); });
  applyLatch();

  const flatsToggle = document.getElementById("flatsBtn");
  let flatsOn = SP.config.flats;
  function applyFlats(){
    SP.keyboard.setFlats(flatsOn);
    SP.results.setFlats(flatsOn);
    flatsToggle.checked = !flatsOn;
    SP.state.notify();   // re-render the held chord in the new spelling immediately
  }
  flatsToggle.addEventListener("change", () => { flatsOn = !flatsToggle.checked; applyFlats(); });
  applyFlats();

  document.getElementById("clearBtn").addEventListener("click", () => SP.state.clear());

  const labelsToggle = document.getElementById("labelsToggle");
  labelsToggle.checked = SP.config.showLabels;
  labelsToggle.addEventListener("change", e => SP.keyboard.setLabels(e.target.checked));

  SP.state.notify();   // initial paint
})();
