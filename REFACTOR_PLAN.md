# scale-piano — Refactor Plan

Goal: turn a working 300-line single-file POC into a small, maintainable hobby
project that can grow features without each change risking the whole file. One
person, no hosting, no build step. KISS is a requirement, not a preference.

The refactor has one measurable outcome: **a new view or feature can be added
by creating a new file, not by editing existing ones.**

## Why refactor at all

The single file is fine until a feature touches everything. The likely next
features (parent-key chords for pentatonics, flat spelling, a fretboard view,
eventually a quiz mode) all want to reuse the theory logic and the selection
state independently of the piano UI. Right now theory, state, MIDI, and DOM are
interleaved.

## Target layout

```
midi-kb-sandbox/
├── index.html          markup shell + script tags at end of <body>
├── style.css           the current <style> block, unchanged
├── tests.html          console.assert over data.js + theory.js
├── CLAUDE.md
├── REFACTOR_PLAN.md
└── js/
    ├── data.js         SP.config knobs + all static tables
    ├── theory.js       detect / diatonic / keyContext — pure, no DOM
    ├── state.js        selection Set + subscribe/notify
    ├── midi.js         Web MIDI hookup, message decoding, console log
    ├── keyboard-ui.js  builds and repaints the on-screen piano
    ├── results-ui.js   renders the detection panel
    └── main.js         wires everything, the only file that runs on load
```

Seven JS files for ~190 lines. Anything finer is more shelves than books.

## Decision: plain script tags, no ES modules

ES modules (`import`/`export`) don't load over `file://` in Chrome — you'd need
a local server running just to open your own tool. That violates "double-click
the file and it works."

Instead: each file attaches to one global namespace object `SP`, and
`index.html` loads them with ordinary `<script>` tags in dependency order, at
the **end of `<body>`**. `data.js` declares `var SP = {};`; every other file
assumes it exists — if the script order is ever wrong it fails loudly on the
next line, which is the right behavior here.

## File contents

**`js/data.js`** — knobs first, then tables:

```js
var SP = {};
SP.config = {
  LOW: 36, HIGH: 96,   // MIDI range of the on-screen keyboard (C2–C7)
  showLabels: true,    // initial state of the Note labels checkbox
  logMIDI: true        // decode every MIDI message to the console
};
SP.data = { NAMES, IV, ORD, ROMAN, CHORDS, SCALES, MAJOR_FAM, MINOR_FAM,
            MAJOR_IV: "0,2,4,5,7,9,11", MINOR_IV: "0,2,3,5,7,8,10" };
```

**`js/theory.js`** — `detect()` and `diatonic()` move verbatim, plus one new
function that absorbs the key logic previously inside `render()`:

```js
SP.theory.keyContext = function (r) {   // r is a detect() result
  // scale  -> { label: "Diatonic chords", chords }
  // major/minor-family chord -> { label: "Chords in the key of X …", chords }
  // otherwise -> null
};
```

`results-ui.js` makes one call and renders whatever comes back. This is the
extension point where pentatonic parent-key chords land later, with no view
edit. `detect()` keeps building its label string — splitting that into
structured fields costs more than it returns today.

**`js/state.js`** — the one architectural change:

```js
SP.state = {
  sel: new Set(), listeners: [],
  subscribe(fn){ this.listeners.push(fn); },
  notify(){ this.listeners.forEach(fn => fn(this.sel)); },
  set(note, on){ on ? this.sel.add(note) : this.sel.delete(note); this.notify(); },
  toggle(note){ this.set(note, !this.sel.has(note)); },
  clear(){ this.sel.clear(); this.notify(); }
};
```

Listeners receive the live `Set` — views read it, never mutate it. MIDI and
mouse call `set`/`toggle`; the keyboard painter and results panel `subscribe`.
Neither input knows the views exist; neither view knows where notes come from.

**`js/midi.js`** — gains `CC_NAMES` and `noteName()` (octave-suffixed; it is
console-only, which is why it doesn't violate the no-octave display rule).
Exposes `SP.midi.init()`.

**`js/keyboard-ui.js`** — exposes `init()`, `repaint(sel)`, `setLabels(on)`.
Two changes from verbatim:

- derive the white-key count instead of hardcoding 36, so the `LOW`/`HIGH`
  knobs actually work
- `repaint(sel)` sets `classList.toggle("active", sel.has(m))` across all keys.
  61 elements, free. This replaces the three places that used to hand-manage
  the active class, and keeps the DOM in sync with the Set by construction.

**`js/results-ui.js`** — `init()` caches the element lookups once; `render(sel)`
holds the display logic and `renderChips`.

**`js/main.js`** — the only file with load-time behavior: init the views,
subscribe them to state, init MIDI, wire the toolbar, then one `SP.state.notify()`
for the initial paint.

## Phases

Commit after each. The tool must work at the end of every one.

**Phase 0 — done.** Repo, first commit, and doc filename fixes.

**Phase 1 — extract CSS.** `<style>` → `style.css`, add `<link>`. Nothing else.

**Phase 2 — split JS into the 7 files.** The long phase. Mostly mechanical
reference fixing (`NAMES` → `SP.data.NAMES`). Three deliberate non-verbatim
bits, all listed above: `keyContext` extraction, `whiteTotal` derivation,
cached element lookups.

**Phase 3 — `tests.html`.** Loads `data.js` + `theory.js` only (both are
side-effect free, which is what makes this possible) and runs assertions,
printing a pass/fail tally to the page. Placed here, immediately after the
split, because it validates the `keyContext` move — the riskiest part of
Phase 2.

**Phase 4 — state subscribers.** Swap the direct `render()` calls for
`SP.state`, delete `press()` and the now-dead class handling in the click and
Clear handlers.

**Phase 5 — update `CLAUDE.md`** to describe the new layout and the state
contract.

## Verification

Smoke test after each phase, in Chrome, by double-clicking `index.html`:

- **Hard-reload every time** (Ctrl+Shift+R). Chrome caches `file://` scripts
  aggressively and will happily serve you the previous version of a `js/` file.
- Click C–E–G → `C major — root position`.
- Click E–G–C (E lowest) → `1st inversion (E in bass)`.
- Play a major scale on the MIDI keyboard → correct name, degree formula, and
  seven diatonic chips with C highlighted.
- Hold a Cmaj7 → "Chords in the key of C major (this chord as I)".
- Console shows timestamped decoded MIDI; note-off clears the key.
- Clear button empties the panel and unlights every key.
- Note-labels checkbox still hides/shows labels.

From Phase 3 on, also open `tests.html` and confirm zero failures.

## How the known feature ideas land afterward

Parent-key chords for pentatonics: edit `theory.js` only. Flat spelling:
`data.js` gains a spelling table, `theory.js` a spelling function; views
unchanged. Fretboard view: new `fretboard-ui.js` that subscribes to state —
zero edits elsewhere, which is the whole point.

## Explicitly out of scope

No npm, no bundler, no TypeScript, no framework, no linter config, no CI, no
minification, no browser support beyond Chrome/Edge on your PC. Any future
temptation toward these should be checked against: does it help one person open
one local file and study theory? So far nothing on this list does.

Also not doing: flat spelling, audio, or structured (non-string) `detect()`
output — all deferred, none blocked by this layout.
