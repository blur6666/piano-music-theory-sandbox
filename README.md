# scale-piano

A local music theory study tool. An on-screen 5-octave piano driven by a
hardware MIDI keyboard, showing live what I'm holding: note names,
chord/scale detection with inversion, the degree formula, and the diatonic
chords.

Personal tool. No build step, no dependencies, no server.

## Running it

Double-click `index.html`. Chrome or Edge — it uses the Web MIDI API, which
Firefox and Safari don't support. Plug the keyboard in, then click **Add MIDI
device**; if the port won't open, close the DAW (Windows gives one app the port
at a time).

## Using it

| Control | What it does |
| --- | --- |
| **Add MIDI device** | Requests MIDI access and connects available MIDI inputs |
| **MIDI keyboard** | Momentary by default — the display mirrors what's physically held |
| **Mouse** | Follows the same mode as MIDI: press-and-hold when momentary, click-to-toggle when latched |
| **Latch** | Note-on (or mouse press) toggles the key instead of holding it, so a scale can be tapped in one note at a time. Off on load. |
| **Flats** | Spells accidentals as Db/Eb instead of C#/D#, on the keys and in the readout. Off on load. |
| **Clear** | Empties the selection, latched notes included |
| **Note labels** | Shows/hides the note name on each key |
| **Scale** | Select a scale; after selecting a key, loads one ascending octave of that scale |
| **Key** | Choose one root chip. The scale starts at the matching root nearest middle C and ends at its octave. |

## Testing

Open `tests.html` — 59 assertions over `theory.js`, prints a pass/fail tally.

**When editing, disable the cache.** Chrome caches `file://` scripts per file and
will serve a stale `js/` file next to freshly-loaded ones — a control that
renders but does nothing is almost always this, not the code. Open DevTools (F12)
→ Network tab → tick "Disable cache", and leave DevTools open while you work. It
applies to all requests while open, so ordinary reloads fetch fresh and you stop
thinking about it. Fallback if something still looks stale: Ctrl+Shift+R.

The MIDI path can be driven from the console with no hardware attached:

```js
SP.midi.onMIDI({data:[0x90,60,100]});   // note on  C4
SP.midi.onMIDI({data:[0x80,60,0]});     // note off C4
```

## Layout

```
index.html     markup shell + script tags
style.css      all styling
tests.html     assertions over theory.js
js/
  data.js         config knobs + all static tables
  theory.js       detect / diatonic / keyContext — pure, no DOM
  state.js        the selection Set + subscribe/notify
  midi.js         Web MIDI hookup, message decoding, console log
  keyboard-ui.js  builds and repaints the piano
  results-ui.js   renders the detection panel
  main.js         wires everything together
```

Plain `<script>` tags sharing one global `SP`, not ES modules — `import` doesn't
work over `file://`, and this has to open by double-clicking.

To add a chord or scale, add a row to `data.js`. To add a view, add a file that
subscribes to `SP.state`. Details and the reasoning are in `CLAUDE.md`.

## Known limitations (deliberate)

- The Flats toggle renames every accidental to its flat name; it isn't key-aware
  spelling, so Gb major's 7th shows as B rather than Cb
- Pentatonic, blues, and whole-tone scales get no diatonic chord chips
- One MIDI port at a time on Windows
