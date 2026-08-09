// Draws the selection on a grand staff. VexFlow does the engraving; this file
// only decides what to hand it. Like every other view it reads the Set and
// nothing else -- it never touches an input module.
//
// Loaded after the VexFlow CDN tag. If that tag fails, render() throws on the
// first `Vex` reference. That is why main.js subscribes this view LAST: state
// .notify() is a plain forEach, so a listener that throws takes out every
// listener queued behind it. Last means a dead CDN costs the staff alone.
(function(){
  const C = SP.config;
  let flats = C.flats;   // mirrors main.js's applyFlats(), like the other views
  let out = null;        // #staffOut, filled by init()

  const MIN_WIDTH = 290; // comfortable for a chord or a one-octave scale
  const HEIGHT = 250;    // fits C7's five ledger lines above and C2's one below
  const COL = 22;        // drawing room per notehead column, when spread out
  const CLEF_ROOM = 110; // brace, clef and margins, before any notes
  const SPLIT = 60;      // middle C and up goes on the treble staff

  // Whole notes throughout: a selection has no rhythm, and a whole note is
  // stemless, so nothing on screen claims a duration the player never played.
  const DURATION = "w";

  // Everything drawable is built through the factory, never with `new`. The
  // factory keeps a render queue and only draws what is in it, so a raw
  // `new StaveNote(...)` formats correctly, occupies space, and then silently
  // fails to appear -- staff lines and clefs but no notes. Modifiers are the
  // exception: the notehead draws its own, so an Accidental is fine bare.
  //
  // Accidentals are not implied by the key string -- "c#/4" positions the
  // notehead but draws no sharp -- so each is attached at its index in the chord.
  function buildNote(factory, midis, clef){
    const keys = midis.map(m => SP.theory.vexKey(m, flats));
    const note = factory.StaveNote({ keys: keys, duration: DURATION, clef: clef });
    keys.forEach((key, i) => {
      const acc = key.slice(1, key.indexOf("/"));
      if (acc) note.addModifier(new Vex.Flow.Accidental(acc), i);
    });
    return note;
  }

  // Grouping is the whole layout decision. Every note in one StaveNote stacks
  // into a chord; one StaveNote each lays them out left to right.
  function buildNotes(factory, midis, clef, spread){
    if (!midis.length) return [];
    if (spread) return midis.map(m => buildNote(factory, [m], clef));
    return [buildNote(factory, midis, clef)];
  }

  // Soft mode, and no time signature anywhere. An eight-note scale of whole
  // notes is thirty-two beats; there is no meter here to be honest about, so
  // the alternative is picking a fake one and fighting it.
  function staveFor(factory, notes){
    if (!notes.length) return { voices: [] };
    return { voices: [factory.Voice().setStrict(false).addTickables(notes)] };
  }

  SP.staff = {

    init(){ out = document.getElementById("staffOut"); },

    // Full repaint from the Set, same as keyboard.repaint -- cheap, and it
    // keeps the drawing in sync by construction. An empty selection still
    // draws both staves so the column never collapses and the page never jumps.
    render(sel){
      out.innerHTML = "";   // Factory appends a fresh <svg> on every call

      const arr = [...sel].sort((a, b) => a - b);

      // Ask the same question results-ui asks, from the same two lines, rather
      // than routing one detect result through main.js into both views -- that
      // would mean editing three existing files to add one.
      let spread = false;
      if (arr.length > 1){
        const pcs = [...new Set(arr.map(m => m % 12))];
        const r = SP.theory.detect(pcs, arr[0] % 12, flats);
        // The count guard is for sets no dictionary covers: a twelve-note
        // cluster has no `kind` and would stack into a solid bar of ink.
        spread = r.kind === "scale" || arr.length > 5;
      }

      const treble = arr.filter(m => m >= SPLIT);
      const bass = arr.filter(m => m < SPLIT);

      // Draw at whatever width the notes actually need. VexFlow's formatter
      // refuses to squeeze noteheads below a minimum, so a chromatic run asked
      // to fit 290px silently overflows its own SVG instead. Widen here, then
      // let the viewBox below scale the result back into the column.
      const cols = spread ? Math.max(treble.length, bass.length) : 1;
      const width = Math.max(MIN_WIDTH, CLEF_ROOM + cols * COL);

      const factory = new Vex.Flow.Factory({
        renderer: { elementId: "staffOut", width: width, height: HEIGHT }
      });
      // x leaves room for the brace, which draws to the LEFT of the staves and
      // is simply clipped away if they start at the edge.
      const system = factory.System({ x: 22, y: 25, width: width - 34, spaceBetweenStaves: 11 });

      system.addStave(staveFor(factory, buildNotes(factory, treble, "treble", spread))).addClef("treble");
      system.addStave(staveFor(factory, buildNotes(factory, bass, "bass", spread))).addClef("bass");
      system.addConnector("brace");
      system.addConnector("singleLeft");

      factory.draw();

      // Hand the drawing over to CSS. Without this the SVG keeps the pixel
      // width it was drawn at and pushes out of the column; with it, a wide
      // one shrinks to fit and a normal one is left alone.
      const svg = out.querySelector("svg");
      svg.setAttribute("viewBox", "0 0 " + width + " " + HEIGHT);
      svg.setAttribute("width", "100%");
      svg.removeAttribute("height");
    },

    setFlats(on){ flats = on; }
  };
})();
