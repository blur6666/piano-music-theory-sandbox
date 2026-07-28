// The only file that runs anything on load. Everything above it just defines.
(function(){

  SP.keyboard.init();
  SP.results.init();

  SP.state.subscribe(sel => SP.keyboard.repaint(sel));
  SP.state.subscribe(sel => SP.results.render(sel));

  SP.midi.init();

  document.getElementById("clearBtn").addEventListener("click", () => SP.state.clear());

  const labelsToggle = document.getElementById("labelsToggle");
  labelsToggle.checked = SP.config.showLabels;
  labelsToggle.addEventListener("change", e => SP.keyboard.setLabels(e.target.checked));

  SP.state.notify();   // initial paint
})();
