// The only file that runs anything on load. Everything above it just defines.
(function(){

  const themePicker = document.querySelector(".theme-picker");
  const themeTrigger = document.querySelector(".theme-trigger");
  const themeButtons = document.querySelectorAll(".theme-swatch");
  const themeVars = { page:"--page", text:"--text-primary", strong:"--text-strong", dim:"--text-secondary",
                      faint:"--text-muted", rule:"--border", accent:"--accent", accentHi:"--accent-hi",
                      onAccent:"--on-accent", second:"--second", pianoShell:"--piano-shell" };
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
    button.style.background = SP.data.THEMES[button.dataset.theme].icon;
    button.addEventListener("click", () => {
      localStorage.setItem("piano-theme", button.dataset.theme);
      applyTheme(button.dataset.theme);
      showThemeSwatches();
    });
  });
  applyTheme(localStorage.getItem("piano-theme") || SP.config.theme);

  // Two octaves on a phone. 61 keys at 390px are unplayable, and LOW/HIGH are
  // real knobs -- keyboard-ui derives every width from them -- so narrowing
  // the range is the entire mobile adaptation. Decided once, here, before
  // init() builds the keys: no resize listener, nothing rebuilds mid-session.
  if (window.matchMedia("(max-width: 560px)").matches){
    SP.config.LOW = 48;    // C3
    SP.config.HIGH = 72;   // C5
  }

  SP.keyboard.init();
  SP.results.init();

  SP.state.subscribe(sel => SP.keyboard.repaint(sel));
  SP.state.subscribe(sel => SP.results.render(sel));
  SP.state.subscribeInput((note, on, velocity) => SP.audio.handle(note, on, velocity));

  document.getElementById("addMidiBtn").addEventListener("click", () => {
    SP.audio.unlock();
    SP.midi.init();
  });

  const soundToggle = document.getElementById("soundToggle");
  let soundOn = SP.config.sound;
  function applySound(){
    SP.audio.setEnabled(soundOn);
    soundToggle.checked = soundOn;
  }
  soundToggle.addEventListener("change", () => {
    soundOn = soundToggle.checked;
    applySound();
  });
  applySound();

  const sustainToggle = document.getElementById("sustainToggle");
  let sustainOn = SP.config.sustain;
  function applySustain(){
    SP.audio.setSustain(sustainOn);
    sustainToggle.checked = sustainOn;
  }
  sustainToggle.addEventListener("change", () => {
    sustainOn = sustainToggle.checked;
    applySustain();
  });
  applySustain();

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
  const scaleHint = document.getElementById("scaleHint");
  let latchBeforeArm = latchOn;

  for (const [name] of SP.data.SCALES){
    const option = document.createElement("option");
    option.value = scaleSelect.options.length - 1;
    option.textContent = name;
    scaleSelect.appendChild(option);
  }

  // Picking a scale doesn't draw anything yet -- it arms the next note played
  // (MIDI or mouse, SP.state.arm doesn't care which) as the root. The dropdown
  // snaps back to the placeholder so the same scale can be re-rooted without
  // detouring through another one; what is on the keyboard is named in the
  // Detected panel anyway.
  function armScale(){
    if (scaleSelect.value === "") return;
    const ivStr = SP.data.SCALES[scaleSelect.value][1];
    scaleSelect.value = "";
    scaleHint.hidden = false;
    // Latched now, before the root is struck, not after it lands. A momentary
    // mouse press would still be holding the root when the scale drew, and its
    // mouseup would knock that first note straight back out.
    if (!SP.state.capture) latchBeforeArm = latchOn;
    latchOn = true;
    applyLatch();
    SP.state.arm(root => {
      scaleHint.hidden = true;
      SP.state.replace(SP.theory.scaleNotesFrom(root, ivStr));
    });
  }

  function cancelScale(){
    if (!SP.state.capture) return;
    SP.state.disarm();
    scaleHint.hidden = true;
    latchOn = latchBeforeArm;
    applyLatch();
  }

  scaleSelect.addEventListener("change", armScale);
  document.addEventListener("keydown", e => { if (e.key === "Escape") cancelScale(); });

  function applyFlats(){
    SP.keyboard.setFlats(flatsOn);
    SP.results.setFlats(flatsOn);
    flatsToggle.checked = !flatsOn;
    SP.state.notify();   // re-render the held chord in the new spelling immediately
  }
  flatsToggle.addEventListener("change", () => { flatsOn = !flatsToggle.checked; applyFlats(); });
  applyFlats();

  document.getElementById("clearBtn").addEventListener("click", () => {
    SP.audio.releaseAll();
    SP.state.clear();
  });

  const labelsToggle = document.getElementById("labelsToggle");
  labelsToggle.checked = SP.config.showLabels;
  labelsToggle.addEventListener("change", e => SP.keyboard.setLabels(e.target.checked));

  SP.state.notify();   // initial paint
})();
