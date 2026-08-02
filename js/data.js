// Knobs and static lookup tables. No behavior lives here.
// Loaded first: this is the file that creates the SP namespace.
var SP = {};

SP.config = {
  LOW: 36, HIGH: 96,   // MIDI range of the on-screen keyboard (C2-C7, 61 keys)
  showLabels: true,    // initial state of the "Note labels" checkbox
  latch: false,     // MIDI note-on toggles instead of held (entering scales)
  sound: true,         // play synthesized notes from mouse and MIDI input
  soundVolume: 0.32,   // master volume for the synthesized output
  mouseVelocity: 100,  // fixed velocity used by the on-screen keyboard
  sustain: true,       // let synthesized notes finish their natural decay
  flats: false,        // initial state of the "Flats" button; per-pitch-class swap, not key-aware
  logMIDI: true,       // decode every incoming MIDI message to the console
  theme: "brass"       // visual palette; swatches reset to this choice on reload
};

SP.data = {

  THEMES: {
    brass: {
      name: "Brass on ink", dark: true,
      page: "radial-gradient(120% 80% at 50% -10%, hsl(24, 7%, 14%) 0%, #141413 55%, #151414 100%)",
      text: "#efe8db", strong: "#f8efdc", dim: "#8a8072", faint: "#5c554a", rule: "#262219",
      accent: "#e0a13c", accentHi: "#f0b555", onAccent: "#1a1611", second: "#9dc0ac",
      pianoShell: "#e0a13c", icon: "#e0a13c"
    },
    paper: {
      name: "Rust on paper", dark: false,
      page: "radial-gradient(120% 80% at 50% -10%, #f0dcb6 0%, #efe8da 55%, #e4cecb 100%)",
      text: "#2e2a24", strong: "#1d1a15", dim: "#7c7364", faint: "#a89d8a", rule: "#868582",
      accent: "#b8472c", accentHi: "#cf5a3c", onAccent: "#b6b4b2", second: "#3f6b5c",
      pianoShell: "#cf5a3c", icon: "#cf5a3c"
    },
    moss: {
      name: "Moss & lime", dark: true,
      page: "radial-gradient(120% 80% at 50% -10%, #16211a 0%, #0d1410 55%, #080d0a 100%)",
      text: "#e2ebe1", strong: "#f1f8ef", dim: "#818f80", faint: "#525e52", rule: "#1e2b21",
      accent: "#a8d24b", accentHi: "#bde066", onAccent: "#152007", second: "#e0c07a",
      pianoShell: "#5e8a00", icon: "#00241a"
    },
    mono: {
      name: "Monochrome", dark: true,
      page: "radial-gradient(120% 80% at 50% -10%, #181818 0%, #232323 5%, #232323 100%)",
      text: "#e8e8e8", strong: "#ffffff", dim: "#8b8b8b", faint: "#5a5a5a", rule: "#262626",
      accent: "#f2f2f2", accentHi: "#ffffff", onAccent: "#121212", second: "#a8a8a8",
      pianoShell: "#fffdfd", icon: "#6e6e6e"
    },
    blueprint: {
      name: "Blueprint", dark: false,
      page: "radial-gradient(120% 80% at 50% -10%, #a9ceff 0%, #cfe0f6 55%, #fdfff2 80%)",
      text: "#1f2c3d", strong: "#121c29", dim: "#6d7c90", faint: "#686e75", rule: "#cbd6e4",
      accent: "#1f5fd0", accentHi: "#3a79e6", onAccent: "#f2f7ff", second: "#c0632a",
      pianoShell: "#7cb7ffaa", icon: "#b1f3ff"
    },
    sand: {
      name: "Sand & indigo", dark: false,
      page: "radial-gradient(120% 80% at 50% -10%, #f6efe0 0%, #ece0c9 55%, #e0d2b7 100%)",
      text: "#2c2740", strong: "#1b1730", dim: "#7a7186", faint: "#817274", rule: "#d6c7a9",
      accent: "#3b3a8f", accentHi: "#5150ad", onAccent: "#f7f4ea", second: "#a1622a",
      pianoShell: "#ffdeaa", icon: "#ffdeaa"
    },
    neon: {
      name: "Magenta graphite", dark: true,
      page: "radial-gradient(120% 80% at 50% -10%, #21202a 0%, #14141a 55%, #0c0c11 100%)",
      text: "#e4e1ea", strong: "#f9f6ff", dim: "#8b8798", faint: "#5b5769", rule: "#272533",
      accent: "#ff3d8b", accentHi: "#ff6aa5", onAccent: "#1a0a13", second: "#5fd8d0",
      pianoShell: "#6b00a1", icon: "#ff3d8b" 
    }
  },

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
