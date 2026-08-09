# Plan: grand staff view

Status: **implemented** on branch `staff-view`. Kept as the record of why the
change looks the way it does; the durable rules it turned up have been moved into
`AGENTS.md`, which is where they belong.

Two things the plan did not predict, both now in `AGENTS.md`: VexFlow only draws
what is in its `Factory` render queue, so notes built with a bare `new StaveNote`
lay out correctly and then never appear; and its formatter will not compress
noteheads below a minimum width, so a wide set overflows its own SVG instead of
shrinking. A third cost an hour and was not a bug at all — VexFlow puts the
accidental inside the notehead group, so measuring that group's bounding box
makes every flat look a line too high.

## Why

The app names what you played in prose — `Notes`, `Degrees`, `Detected`, chord chips — but never *notates*
it. A staff is the one representation a musician reads without translating. `AGENTS.md` already anticipates
this exact feature under **Adding things**: *"a new view (fretboard, **staff**, quiz) is a new `js/` file, a
`<script>` tag, and one `SP.state.subscribe(...)` in `main.js`"*. This follows that shape. No existing module
changes behaviour; the staff is a pure consumer of the selection `Set`.

## Decisions

| Decision | Rationale |
|---|---|
| **Grand staff** (treble + bass) | The keyboard is C2–C7. A treble staff alone covers ~F3–E6, so C2 would need 9 ledger lines. |
| **VexFlow 4 via CDN** | Supplies Bravura engraving, ledger lines, accidental collision stacking, second-interval displacement, and the piano brace — most of the hand-rolled cost. |
| **Layout from `theory.detect`** | Chords stack as one notehead group; scales run left-to-right. |
| **Three-column results row** | Staff leftmost, then Notes/Degrees, then Detected + chips. |
| **Only the `brass` theme is verified** | CSS uses theme variables so the rest likely follow, but they are explicitly out of scope here. |

Rejected: hand-rolled SVG (~150 lines, and the Unicode clef glyph `𝄞` was an unresolved rendering risk);
abcjs (wants ABC *strings*, so it needs a pitch-set→ABC translator); Verovio / OpenSheetMusicDisplay
(MusicXML/MEI engines, far heavier, aimed at whole scores).

## The dependency

```html
<script src="https://cdn.jsdelivr.net/npm/vexflow@4.2.2/build/cjs/vexflow.js"></script>
```

Defines a global `Vex.Flow`. **Pin the version** — VexFlow's own docs recommend it, and an unpinned CDN URL
is silent breakage waiting to happen. `/cjs/` is the correct path for plain `<script>` tags.

This introduces no npm, bundler, TypeScript, framework, or ES module, and needs no server — the
**Out of scope** list in `AGENTS.md` survives intact. It *does* add ~800 KiB of third-party code and an
internet requirement for one view. That is a real change to the project's character; `AGENTS.md` gets an
edit recording it (see Knowledge routing).

Failure mode is deliberately unhandled, per the KISS constraint: no CDN, no staff, an error in the console.
One structural precaution is still required — see the next section.

## Trap: subscriber ordering

`SP.state.notify()` is `this.listeners.forEach(fn => fn(this.sel))` (`js/state.js:20`). A listener that
throws propagates out of `forEach`, so **every listener registered after it never runs**. If VexFlow fails
to load, `staff.render` throws.

**The staff must subscribe last**, after `keyboard.repaint` and `results.render` (`js/main.js:63-64`).
Registered last, a dead CDN costs the staff and nothing else. Registered first, it takes the whole app down.

## Step 1 — `theory.vexKey()`

VexFlow wants pitches as `"c#/4"`. This goes in `js/theory.js`, not the view, so `tests.html` can assert on
it while loading only `data.js` + `theory.js`.

```js
// A pitch as VexFlow names it: letter + accidental + octave, e.g. "c#/4".
// Derived from spell(), so the flats toggle moves the notehead and not just
// the label -- D# draws on the D line, Eb on the E line.
vexKey(midi, flats){
  return this.spell(midi % 12, flats).toLowerCase() + "/" + (Math.floor(midi / 12) - 1);
}
```

The octave arithmetic is safe for a reason worth knowing: `data.FLATS` is a naive per-pitch-class table (the
documented limitation in `AGENTS.md`), so it never yields `Cb` or `B#`. The letter can never disagree with
the octave number, and there is no wraparound case to handle.

**The key string is not enough on its own.** VexFlow does not draw an accidental just because the key
contains one — each needs an explicit `.addModifier(new Accidental('#'), i)` at that notehead's index.

## Step 2 — `js/staff.js`

An IIFE attaching `SP.staff`, mirroring `js/keyboard-ui.js`'s shape: `init` / `render` / `setFlats`.

Use the **`Factory` + `System` API**, not raw `Stave` / `Formatter`. Per VexFlow's FAQ, aligning voices
across staves by hand needs `joinVoices` per stave, a shared `format` call, and manual
`getNoteStartX`/`setNoteStartX` fixups; `System` does all of that internally.

`render(sel)` — full repaint, same philosophy as `keyboard.repaint`:

1. Clear `#staffOut` first — `Factory` appends a fresh `<svg>` on every call.
2. Empty selection → draw the bare grand staff, so the column never collapses and the page doesn't jump.
3. Split notes at middle C: MIDI `>= 60` → treble, else bass.
4. Derive `pcs` / `bass` the way `js/results-ui.js:42-43` does, then call `SP.theory.detect(pcs, bass, flats)`.
   Duplicating those two lines beats routing one detect result through `main.js` into both views — that would
   touch three existing files, which `AGENTS.md` warns against.
