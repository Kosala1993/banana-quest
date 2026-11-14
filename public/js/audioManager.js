// Local CC0 recordings. See documentation/audio-credits.md for provenance.
export const SOUND_ASSETS = {
  ui: ['pop.ogg', 0.22, 0.25],
  start: ['jingles_STEEL00.ogg', 0.32, 2.5],
  success: ['confirmation_001.ogg', 0.35, 0.55],
  error: ['pluck_002.ogg', 0.3, 0.3],
  damage: ['bong_001.ogg', 0.24, 0.35],
  mountain: ['pluck_001.ogg', 0.2, 0.25],
  bridge: ['wood01.ogg', 0.18, 0.3],
  forest: ['birds.ogg', 0.14, 0.7],
  cave: ['drop_001.ogg', 0.22, 0.5],
  waterfall: ['waterflow.mp3', 0.2, 0.7],
  gate: ['glass_001.ogg', 0.25, 0.7],
  complete: ['confirmation_002.ogg', 0.32, 1],
  victory: ['jingles_STEEL00.ogg', 0.38, 3.5],
  'game-over': ['minimize_001.ogg', 0.3, 0.8],
  restart: ['maximize_001.ogg', 0.25, 0.5],
  logout: ['back_001.ogg', 0.25, 0.5]
};

let context;
let soundEnabled = true;
let musicEnabled = true;
let soundVolume = 0.9;
let ambienceVolume = 0.55;
let scene = null;
let generation = 0;
let ambienceGeneration = 0;
let nextTime = 0;
const buffers = new Map();
const voices = new Set();
let ambience = null;
let foreground = Promise.resolve();

export function initializeAudio() {
  try {
    const Constructor = window.AudioContext || window.webkitAudioContext;
    if (!Constructor) return false;
    context ??= new Constructor();
    if (context.state === 'suspended') context.resume().catch(() => {});
    return true;
  } catch { return false; }
}

async function load(file) {
  if (!buffers.has(file)) {
    buffers.set(file, fetch(`/audio/${file}`, { signal: AbortSignal.timeout(5000) }).then(response => {
      if (!response.ok) throw new Error('Audio unavailable');
      return response.arrayBuffer();
    }).then(bytes => context.decodeAudioData(bytes)).catch(() => {
      buffers.delete(file); // Retry on a later event; gameplay never awaits audio.
      return null;
    }));
  }
  return buffers.get(file);
}

function stopVoice(voice) {
  try { voice.source.stop(); } catch { /* Already ended. */ }
  voice.source.disconnect();
  voice.gain.disconnect();
  voices.delete(voice);
}

export function playSound(name) {
  const asset = SOUND_ASSETS[name];
  if (!asset || !soundEnabled || !initializeAudio()) return;
  const ticket = generation;
  const loading = load(asset[0]);
  foreground = foreground.then(() => loading).then(buffer => {
    if (!buffer || ticket !== generation || !soundEnabled || context.state !== 'running') return;
    // One ordered foreground lane, at most two queued cues. Rapid clicks cannot pile up.
    if (voices.size >= 2) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const start = Math.max(context.currentTime, nextTime);
    const duration = Math.min(buffer.duration, asset[2]);
    source.buffer = buffer;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(asset[1] * soundVolume, start + 0.01);
    gain.gain.setValueAtTime(asset[1] * soundVolume, start + Math.max(0.01, duration - 0.04));
    gain.gain.linearRampToValueAtTime(0, start + duration);
    source.connect(gain).connect(context.destination);
    const voice = { name, source, gain, level: asset[1] };
    voices.add(voice);
    source.onended = () => stopVoice(voice);
    source.start(start, 0, duration);
    nextTime = start + duration + 0.025;
  }).catch(() => {});
}

export function stopSound(name) {
  if (name === 'ambience') return stopAmbience();
  for (const voice of voices) if (voice.name === name) stopVoice(voice);
  if (!voices.size) nextTime = 0;
}

export function stopAllSounds() {
  generation += 1;
  for (const voice of voices) stopVoice(voice);
  nextTime = 0;
  foreground = Promise.resolve();
  stopAmbience();
}

export function stopAmbience() {
  ambienceGeneration += 1;
  if (ambience) stopVoice(ambience);
  ambience = null;
}

export function playAmbience(area) {
  if (scene === area && ambience) return;
  scene = area;
  stopAmbience();
  // No ominous drones: only quiet birds or water. Other areas stay peacefully silent.
  const file = area === 'forest' || area === 'welcome' ? 'birds.ogg' : area === 'waterfall' ? 'waterflow.mp3' : null;
  if (!file || !soundEnabled || !musicEnabled || !initializeAudio()) return;
  const ticket = ambienceGeneration;
  void load(file).then(buffer => {
    if (!buffer || ticket !== ambienceGeneration || !musicEnabled || !soundEnabled || context.state !== 'running') return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = ambienceVolume * 0.09;
    source.connect(gain).connect(context.destination);
    ambience = { source, gain };
    source.start();
  }).catch(() => {});
}

export const getSoundEnabled = () => soundEnabled;
export const getMusicEnabled = () => musicEnabled;
export function setSoundEnabled(enabled) {
  soundEnabled = Boolean(enabled);
  if (!soundEnabled) stopAllSounds();
  else if (scene) playAmbience(scene);
}
export function setMusicEnabled(enabled) {
  musicEnabled = Boolean(enabled);
  if (!musicEnabled) stopAmbience();
  else if (scene) playAmbience(scene);
}
const clamp = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0;
export function setSoundVolume(value) {
  soundVolume = clamp(value);
  for (const voice of voices) {
    voice.gain.gain.cancelScheduledValues(context.currentTime);
    voice.gain.gain.setTargetAtTime(voice.level * soundVolume, context.currentTime, 0.015);
  }
}
export function setAmbienceVolume(value) {
  ambienceVolume = clamp(value);
  if (ambience) ambience.gain.gain.setTargetAtTime(ambienceVolume * 0.09, context.currentTime, 0.03);
}

export const audioManager = { initializeAudio, playSound, stopSound, stopAllSounds, playAmbience,
  stopAmbience, getSoundEnabled, getMusicEnabled, setSoundEnabled, setMusicEnabled,
  setSoundVolume, setAmbienceVolume };
export default audioManager;
