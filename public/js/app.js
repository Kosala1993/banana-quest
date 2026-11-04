import { positionExplorer, showCheckpointMarkers } from './world.js';

const screens = ['welcome-screen', 'auth-screen', 'intro-screen', 'game-screen', 'end-screen'];
const obstacles = ['Climb the Mountain', 'Cross the Broken Bridge', 'Dark Forest', 'Hidden Cave', 'Waterfall Crossing', 'Ancient Gate'];
let csrfToken = '';
let player = null;
let currentAttempt = null;
let puzzleId = null;
let offlineMode = false;
let authMode = 'register';

async function api(url, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.method && options.method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}), ...options.headers };
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

function showScreen(screenId) {
  screens.forEach(id => document.getElementById(id).classList.toggle('hidden', id !== screenId));
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.setTimeout(() => toast.classList.remove('visible'), 2600);
}

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === 'register';
  document.querySelector('#auth-title').textContent = registering ? 'Create your account' : 'Welcome back, explorer';
  document.querySelector('#auth-submit').textContent = registering ? 'Create account' : 'Log in';
  document.querySelector('#email-label').classList.toggle('hidden', !registering);
  document.querySelector('#confirm-label').classList.toggle('hidden', !registering);
  document.querySelector('#auth-form [name="email"]').required = registering;
  document.querySelector('#auth-form [name="confirmPassword"]').required = registering;
  document.querySelector('#auth-form [name="password"]').autocomplete = registering ? 'new-password' : 'current-password';
  document.querySelectorAll('[data-auth-mode]').forEach(button => button.classList.toggle('active', button.dataset.authMode === mode));
  document.querySelector('#auth-message').textContent = '';
}

function renderState(attempt) {
  currentAttempt = attempt;
  document.querySelector('#player-name').textContent = player.username;
  document.querySelector('#obstacle-name').textContent = attempt.obstacle;
  document.querySelector('#obstacle-progress').textContent = `${attempt.answersInObstacle} / 5`;
  document.querySelector('#score-value').textContent = attempt.score.toLocaleString();
  document.querySelector('#life-count').textContent = `${'♥ '.repeat(attempt.lives).trim()}${attempt.lives < 3 ? ` ${'♡ '.repeat(3 - attempt.lives).trim()}` : ''}`;
  document.querySelector('#life-count').setAttribute('aria-label', `${attempt.lives} lives remaining`);
  document.querySelector('#progress-label').textContent = `${attempt.checkpoint} / 30`;
  document.querySelector('#progress-fill').style.width = `${attempt.checkpoint / 30 * 100}%`;
  document.querySelector('#puzzle-source').textContent = offlineMode ? 'Offline sample' : 'Banana API';
  positionExplorer(attempt.checkpoint);
}

async function loadPuzzle() {
  const placeholder = document.querySelector('#puzzle-placeholder');
  const image = document.querySelector('#puzzle-image');
  placeholder.classList.remove('hidden');
  placeholder.textContent = 'Finding a puzzle...';
  image.classList.add('hidden');
  document.querySelector('#answer-submit').disabled = true;
  try {
    const data = await api(`/api/game/puzzle${offlineMode ? '?mode=offline' : ''}`);
    puzzleId = data.puzzleId;
    offlineMode = data.source === 'offline';
    document.querySelector('#puzzle-source').textContent = offlineMode ? 'Offline sample' : 'Banana API';
    document.querySelector('#puzzle-mode-label').textContent = offlineMode ? 'OFFLINE SAMPLE PUZZLE' : 'BANANA API PUZZLE';
    image.src = data.imageUrl;
    image.onload = () => { placeholder.classList.add('hidden'); image.classList.remove('hidden'); };
    image.onerror = () => { placeholder.textContent = 'This puzzle image could not be displayed. Try loading another puzzle.'; };
    if (image.complete && image.naturalWidth) { placeholder.classList.add('hidden'); image.classList.remove('hidden'); }
    document.querySelector('#answer-submit').disabled = false;
    document.querySelector('#answer-input').focus({ preventScroll: true });
  } catch (error) {
    puzzleId = null;
    placeholder.textContent = error.message;
    document.querySelector('#answer-message').textContent = '';
  }
}

async function openGame(attempt) {
  renderState(attempt);
  showScreen('game-screen');
  document.querySelector('#answer-message').textContent = '';
  if (attempt.status === 'completed' || attempt.status === 'game_over') return showEndScreen(attempt);
  await loadPuzzle();
}

function showEndScreen(attempt) {
  const won = attempt.status === 'completed';
  document.querySelector('#end-eyebrow').textContent = won ? 'Jungle Champion achievement earned' : `${attempt.obstacle} · Game Over`;
  document.querySelector('#end-title').textContent = won ? 'Level 1 completed!' : 'The jungle wins this round.';
  document.querySelector('#end-copy').textContent = won
    ? 'You solved all 30 puzzles, opened the ancient gate, and found your way out of the Lost Jungle.'
    : `Your adventure ended at checkpoint ${attempt.checkpoint} on ${attempt.obstacle}. Your progress and final score have been saved.`;
  document.querySelector('#end-score-value').textContent = attempt.score.toLocaleString();
  showScreen('end-screen');
}

async function refreshWelcome() {
  const data = await api('/api/game/state');
  document.querySelector('#guest-actions').classList.add('hidden');
  document.querySelector('#player-actions').classList.remove('hidden');
  document.querySelector('#logout-button').classList.remove('hidden');
  document.querySelector('#welcome-back').textContent = `Welcome back, ${player.username}.`;
  currentAttempt = data.attempt;
  document.querySelector('#continue-button').textContent = data.attempt?.status === 'active' ? 'Continue adventure' : data.attempt ? 'View last result' : 'Read the story';
  document.querySelector('#restart-button').classList.toggle('hidden', !data.attempt);
  showScreen('welcome-screen');
}

