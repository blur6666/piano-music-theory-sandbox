// Single source of truth for what is held or selected.
// Inputs (mouse, MIDI) call set/toggle/clear; views subscribe.
// Neither side knows the other exists -- that is the whole point of the file.
SP.state = {

  sel: new Set(),      // MIDI note numbers. Listeners read it, never mutate it.
  listeners: [],

  subscribe(fn){ this.listeners.push(fn); },

  notify(){ this.listeners.forEach(fn => fn(this.sel)); },

  set(note, on){
    if (on) this.sel.add(note); else this.sel.delete(note);
    this.notify();
  },

  replace(notes){
    this.sel = new Set(notes);
    this.notify();
  },

  toggle(note){ this.set(note, !this.sel.has(note)); },

  clear(){ this.sel.clear(); this.notify(); }
};
