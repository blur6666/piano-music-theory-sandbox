// Pure music theory: no DOM, no state, no side effects on load.
// That is what lets tests.html load this file with only data.js beside it.
(function(){
  const D = SP.data;

  SP.theory = {

    // Triads stacked from the tones of a 7-note scale. null for any other size.
    diatonic(root, ivStr){
      const iv = ivStr.split(",").map(Number);
      if (iv.length !== 7) return null;
      return iv.map((t0, i) => {
        const t1 = iv[(i + 2) % 7] + ((i + 2) >= 7 ? 12 : 0);
        const t2 = iv[(i + 4) % 7] + ((i + 4) >= 7 ? 12 : 0);
        const a = t1 - t0, b = t2 - t0;
        let suf = "", rn = D.ROMAN[i];
        if (a === 4 && b === 7){ suf = ""; }
        else if (a === 3 && b === 7){ suf = "m"; rn = rn.toLowerCase(); }
        else if (a === 3 && b === 6){ suf = "°"; rn = rn.toLowerCase() + "°"; }
        else if (a === 4 && b === 8){ suf = "+"; rn = rn + "+"; }
        else { suf = "?"; }
        return { name: D.NAMES[(root + t0) % 12] + suf, rn: rn };
      });
    },

    // Try every candidate root (bass first) against the dictionaries.
    // <=4 notes prefers chords, >=5 prefers scales.
    detect(pcs, bass){
      const n = pcs.length;
      const dicts = n <= 4 ? [["chord", D.CHORDS], ["scale", D.SCALES]]
                           : [["scale", D.SCALES], ["chord", D.CHORDS]];
      const roots = [bass, ...pcs.filter(p => p !== bass)];
      for (const [kind, dict] of dicts){
        for (const root of roots){
          const ivArr = pcs.map(p => (p - root + 12) % 12).sort((a, b) => a - b);
          const hit = dict.find(d => d[1] === ivArr.join(","));
          if (hit){
            let label = D.NAMES[root] + " " + hit[0];
            if (kind === "chord"){
              const pos = ivArr.indexOf((bass - root + 12) % 12);
              label += " — " + (D.ORD[pos] || pos + "th inversion");
              if (pos > 0) label += " (" + D.NAMES[bass] + " in bass)";
            } else if (root !== bass){
              label += " (" + D.NAMES[bass] + " in bass)";
            }
            return { label: label, kind: kind, root: root, hit: hit };
          }
        }
      }
      return { label: "No match" };
    },

    // The chord list to show under a result, or null when there is no single
    // standard key to show for it (dim/aug/sus/dominant chords, and scales
    // that aren't 7 notes). New key-inference rules -- parent keys for
    // pentatonics, say -- belong here, not in results-ui.js.
    keyContext(r){
      if (!r.hit) return null;
      if (r.kind === "scale"){
        const chords = this.diatonic(r.root, r.hit[1]);
        return chords ? { label: "Diatonic chords", chords: chords } : null;
      }
      let ivStr = null, keyName = "";
      if (D.MAJOR_FAM.includes(r.hit[0])){ ivStr = D.MAJOR_IV; keyName = "major"; }
      else if (D.MINOR_FAM.includes(r.hit[0])){ ivStr = D.MINOR_IV; keyName = "minor"; }
      if (!ivStr) return null;
      return {
        label: "Chords in the key of " + D.NAMES[r.root] + " " + keyName + " (this chord as I)",
        chords: this.diatonic(r.root, ivStr)
      };
    }
  };
})();
