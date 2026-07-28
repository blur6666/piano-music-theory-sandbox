# CLAUDE.md

Local music theory study tool: on-screen 5-octave piano driven by a MIDI
keyboard, showing live note names, intervals, chord/scale detection with
inversion, degree formula, and diatonic chords. `README.md` covers usage.

## Hard constraints

- **KISS.** No support beyond the owner's use case — no resilience, no graceful
  degradation, no edge-case armor. He tinkers and fixes breakage himself.
- **No audio.** Silent by design.
- **Must open by double-clicking `index.html`** off the filesystem in
  Chrome/Edge. No server, no build step, no dependencies.
- **Display conventions** (user-specified): note names without octave numbers,
  deduplicated to pitch classes; intervals as proper names ("major 3rd"), never
  W/H or semitone counts; chords show inversion text.

## Architecture

```
index.html  shell + script tags     js/data.js         SP.config + static tables
style.css   all styling             js/theory.js       detect/diatonic/keyContext, pure
tests.html  assertions on theory    js/state.js        selection Set + subscribe/notify
                                    js/midi.js         Web MIDI, decoding, console log
                                    js/keyboard-ui.js  builds + repaints the piano
                                    js/results-ui.js   renders the detection panel
                                    js/main.js         wires everything together
```

**Plain `<script>` tags at the end of `<body>`, one global `SP`. NOT ES
modules** — `import` doesn't load over `file://`. `data.js` declares
`var SP = {}`; every other file is an IIFE attaching to it. Wrong order fails
loudly, which is what you want.

**`main.js` is the only file that runs anything on load** — everything else just
defines. That is what lets `tests.html` load `data.js` + `theory.js` alone.

### The contract that matters

`SP.state` holds the selection `Set` plus a listener list. Inputs (mouse in
`keyboard-ui.js`, MIDI in `midi.js`) call `set`/`toggle`/`clear`; views
(`keyboard.repaint`, `results.render`) `subscribe`. **Inputs and views must not
reference each other** — a new view is a new file that subscribes and nothing
else changes. Views read the Set they're handed; they never mutate it.

### Where things live

- **`data.js`** — `CHORDS`/`SCALES` are `[name, intervals-from-root, (scales)
  degree-formula]`, e.g. `["minor 7","0,3,7,10"]`. Add a row and detection picks
  it up. `NAMES`/`FLATS` are parallel pitch-class tables (same index); `NAMES`
  also doubles as the geometry source in `keyboard-ui.js`, so it never gets
  swapped for display — use `theory.spell()` instead. `SP.config`: key range,
  initial label visibility, latch default, flats default, MIDI logging flag.
