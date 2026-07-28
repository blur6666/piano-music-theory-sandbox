// Knobs and static lookup tables. No behavior lives here.
// Loaded first: this is the file that creates the SP namespace.
var SP = {};

SP.config = {
  LOW: 36, HIGH: 96,   // MIDI range of the on-screen keyboard (C2-C7, 61 keys)
  showLabels: true,    // initial state of the "Note labels" checkbox
  latch: false,        // MIDI note-on toggles instead of held (entering scales)
  flats: false,        // initial state of the "Flats" button; per-pitch-class swap, not key-aware
  logMIDI: true        // decode every incoming MIDI message to the console
};

SP.data = {

  // Sharps table is also the geometry source in keyboard-ui.js (black-key
  // test is "#"). Display spelling goes through theory.spell(); never swap
  // this array to change what's shown.
  NAMES: ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"],

  // Display-only alternative, same index. Naive: one name per pitch class,
  // no key context -- Gb major's 7th prints "B", not "Cb".
  FLATS: ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"],

  ORD: ["root position","1st inversion","2nd inversion","3rd inversion","4th inversion","5th inversion"],

  ROMAN: ["I","II","III","IV","V","VI","VII"],

  // Semitone offset from an assumed root -> degree name. Naive: one name per
  // offset, so it can't spell #5 or bb7. Only feeds unmatched note sets
  // (theory.degrees()), where there is no textbook formula to be faithful to
  // anyway -- dictionary rows below carry their own hand-written column.
  DEGREES: ["1","b2","2","b3","3","4","b5","5","b6","6","b7","7"],

  // [name, intervals in semitones from the root, degree formula]. Add a row
  // and detection picks it up automatically. The formula column is display
  // text in stacked-thirds order, deliberately not parallel to column 2 --
  // e.g. "minor 9" lists 9 last though its semitone (2) sorts first. Nothing
  // indexes into it; it is printed whole.
  CHORDS: [
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
  ],

  // [name, intervals, scale-degree formula]
  SCALES: [
    ["major scale",           "0,2,4,5,7,9,11",  "1 2 3 4 5 6 7"],
    ["natural minor scale",   "0,2,3,5,7,8,10",  "1 2 b3 4 5 b6 b7"],
    ["harmonic minor scale",  "0,2,3,5,7,8,11",  "1 2 b3 4 5 b6 7"],
    ["melodic minor scale",   "0,2,3,5,7,9,11",  "1 2 b3 4 5 6 7"],
    ["dorian mode",           "0,2,3,5,7,9,10",  "1 2 b3 4 5 6 b7"],
    ["phrygian mode",         "0,1,3,5,7,8,10",  "1 b2 b3 4 5 b6 b7"],
    ["lydian mode",           "0,2,4,6,7,9,11",  "1 2 3 #4 5 6 7"],
    ["mixolydian mode",       "0,2,4,5,7,9,10",  "1 2 3 4 5 6 b7"],
    ["locrian mode",          "0,1,3,5,6,8,10",  "1 b2 b3 4 b5 b6 b7"],
    ["major pentatonic",      "0,2,4,7,9",       "1 2 3 5 6"],
    ["minor pentatonic",      "0,3,5,7,10",      "1 b3 4 5 b7"],
    ["blues scale",           "0,3,5,6,7,10",    "1 b3 4 b5 5 b7"],
    ["whole tone scale",      "0,2,4,6,8,10",    "1 2 3 #4 #5 b7"],
    ["chromatic scale",       "0,1,2,3,4,5,6,7,8,9,10,11",  "1 b2 2 b3 3 4 b5 5 b6 6 b7 7"]
  ],

  // Chords that imply a single standard key, and that key's interval set.
  // Anything not listed here gets no "chords in this key" panel.
  MAJOR_FAM: ["major","major 7","6","add9","major 9"],
  MINOR_FAM: ["minor","minor 7","minor 6","minor add9","minor 9"],
  MAJOR_IV: "0,2,4,5,7,9,11",
  MINOR_IV: "0,2,3,5,7,8,10",

  // Chords with more than one common key relationship. [semitone offset from
  // chord root to key tonic, "major"/"minor", roman numeral]. Fixed textbook
  // facts about where each chord shape conventionally sits -- not diatonic-
  // derived, so this is a lookup, not a computation. Sus chords have no
  // scale-membership answer at all (not stacked 3rds); listed here as the
  // major/minor ambiguity on the same root instead, since suspending the 3rd
  // is exactly what makes that ambiguous -- a different kind of answer than
  // the other rows (a likely resolution, not a scale-membership fact).
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
};
