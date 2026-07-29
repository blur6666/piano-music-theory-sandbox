# MIDI piano theory tool

Local music theory study tool: on-screen 5-octave piano driven by a MIDI keyboard, showing live note names, chord/scale detection with inversion, degree formula, and diatonic chords. `README.md` covers usage.

## Hard constraints

- **KISS.** No support beyond the owner's use case: Desktop Windows PC. No resilience, no graceful degradation, no edge-case armor. He tinkers and fixes breakage himself.
- **Synthesized audio.** Notes use the browser Web Audio API; there are no external audio assets.
- **Display conventions** (user-specified): note names without octave numbers, deduplicated to pitch classes; intervals as proper names ("major 3rd"), never W/H or semitone counts; chords show inversion text.

## Architecture

```
index.html  shell + script tags     js/data.js         SP.config + static tables
style.css   all styling             js/theory.js       detect/diatonic/keyContext, pure
tests.html  assertions on theory    js/state.js        selection Set + subscribe/notify
                                    js/audio.js        polyphonic Web Audio synthesis
                                    js/midi.js         Web MIDI, decoding, console log
                                    js/keyboard-ui.js  builds + repaints the piano
                                    js/results-ui.js   renders the detection panel
                                    js/main.js         wires everything together
```

**Plain `<script>` tags at the end of `<body>`, one global `SP`. NOT ES modules** — `import` doesn't load over `file://`. `data.js` declares `var SP = {}`; every other file is an IIFE attaching to it. Wrong order fails loudly, which is what you want.

**`main.js` is the only file that runs anything on load** — everything else just defines. That is what lets `tests.html` load `data.js` + `theory.js` alone.

### The contract that matters

`SP.state` holds the selection `Set` plus listener lists. Inputs (mouse in `keyboard-ui.js`, MIDI in `midi.js`) call `set`/`toggle`/`clear`; views (`keyboard.repaint`, `results.render`) `subscribe`. Audio consumes note events through `subscribeInput`, not selection repaint events. **Inputs and views must not reference each other** — a new view is a new file that subscribes and nothing else changes. Views read the Set they're handed; they never mutate it.

**`state.arm(fn)` is the one place to intercept input.** Every input path bottoms out in `state.set`, so a one-shot capture there catches mouse and MIDI at once: the next note-on goes to `fn` instead of the selection and the arm is spent (`disarm()` to cancel; releases are ignored, never mistaken for a choice). The scale-root picker is built entirely on this and touches neither input file. **Anything that needs "the next note the player hits" goes here, not into `midi.js` and `keyboard-ui.js` twice.**

### Why things are the way they are

Read the files for what the code does. This section is only for decisions the code can't tell you, and for traps that look like bugs.

- **`CHORDS`/`SCALES` share one shape:** `[name, intervals-from-root, degree-formula]`. Add a row and detection picks it up. **The formula column is hand-written display text in stacked-thirds order, not derived from column 2** — write it by hand, don't generate it. `data.DEGREES` is only a fallback for note sets no dictionary row covers; being a naive semitone→degree table it can't spell `#5` or `bb7`, which is exactly why hand-written rows exist.
- **`NAMES` is geometry, not display.** `NAMES`/`FLATS` are parallel pitch-class tables, but `keyboard-ui.js` derives black/white keys from `NAMES` entries containing `"#"`. Swap it to change what's shown and every key tests white. Display goes through `theory.spell()` — the one place that picks between the two tables.
- **`detect()` stamps its `flats` arg onto the result** so `keyContext()` re-spells the same way without a second argument to keep in sync.
- **`theory.detect` tries the bass as root first**, so a rotation that is itself in the dictionary wins outright: C-major notes over D is "D dorian mode", not an inversion. ≤4 notes prefers chords, ≥5 scales.
- **No match still returns a result**, not a dead end — root = bass, label `"<bass> ? (unknown chord)"`, `degrees` computed by `theory.degrees()` — so the player always has an interval formula to read, confirmed or not. That result carries no `hit`, which is what makes `keyContext()` correctly give it no chip panel.
- **`theory.suspects` keeps only the closest tier** (fewest missing notes), so a bare 5th doesn't also suggest every 7th chord that happens to contain it. It runs whenever there's no exact hit **or** fewer than 3 notes are held — a dyad never determines a chord even when one interval happens to match (see the power-chord case).
- **`theory.diatonic` is 7-note scales only**, which is why pentatonic/blues/whole-tone get no chips.
- **`theory.keyContext` owns all key inference.** Diatonic for a scale, "chords in the key of X" for major/minor-family chords, a **"Possible keys" chip list** for dim/aug/sus/dominant (fixed semitone offsets in `data.AMBIGUOUS_KEYS`, reusing the chip renderer with one candidate key per chip instead of one diatonic chord), else `null`. The `null` cases — power chord, minor major 7, non-7-note scales — have genuinely nothing to show; that is not an oversight. **New key-inference rules go here, not in `results-ui.js`.**
- **`keyboard-ui.js` repaints in full** from the Set on every change, no bookkeeping. Momentary mouse presses release on `mouseup` **anywhere on the page**, so a cursor that drifts off the key before release can't strand a note on.
- **Latch** (`config.latch`, off by default) toggles on note-on and ignores note-off; momentary adds on note-on and removes on note-off. Mouse and MIDI share one latch flag, mirrored into each module by `main.js`'s `applyLatch`. Switching modes deliberately leaves lit notes alone. `describeMIDI`'s `noteName()` includes an octave **on purpose** — console only, exempt from the display convention.
- **Sound** (`config.sound`, `config.sustain`) is synthesized in `audio.js`. Sustain leaves each voice on its natural decay and ignores logical note-off; turning Sustain off releases active voices and makes future note-offs shorten the sound.

