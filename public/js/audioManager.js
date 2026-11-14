const SOUND_PRESETS = {
  ui: [
    { type: 'triangle', frequency: 520, duration: 0.08, volume: 0.06 },
    { type: 'triangle', frequency: 680, duration: 0.08, volume: 0.03, delay: 0.05 }
  ],
  start: [
    { type: 'triangle', frequency: 440, duration: 0.16, volume: 0.09, sweepTo: 620 },
    { type: 'sine', frequency: 620, duration: 0.24, volume: 0.08, delay: 0.1, sweepTo: 820 },
    { type: 'triangle', frequency: 820, duration: 0.2, volume: 0.07, delay: 0.2, sweepTo: 980 }
  ],
  success: [
    { type: 'triangle', frequency: 620, duration: 0.12, volume: 0.08, sweepTo: 760 },
    { type: 'sine', frequency: 820, duration: 0.16, volume: 0.06, delay: 0.08, sweepTo: 980 }
  ],
  error: [
    { type: 'sawtooth', frequency: 220, duration: 0.18, volume: 0.06, sweepTo: 160 },
    { type: 'triangle', frequency: 180, duration: 0.18, volume: 0.04, delay: 0.09, sweepTo: 120 }
  ],
  damage: [
    { type: 'square', frequency: 180, duration: 0.18, volume: 0.05, sweepTo: 120 },
    { type: 'triangle', frequency: 110, duration: 0.22, volume: 0.04, delay: 0.08, sweepTo: 90 }
  ],
  mountain: [
    { type: 'triangle', frequency: 180, duration: 0.11, volume: 0.04, sweepTo: 220 },
    { type: 'triangle', frequency: 260, duration: 0.12, volume: 0.03, delay: 0.06, sweepTo: 310 }
  ],
  bridge: [
    { type: 'square', frequency: 110, duration: 0.1, volume: 0.04, sweepTo: 160 },
    { type: 'triangle', frequency: 180, duration: 0.12, volume: 0.03, delay: 0.07, sweepTo: 220 }
  ],
  forest: [
    { type: 'triangle', frequency: 220, duration: 0.08, volume: 0.035, sweepTo: 270 },
    { type: 'sine', frequency: 300, duration: 0.1, volume: 0.025, delay: 0.05, sweepTo: 340 }
  ],
  cave: [
    { type: 'sine', frequency: 110, duration: 0.12, volume: 0.03, sweepTo: 140 },
    { type: 'triangle', frequency: 150, duration: 0.18, volume: 0.03, delay: 0.08, sweepTo: 180 }
  ],
  waterfall: [
    { type: 'sine', frequency: 160, duration: 0.09, volume: 0.025, sweepTo: 200 },
    { type: 'triangle', frequency: 210, duration: 0.11, volume: 0.022, delay: 0.05, sweepTo: 260 }
  ],
  gate: [
    { type: 'sine', frequency: 400, duration: 0.12, volume: 0.04, sweepTo: 460 },
    { type: 'triangle', frequency: 560, duration: 0.18, volume: 0.05, delay: 0.09, sweepTo: 720 }
  ],
  victory: [
    { type: 'triangle', frequency: 440, duration: 0.2, volume: 0.08, sweepTo: 560 },
    { type: 'triangle', frequency: 660, duration: 0.22, volume: 0.08, delay: 0.1, sweepTo: 820 },
    { type: 'sine', frequency: 880, duration: 0.4, volume: 0.07, delay: 0.2, sweepTo: 980 }
  ],
  'game-over': [
    { type: 'sawtooth', frequency: 180, duration: 0.22, volume: 0.07, sweepTo: 120 },
    { type: 'triangle', frequency: 120, duration: 0.42, volume: 0.06, delay: 0.14, sweepTo: 80 }
  ]
};

const AMBIENCE_PRESETS = {
  welcome: { base: 190, accent: 340, wavetype: 'triangle', noise: 0.015 },
  mountain: { base: 220, accent: 330, wavetype: 'triangle', noise: 0.02 },
  bridge: { base: 170, accent: 270, wavetype: 'square', noise: 0.018 },
  forest: { base: 260, accent: 420, wavetype: 'sine', noise: 0.022 },
  cave: { base: 120, accent: 220, wavetype: 'sine', noise: 0.012 },
  waterfall: { base: 140, accent: 260, wavetype: 'sawtooth', noise: 0.025 },
  gate: { base: 290, accent: 480, wavetype: 'triangle', noise: 0.018 }
};

let audioContext = null;
let masterGain = null;
let soundEnabled = true;
let musicEnabled = true;
let soundVolume = 0.9;
let ambienceVolume = 0.55;
let activeAmbience = null;

function ensureAudioContext() {
  if (audioContext) return audioContext;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  audioContext = new AudioCtor();
  masterGain = audioContext.createGain();
  masterGain.gain.value = soundVolume;
  masterGain.connect(audioContext.destination);
  return audioContext;
}

function resumeAudioContext() {
  const context = ensureAudioContext();
  if (!context || context.state === 'running') return;
  context.resume().catch(() => {});
}

