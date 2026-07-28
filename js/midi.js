// Web MIDI input. Note messages go into SP.state; everything else is ignored
// for logic but decoded to the console so you can see what the keyboard sends.
(function(){

  const CC_NAMES = {1:"mod wheel",7:"volume",10:"pan",11:"expression",64:"sustain pedal",120:"all sound off",121:"reset controllers",123:"all notes off"};

  // Octave-suffixed on purpose: this is console output only. The on-screen
  // display uses pitch classes without octaves -- don't "fix" this to match.
  function noteName(n){ return SP.data.NAMES[n % 12] + (Math.floor(n / 12) - 1); }

  function describeMIDI(d){
    const st = d[0], cmd = st & 0xF0, ch = (st & 0x0F) + 1;
    if (st === 0xF8) return "Clock";
    if (st === 0xFE) return "Active Sensing";
    if (st === 0xFA) return "Start";
    if (st === 0xFB) return "Continue";
    if (st === 0xFC) return "Stop";
    if (st === 0xF0) return "SysEx (" + d.length + " bytes)";
    if (cmd === 0x90 && d[2] > 0) return "Note On  ch" + ch + "  " + noteName(d[1]) + "  vel " + d[2];
    if (cmd === 0x80 || (cmd === 0x90 && d[2] === 0)) return "Note Off ch" + ch + "  " + noteName(d[1]);
    if (cmd === 0xA0) return "Poly Aftertouch ch" + ch + "  " + noteName(d[1]) + "  " + d[2];
    if (cmd === 0xB0) return "Control Change ch" + ch + "  CC" + d[1] + (CC_NAMES[d[1]] ? " (" + CC_NAMES[d[1]] + ")" : "") + " = " + d[2];
    if (cmd === 0xC0) return "Program Change ch" + ch + "  program " + d[1];
    if (cmd === 0xD0) return "Channel Aftertouch ch" + ch + "  " + d[1];
    if (cmd === 0xE0) return "Pitch Bend ch" + ch + "  " + ((((d[2] << 7) | d[1])) - 8192);
    return "Unknown";
  }

  function onMIDI(e){
    if (SP.config.logMIDI){
      const t = new Date(), pad = (n, w) => String(n).padStart(w, "0");
      const ts = pad(t.getHours(),2) + ":" + pad(t.getMinutes(),2) + ":" + pad(t.getSeconds(),2) + "." + pad(t.getMilliseconds(),3);
      console.log(ts + "  " + describeMIDI(e.data) + "   [" + [...e.data].map(b => "0x" + b.toString(16).padStart(2,"0")).join(" ") + "]");
    }
    const st = e.data[0], note = e.data[1], vel = e.data[2];
    const cmd = st & 0xF0;
    // Momentary: the display mirrors what is physically held.
    if (cmd === 0x90 && vel > 0) SP.state.set(note, true);
    else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) SP.state.set(note, false);
  }

  SP.midi = {

    describeMIDI: describeMIDI,   // exposed for poking at from the console

    init(){
      const statusEl = document.getElementById("midiStatus");
      if (!navigator.requestMIDIAccess){
        statusEl.textContent = "MIDI: not supported in this browser (use Chrome or Edge)";
        return;
      }
      navigator.requestMIDIAccess().then(acc => {
        const hook = inp => {
          inp.onmidimessage = onMIDI;
          inp.open().then(
            () => { statusEl.textContent = "MIDI: port open — " + inp.name + " (waiting for notes)"; statusEl.classList.add("ok"); },
            () => { statusEl.textContent = "MIDI: could not open " + inp.name + " — port busy? Close your DAW / Roland apps and reload"; statusEl.classList.remove("ok"); }
          );
        };
        acc.inputs.forEach(hook);
        const names = [...acc.inputs.values()].map(i => i.name).join(", ");
        statusEl.textContent = names ? "MIDI: connected to " + names : "MIDI: no device found, plug in and reload";
        statusEl.classList.toggle("ok", !!names);
        acc.onstatechange = e => {
          if (e.port.type === "input" && e.port.state === "connected"){
            hook(e.port);
            statusEl.textContent = "MIDI: connected to " + e.port.name;
            statusEl.classList.add("ok");
          }
        };
      }, () => { statusEl.textContent = "MIDI: permission denied"; });
    }
  };
})();
