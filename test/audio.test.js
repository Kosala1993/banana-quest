import assert from 'node:assert/strict';
import { it } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

it('plays local assets in order, bounds overlap, handles failure, mute, unmute and zero volume', async () => {
  const sources = [];
  const gains = [];
  const parameter = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; }, cancelScheduledValues() {} });
  class Context {
    state = 'running'; currentTime = 0; destination = {};
    createBufferSource() {
      const node = { connect: destination => destination, disconnect() {}, start(...args) { this.started = args; }, stop() { this.stopped = true; } };
      sources.push(node); return node;
    }
    createGain() { const node = { gain: parameter(), connect: destination => destination, disconnect() {} }; gains.push(node); return node; }
    async decodeAudioData() { return { duration: 1 }; }
  }
  const oldWindow = globalThis.window;
  const oldFetch = globalThis.fetch;
  globalThis.window = { AudioContext: Context };
  let fail = false;
  globalThis.fetch = async () => {
    if (fail) throw new Error('missing file');
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  };
  const tick = () => new Promise(resolve => setImmediate(resolve));
  try {
    const audio = await import(`../public/js/audioManager.js?test=${Date.now()}`);
    for (const [name, asset] of Object.entries(audio.SOUND_ASSETS)) {
      assert.ok(existsSync(new URL(`../public/audio/${asset[0]}`, import.meta.url)), name);
      const bytes = readFileSync(new URL(`../public/audio/${asset[0]}`, import.meta.url));
      assert.ok(bytes.length > 1000, `${name}: real audio data`);
      if (asset[0].endsWith('.ogg')) assert.equal(bytes.toString('ascii', 0, 4), 'OggS');
      else assert.ok(bytes.toString('ascii', 0, 3) === 'ID3' || bytes[0] === 255, 'MP3 header');
      audio.stopAllSounds();
      audio.playSound(name); await tick();
      assert.ok(sources.at(-1).started, name);
    }
    audio.stopAllSounds();
    const before = sources.length;
    audio.playSound('error'); audio.playSound('damage'); audio.playSound('ui');
    await tick();
    assert.equal(sources.length - before, 2);
    assert.ok(sources.at(-1).started[0] > sources.at(-2).started[0]);
    audio.setSoundVolume(0);
    assert.equal(gains.at(-1).gain.value, 0);
    audio.setSoundVolume(0.4);
    assert.ok(gains.at(-1).gain.value > 0);
    audio.setSoundEnabled(false);
    assert.ok(sources.at(-1).stopped);
    const mutedCount = sources.length;
    audio.playSound('success'); await tick();
    assert.equal(sources.length, mutedCount);
    audio.setSoundEnabled(true);
    audio.playSound('success'); await tick();
    assert.ok(sources.length > mutedCount);
    audio.playAmbience('forest'); await tick();
    const bird = sources.at(-1);
    audio.playAmbience('forest'); await tick();
    assert.equal(sources.at(-1), bird, 'same scene does not restart ambience');
    audio.setAmbienceVolume(0); assert.equal(gains.at(-1).gain.value, 0);
    audio.setAmbienceVolume(0.5); assert.ok(gains.at(-1).gain.value < 0.05);
    audio.setMusicEnabled(false); assert.ok(bird.stopped);
    audio.setMusicEnabled(true); await tick(); assert.notEqual(sources.at(-1), bird);
    audio.stopAllSounds();
    const recovery = await import(`../public/js/audioManager.js?recovery=${Date.now()}`);
    fail = true;
    recovery.playAmbience('waterfall'); await tick();
    const failedCount = sources.length;
    recovery.playSound('unknown'); await tick(); assert.equal(sources.length, failedCount);
    fail = false;
    recovery.playAmbience('waterfall'); await tick(); assert.ok(sources.length > failedCount);
    recovery.stopAllSounds();
    globalThis.window = {};
    const unsupported = await import(`../public/js/audioManager.js?unsupported=${Date.now()}`);
    assert.equal(unsupported.initializeAudio(), false);
    assert.doesNotThrow(() => unsupported.playSound('success'));
  } finally { globalThis.window = oldWindow; globalThis.fetch = oldFetch; }
});