## Testing

Open `tests.html`; it prints a pass/fail tally. Smoke test for UI changes: click C-E-G → "C major — root position"; play a scale → name, degrees, chips; console decoding; Clear; Latch **via both mouse and MIDI**; Sound and Sustain via mouse and MIDI, including note-off behavior and velocity; note-labels; pick a scale then root it **both by clicking a key and by MIDI**, and Esc out of an armed pick.

The whole MIDI input path runs from the console, no hardware needed:

```js
SP.midi.onMIDI({data:[0x90,60,100]});   // note on  C4
SP.midi.onMIDI({data:[0x80,60,0]});     // note off C4
```

`SP.midi.describeMIDI(bytes)` is exported for the same reason.

### Agent page viewing

Chrome automation blocks `file://` URLs. To inspect UI/CSS and avoid hallucinations, serve temporarily:

```
python -m http.server 8731 --bind 127.0.0.1
```

(Note: this temporary viewing harness does **not** violate the project's "no local servers" rule. The app itself remains serverless and double-clickable.)

### Before debugging a dead control: suspect the cache

**Chrome caches `file://` scripts per file and will serve a stale `js/` file next to freshly-loaded ones.** Cost an hour once — a new button rendered from an updated `index.html` while `main.js` came from cache, so the element existed with no listener and every click did nothing. The code was correct throughout.

Symptoms: a control that renders but does nothing; a function that behaves like an older version; edits that "don't take" while others in the same commit did.

1. Ctrl+Shift+R. A plain `location.reload()` was **not** enough.
2. Still stale? Temporarily version the tag (`js/main.js?v=2`), confirm, revert. Don't commit the query string.
3. Confirm what actually loaded before suspecting logic — `typeof SP.midi.setLatch`, or spy on a handler, rather than inferring from the UI.

## Where knowledge goes

When a change turns up something that wasn't obvious going in — a constraint that forced a different approach, a behavior nobody would guess from the code — route it **at commit time**. That moment reliably arrives; "later in the session" doesn't, and long sessions get summarized with the "huh, surprising" detail going first. Three destinations, no fourth:

- **A rule that must not be rediscovered** → this file (the cache trap above).
- **A fact about behavior** → an assertion in `tests.html`. Executable, can't go stale like prose. "Bass tried first, so C-major over D is D dorian" is a test.
- **A one-off explaining this diff's shape** → the commit message. Git greps those.

## Known limitations (accepted, do not "fix" unless asked)

- Flats toggle is a per-pitch-class table swap, not key-aware spelling. With flats on, every accidental takes its flat name (D#→Eb) from one table indexed by pitch class. Nothing computes a correct letter per scale degree, so Gb major prints its 7th as B (not Cb) and a scale can repeat or skip letters. This is parity with the sharps-only default, not a regression from it — key-correct spelling needs letter+accidental math through `detect`/`diatonic` plus key inference for results that deliberately have no key, and is out of scope.
- Pentatonic/blues/whole-tone scales get no diatonic chord chips.
- One MIDI port at a time on Windows — if it won't open, close the DAW.

## Adding things

Most features are additive: **a new view** (fretboard, staff, quiz) is a new `js/` file, a `<script>` tag, and one `SP.state.subscribe(...)` in `main.js`; **a chord or scale** is one row in `data.js` — name, intervals, and its hand-written degree-formula column; **pentatonic parent keys** are `theory.keyContext` alone. **Flat spelling** is `data.FLATS` + `theory.spell`, plus a boolean mirrored into each view exactly like `latch` — see the toolbar button in `main.js` for the pattern to copy for the next such toggle.

If a change needs edits to three existing files, the layout is being fought — stop and reconsider where the logic belongs.

## Out of scope — do not introduce

npm, bundlers, TypeScript, frameworks, linter config, CI, minification, ES modules, local servers, browsers other than Chrome/Edge. Check any temptation against: does it help one person open one local file and study theory?
