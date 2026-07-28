// Knobs and static lookup tables. No behavior lives here.
// Loaded first: this is the file that creates the SP namespace.
var SP = {};

SP.config = {
  LOW: 36, HIGH: 96,   // MIDI range of the on-screen keyboard (C2-C7, 61 keys)
  showLabels: true,    // initial state of the "Note labels" checkbox
  latch: false,        // MIDI note-on toggles instead of held (entering scales)
  logMIDI: true        // decode every incoming MIDI message to the console
};

SP.data = {

  NAMES: ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"],

  IV: ["unison","minor 2nd","major 2nd","minor 3rd","major 3rd","perfect 4th","tritone","perfect 5th","minor 6th","major 6th","minor 7th","major 7th","octave"],

  ORD: ["root position","1st inversion","2nd inversion","3rd inversion","4th inversion","5th inversion"],

  ROMAN: ["I","II","III","IV","V","VI","VII"],

  // [name, intervals in semitones from the root]. Add a row and detection
  // picks it up automatically.
  CHORDS: [["major","0,4,7"],["minor","0,3,7"],["diminished","0,3,6"],["augmented","0,4,8"],["sus2","0,2,7"],["sus4","0,5,7"],["5 (power chord)","0,7"],["major 7","0,4,7,11"],["dominant 7","0,4,7,10"],["minor 7","0,3,7,10"],["minor 7 flat 5","0,3,6,10"],["diminished 7","0,3,6,9"],["minor major 7","0,3,7,11"],["6","0,4,7,9"],["minor 6","0,3,7,9"],["add9","0,2,4,7"],["minor add9","0,2,3,7"],["major 9","0,2,4,7,11"],["dominant 9","0,2,4,7,10"],["minor 9","0,2,3,7,10"],["7 sus4","0,5,7,10"]],

  // [name, intervals, scale-degree formula]
  SCALES: [["major scale","0,2,4,5,7,9,11","1 2 3 4 5 6 7"],["natural minor scale","0,2,3,5,7,8,10","1 2 b3 4 5 b6 b7"],["harmonic minor scale","0,2,3,5,7,8,11","1 2 b3 4 5 b6 7"],["melodic minor scale","0,2,3,5,7,9,11","1 2 b3 4 5 6 7"],["dorian mode","0,2,3,5,7,9,10","1 2 b3 4 5 6 b7"],["phrygian mode","0,1,3,5,7,8,10","1 b2 b3 4 5 b6 b7"],["lydian mode","0,2,4,6,7,9,11","1 2 3 #4 5 6 7"],["mixolydian mode","0,2,4,5,7,9,10","1 2 3 4 5 6 b7"],["locrian mode","0,1,3,5,6,8,10","1 b2 b3 4 b5 b6 b7"],["major pentatonic","0,2,4,7,9","1 2 3 5 6"],["minor pentatonic","0,3,5,7,10","1 b3 4 5 b7"],["blues scale","0,3,5,6,7,10","1 b3 4 b5 5 b7"],["whole tone scale","0,2,4,6,8,10","1 2 3 #4 #5 b7"],["chromatic scale","0,1,2,3,4,5,6,7,8,9,10,11","1 b2 2 b3 3 4 b5 5 b6 6 b7 7"]],

  // Chords that imply a single standard key, and that key's interval set.
  // Anything not listed here gets no "chords in this key" panel.
  MAJOR_FAM: ["major","major 7","6","add9","major 9"],
  MINOR_FAM: ["minor","minor 7","minor 6","minor add9","minor 9"],
  MAJOR_IV: "0,2,4,5,7,9,11",
  MINOR_IV: "0,2,3,5,7,8,10"
};