it('connects all gameplay outcomes and transitions to their intended audio events', async () => {
  const nodes = new Map();
  function node(key) {
    if (!nodes.has(key)) nodes.set(key, {
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {},
      listeners: {}, attributes: {},
      addEventListener(name, handler) { this.listeners[name] = handler; },
      setAttribute(name, value) { this.attributes[name] = value; }, focus() {}, value: '5'
    });
    return nodes.get(key);
  }
  const sounds = [];
  let enabled = true;
  const manager = new Proxy({}, { get: (_target, key) => (...args) => {
    if (key === 'playSound') sounds.push(args[0]);
    if (key === 'getSoundEnabled') return enabled;
    if (key === 'setSoundEnabled') enabled = args[0];
  } });
  let result;
  const context = vm.createContext({
    audioManager: manager, positionExplorer() {}, showCheckpointMarkers() {}, console,
    document: { querySelector: node, getElementById: node,
      querySelectorAll: selector => selector === '.audio-toggle' ? [node('toggle1'), node('toggle2')] : [],
      addEventListener() {} },
    window: { scrollTo() {}, setTimeout: fn => { fn(); } },
    fetch: async url => ({ ok: true, json: async () => url === '/api/session' ? {} : url === '/api/game/answer' ? result : url === '/api/game/start' ? { attempt: { ...result.attempt, status: 'active' } } : { puzzleId: 'next', imageUrl: '' } })
  });
  const source = readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  vm.runInContext(source + '\n globalThis.hooks = { submitAnswer, startNewAttempt, showEndScreen, logout, prepare(attempt) { player = {username:"tester"}; currentAttempt = attempt; puzzleId = "puzzle"; } };', context);
  const hooks = context.hooks;
  const attempt = { obstacleIndex: 0, lives: 3, score: 100, checkpoint: 1, status: 'active', obstacle: 'Mountain', answersInObstacle: 1 };
  for (const [index, area] of ['mountain', 'bridge', 'forest', 'cave', 'waterfall', 'gate'].entries()) {
    hooks.prepare({ ...attempt, obstacleIndex: index });
    result = { correct: true, attempt: { ...attempt, obstacleIndex: index } };
    sounds.length = 0;
    await hooks.submitAnswer({ preventDefault() {} });
    assert.deepEqual(sounds, ['success', area]);
  }
  hooks.prepare(attempt);
  result = { correct: false, attempt: { ...attempt, lives: 2 } };
  sounds.length = 0; await hooks.submitAnswer({ preventDefault() {} });
  assert.deepEqual(sounds, ['error', 'damage']);
  hooks.prepare(attempt);
  result = { correct: true, obstacleCompleted: true, attempt: { ...attempt, obstacleIndex: 1 } };
  sounds.length = 0; await hooks.submitAnswer({ preventDefault() {} });
  assert.deepEqual(sounds, ['success', 'mountain', 'complete'], 'crossing a boundary uses the obstacle just traversed');
  for (const [status, cue] of [['completed', 'victory'], ['game_over', 'game-over']]) {
    hooks.prepare(attempt);
    result = { correct: status === 'completed', attempt: { ...attempt, status, lives: status === 'game_over' ? 0 : 3 } };
    sounds.length = 0; await hooks.submitAnswer({ preventDefault() {} });
    assert.equal(sounds.at(-1), cue);
  }
  sounds.length = 0;
  await hooks.startNewAttempt(); assert.equal(sounds.at(-1), 'start');
  await hooks.startNewAttempt(true); assert.equal(sounds.at(-1), 'restart');
  await hooks.logout(); assert.equal(sounds.at(-1), 'logout');
  const toggle = node('toggle1');
  assert.equal(toggle.textContent, 'Sound: on');
  toggle.listeners.click();
  assert.equal(toggle.textContent, 'Sound: off');
  assert.equal(node('toggle2').attributes['aria-pressed'], 'false');
  toggle.listeners.click();
  assert.equal(node('toggle2').textContent, 'Sound: on');
  assert.doesNotThrow(() => node('#sound-volume').listeners.input({ target: { value: '0' } }));
  assert.doesNotThrow(() => node('#ambience-volume').listeners.input({ target: { value: '0.4' } }));
});
