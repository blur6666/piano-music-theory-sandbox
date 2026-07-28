# CLAUDE.md

## Project

A local music theory study tool. An on-screen 5-octave piano driven by a
hardware MIDI keyboard. Shows, live, what the user is holding: note names,
interval names, chord/scale detection with inversion, scale-degree formula, and
diatonic chords.

Personal tool for one user studying theory. Not hosted, no build step, no
dependencies, no framework. Double-click `index.html` to open it in Chrome/Edge —
it must keep working straight off the filesystem, with no local server.

## Hard constraints (do not violate)

- **KISS.** No support beyond the owner's use case. No resilience, no graceful
  degradation, no edge-case armor. The owner tinkers and fixes breakage himself.
- **No audio.** The tool is silent by design.
- **Display conventions** (user-specified, keep them):
  - Note names without octave numbers, deduplicated (pitch classes).
  - Intervals as proper names ("major 3rd"), never W/H, never semitone counts.
  - Chords show inversion text (root position / 1st inversion / ...).

## Architecture

```
index.html     markup shell + script tags, no logic
style.css      all styling
tests.html     assertions over theory.js, open it in the browser
js/
  data.js         SP.config knobs + all static tables
  theory.js       detect / diatonic / keyContext — pure, no DOM
  state.js        the selection Set + subscribe/notify
  midi.js         Web MIDI hookup, message decoding, console log
  keyboard-ui.js  builds and repaints the on-screen piano
  results-ui.js   renders the detection panel
  main.js         wires everything together
```

**Module system: plain `<script>` tags in dependency order at the end of
`<body>`, sharing one global namespace object `SP`. NOT ES modules** —
`import`/`export` doesn't load over `file://` in Chrome, and this tool must open
by double-clicking, with no server. `data.js` declares `var SP = {}`; every
other file is an IIFE that attaches to it, so `SP` is the only global. Wrong
script order fails loudly, which is what you want.

**`main.js` is the only file that runs anything on load.** Everything else just
defines. This is what keeps `tests.html` able to load `data.js` + `theory.js`
alone.

### The contract that matters

`SP.state` holds the selection `Set` and a listener list. Inputs (mouse clicks
in `keyboard-ui.js`, MIDI in `midi.js`) call `set` / `toggle` / `clear`. Views
(`keyboard-ui.repaint`, `results-ui.render`) `subscribe` and receive the Set.
**Inputs and views must not reference each other.** A new view — a fretboard,
a quiz mode — is a new file that subscribes, and nothing else changes. That is
the point of the whole layout; don't route around it.

Views read the Set they're handed; they never mutate it.

### Where things live

- **Data tables** (`data.js`): `CHORDS` and `SCALES` are arrays of
  `[name, interval-set-string, (scales only) degree-formula]`, intervals in
  semitones from root, e.g. `["minor 7","0,3,7,10"]`. To add a chord or scale,
  add a row — detection picks it up automatically. `SP.config` holds the key
  range, initial label visibility, and the MIDI console-logging flag.
- **Detection** (`theory.detect`): reduce to pitch classes, try each candidate
  root (bass first) against `CHORDS`/`SCALES`. ≤4 notes prefers chords, ≥5
  prefers scales. Chord matches get inversion from the bass note's position in
  the interval stack. Because the bass is tried first, a rotation that is itself
  in the dictionary wins outright — C-major notes over D is "D dorian mode",
  not an inversion.
- **Diatonic chords** (`theory.diatonic`): for 7-note scales, triads stacked
  from scale tones; Roman numerals uppercase/lowercase/°/+.
- **Key context** (`theory.keyContext`): decides what chord list to show under a
  result — diatonic chords for a scale, "chords in the key of X" for a major- or
  minor-family chord, `null` otherwise. **New key-inference rules go here, not
  in `results-ui.js`.** The view just renders what it gets back.
- **Keyboard** (`keyboard-ui.js`): built in a loop over `config.LOW`–`HIGH`
  (36–96, C2–C7, 61 keys); white-key count is derived, keys positioned by
  percentage width. `repaint` sets `.active` across every key from the Set —
  full repaint, no incremental bookkeeping.
- **MIDI** (`midi.js`): `navigator.requestMIDIAccess()`, listener attached to
  every input port, re-hooked on `statechange`. Note-on (0x90 vel>0) adds,
  note-off (0x80, or 0x90 vel 0) removes — momentary, so the display mirrors
  what is physically held. Non-note messages are ignored for logic but decoded
  human-readable to the console with an `HH:MM:SS.mmm` timestamp
  (`describeMIDI`). Its `noteName()` includes an octave number on purpose:
  console only, and not subject to the display convention above.

## Testing

Open `tests.html` in the browser; it prints a pass/fail tally. Hard-reload
(Ctrl+Shift+R) — Chrome caches `file://` scripts aggressively and will happily
serve you the previous version of a `js/` file.

Manual smoke test for anything touching the UI: click C-E-G → "C major — root
position"; play a scale on the MIDI keyboard → correct name, degrees, chips;
check console decoding; Clear button; note-labels checkbox.

## Known limitations (accepted, do not "fix" unless asked)

- Sharps only, no flat spelling (D# never Eb).
- Dim/aug/sus/dominant chords get no "chords in this key" list (no single
  standard key).
- Pentatonic/blues/whole-tone scales get no diatonic chord chips.
- One MIDI port at a time on Windows — if the port won't open, close the DAW.

## Adding things

The layout exists so that most features are additive. Where the known ideas go:

- **A new view** (fretboard, staff, quiz): new file in `js/`, a `<script>` tag,
  and a `SP.state.subscribe(...)` line in `main.js`. Nothing else changes.
- **A new chord or scale:** one row in `data.js`.
- **Parent-key chords for pentatonics:** `theory.keyContext` only.
- **Flat spelling:** a spelling table in `data.js` and a function in
  `theory.js`; views unchanged.

If a change requires editing three existing files, the layout is being fought —
stop and reconsider where the logic belongs.

## Out of scope — do not introduce

npm, bundlers, TypeScript, frameworks, linter config, CI, minification, ES
modules, local servers, browsers other than Chrome/Edge. Check any temptation
against: does it help one person open one local file and study theory? So far
nothing on this list does.