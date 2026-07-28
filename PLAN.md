# Chord degree formulas + suspected root

## Context

The results panel prints a **Degrees** row (`1 2 b3 4 5 b6 b7`) only for scales —
the formula comes from the third column of each `SCALES` row in `data.js`.
Chords have no such column, so a detected A minor 7 shows its name, its notes,
and a chain of successive intervals ("minor 3rd – major 3rd – minor 3rd"), but
never the formula a student actually reads chords by: `1 b3 5 b7`. Worse, a
set that matches nothing at all — two notes mid-chord, or an ambiguous
handful — prints a flat "No match" and gives the player nothing to reason from.

This change makes the Degrees row universal. Every selection gets a formula:
from the dictionary when a chord or scale is recognised, and computed against
the **lowest sounding note as a suspected root** when it isn't. An unmatched
set stops reading as a failure and starts reading as a hypothesis — `A ?
(unknown chord)` over `1 b3 b5`.

## Decisions (settled with the user)

1. **Chord formulas are hand-written**, a third column on each `CHORDS` row,
   exactly the shape `SCALES` already uses. Textbook spellings: augmented is
   `1 3 #5` (not `b6`), diminished 7 is `1 b3 b5 bb7` (not `6`), 9th chords
   read `1 3 5 b7 9` (not `1 2 3 5 b7`). A computed table cannot produce these.
2. **Unmatched sets read as a chord-style guess** in the Detected line:
   `A ? (unknown chord)`.
3. **A single held note shows `Degrees: 1`**; its Detected line stays the plain
   note name, as today.

## Changes

### `js/data.js`

Add a naive semitone→degree table, used *only* where no dictionary row applies:

```js
// Semitone offset from an assumed root -> degree name. Naive: one name per
// offset, so it can't spell #5 or bb7. Only feeds unmatched sets, where
// there is no textbook formula to be faithful to anyway.
DEGREES: ["1","b2","2","b3","3","4","b5","5","b6","6","b7","7"],
```

Add a third column to all 21 `CHORDS` rows, mirroring `SCALES`:

```js
["major",            "0,4,7",      "1 3 5"],
["minor",            "0,3,7",      "1 b3 5"],
["diminished",       "0,3,6",      "1 b3 b5"],
["augmented",        "0,4,8",      "1 3 #5"],
["sus2",             "0,2,7",      "1 2 5"],
["sus4",             "0,5,7",      "1 4 5"],
["5 (power chord)",  "0,7",        "1 5"],
["major 7",          "0,4,7,11",   "1 3 5 7"],
["dominant 7",       "0,4,7,10",   "1 3 5 b7"],
["minor 7",          "0,3,7,10",   "1 b3 5 b7"],
["minor 7 flat 5",   "0,3,6,10",   "1 b3 b5 b7"],
["diminished 7",     "0,3,6,9",    "1 b3 b5 bb7"],
["minor major 7",    "0,3,7,11",   "1 b3 5 7"],
["6",                "0,4,7,9",    "1 3 5 6"],
["minor 6",          "0,3,7,9",    "1 b3 5 6"],
["add9",             "0,2,4,7",    "1 3 5 9"],
["minor add9",       "0,2,3,7",    "1 b3 5 9"],
["major 9",          "0,2,4,7,11", "1 3 5 7 9"],
["dominant 9",       "0,2,4,7,10", "1 3 5 b7 9"],
["minor 9",          "0,2,3,7,10", "1 b3 5 b7 9"],
["7 sus4",           "0,5,7,10",   "1 4 5 b7"]
```

Update the header comment: the third column is **display text in stacked-thirds
order, deliberately not parallel to column 2** — `minor 9` lists `9` last though
its semitone `2` sorts first. Nothing indexes into it; it is printed whole.

### `js/theory.js`

New pure helper beside `spell`:

```js
// Degrees of a note set against an assumed root, for sets no dictionary row
// covers. Sorted by semitone, so no stacked-thirds reordering -- that is what
// the hand-written columns are for.
degrees(pcs, root){
  return pcs.map(p => (p - root + 12) % 12).sort((a, b) => a - b)
            .map(i => D.DEGREES[i]).join(" ");
},
```

In `detect()`:

- On a hit, stamp `degrees: hit[2]` onto the returned result — same rationale as
  the existing `flats` stamp: the view gets one field to read and cannot pick
  the wrong column. Chords and scales now both carry it.
