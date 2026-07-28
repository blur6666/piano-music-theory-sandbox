# Flat spelling toggle

## Context

The tool has always shown accidentals as sharps only (`A#`, never `Bb`) — an
accepted limitation from the original refactor. Solving it with a toggle
button. The real fork was: a simple per-pitch-class name swap ("Bb=A#"), or
full context-aware spelling that computes the theoretically correct letter for
each scale degree.

**Chosen: the simple swap.** Two reasons, both solid:

1. It's what CLAUDE.md already pre-committed to in "Adding things": *"flat
   spelling is a table in `data.js` plus a function in `theory.js`, views
   unchanged."* This plan delivers exactly that.
2. Full context-aware spelling isn't a bigger version of the same feature —
   it's a different data model. Correct spelling needs letter+accidental math
   (`{letter: 4, alter: -1}`, not a pitch-class string) threaded through
   `detect`/`diatonic`, *plus* key inference for the results that deliberately
   have no key today (`keyContext` already returns `null` for dim/aug/sus/
   dominant chords and non-7-note scales — exactly the cases with nothing to
   spell correctly against). That's a `theory.js` rewrite, not a toggle.

The simple swap is also honest at the same level the tool already is: it shows
`C#` today with no regard for whether the key would call it `Db`; flipped on,
it shows `Db` with the same disregard the other direction. Same quality bar,
not a regression — the value is letting you pick which glyph you'd rather read
without the tool pretending to know your key.

## The one trap

`keyboard-ui.js` decides black-vs-white key geometry by testing
`D.NAMES[m % 12].includes("#")`. That table must stay the geometry source
regardless of spelling — swapping it (or feeding a flats table into it) makes
every key test white and the layout collapses. Spelling is chosen through a
new function instead, so geometry and display stay structurally decoupled.

## Design

A boolean (`flats`), mirrored into each consuming module exactly like `latch`
already is, plus one new pure function `SP.theory.spell(pc, flats)` that both
views call instead of ever touching `NAMES`/`FLATS` directly.

**`js/data.js`** — new config default and table:
```js
flats: false,   // initial state of the "Flats" button; per-pitch-class swap, not key-aware
```
```js
// Sharps table is also the geometry source in keyboard-ui.js (black-key test
// is "#"). Display spelling goes through theory.spell(); never swap this
// array to change what's shown.
NAMES: ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"],

// Display-only alternative, same index. Naive: one name per pitch class, no
// key context -- Gb major's 7th prints "B", not "Cb".
FLATS: ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"],
```

**`js/theory.js`** — one new function; `detect`/`diatonic` take a trailing
optional `flats` boolean (omitted → falsy → sharps, so all 27 existing calls
are unaffected):
```js
spell(pc, flats){ return (flats ? D.FLATS : D.NAMES)[pc]; },
```
`diatonic(root, ivStr, flats)` and `detect(pcs, bass, flats)` route their name
lookups through `this.spell(...)` instead of `D.NAMES[...]`. `detect()` stamps
`flats` onto its returned object (`{label, kind, root, hit, flats}`).
**`keyContext(r)` keeps its existing 1-argument signature** and reads
`r.flats` — this is the key correctness move: it removes the failure mode
where a caller could pass `detect(..., true)` and `keyContext(r, false)` and
get a flat chord name over sharp-spelled chips. One call always agrees with
the other because the choice travels with the result, not as a second
argument someone has to remember to repeat.

**`js/keyboard-ui.js`** — mirrors `flats` next to the existing `latch` mirror.
In the build loop, geometry (`black = D.NAMES[m % 12].includes("#")`) stays on
the sharps table; only the label text changes to
`SP.theory.spell(m % 12, flats)`. New method, structurally identical to
`setLabels`:
```js
setFlats(on){
  flats = on;
  for (const m in keyEls) keyEls[m].firstChild.textContent = SP.theory.spell(+m % 12, flats);
}
```

**`js/results-ui.js`** — same mirror pattern. `setFlats(on){ flats = on; }`;
the "Notes" line and the single-note fallback route through
`SP.theory.spell(...)`; `SP.theory.detect(pcs, bass, flats)` passes the flag;
`keyContext(r)` needs no change since it reads `r.flats`.

