// Single source of truth for what is held or selected.
// Inputs (mouse, MIDI) call set/toggle/clear; views subscribe.
// Neither side knows the other exists -- that is the whole point of the file.
SP.state = {

  sel: new Set(),      // MIDI note numbers. Listeners read it, never mutate it.
  listeners: [],
  inputListeners: [],  // note-on/off consumers, separate from selection views

  // While armed, the next note-on goes to this function instead of the
  // selection, and the arm is spent. Every input lands in set(), so one hook
  // here catches mouse and MIDI alike without either knowing it exists --
  // which is why "play a note to pick a root" needed no change to either.
  capture: null,

  subscribe(fn){ this.listeners.push(fn); },

  subscribeInput(fn){ this.inputListeners.push(fn); },

  notify(){ this.listeners.forEach(fn => fn(this.sel)); },

  arm(fn){ this.capture = fn; },

  disarm(){ this.capture = null; },

  set(note, on, velocity){
    this.inputListeners.forEach(fn => fn(note, on, velocity));
    if (this.capture){
      if (!on) return;              // a release is not a choice of note
      const fn = this.capture;
      this.capture = null;
      fn(note);
      return;
    }
    if (on) this.sel.add(note); else this.sel.delete(note);
    this.notify();
  },

  replace(notes){
    this.sel = new Set(notes);
    this.notify();
  },

  toggle(note, velocity){ this.set(note, !this.sel.has(note), velocity); },

  clear(){ this.sel.clear(); this.notify(); }
};
