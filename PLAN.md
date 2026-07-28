1. Replace the CSS custom-property palette in `style.css` (light + dark
   `:root` blocks) with a new violet-accented scheme, distinct from the
   current blue/beige one.
2. Keep white piano keys (`--surface-2`) pure/near-white in both light and
   dark mode, instead of the dark-mode inversion the old palette used.
3. Add a dedicated `--key-white-text` variable (constant across themes) for
   `.pkey.white .klabel`, since `--text-secondary` used to work only because
   white keys used to go dark in dark mode — that assumption breaks once
   white keys stay white.
4. No structural/markup changes; only CSS variable values plus the one
   selector that referenced a variable which no longer fits its use.