5. Grouping *is* the layout, which is the nice part of using VexFlow:
   - **chord** → one `StaveNote` holding every key:
     `new StaveNote({ keys: ['c/4','e/4','g/4'], duration: 'w' })`
   - **scale** (`r.kind === "scale"`, or more than 5 notes held) → one single-key `StaveNote` per note
   - The `> 5` guard stops an unmatched 12-note cluster from stacking into a solid bar.
6. `duration: 'w'` throughout. Whole notes are stemless, which is exactly right — a selection has no rhythm,
   and a stem would assert a duration that isn't there.
7. Add an `Accidental` modifier for each key whose spelling has one, at that key's index.
8. Eight whole notes is 32 beats, so **set the voice to soft / non-strict mode** rather than fighting a time
   signature. Add no time signature at all.
9. If one staff has no notes, add the stave without a voice rather than inventing a rest.
10. `addConnector('brace')` and `addConnector('singleLeft')` for the piano brace.

`setFlats(on)` mirrors the flag exactly like `js/keyboard-ui.js:120`. No re-render inside it —
`main.js`'s `applyFlats()` already calls `SP.state.notify()` (`js/main.js:157`).

## Step 3 — wiring

- **`index.html`** — the pinned VexFlow CDN tag, then `<script src="js/staff.js">` after `theory.js`. Add
  `<div class="results-col col-staff">` containing a `Staff` field label and `<div id="staffOut">`, as the
  **first** child of `.results`.
- **`js/main.js`** — `SP.staff.init()` beside the other inits (`:60-61`); the subscribe **last**, after the
  `results.render` line (`:64`), for the reason in *Trap* above; `SP.staff.setFlats(flatsOn)` inside
  `applyFlats()` (`:153`).

## Step 4 — layout and colour

`.results` is already `display:flex; flex-wrap:wrap`. Add `.col-staff { flex: 0 0 300px; padding-right: 32px;
border-right: 1px solid var(--border); }`, narrow `.col-left` from 385px to ~260px, leave `.col-right` at
`flex: 1 1 0`.

VexFlow renders black by default. Rather than styling each element in JS, colour the generated SVG with one
CSS rule — VexFlow's SVG output is paths and rects, so this catches staff lines, clefs, noteheads and
accidentals together:

```css
#staffOut svg path, #staffOut svg rect { fill: var(--text-primary); }
```

**Try `fill` alone first.** Adding `stroke` thickens the Bravura glyph outlines and tends to look wrong;
fall back to per-note `setStyle({fillStyle, strokeStyle})` only if the CSS route fails.

Two things to check rather than assume:

- `#nameOut` is `font-size: clamp(38px, 5vw, 68px)` (`style.css:507`) and now sits in a narrower column —
  watch for overflow on a long label like *"C# minor 7 flat 5 — 2nd inversion"*.
- The `@media (max-width: 850px)` block (`style.css:589-600`) forces the existing columns to
  `flex-basis: 100%`; `.col-staff` needs the same treatment.

**Reuse the 850px and 560px breakpoints — do not invent a third** (`AGENTS.md`).

## Verification

1. **`tests.html`** — add `eq()` assertions for `vexKey`: `(60,false)` → `"c/4"`, `(36,false)` → `"c/2"`,
   `(96,false)` → `"c/7"`, `(59,false)` → `"b/3"` (the octave boundary), and the one that earns its keep —
   `(63,false)` → `"d#/4"` vs `(63,true)` → `"eb/4"`. This needs **no VexFlow**: `vexKey` lives in
   `theory.js`, so `tests.html` keeps loading only `data.js` + `theory.js`. Currently 64 assertions.
2. **Serve and look** — `python -m http.server 8731 --bind 127.0.0.1`, then drive headless Chrome over CDP.
   Confirm `Vex.Flow.BUILD` in the console *before* debugging anything visual. Check:
   - C-E-G → one stacked whole-note chord on the treble staff; `Detected` reads *"C major — root position"*
   - C major scale via the picker → 8 whole notes ascending left-to-right
   - a chord spanning C2–C6 → notes split across both staves, brace intact
   - C-D-E cluster → VexFlow displaces the seconds automatically; confirm it actually does
   - flats toggle → the D#/Eb notehead moves a line and the accidental flips ♯→♭
   - Clear → bare grand staff, no layout jump
3. **`brass` theme only.** The other six are out of scope for this change.
4. **Kill the network and reload** — the keyboard, detection, and audio must all still work with only the
   staff missing. This is the test that proves the subscriber ordering is right.
5. Suspect the script cache before debugging anything dead (`AGENTS.md`). Ctrl+Shift+R first.

## Knowledge routing (at commit time)

- **`AGENTS.md` needs a real edit**, not a footnote. Its *Out of scope* list makes a reader assume no
  third-party code, and VexFlow contradicts that on first glance. Record what was accepted (a pinned CDN
  `<script>`, ~800 KiB, no npm / bundler / module system) and what still stands.
- **The subscriber-ordering trap belongs in `AGENTS.md` too** — it is invisible from reading `staff.js`
  alone, and it is exactly the kind of rule the file exists to prevent rediscovering.
- `vexKey` reference values → **assertions in `tests.html`**, not prose.
- Why whole notes, and why the staff calls `detect()` itself → **the commit message**.
