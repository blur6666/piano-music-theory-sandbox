// The only file that runs anything on load. Everything above it just defines.
(function(){

  const themePicker = document.querySelector(".theme-picker");
  const themeTrigger = document.querySelector(".theme-trigger");
  const themeButtons = document.querySelectorAll(".theme-swatch");
  const themeVars = { page:"--page", text:"--text-primary", strong:"--text-strong", dim:"--text-secondary",
                      faint:"--text-muted", rule:"--border", accent:"--accent", accentHi:"--accent-hi",
                      onAccent:"--on-accent", second:"--second" };
  let themeHoverTimer = null;

  function showThemeSwatches(){
    if (themeHoverTimer) clearTimeout(themeHoverTimer);
    themePicker.classList.add("is-visible");
    themeTrigger.setAttribute("aria-expanded", "true");
  }

  function hideThemeSwatches(){
    if (themeHoverTimer) clearTimeout(themeHoverTimer);
    themeHoverTimer = setTimeout(() => {
      themePicker.classList.remove("is-visible");
      themeTrigger.setAttribute("aria-expanded", "false");
    }, 3000);
  }

  themePicker.addEventListener("mouseenter", showThemeSwatches);
  themePicker.addEventListener("mouseleave", hideThemeSwatches);
  themePicker.addEventListener("focusin", showThemeSwatches);
  themePicker.addEventListener("focusout", hideThemeSwatches);
  function applyTheme(name){
    const theme = SP.data.THEMES[name];
    const root = document.documentElement;
    for (const key in themeVars) root.style.setProperty(themeVars[key], theme[key]);
    root.style.colorScheme = theme.dark ? "dark" : "light";
    themeButtons.forEach(button => button.setAttribute("aria-pressed", button.dataset.theme === name ? "true" : "false"));
  }
  themeButtons.forEach(button => {
    button.style.background = SP.data.THEMES[button.dataset.theme].accent;
    button.addEventListener("click", () => {
      localStorage.setItem("piano-theme", button.dataset.theme);
      applyTheme(button.dataset.theme);
      showThemeSwatches();
    });
  });
  applyTheme(localStorage.getItem("piano-theme") || SP.config.theme);

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
  const scaleSelect = document.getElementById("scaleSelect");
  const keyChips = document.getElementById("keyChips");
  let selectedRoot = null;

  for (const [name] of SP.data.SCALES){
    const option = document.createElement("option");
    option.value = scaleSelect.options.length - 1;
    option.textContent = name;
    scaleSelect.appendChild(option);
  }

  function loadScale(){
    if (scaleSelect.value === "" || selectedRoot === null) return;
    latchOn = true;
    applyLatch();
    SP.state.replace(SP.theory.scaleNotesNearMiddleC(selectedRoot, SP.data.SCALES[scaleSelect.value][1]));
  }

  function renderKeyChips(){
    keyChips.replaceChildren();
    for (let pc = 0; pc < 12; pc++){
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "key-chip" + (pc === selectedRoot ? " active" : "");
      chip.textContent = SP.theory.spell(pc, flatsOn);
      chip.setAttribute("aria-pressed", pc === selectedRoot ? "true" : "false");
      chip.addEventListener("click", () => {
        selectedRoot = pc;
        renderKeyChips();
        loadScale();
      });
      keyChips.appendChild(chip);
    }
  }

  scaleSelect.addEventListener("change", loadScale);

  function applyFlats(){
    SP.keyboard.setFlats(flatsOn);
    SP.results.setFlats(flatsOn);
    renderKeyChips();
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
