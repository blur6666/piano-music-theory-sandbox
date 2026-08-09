# MIDI piano theory tool

Local music theory study tool: on-screen 5-octave piano driven by a MIDI keyboard, showing live note names, chord/scale detection with inversion, degree formula, and diatonic chords. `README.md` covers usage.

## Hard constraints

- **KISS.** No support beyond the owner's use case: Desktop Windows PC. No resilience, no graceful degradation, no edge-case armor. He tinkers and fixes breakage himself.
- **Must work opened straight from the filesystem.** Double-clicking `index.html` has to keep working. That requirement is what forces plain `<script>` tags and one global `SP` instead of ES modules — `import` doesn't load over `file://`. It is a floor, not a ceiling: a static copy is also published to GitHub Pages, which adds no build step, no dependency, and no change to the module strategy. The hosted copy is served from a **subpath** (`/piano-music-theory-sandbox/`), so every asset path stays relative — an absolute path rooted at `/` works on `file://` and breaks there.
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
                                    js/staff.js        grand staff, drawn by VexFlow
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
- **Narrow screens get two octaves, decided once at load.** `main.js` sets `config.LOW = 48` / `HIGH = 72` (C3–C5) before `keyboard.init()` when `matchMedia("(max-width: 560px)")` matches; `keyboard-ui.js` derives every width from those knobs, so nothing else changes. C3–C5 centres the span on middle C — chosen for pitch, not for symmetry, so it deliberately cuts one octave below and two above; don't "centre" it on the full C2–C7 range. **This is honest degradation, not mobile support** — 61 keys at 390px are unplayable, and the `.desktop-note` paragraph in `index.html` (CSS-hidden above 560px, no JS) says so on the page. **Do not add a resize listener or a `ResizeObserver`**: rebuilding the keyboard on rotation, mid-session, with notes possibly held, is worse than not adapting. 560px and 850px are the only two breakpoints; reuse them rather than inventing a third.
- **The staff subscribes LAST, and must stay last.** `state.notify()` is a plain `forEach`, so a listener that throws stops every listener queued behind it. `staff.js` is the only view with a dependency that can fail to load, so it is the only one that can throw. Last in the list, a dead CDN costs the staff and nothing else; first, it would take the keyboard and the detection panel down with it. Verified by deleting `window.Vex` and confirming the rest of the app still repaints.
- **`theory.vexKey()` derives the octave arithmetically, which only works because `FLATS` is naive.** One name per pitch class means it can never yield `Cb` or `B#`, so the letter can never disagree with `Math.floor(midi/12) - 1`. **A key-aware speller would break that line** — it is the flats limitation below quietly holding something up.
- **VexFlow renders the accidental inside the same `g.vf-notehead` group as the notehead.** A flat's tall ascender drags that group's bounding box up by roughly a staff step, so measuring the *group* makes flats look one line too high while sharps look fine. The engraving is correct; measure the notehead ellipse (the one path wider than it is tall) instead. Cost an hour chasing a placement bug that did not exist.
- **Everything drawable in `staff.js` is built through the VexFlow `Factory`, never with `new`.** The factory only draws what is in its render queue, so a raw `new StaveNote(...)` formats correctly, takes up space, and then silently fails to appear — staff lines and clefs but no notes. Modifiers are the exception; the notehead draws its own.
- **VexFlow aligns voices across staves by tick, so a spread run that crosses middle C needs ghost notes.** Both voices start at tick 0, so left alone a scale from C3 draws its top C in the same column as its bottom one instead of after it — and counting columns per staff under-measures the width on top of that. `staff.js` pads each voice with `factory.GhostNote` so every note owns a column, which is the job an engraver gives a rest. **A chord across both staves must keep sharing one column** — that one is not a bug, so a test for this has to tell a scale from a chord.
- **The staff SVG is drawn at whatever width the notes need, then scaled by a `viewBox`.** VexFlow's formatter will not squeeze noteheads below a minimum width, so a chromatic run told to fit 290px overflows its own SVG rather than compressing. `staff.js` widens the drawing and lets CSS shrink it back into the column.
- **Sound** (`config.sound`, `config.sustain`) is synthesized in `audio.js`. Sustain leaves each voice on its natural decay and ignores logical note-off; turning Sustain off releases active voices and makes future note-offs shorten the sound.

## Testing

Open `tests.html`; it prints a pass/fail tally. Smoke test for UI changes: click C-E-G → "C major — root position" and three stacked noteheads on the treble staff; play a scale → name, degrees, chips, and noteheads spread left to right; console decoding; Clear; Latch **via both mouse and MIDI**; Sound and Sustain via mouse and MIDI, including note-off behavior and velocity; note-labels; pick a scale then root it **both by clicking a key and by MIDI**, and Esc out of an armed pick.

Staff-specific checks worth repeating: a chord spanning both staves (one shared column), **a scale that crosses middle C — C3 to C4 — where the notes must run left to right across both staves and not stack**, C2 and C7 (ledger lines, and nothing clipped out of the SVG), a twelve-note set (must scale down, not overflow), and the flats toggle moving a notehead to the next line rather than only relabelling it.

None of these can live in `tests.html`, which loads `data.js` + `theory.js` with no DOM. They need the page in a browser, so they are a checklist, not assertions — which is exactly why the crossing-scale bug survived the first round of testing.

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

(Note: this harness is a viewing convenience, not a dependency — the app still opens by double-click. It doubles as the way to check the GitHub Pages copy, since serving from a subdirectory reproduces the subpath the hosted version runs under.)

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
- Mobile is two octaves and a notice, nothing more — see the narrow-screen bullet above. Cramped keys under 560px are the accepted outcome, not a bug.

## Adding things

Most features are additive: **a new view** (fretboard, staff, quiz) is a new `js/` file, a `<script>` tag, and one `SP.state.subscribe(...)` in `main.js`; **a chord or scale** is one row in `data.js` — name, intervals, and its hand-written degree-formula column; **pentatonic parent keys** are `theory.keyContext` alone. **Flat spelling** is `data.FLATS` + `theory.spell`, plus a boolean mirrored into each view exactly like `latch` — see the toolbar button in `main.js` for the pattern to copy for the next such toggle.

If a change needs edits to three existing files, the layout is being fought — stop and reconsider where the logic belongs.

## Out of scope — do not introduce

npm, bundlers, TypeScript, frameworks, linter config, CI, minification, ES modules, any server the app needs in order to run, browsers other than Chrome/Edge. Static hosting of the very same files is not an exception to this — nothing is generated and nothing is installed. Check any temptation against: does it help one person open one local file and study theory?

**The one accepted third-party dependency is VexFlow**, pinned, from a CDN `<script>` tag in `index.html`. It is not a hole in the list above: it adds no npm, no bundler, no module system, and nothing to install or generate. What it does add is ~800 KiB and an internet requirement **for the staff alone**; every other view keeps working offline, which is a property the subscribe order in `main.js` deliberately protects (see above). It was taken on because hand-rolling engraving meant owning clef glyphs, ledger lines, accidental collisions and second-interval displacement by hand. **Pin the version** — an unpinned CDN URL is someone else's release breaking this app. A second dependency deserves the same argument from scratch; this one is not a precedent.