async function showProfile() {
  try {
    const data = await api('/api/profile');
    document.querySelector('#profile-username').textContent = `Explorer ${data.user.username}`;
    const results = document.querySelector('#results-list');
    results.innerHTML = data.results.length ? data.results.map(result => `<div class="result-row"><span>${result.result === 'completed' ? 'Level 1 complete' : 'Game over'} · ${new Date(result.completedAt).toLocaleDateString()}</span><strong>${result.score.toLocaleString()} pts</strong></div>`).join('') : '<p>No completed attempts yet.</p>';
    document.querySelector('#profile-dialog').showModal();
  } catch (error) { showToast(error.message); }
}

async function submitAnswer(event) {
  event.preventDefault();
  if (!puzzleId) return;
  const button = document.querySelector('#answer-submit');
  const answerInput = document.querySelector('#answer-input');
  button.disabled = true;
  document.querySelector('#answer-message').textContent = 'Checking your answer...';
  try {
    const result = await api('/api/game/answer', { method: 'POST', body: JSON.stringify({ puzzleId, answer: Number(answerInput.value) }) });
    puzzleId = null;
    renderState(result.attempt);
    document.querySelector('#answer-message').textContent = result.answerMessage;
    answerInput.value = '';
    await new Promise(resolve => window.setTimeout(resolve, result.attempt.status === 'completed' ? 1320 : 680));
    if (result.attempt.status !== 'active') return showEndScreen(result.attempt);
    if (result.obstacleCompleted) showToast(`${obstacles[result.attempt.obstacleIndex - 1]} completed! Keep moving.`);
    await loadPuzzle();
  } catch (error) {
    document.querySelector('#answer-message').textContent = error.message;
    button.disabled = false;
  }
}

async function startNewAttempt() {
  const data = await api('/api/game/start', { method: 'POST', body: '{}' });
  await openGame(data.attempt);
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const message = document.querySelector('#auth-message');
  message.classList.remove('success');
  message.textContent = '';
  if (authMode === 'register' && values.get('password') !== values.get('confirmPassword')) {
    message.textContent = 'Those passwords do not match.';
    return;
  }
  const submit = document.querySelector('#auth-submit');
  submit.disabled = true;
  try {
    const route = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body = { username: values.get('username'), password: values.get('password') };
    if (authMode === 'register') body.email = values.get('email');
    const result = await api(route, { method: 'POST', body: JSON.stringify(body) });
    if (authMode === 'register') {
      setAuthMode('login');
      message.classList.add('success');
      message.textContent = result.message;
      document.querySelector('#auth-form [name="username"]').value = body.username;
    } else {
      csrfToken = result.csrfToken;
      player = result.user;
      await refreshWelcome();
      if (!currentAttempt) showScreen('intro-screen');
    }
  } catch (error) { message.textContent = error.message; }
  finally { submit.disabled = false; }
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST', body: '{}' });
    player = null;
    currentAttempt = null;
    document.querySelector('#guest-actions').classList.remove('hidden');
    document.querySelector('#player-actions').classList.add('hidden');
    document.querySelector('#logout-button').classList.add('hidden');
    showScreen('welcome-screen');
  } catch (error) { showToast(error.message); }
}

document.querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => {
  setAuthMode(button.dataset.screen);
  showScreen('auth-screen');
}));
document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setAuthMode(button.dataset.authMode)));
document.querySelectorAll('[data-home]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); showScreen(player ? 'welcome-screen' : 'welcome-screen'); }));
document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', logout));
document.querySelector('#auth-form').addEventListener('submit', handleAuthSubmit);
document.querySelector('#answer-form').addEventListener('submit', submitAnswer);
document.querySelector('#begin-button').addEventListener('click', async () => {
  try { await startNewAttempt(); } catch (error) { showToast(error.message); }
});
document.querySelector('#continue-button').addEventListener('click', async () => {
  if (!currentAttempt) return showScreen('intro-screen');
  if (currentAttempt.status === 'active') return openGame(currentAttempt);
  showEndScreen(currentAttempt);
});
document.querySelector('#restart-button').addEventListener('click', async () => {
  try { await startNewAttempt(); } catch (error) { showToast(error.message); }
});
document.querySelector('#end-restart').addEventListener('click', async () => {
  try { await startNewAttempt(); } catch (error) { showToast(error.message); }
});
document.querySelector('#offline-toggle').addEventListener('click', async event => {
  const toggleButton = event.currentTarget;
  toggleButton.disabled = true;
  try {
    if (puzzleId) await api('/api/game/puzzle/discard', { method: 'POST', body: '{}' });
    puzzleId = null;
  } catch (error) {
    showToast(error.message);
    toggleButton.disabled = false;
    return;
  }
  offlineMode = !offlineMode;
  toggleButton.textContent = offlineMode ? 'Use Banana API puzzles' : 'Use offline sample puzzles';
  await loadPuzzle();
  toggleButton.disabled = false;
});
document.querySelector('#profile-button').addEventListener('click', showProfile);
document.querySelector('#profile-game-button').addEventListener('click', showProfile);
document.querySelector('#close-profile').addEventListener('click', () => document.querySelector('#profile-dialog').close());

async function initialize() {
  showCheckpointMarkers();
  try {
    const sessionData = await api('/api/session');
    csrfToken = sessionData.csrfToken;
    if (!sessionData.user) return;
    player = sessionData.user;
    await refreshWelcome();
    if (!currentAttempt) showScreen('intro-screen');
  } catch (error) { showToast(error.message); }
}

initialize();