import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { createDatabase } from '../server/database.js';
import { createBananaService, getOfflinePuzzle } from '../server/bananaService.js';

const puzzle = { imageUrl: 'https://www.sanfoh.com/uob/banana/data/sample.png', solution: 5 };

describe('Banana Quest application', () => {
  let db;
  let app;
  let playerAgent;
  let csrf;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    db = createDatabase(':memory:');
    app = createApp({ db, getPuzzle: async () => puzzle, sessionSecret: 'test-secret-with-more-than-thirty-two-characters' });
    playerAgent = request.agent(app);
    csrf = (await playerAgent.get('/api/session').expect(200)).body.csrfToken;
  });

  afterEach(() => { db.close(); });

  async function registerAndLogin(agent = playerAgent, username = 'jungle_fox') {
    let token = csrf;
    if (agent !== playerAgent) token = (await agent.get('/api/session').expect(200)).body.csrfToken;
    await agent.post('/api/auth/register').set('X-CSRF-Token', token).send({ username, email: `${username}@example.com`, password: 'StrongPass123' }).expect(201);
    const response = await agent.post('/api/auth/login').set('X-CSRF-Token', token).send({ username, password: 'StrongPass123' }).expect(200);
    if (agent === playerAgent) csrf = response.body.csrfToken;
    return response.body.csrfToken;
  }

  async function startAttempt(agent = playerAgent, token = csrf) {
    return agent.post('/api/game/start').set('X-CSRF-Token', token).send({ score: 999999, lives: 99 }).expect(201);
  }

  async function answerNext(value = 5, agent = playerAgent, token = csrf) {
    const found = await agent.get('/api/game/puzzle').expect(200);
    const submitted = await agent.post('/api/game/answer').set('X-CSRF-Token', token).send({ puzzleId: found.body.puzzleId, answer: value }).expect(200);
    return { found, submitted };
  }

  it('registers unique users, logs in, protects routes, and destroys the session on logout', async () => {
    await playerAgent.get('/api/game/state').expect(401);
    await playerAgent.post('/api/auth/register').send({ username: 'jungle_fox', email: 'fox@example.com', password: 'StrongPass123' }).expect(403);
    await playerAgent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ username: 'jungle_fox', email: 'fox@example.com', password: 'StrongPass123' }).expect(201);
    await playerAgent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ username: 'JUNGLE_FOX', email: 'other@example.com', password: 'StrongPass123' }).expect(409);
    await playerAgent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ username: 'jungle_fox', password: 'wrong-password' }).expect(401);
    const login = await playerAgent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ username: 'JUNGLE_FOX', password: 'StrongPass123' }).expect(200);
    csrf = login.body.csrfToken;
    assert.equal(login.body.user.username, 'jungle_fox');
    const stored = db.prepare('SELECT password_hash FROM users').get();
    assert.notEqual(stored.password_hash, 'StrongPass123');
    assert.match(stored.password_hash, /^\$2/);
    await playerAgent.get('/api/profile').expect(200);
    await playerAgent.post('/api/auth/logout').set('X-CSRF-Token', csrf).send({}).expect(200);
    await playerAgent.get('/api/profile').expect(401);
  });

  it('keeps Banana solutions private and advances through all six connected obstacles', async () => {
    await registerAndLogin();
    const start = await startAttempt();
    assert.equal(start.body.attempt.checkpoint, 0);
    assert.equal(start.body.attempt.lives, 3);
    assert.equal(start.body.attempt.score, 0);

    const first = await playerAgent.get('/api/game/puzzle').expect(200);
    assert.equal(first.body.source, 'banana-api');
    assert.equal(first.body.solution, undefined);
    const correct = await playerAgent.post('/api/game/answer').set('X-CSRF-Token', csrf).send({ puzzleId: first.body.puzzleId, answer: 5, score: 90000 }).expect(200);
    assert.equal(correct.body.attempt.checkpoint, 1);
    assert.equal(correct.body.attempt.score, 100);
    await playerAgent.post('/api/game/answer').set('X-CSRF-Token', csrf).send({ puzzleId: first.body.puzzleId, answer: 5 }).expect(409);

    for (let checkpoint = 2; checkpoint <= 30; checkpoint += 1) {
      const { submitted } = await answerNext();
      assert.equal(submitted.body.attempt.checkpoint, checkpoint);
      assert.equal(submitted.body.attempt.score, checkpoint * 100);
      if (checkpoint === 5) assert.equal(submitted.body.attempt.obstacle, 'Cross the Broken Bridge');
      if (checkpoint === 10) assert.equal(submitted.body.attempt.obstacle, 'Dark Forest');
      if (checkpoint === 15) assert.equal(submitted.body.attempt.obstacle, 'Hidden Cave');
      if (checkpoint === 20) assert.equal(submitted.body.attempt.obstacle, 'Waterfall Crossing');
      if (checkpoint === 25) assert.equal(submitted.body.attempt.obstacle, 'Ancient Gate');
    }
    const state = await playerAgent.get('/api/game/state').expect(200);
    assert.equal(state.body.attempt.status, 'completed');
    assert.equal(state.body.attempt.checkpoint, 30);
    assert.equal(state.body.attempt.score, 3000);
    assert.equal(state.body.attempt.lives, 3);
    assert.equal(state.body.results[0].result, 'completed');
    assert.equal(db.prepare('SELECT achievement_name FROM achievements').get().achievement_name, 'Jungle Champion');
  });

  it('takes one life for each wrong answer, ends after three, and starts a fresh attempt on restart', async () => {
    await registerAndLogin();
    await startAttempt();
    for (const remaining of [2, 1, 0]) {
      const { submitted } = await answerNext(4);
      assert.equal(submitted.body.attempt.lives, remaining);
      assert.equal(submitted.body.attempt.score, 0);
    }
    const state = (await playerAgent.get('/api/game/state').expect(200)).body.attempt;
    assert.equal(state.status, 'game_over');
    await playerAgent.get('/api/game/puzzle').expect(409);
    const restarted = await startAttempt();
    assert.equal(restarted.body.attempt.checkpoint, 0);
    assert.equal(restarted.body.attempt.lives, 3);
    assert.equal(restarted.body.attempt.score, 0);
  });

  it('supports an explicit offline sample and returns a retryable service error without losing a life', async () => {
    await registerAndLogin();
    await startAttempt();
    const offline = await playerAgent.get('/api/game/puzzle?mode=offline').expect(200);
    assert.equal(offline.body.source, 'offline');
    assert.match(offline.body.imageUrl, /^data:image\/svg\+xml,/);
    await playerAgent.post('/api/game/puzzle/discard').set('X-CSRF-Token', csrf).send({}).expect(200);
    const livesBefore = (await playerAgent.get('/api/game/state')).body.attempt.lives;
    const brokenApp = createApp({ db, getPuzzle: async () => { throw new Error('network is down'); }, sessionSecret: 'test-secret-with-more-than-thirty-two-characters' });
    const brokenAgent = request.agent(brokenApp);
    const newCsrf = (await brokenAgent.get('/api/session')).body.csrfToken;
    const login = await brokenAgent.post('/api/auth/login').set('X-CSRF-Token', newCsrf).send({ username: 'jungle_fox', password: 'StrongPass123' }).expect(200);
    await brokenAgent.get('/api/game/puzzle').expect(503);
    assert.equal((await playerAgent.get('/api/game/state')).body.attempt.lives, livesBefore);
    assert.ok(login.body.csrfToken);
    assert.ok(getOfflinePuzzle().solution >= 2);
  });

  it('isolates another player’s puzzle and ignores client-supplied score changes', async () => {
    await registerAndLogin();
    await startAttempt();
    const issued = await playerAgent.get('/api/game/puzzle').expect(200);
    const otherAgent = request.agent(app);
    const otherCsrf = await registerAndLogin(otherAgent, 'other_explorer');
    await startAttempt(otherAgent, otherCsrf);
    await otherAgent.post('/api/game/answer').set('X-CSRF-Token', otherCsrf).send({ puzzleId: issued.body.puzzleId, answer: 5, score: 999999 }).expect(404);
    const otherState = await otherAgent.get('/api/game/state').expect(200);
    assert.equal(otherState.body.attempt.score, 0);
    assert.equal(otherState.body.attempt.checkpoint, 0);
  });
});

describe('Banana API adapter', () => {
  it('validates the documented puzzle response and rejects unsafe image hosts', async () => {
    const valid = createBananaService({ fetchImpl: async () => ({ ok: true, json: async () => ({ question: puzzle.imageUrl, solution: '5' }) }) });
    assert.deepEqual(await valid(), puzzle);
    const unsafe = createBananaService({ fetchImpl: async () => ({ ok: true, json: async () => ({ question: 'https://example.com/puzzle.png', solution: 5 }) }) });
    await assert.rejects(unsafe, /unsafe puzzle image URL/);
    const invalid = createBananaService({ fetchImpl: async () => ({ ok: true, json: async () => ({ question: puzzle.imageUrl, solution: 'many' }) }) });
    await assert.rejects(invalid, /unexpected puzzle format/);
  });
});