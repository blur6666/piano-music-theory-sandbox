# List possible keys for dim/aug/sus/dominant chords

## Context

`theory.keyContext()` currently returns `null` for any chord that isn't in
`MAJOR_FAM`/`MINOR_FAM` — diminished, augmented, sus, and dominant chords get
no "chords in this key" panel at all, listed as an accepted limitation in
CLAUDE.md and README. Replacing "no single key" with "list the possible keys,
one per line" for these chord families.

**Fast path found:** `keyContext()` already returns `{label, chords}` where
`chords` is a list of `{name, rn}` objects that `results-ui.js` renders as
chips via the existing `renderChips()`. The "possible keys" list can reuse
that *exact* pipeline — each candidate key becomes one chip (`{name: "C#
major", rn: "vii°"}`) instead of each diatonic chord. **Only `data.js` and
`theory.js` change; `results-ui.js`, `index.html`, and CSS are untouched.**

Each family's candidate keys are small, fixed textbook facts (a semitone
offset + mode + roman numeral) — not computed, just looked up. All hand-
verified below against the real music theory before writing them down.

## The one judgment call (confirmed with the owner)

Sus chords have no scale-membership answer at all (they're not stacked
3rds, so they don't sit at a triad degree in any key). Agreed approach:
treat them as ambiguous between the major and minor triad on the *same*
root, since suspending the 3rd is exactly what makes that ambiguous. This
is a different *kind* of answer than the other three rows (a likely
resolution, not a scale-membership fact) — noted here so it doesn't read as
inconsistent later.

`7 sus4` is bucketed with sus2/sus4 (same-root major/minor ambiguity) rather
than treated as a dominant chord, since it's fundamentally a sus shape with
an added 7th. Not separately confirmed, but it's a direct, visible extension
of the sus rule above rather than a new one — flagging it here rather than
deciding it silently.

## Design

**`js/data.js`** — new table, chords with more than one common key:
```js
// [semitone offset from chord root to key tonic, "major"/"minor", roman
// numeral]. Fixed textbook facts about where each chord shape conventionally
// sits -- not diatonic-derived, so this is a lookup, not a computation.
AMBIGUOUS_KEYS: {
  "diminished":     [[1,"major","vii°"], [-2,"minor","ii°"]],
  "diminished 7":   [[1,"major","vii°"], [-2,"minor","ii°"]],
  "minor 7 flat 5": [[1,"major","vii°"], [-2,"minor","ii°"]],
  "augmented":      [[-3,"minor","III+"]],
  "dominant 7":     [[5,"major","V"]],
  "dominant 9":     [[5,"major","V"]],
  "sus2":           [[0,"major","I"], [0,"minor","i"]],
  "sus4":           [[0,"major","I"], [0,"minor","i"]],
  "7 sus4":         [[0,"major","I"], [0,"minor","i"]]
}
```
Hand-verified against real diatonic triads (not guessed):
- `diminished`/`+1 major "vii°"`: B° is vii° of C major → offset checks out
  (chordRoot = keyRoot + 11 ≡ keyRoot − 1, so keyRoot = chordRoot + 1).
- `diminished`/`−2 minor "ii°"`: B° is also ii° of A natural minor → keyRoot
  = chordRoot − 2.
- `augmented`/`−3 minor "III+"`: C+ is III+ of A harmonic minor (same
  interval math the existing "harmonic minor gives an augmented III" test
  already exercises with `T.diatonic(0, "0,2,3,5,7,8,11")`) → keyRoot =
  chordRoot − 3.
- `dominant 7`/`+5 major "V"`: G is V of C major → keyRoot = chordRoot + 5.

**`js/theory.js`** — `keyContext()` gains one more branch, after the
MAJOR_FAM/MINOR_FAM checks and before the final `return null`:
```js
const keys = D.AMBIGUOUS_KEYS[name];
if (!keys) return null;
return {
  label: "Possible keys",
  chords: keys.map(([offset, mode, rn]) =>
    ({ name: this.spell((r.root + offset + 12) % 12, r.flats) + " " + mode, rn: rn }))
};
```
No changes anywhere else — `results-ui.js` already does
`el.diaLabel.textContent = kc.label; renderChips(kc.chords, 0);` for
whatever `keyContext()` hands it.

## Tests

Three existing assertions are now **wrong** and must be replaced, not left
alone — they assert `null` for cases that no longer return `null`:
```js
// REMOVE (no longer true):
eq("dominant 7 has no single key", T.keyContext(T.detect([7,11,2,5], 7)), null);
eq("sus4 has no single key", T.keyContext(T.detect([0,5,7], 0)), null);
eq("diminished has no single key", T.keyContext(T.detect([0,3,6], 0)), null);
```
Replaced with (all hand-computed against the real algorithm):
```js
eq("diminished chord lists both candidate keys",
   T.keyContext(T.detect([0,3,6], 0)).chords.map(c => c.name + " " + c.rn).join(", "),
   "C# major vii°, A# minor ii°");
eq("augmented chord lists its one candidate key",
   T.keyContext(T.detect([0,4,8], 0)).chords.map(c => c.name + " " + c.rn).join(", "),
   "A minor III+");
eq("dominant 7 lists the key it's V of",
   T.keyContext(T.detect([7,11,2,5], 7)).chords.map(c => c.name + " " + c.rn).join(", "),
   "C major V");
eq("sus4 lists the major/minor ambiguity on the same root",
   T.keyContext(T.detect([0,5,7], 0)).chords.map(c => c.name + " " + c.rn).join(", "),
   "C major I, C minor i");
eq("minor 7 flat 5 joins the diminished family",
   T.keyContext(T.detect([0,3,6,10], 0)).chords.map(c => c.name + " " + c.rn).join(", "),
   "C# major vii°, A# minor ii°");
```
`diminished 7` and `7 sus4` aren't separately asserted (same table rows as
their siblings above; no new logic path to cover) — kept to five new
assertions since they'd be redundant. `power chord` and `minor major 7` are
untouched, still `null`, out of scope per the original ask.

## Docs

- CLAUDE.md's "Known limitations" bullet on dim/aug/sus/dominant chords gets
  removed (the limitation is solved); add one line to the `theory.keyContext`
  bullet in "Where things live" noting the `AMBIGUOUS_KEYS` lookup and that
  it's fixed facts, not computed.
- README.md's matching "Known limitations" bullet is removed the same way.
- Test count: 35 − 3 replaced + 5 new = **37**. Update `README.md`'s count.

## Verification

No browser tool available this session. Same proven approach as the flats
feature:
1. Run the new assertions against real `data.js` + `theory.js` via Node
   before touching `tests.html`, to catch any hand-computation slip.
2. Run the full `tests.html` file itself (all 37) via the document-shim
   technique used for the flats toggle, confirm "all 37 passed".
3. Ask the owner to eyeball it in the real browser before committing —
   this is a display-only change (new chip content under an existing
   label), so the risk is entirely "does this read clearly", not logic.

## Deviations

(none yet — appended here during implementation if reality forces a change)
