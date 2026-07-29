// Polyphonic synthesized piano-ish sound. Input events arrive through state;
// selection views never need to know that audio exists.
(function(){

  const C = SP.config;
  const MIN_GAIN = 0.0001;
  const ATTACK = 0.003;
  const DECAY = 1.35;
  const RELEASE = 0.18;
  const VOICE_TAIL = 0.26;

  let ctx = null;
  let master = null;
  let compressor = null;
  let enabled = C.sound;
  let sustain = C.sustain;
  const voices = new Map();
  let noiseBuffer = null;

  function audioContextType(){
    return window.AudioContext || window.webkitAudioContext;
  }

  function ensureContext(){
    if (ctx) return ctx;
    const Type = audioContextType();
    if (!Type) return null;

    ctx = new Type();
    master = ctx.createGain();
    compressor = ctx.createDynamicsCompressor();
    master.gain.value = C.soundVolume;
    compressor.threshold.value = -12;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;
    master.connect(compressor).connect(ctx.destination);
    return ctx;
  }

  function unlock(){
    const audio = ensureContext();
    if (audio && audio.state === "suspended") audio.resume();
  }

  function clampVelocity(velocity){
    const v = velocity == null ? C.mouseVelocity : velocity;
    return Math.max(1, Math.min(127, v)) / 127;
  }

  function frequency(note){
    return 220 * Math.pow(2, (note - 69) / 12);
  }

  function getNoiseBuffer(){
    if (noiseBuffer) return noiseBuffer;
    const length = Math.floor(ctx.sampleRate * 0.035);
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  function oscillator(bus, f, multiple, amount, voice){
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = f * multiple;
    gain.gain.value = amount;
    osc.connect(gain).connect(bus);
    osc.start(voice.startAt);
    osc.stop(voice.stopAt);
    voice.toneSources.push(osc);
  }

  function releaseVoice(note){
    const voice = voices.get(note);
    if (!voice || voice.released) return;
    voice.released = true;
    const now = ctx.currentTime;
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setTargetAtTime(MIN_GAIN, now, RELEASE / 5);
    voice.toneSources.forEach(source => source.stop(now + VOICE_TAIL));
    window.setTimeout(() => {
      if (voices.get(note) === voice) voices.delete(note);
    }, VOICE_TAIL * 1000 + 50);
  }

  function releaseAll(){
    [...voices.keys()].forEach(releaseVoice);
  }

  function play(note, velocity){
    if (!enabled) return;
    const audio = ensureContext();
    if (!audio) return;
    if (audio.state === "suspended") audio.resume();

    // A retrigger replaces the old voice instead of stacking an unbounded
    // number of voices for one MIDI note.
    releaseVoice(note);

    const now = audio.currentTime;
    const f = frequency(note);
    console.log("Audio note " + note + " = " + f.toFixed(2) + " Hz");
    const voice = {
      startAt: now,
      stopAt: now + DECAY + VOICE_TAIL,
      toneSources: [],
      released: false
    };
    voices.set(note, voice);

    const bus = audio.createGain();
    const filter = audio.createBiquadFilter();
    const envelope = audio.createGain();
    voice.envelope = envelope;
    filter.type = "lowpass";
    filter.frequency.value = Math.min(10000, Math.max(1800, f * 7));
    filter.Q.value = 0.35;
    bus.connect(filter).connect(envelope).connect(master);

    // Additive harmonics make the tone less like a bare sine wave.
    oscillator(bus, f, 1, 1.00, voice);
    oscillator(bus, f, 2, 0.28, voice);
    oscillator(bus, f, 3, 0.12, voice);
    oscillator(bus, f, 4, 0.05, voice);

    // A short filtered noise burst suggests the hammer attack.
    const noise = audio.createBufferSource();
    const noiseGain = audio.createGain();
    const noiseFilter = audio.createBiquadFilter();
    noise.buffer = getNoiseBuffer();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 1500;
    noiseGain.gain.setValueAtTime(0.16, now);
    noiseGain.gain.exponentialRampToValueAtTime(MIN_GAIN, now + 0.035);
    noise.connect(noiseGain).connect(noiseFilter).connect(bus);
    noise.start(now);
    noise.stop(now + 0.04);

    const peak = 0.16 + Math.pow(clampVelocity(velocity), 1.35) * 0.36;
    envelope.gain.setValueAtTime(MIN_GAIN, now);
    envelope.gain.linearRampToValueAtTime(peak, now + ATTACK);
    envelope.gain.setTargetAtTime(MIN_GAIN, now + ATTACK, DECAY / 5);
    window.setTimeout(() => {
      if (voices.get(note) === voice) voices.delete(note);
    }, (DECAY + VOICE_TAIL) * 1000 + 50);
  }

  SP.audio = {
    unlock: unlock,
    handle(note, on, velocity){ on ? play(note, velocity) : (sustain ? null : releaseVoice(note)); },
    setEnabled(on){
      enabled = !!on;
      if (!enabled) releaseAll();
    },
    setSustain(on){
      sustain = !!on;
      if (!sustain) releaseAll();
    },
    setVolume(value){
      C.soundVolume = value;
      if (master) master.gain.setTargetAtTime(value, ctx.currentTime, 0.02);
    },
    releaseAll: releaseAll,
    noteFrequency: frequency
  };
})();
