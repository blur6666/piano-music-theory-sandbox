// Renders the detection panel from the selection Set.
// All the music reasoning lives in theory.js; this file only displays.
(function(){
  const el = {};   // cached element lookups, filled by init()
  let flats = SP.config.flats;   // mirrors main.js's applyFlats(), like keyboard-ui does for latch

  function renderChips(list, activeIdx){
    el.diaOut.innerHTML = "";
    list.forEach((c, i) => {
      const chip = document.createElement("div");
      chip.className = "chip" + (i === activeIdx ? " tonic" : "");
      const rn = document.createElement("span");
      rn.className = "rn";
      rn.textContent = c.rn;
      chip.appendChild(rn);
      chip.appendChild(document.createTextNode(c.name));
      el.diaOut.appendChild(chip);
    });
  }

  SP.results = {

    init(){
      ["nameOut","notesOut","degRow","degOut","suspectOut","diaRow","diaLabel","diaOut"]
        .forEach(id => { el[id] = document.getElementById(id); });
    },

    setFlats(on){ flats = on; },

    render(sel){
      const arr = [...sel].sort((a, b) => a - b);
      el.degRow.style.display = "none";
      el.suspectOut.style.display = "none";
      el.diaRow.style.display = "none";

      if (!arr.length){
        el.notesOut.textContent = "—";
        el.nameOut.textContent = "—";
        return;
      }

      const bass = arr[0] % 12;
      const pcs = [...new Set(arr.map(m => m % 12))];
      const ordered = pcs.map(p => (p - bass + 12) % 12).sort((a, b) => a - b);
      el.notesOut.textContent = ordered.map(i => SP.theory.spell((bass + i) % 12, flats)).join("  ");

      if (ordered.length < 2){
        el.nameOut.textContent = SP.theory.spell(bass, flats);
        el.degOut.textContent = SP.theory.degrees(pcs, bass);
        el.degRow.style.display = "block";
        return;
      }

      const r = SP.theory.detect(pcs, bass, flats);
      el.nameOut.textContent = r.label;

      const sus = (!r.hit || pcs.length < 3) ? SP.theory.suspects(pcs, bass, flats) : [];
      if (sus.length){
        el.suspectOut.textContent = "could be: " +
          sus.map(c => c.name + " (+" + c.missing + ")").join(" · ");
        el.suspectOut.style.display = "block";
      }

      if (r.degrees){
        el.degOut.textContent = r.degrees.split(" ").join("  ");
        el.degRow.style.display = "block";
      }

      const kc = SP.theory.keyContext(r);
      if (kc){
        el.diaLabel.textContent = kc.label;
        renderChips(kc.chords, kc.activeIdx);
        el.diaRow.style.display = "block";
      }
    }
  };
})();