- **`theory.spell(pc, flats)`** — the one place that picks `NAMES` or `FLATS`.
  Naive: one name per pitch class, no key context, so it isn't always the
  textbook-correct letter (Gb major's 7th prints "B", not "Cb") — same
  simplicity level the sharps-only default always had, just switchable.
  `detect()` stamps its `flats` arg onto the returned result so `keyContext()`
  re-spells the same way without a second argument to keep in sync.
- **`theory.detect`** — reduce to pitch classes, try each candidate root (bass
  first) against both dictionaries; ≤4 notes prefers chords, ≥5 scales. Bass
  first means a rotation that is itself in the dictionary wins outright: C-major
  notes over D is "D dorian mode", not an inversion.
- **`theory.diatonic`** — 7-note scales only; triads stacked from scale tones,
  Roman numerals upper/lower/°/+.
- **`theory.keyContext`** — picks the chord list under a result (diatonic for a
  scale, "chords in the key of X" for major/minor-family chords, else `null`).
  **New key-inference rules go here, not in `results-ui.js`.**
- **`keyboard-ui.js`** — loop over `config.LOW`–`HIGH` (36–96, C2–C7, 61 keys);
  white-key count derived, keys positioned by percentage. `repaint` sets
  `.active` across every key from the Set — full repaint, no bookkeeping.
  Mouse honors the same latch flag as MIDI (own `setLatch`, kept in sync by
  `main.js`'s `applyLatch`): momentary presses add on `mousedown` and release on
  the next `mouseup` **anywhere on the page**, so a cursor that drifts off the
  key before release can't strand a note on; latched presses toggle.
  Black/white geometry is derived from `data.NAMES` containing `"#"` — that
  table is geometry, not display. Key labels go through `theory.spell()`
  instead; swapping `NAMES` to change what's shown would make every key test
  white.
- **`midi.js`** — listener on every input port, re-hooked on `statechange`.
  Note-on adds / note-off removes (momentary). **Latch** (`config.latch`, off by
  default) instead toggles on note-on and ignores note-off. Both input paths
  share one latch flag, mirrored into each module by `main.js`; switching modes
  deliberately leaves lit notes alone. Non-note messages are console-decoded
  with a timestamp (`describeMIDI`); its `noteName()` includes an octave on
  purpose — console only, exempt from the display convention.

## Testing

Open `tests.html`; it prints a pass/fail tally. Smoke test for UI changes: click
C-E-G → "C major — root position"; play a scale → name, degrees, chips; console
decoding; Clear; Latch **via both mouse and MIDI**; note-labels.

The whole MIDI input path runs from the console, no hardware needed:

```js
SP.midi.onMIDI({data:[0x90,60,100]});   // note on  C4
SP.midi.onMIDI({data:[0x80,60,0]});     // note off C4
```

`SP.midi.describeMIDI(bytes)` is exported for the same reason.

### Before debugging a dead control: suspect the cache

**Chrome caches `file://` scripts per file and will serve a stale `js/` file
next to freshly-loaded ones.** Cost an hour once — a new button rendered from an
updated `index.html` while `main.js` came from cache, so the element existed
with no listener and every click did nothing. The code was correct throughout.

Symptoms: a control that renders but does nothing; a function that behaves like
an older version; edits that "don't take" while others in the same commit did.

1. Ctrl+Shift+R. A plain `location.reload()` was **not** enough.
2. Still stale? Temporarily version the tag (`js/main.js?v=2`), confirm, revert.
   Don't commit the query string.
3. Confirm what actually loaded before suspecting logic — `typeof
   SP.midi.setLatch`, or spy on a handler, rather than inferring from the UI.

## Process for a change of any size

1. Write `PLAN.md` — always that filename — and commit it alone, before code.
2. Implement, appending any forced deviation to a **Deviations** list at its end.
3. Closing commit: triage every deviation to a permanent home (below), then
   delete `PLAN.md` — in the commit *after* the implementation, so the
   implementation diff isn't buried under a doc deletion.

One filename means retrieving any past plan needs no memory:
`git log --follow --patch -- PLAN.md`

**Where knowledge goes.** The Deviations list is a staging area — `PLAN.md` is
about to be deleted, so anything left in it is lost. Write it down anyway: long
sessions get summarized and the "huh, surprising" detail goes first. Three
destinations, no fourth:

- **A rule that must not be rediscovered** → this file (the cache trap above).
- **A fact about behavior** → an assertion in `tests.html`. Executable, can't go
  stale like prose. "Bass tried first, so C-major over D is D dorian" is a test.
- **A one-off explaining this diff's shape** → the commit message. Git greps
  those; it does not grep deleted files.

## When to commit

- **Validation needs the owner → don't commit.** Implement, report, wait. Here
  that means anything whose real proof is the MIDI keyboard: the browser can
  drive `onMIDI` and prove the logic, never the hardware. Latch mode was
  committed before that check came back; it passed, but the commit was a guess.
- **You can fully validate it → commit without asking.** Passing tests, a
  browser smoke test, a doc edit. Don't manufacture check-ins for proven work.

## Known limitations (accepted, do not "fix" unless asked)

- **Flats toggle is a per-pitch-class table swap, not key-aware spelling.**
  With flats on, every accidental takes its flat name (D#→Eb) from one table
  indexed by pitch class. Nothing computes a correct letter per scale degree,
  so Gb major prints its 7th as B (not Cb) and a scale can repeat or skip
  letters. This is parity with the sharps-only default, not a regression from
  it — key-correct spelling needs letter+accidental math through
  `detect`/`diatonic` plus key inference for results that deliberately have no
  key, and is out of scope.
- Dim/aug/sus/dominant chords get no "chords in this key" list — no single key.
- Pentatonic/blues/whole-tone scales get no diatonic chord chips.
- One MIDI port at a time on Windows — if it won't open, close the DAW.

## Adding things

Most features are additive: **a new view** (fretboard, staff, quiz) is a new
`js/` file, a `<script>` tag, and one `SP.state.subscribe(...)` in `main.js`;
**a chord or scale** is one row in `data.js`; **pentatonic parent keys** are
`theory.keyContext` alone. **Flat spelling** is `data.FLATS` + `theory.spell`,
plus a boolean mirrored into each view exactly like `latch` — see the toolbar
button in `main.js` for the pattern to copy for the next such toggle.

If a change needs edits to three existing files, the layout is being fought —
stop and reconsider where the logic belongs.

## Out of scope — do not introduce

npm, bundlers, TypeScript, frameworks, linter config, CI, minification, ES
modules, local servers, browsers other than Chrome/Edge. Check any temptation
against: does it help one person open one local file and study theory?
