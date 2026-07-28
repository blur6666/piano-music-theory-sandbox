# CLAUDE.md

## Project

`index.html` — a single-file, local music theory study tool. An on-screen
5-octave piano driven by a hardware MIDI keyboard. Shows, live, what the user is
holding: note names, interval names, chord/scale detection with inversion,
scale-degree formula, and diatonic chords.

Personal tool for one user studying theory. Not hosted, no build step, no
dependencies, no framework. Open the file in Chrome/Edge.

## Hard constraints (do not violate)

- **KISS.** No support beyond the owner's use case. No resilience, no graceful
  degradation, no edge-case armor. The owner tinkers and fixes breakage himself.
- **No audio.** The tool is silent by design.
- **Display conventions** (user-specified, keep them):
  - Note names without octave numbers, deduplicated (pitch classes).
  - Intervals as proper names ("major 3rd"), never W/H, never semitone counts.
  - Chords show inversion text (root position / 1st inversion / ...).

## Architecture

Everything lives in one `<script>` at the bottom of the file.

- **Data tables:** `CHORDS` and `SCALES` are arrays of
  `[name, interval-set-string, (scales only) degree-formula]`, intervals in
  semitones from root, e.g. `["minor 7","0,3,7,10"]`. To add a chord or scale,
  add a row — detection picks it up automatically.
- **State:** `sel` — a `Set` of held/selected MIDI note numbers. Single source
  of truth. `press(note, on)` mutates it and repaints.
- **Keyboard:** built in a loop, MIDI notes 36–96 (C2–C7, 61 keys).
  White keys labeled; keys positioned by percentage width.
- **Input, two paths into the same state:**
  - Mouse click → toggle.
  - MIDI note-on (0x90 vel>0) → add; note-off (0x80, or 0x90 vel 0) → remove.
    Momentary: display mirrors what is physically held.
- **MIDI:** `navigator.requestMIDIAccess()`, listener attached to every input
  port, re-hooked on `statechange`. All non-note messages ignored for logic but
  logged to console, decoded human-readable with `HH:MM:SS.mmm` timestamp
  (`describeMIDI`).
- **Detection (`detect`):** reduce `sel` to pitch classes, try each candidate
  root (bass first) against `CHORDS`/`SCALES` interval sets. ≤4 notes prefers
  chords, ≥5 prefers scales. Chord matches get inversion from the bass note's
  position in the interval stack.
- **Diatonic chords (`diatonic`):** for 7-note scales, triads stacked from
  scale tones; Roman numerals uppercase/lowercase/°/+. For detected major- or
  minor-family chords, shows the chords of that key with the chord as I.

## Known limitations (accepted, do not "fix" unless asked)

- Sharps only, no flat spelling (D# never Eb).
- Dim/aug/sus/dominant chords get no "chords in this key" list (no single
  standard key).
- Pentatonic/blues/whole-tone scales get no diatonic chord chips.
- One MIDI port at a time on Windows — if the port won't open, close the DAW.

## Planned refactor (approved — execute when asked)

Full plan in `REFACTOR_PLAN.md` (same folder) — read it before starting.
Summary of the locked-in decisions:

- **Goal:** a new feature or view becomes a NEW file, not edits to existing
  ones.
- **Module system: plain `<script>` tags in dependency order, shared global
  namespace object `SP`. NOT ES modules** — `import`/`export` doesn't load
  over `file://` in Chrome and this tool must open by double-clicking the
  file, with no local server.
- **Target layout:** `index.html` (shell) + `style.css` + `tests.html` + `js/`
  with `data.js` (config knobs + all static tables), `theory.js` (pure
  functions, no DOM), `state.js`, `midi.js`, `keyboard-ui.js`,
  `results-ui.js`, `main.js`.
- **The one architectural change:** `SP.state` — the selection `Set` plus
  subscribe/notify (~15 lines). Inputs (mouse, MIDI) call `state.set()`;
  views subscribe. Inputs and views must not know about each other.
  Everything else is cut-and-paste splitting with behavior unchanged, except
  the key-of logic moving out of `render()` into `theory.keyContext()`.
- **Phases (commit after each, tool must work after each):**
  0 git init + doc fixes → 1 extract CSS → 2 split JS into namespace files →
  3 tests.html → 4 introduce state subscribers → 5 update CLAUDE.md.
- **Smoke test between phases:** click C-E-G → "C major — root position";
  MIDI scale → correct name/degrees/chips; console decoding; Clear button.
- **Out of scope, do not introduce:** npm, bundlers, TypeScript, frameworks,
  linter config, CI, minification, ES modules, local servers, browsers other
  than Chrome/Edge.