**`js/main.js`** — a near-copy of the existing `applyLatch()` block, right
after it:
```js
const flatsBtn = document.getElementById("flatsBtn");
let flatsOn = SP.config.flats;
function applyFlats(){
  SP.keyboard.setFlats(flatsOn);
  SP.results.setFlats(flatsOn);
  flatsBtn.classList.toggle("on", flatsOn);
  flatsBtn.textContent = "Flats: " + (flatsOn ? "on" : "off");
  SP.state.notify();   // re-render the held chord in the new spelling immediately
}
flatsBtn.addEventListener("click", () => { flatsOn = !flatsOn; applyFlats(); });
applyFlats();
```
`notify()` lives in `applyFlats()`, not in `setFlats()` on either module — a
view calling back into state would invert the input→state→view contract, and
it would fire twice per click if both modules did it.

**`index.html`** — one button in the toolbar, after Latch:
```html
<button id="flatsBtn" title="Spell accidentals as flats (Db, Eb...) instead of sharps (C#, D#...)">Flats: off</button>
```

**`style.css`** — no changes. `.toolbar button` / `.toolbar button.on` already
cover it.

## Tests

8 new assertions in `tests.html`, all using accidental roots so the flip is
actually visible (none of the 27 existing ones do, which is why they're safe
unchanged). Every string below was computed by hand against the real
algorithm, not guessed:

```js
eq("spell defaults to sharps", T.spell(1), "C#");
eq("spell with flats on", T.spell(1, true), "Db");
eq("detect without the flag is unchanged",
   T.detect([1,5,8], 1).label, "C# major — root position");
eq("detect with flats on respells the root",
   T.detect([1,5,8], 1, true).label, "Db major — root position");
eq("flats reach the inversion's bass note too",
   T.detect([8,0,3], 3, true).label, "Ab major — 2nd inversion (Eb in bass)");
eq("diatonic triads of Db major in flats",
   T.diatonic(1, SP.data.MAJOR_IV, true).map(c => c.name).join(" "),
   "Db Ebm Fm Gb Ab Bbm C°");
eq("keyContext inherits the spelling from the detect result",
   T.keyContext(T.detect([1,5,8,0], 1, true)).label,
   "Chords in the key of Db major (this chord as I)");
// Accepted limitation, asserted so it can't be mistaken for a regression later:
eq("naive swap does not do key-correct letters",
   T.diatonic(6, SP.data.MAJOR_IV, true).map(c => c.name).join(" "),
   "Gb Abm Bbm B Db Ebm F°");
```
27 + 8 = **35**. Update the count in `README.md`.

## Docs

- **CLAUDE.md "Known limitations"** — replace the sharps-only bullet with an
  honest description of what the toggle does and doesn't guarantee (naive
  swap, not key-correct; point at the Gb-major example above).
- **README.md "Known limitations"** — same replacement, shorter.
- **README.md control table** — add a Flats row next to Latch.
- **CLAUDE.md `keyboard-ui.js` bullet** — add the trap as a permanent rule:
  geometry reads `NAMES` for its `#` test; that's decoupled from display,
  which goes through `theory.spell()`.
- **CLAUDE.md "Adding things"** — the flat-spelling line currently describes a
  future plan; reword to describe what's actually shipped (`data.FLATS` +
  `theory.spell`, plus a mirrored boolean).

## Verification

No browser tool is available this session. Verification plan, in order:

1. **`theory.js` in isolation, via Node** — load `data.js` + `theory.js` and
   run the 8 new assertions above.
2. **`keyboard-ui.js`, via a fake-DOM shim** — confirm `setFlats` changes
   label text without touching the black/white class assignment, and that
   geometry is unaffected by the flag.
3. **Ask the owner to smoke-test in the real browser** before committing:
   toggle Flats with nothing held (labels change), hold a chord and toggle it
   live (Detected line updates immediately via `notify()`), confirm mouse and
   MIDI both still work normally. Hard-reload / disable-cache per the
   documented `file://` cache trap.

Only after that confirmation does the implementation get committed, per the
"validation needs the owner" rule.

## Deviations

(none yet — appended here during implementation if reality forces a change)