- Replace `return { label: "No match" }` with the suspected-root guess:

```js
return { label: this.spell(bass, flats) + " ? (unknown chord)",
         root: bass, degrees: this.degrees(pcs, bass), flats: flats };
```

  No `hit` on this object, so `keyContext()`'s first line still returns `null` —
  an unknown set gets no chip panel, unchanged.

### `js/results-ui.js`

Two edits inside `render`, both narrowing this file's job rather than widening
it — it stops knowing that scales are the thing with degrees:

- Single-note branch (`ordered.length < 2`), before its early return:

```js
el.degOut.textContent = SP.theory.degrees(pcs, bass);
el.degRow.style.display = "block";
```

- Replace the scale-only condition with a check on the stamped field:

```js
if (r.degrees){
  el.degOut.textContent = r.degrees.split(" ").join("  ");
  el.degRow.style.display = "block";
}
```

No `index.html` change: the Degrees row and its label already exist.

> Three source files is the count `CLAUDE.md` says to stop and question. It is
> the right count here — one row per layer (a table, a derivation, a render),
> the same shape the flats toggle took — not logic smeared across files. If the
> implementation starts needing a *fourth*, stop.

### `tests.html`

One existing assertion changes: `"unrecognised set falls through"` now expects
`"C ? (unknown chord)"`. Add, per `CLAUDE.md`'s "a fact about behavior is an
assertion":

- The user's own example: `T.detect([9,0,4,7], 9).degrees` → `"1 b3 5 b7"`.
- Hand-written beats naive: `T.detect([0,4,8], 0).degrees` → `"1 3 #5"`, and
  `T.detect([0,3,6,9], 0).degrees` → `"1 b3 b5 bb7"`.
- Stacked-thirds order survives: `T.detect([0,2,3,7,10], 0).degrees` →
  `"1 b3 5 b7 9"`.
- The A+E partial: `T.detect([9,4], 9).degrees` → `"1 5"`.
- Unknown set computes: `T.detect([0,1,6], 0).degrees` → `"1 b2 b5"`.
- **Lowest note is the suspected root**: same set over a different bass,
  `T.detect([0,1,6], 1).degrees` → `"1 4 7"`.
- Flats reach the guess: `T.detect([0,1,6], 1, true).label` →
  `"Db ? (unknown chord)"`.
- Column guard, so a future chord row can't ship without a formula:
  `SP.data.CHORDS.every(c => c.length === 3)` → `true`.
- Unchanged and must stay green: `"no match yields no key context"`.

### `CLAUDE.md`

- "Where things live" → `CHORDS`/`SCALES` are now uniformly
  `[name, intervals-from-root, degree-formula]`; drop the `(scales)` qualifier.
- Add `theory.degrees` to the bullet list, noting it serves only unmatched sets
  while dictionary rows carry their own textbook formula.
- "Adding things" → a chord row is now three columns, not two.

## Process (per `CLAUDE.md`)

1. Copy this plan to `PLAN.md`, commit it alone, before any code.
2. Implement; append any forced deviation to a **Deviations** list at its end.
3. Triage deviations to `CLAUDE.md` / `tests.html` / the commit message, then
   delete `PLAN.md` in the commit *after* the implementation.

## Verification

1. **`tests.html`** — open it, expect the tally green with the new assertions.
   Everything here is pure `data.js` + `theory.js`, so this proves the whole
   feature except the rendering.
2. **`index.html` smoke test** — hard-reload (`Ctrl+Shift+R`; a plain reload
   serves stale `js/` files off `file://`, the documented hour-eating trap):
   - C-E-G → `C major — root position`, Degrees `1  3  5`
   - A-C-E-G → `A minor 7 — root position`, Degrees `1  b3  5  b7`
   - A + E alone → `A 5 (power chord) — root position`, Degrees `1  5`
   - C + C# + F# → `C ? (unknown chord)`, Degrees `1  b2  b5`
   - the same three notes rooted on C# → Degrees `1  4  7`
   - single A → Detected `A`, Degrees `1`
   - Flats on → the guess respells (`Db ? (unknown chord)`)
   - Clear → all rows back to `—`, Degrees row hidden
3. Fully self-validatable (tests + browser smoke test, no hardware), so per
   `CLAUDE.md` this commits without waiting on the owner. The MIDI path is
   untouched.
