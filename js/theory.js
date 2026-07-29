// Pure music theory: no DOM, no state, no side effects on load.
// That is what lets tests.html load this file with only data.js beside it.
(function(){
  const D = SP.data;

  SP.theory = {

    // The one place that chooses between the two tables. Display only --
    // midi.js's console noteName() is deliberately exempt.
    spell(pc, flats){ return (flats ? D.FLATS : D.NAMES)[pc]; },

    // One ascending octave of a scale from an actual key on the keyboard:
    // the root the player struck, its scale tones above it, and the root
    // again an octave up to close the run. Takes a MIDI note, not a pitch
    // class -- the octave the player chose is the octave it draws in, even
    // if that runs off the top of the on-screen range.
    scaleNotesFrom(root, ivStr){
      return ivStr.split(",").map(Number).concat(12).map(i => root + i);
    },

    // Degrees of a note set against an assumed root, for sets no dictionary
    // row covers. Sorted by semitone, so no stacked-thirds reordering --
    // that is what the hand-written CHORDS/SCALES columns are for.
    degrees(pcs, root){
      return pcs.map(p => (p - root + 12) % 12).sort((a, b) => a - b)
                .map(i => D.DEGREES[i]).join(" ");
    },

    // Chords rooted on the bass whose notes contain everything held, keeping
    // only the closest tier -- with 1 5 held that is the four one-note-away
    // triads, not every 7th and 9th that also fits. Exact matches are
    // excluded by the zero-missing test: a chord cannot be a suspicion of
    // itself. Always rooted on the bass, same rule as the suspected root.
    suspects(pcs, bass, flats){
      const held = pcs.map(p => (p - bass + 12) % 12);
      const cands = [];
      for (const [name, ivStr] of D.CHORDS){
        const iv = ivStr.split(",").map(Number);
        if (!held.every(h => iv.includes(h))) continue;
        const missing = iv.filter(i => !held.includes(i));
        if (!missing.length) continue;
        cands.push({ name: this.spell(bass, flats) + " " + name,
                     missing: missing.map(i => D.DEGREES[i]).join(" "),
                     gap: missing.length });
      }
      const best = Math.min(...cands.map(c => c.gap));
      return cands.filter(c => c.gap === best);
    },

    // Triads stacked from the tones of a 7-note scale. null for any other size.
    diatonic(root, ivStr, flats){
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
        return { name: this.spell((root + t0) % 12, flats) + suf, rn: rn };
      });
    },

    // Try every candidate root (bass first) against the dictionaries.
    // <=4 notes prefers chords, >=5 prefers scales.
    detect(pcs, bass, flats){
      const n = pcs.length;
      const dicts = n <= 4 ? [["chord", D.CHORDS], ["scale", D.SCALES]]
                           : [["scale", D.SCALES], ["chord", D.CHORDS]];
      const roots = [bass, ...pcs.filter(p => p !== bass)];
      for (const [kind, dict] of dicts){
        for (const root of roots){
          const ivArr = pcs.map(p => (p - root + 12) % 12).sort((a, b) => a - b);
          const hit = dict.find(d => d[1] === ivArr.join(","));
          if (hit){
            let label = this.spell(root, flats) + " " + hit[0];
            if (kind === "chord"){
              const pos = ivArr.indexOf((bass - root + 12) % 12);
              label += " — " + (D.ORD[pos] || pos + "th inversion");
              if (pos > 0) label += " (" + this.spell(bass, flats) + " in bass)";
            } else if (root !== bass){
              label += " (" + this.spell(bass, flats) + " in bass)";
            }
            // flats rides along on the result so keyContext() re-spells the
            // same way without a second argument the caller could forget.
            // degrees rides along too, straight off hit[2] -- CHORDS and
            // SCALES rows both carry a hand-written formula column now. pcs
            // and bass ride along so the view can call suspects() without
            // re-deriving them.
            return { label: label, kind: kind, root: root, hit: hit, flats: flats,
                      degrees: hit[2], pcs: pcs, bass: bass };
          }
        }
      }
      // Nothing in either dictionary. Not a failure -- a hypothesis: the
      // lowest note is the suspected root, and its degrees are computed
      // (theory.degrees(), naive) rather than looked up, since there is no
      // dictionary row to be faithful to. No `hit`, so keyContext() still
      // returns null for this -- an unknown set gets no chip panel.
      return { label: this.spell(bass, flats) + " ? (unknown chord)", root: bass,
                flats: flats, degrees: this.degrees(pcs, bass), pcs: pcs, bass: bass };
    },

    // The chord list to show under a result, or null when there is truly
    // nothing to show (scales that aren't 7 notes; power chord and minor
    // major 7 have no textbook key relationship worth guessing at). New
    // key-inference rules -- parent keys for pentatonics, say -- belong here,
    // not in results-ui.js.
    // activeIdx tells the view which chip (if any) to highlight as "this one
    // is confirmed, not just a candidate" -- always 0 for the diatonic cases
    // (that chip genuinely is the tonic), -1 for the ambiguous-keys case
    // (none of the candidates is more correct than the others).
    keyContext(r){
      if (!r.hit) return null;
      if (r.kind === "scale"){
        const chords = this.diatonic(r.root, r.hit[1], r.flats);
        return chords ? { label: "Diatonic chords", chords: chords, activeIdx: 0 } : null;
      }
      const name = r.hit[0];
      let ivStr = null, keyName = "";
      if (D.MAJOR_FAM.includes(name)){ ivStr = D.MAJOR_IV; keyName = "major"; }
      else if (D.MINOR_FAM.includes(name)){ ivStr = D.MINOR_IV; keyName = "minor"; }
      if (ivStr){
        return {
          label: "Chords in the key of " + this.spell(r.root, r.flats) + " " + keyName + " (this chord as I)",
          chords: this.diatonic(r.root, ivStr, r.flats),
          activeIdx: 0
        };
      }
      // Dim/aug/sus/dominant chords don't imply one key -- list the small,
      // fixed set of candidates instead of picking one. Same shape as above,
      // reusing renderChips as-is: each candidate key is one chip rather than
      // one diatonic chord. activeIdx -1 regardless of how many candidates
      // there are (even a single one), so a lone candidate never looks more
      // "confirmed" than a pair does -- the label already says "Possible".
      const keys = D.AMBIGUOUS_KEYS[name];
      if (!keys) return null;
      return {
        label: "Possible keys",
        chords: keys.map(([offset, mode, rn]) =>
          ({ name: this.spell((r.root + offset + 12) % 12, r.flats) + " " + mode, rn: rn })),
        activeIdx: -1
      };
    }
  };
})();