function scheduleTone({ type = 'sine', frequency = 440, duration = 0.2, volume = 0.09, delay = 0, sweepTo = null, detune = 0 }) {
  const context = ensureAudioContext();
  if (!context || !soundEnabled) return;

  const startTime = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const filterNode = context.createBiquadFilter();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  if (typeof sweepTo === 'number') {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), startTime + duration);
  }
  oscillator.detune.setValueAtTime(detune, startTime);

  filterNode.type = 'lowpass';
  filterNode.frequency.setValueAtTime(2800, startTime);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(filterNode);
  filterNode.connect(gainNode);
  gainNode.connect(masterGain ?? context.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.05);
}

function clonePreset(sfx) {
  if (Array.isArray(sfx)) return sfx.map(item => ({ ...item }));
  return [{ ...sfx }];
}

export function initializeAudio() {
  const context = ensureAudioContext();
  if (context) resumeAudioContext();
  return Boolean(context);
}

export function playSound(soundName) {
  if (!soundName || !SOUND_PRESETS[soundName]) return;
  const sfx = clonePreset(SOUND_PRESETS[soundName]);
  sfx.forEach(part => scheduleTone({ ...part, delay: part.delay ?? 0 }));
}

export function stopSound(soundName) {
  if (!soundName || !SOUND_PRESETS[soundName]) return;
  if (soundName === 'ambience') {
    stopAmbience();
  }
}

export function stopAllSounds() {
  stopAmbience();
}

function createNoiseBuffer(context) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let sample = 0; sample < channel.length; sample += 1) {
    channel[sample] = (Math.random() * 2 - 1) * 0.3;
  }
  return buffer;
}

export function playAmbience(areaName) {
  const context = ensureAudioContext();
  if (!context || !musicEnabled) return;

  const preset = AMBIENCE_PRESETS[areaName] || AMBIENCE_PRESETS.welcome;
  stopAmbience();

  const ambienceGain = context.createGain();
  ambienceGain.gain.value = 0.0001;
  ambienceGain.connect(masterGain ?? context.destination);
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.7;
  const drone = context.createOscillator();
  const accent = context.createOscillator();
  const droneGain = context.createGain();
  const accentGain = context.createGain();
  const lfo = context.createOscillator();
  const lfoGain = context.createGain();
  const noiseSource = context.createBufferSource();
  const noiseGain = context.createGain();
  const noiseFilter = context.createBiquadFilter();

  drone.type = preset.wavetype;
  drone.frequency.setValueAtTime(preset.base, context.currentTime);
  accent.type = 'sine';
  accent.frequency.setValueAtTime(preset.accent, context.currentTime);

  lfo.type = 'sine';
  lfo.frequency.value = 0.18;
  lfoGain.gain.value = 18;
  lfo.connect(lfoGain);
  lfoGain.connect(drone.frequency);

  droneGain.gain.value = 0.02;
  accentGain.gain.value = 0.01;
  noiseGain.gain.value = preset.noise;
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 900;

  noiseSource.buffer = createNoiseBuffer(context);
  noiseSource.loop = true;

  drone.connect(droneGain).connect(filter);
  accent.connect(accentGain).connect(filter);
  noiseSource.connect(noiseFilter).connect(noiseGain).connect(filter);
  filter.connect(ambienceGain);

  ambienceGain.gain.linearRampToValueAtTime(ambienceVolume, context.currentTime + 0.6);

  drone.start();
  accent.start();
  lfo.start();
  noiseSource.start();

  activeAmbience = { ambienceGain, drone, accent, lfo, noiseSource };
}

export function stopAmbience() {
  const context = ensureAudioContext();
  if (!context || !activeAmbience) return;
  const { ambienceGain, drone, accent, lfo, noiseSource } = activeAmbience;
  const now = context.currentTime;
  ambienceGain.gain.cancelScheduledValues(now);
  ambienceGain.gain.setValueAtTime(ambienceGain.gain.value, now);
  ambienceGain.gain.linearRampToValueAtTime(0.0001, now + 0.6);
  drone.stop(now + 0.7);
  accent.stop(now + 0.7);
  lfo.stop(now + 0.7);
  noiseSource.stop(now + 0.7);
  activeAmbience = null;
}

export function getSoundEnabled() {
  return soundEnabled;
}

export function getMusicEnabled() {
  return musicEnabled;
}

export function setSoundEnabled(enabled) {
  soundEnabled = Boolean(enabled);
  if (!soundEnabled) {
    stopAllSounds();
  }
}

export function setMusicEnabled(enabled) {
  musicEnabled = Boolean(enabled);
  if (!musicEnabled) {
    stopAmbience();
  }
}

export function setSoundVolume(volume) {
  soundVolume = Math.min(1, Math.max(0, Number(volume) || 0.9));
  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(soundVolume, audioContext.currentTime, 0.08);
  }
}

export function setAmbienceVolume(volume) {
  ambienceVolume = Math.min(1, Math.max(0, Number(volume) || 0.55));
  if (activeAmbience && audioContext) {
    activeAmbience.ambienceGain.gain.setTargetAtTime(ambienceVolume, audioContext.currentTime, 0.12);
  }
}

export const audioManager = {
  initializeAudio,
  playSound,
  stopSound,
  stopAllSounds,
  playAmbience,
  stopAmbience,
  getSoundEnabled,
  getMusicEnabled,
  setSoundEnabled,
  setMusicEnabled,
  setSoundVolume,
  setAmbienceVolume
};

export default audioManager;
