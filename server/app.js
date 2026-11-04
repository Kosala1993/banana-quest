import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './database.js';
import { createBananaService, getOfflinePuzzle } from './bananaService.js';
import { SQLiteSessionStore } from './sessionStore.js';

const OBSTACLES = ['Climb the Mountain', 'Cross the Broken Bridge', 'Dark Forest', 'Hidden Cave', 'Waterfall Crossing', 'Ancient Gate'];
const here = path.dirname(fileURLToPath(import.meta.url));

function sendError(response, status, message) { return response.status(status).json({ error: message }); }

export function createApp({ db = createDatabase(), getPuzzle = createBananaService(), sessionSecret = process.env.SESSION_SECRET || 'local-development-secret-change-before-deployment' } = {}) {
  if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
    throw new Error('Production requires a SESSION_SECRET with at least 32 characters.');
  }
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { imgSrc: ["'self'", 'data:', 'https://marcconrad.com', 'https://sanfoh.com', 'https://www.sanfoh.com'], styleSrc: ["'self'", 'https://fonts.googleapis.com'], styleSrcAttr: ["'unsafe-inline'"], fontSrc: ["'self'", 'https://fonts.gstatic.com'], scriptSrc: ["'self'"] } } }));
  app.use(express.json({ limit: '10kb' }));
  app.use(session({
    name: 'banana.quest', secret: sessionSecret, store: new SQLiteSessionStore(db), resave: false,
    saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 12 }
  }));
  app.use(express.static(path.join(here, '..', 'public')));

  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: process.env.NODE_ENV === 'test' ? 1000 : 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Please wait a few minutes and try again.' } });
  const requirePlayer = (request, response, next) => request.session.user ? next() : sendError(response, 401, 'Please log in to continue.');
  const requireCsrf = (request, response, next) => {
    if (request.session.csrfToken && request.get('x-csrf-token') === request.session.csrfToken) return next();
    return sendError(response, 403, 'Your session expired. Refresh the page and try again.');
  };

  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
  app.get('/api/session', (request, response) => {
    request.session.csrfToken ||= randomBytes(24).toString('hex');
    response.json({ csrfToken: request.session.csrfToken, user: request.session.user || null });
  });

  app.post('/api/auth/register', loginLimiter, requireCsrf, async (request, response) => {
    const { username, email, password } = request.body || {};
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) return sendError(response, 400, 'Username must be 3 to 20 letters, numbers, or underscores.');
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return sendError(response, 400, 'Enter a valid email address.');
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) return sendError(response, 400, 'Password must be between 8 and 72 characters.');
    try {
      const passwordHash = await bcrypt.hash(password, 12);
      db.prepare('INSERT INTO users(username, email, password_hash) VALUES(?, ?, ?)').run(username.trim(), email.trim(), passwordHash);
      return response.status(201).json({ message: 'Account created. Log in to begin your adventure.' });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return sendError(response, 409, 'That username or email is already registered.');
      return sendError(response, 500, 'We could not create your account. Please try again.');
    }
  });

  app.post('/api/auth/login', loginLimiter, requireCsrf, async (request, response, next) => {
    const { username, password } = request.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') return sendError(response, 400, 'Enter your username and password.');
    try {
      const player = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE').get(username.trim());
      if (!player || !(await bcrypt.compare(password, player.password_hash))) return sendError(response, 401, 'The username or password was not recognised.');
      request.session.regenerate(error => {
        if (error) return next(error);
        request.session.user = { id: player.id, username: player.username };
        request.session.csrfToken = randomBytes(24).toString('hex');
        request.session.save(saveError => saveError ? next(saveError) : response.json({ user: request.session.user, csrfToken: request.session.csrfToken }));
      });
    } catch (error) { next(error); }
  });

  app.post('/api/auth/logout', requirePlayer, requireCsrf, (request, response, next) => {
    request.session.destroy(error => {
      if (error) return next(error);
      response.clearCookie('banana.quest', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
      response.json({ message: 'You have logged out.' });
    });
  });

  const getLatestAttempt = userId => db.prepare('SELECT * FROM game_attempts WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
  const publicState = attempt => ({
    id: attempt.id,
    obstacleIndex: Math.min(5, Math.floor(attempt.correct_answers / 5)),
    obstacle: OBSTACLES[Math.min(5, Math.floor(attempt.correct_answers / 5))],
    checkpoint: attempt.current_checkpoint,
    correctAnswers: attempt.correct_answers,
    answersInObstacle: attempt.correct_answers === 30 ? 5 : attempt.correct_answers % 5,
    lives: attempt.lives_remaining,
    score: attempt.score,
    status: attempt.status
  });

  app.get('/api/game/state', requirePlayer, (request, response) => {
    const attempt = getLatestAttempt(request.session.user.id);
    const results = db.prepare('SELECT final_score AS score, result, completed_at AS completedAt FROM game_results WHERE user_id = ? ORDER BY id DESC LIMIT 10').all(request.session.user.id);
    response.json({ attempt: attempt ? publicState(attempt) : null, results });
  });

  app.get('/api/profile', requirePlayer, (request, response) => {
    const results = db.prepare('SELECT final_score AS score, result, completed_at AS completedAt FROM game_results WHERE user_id = ? ORDER BY id DESC').all(request.session.user.id);
    response.json({ user: request.session.user, results });
  });

  app.post('/api/game/start', requirePlayer, requireCsrf, (request, response) => {
    const result = db.prepare(`INSERT INTO game_attempts(user_id) VALUES(?)`).run(request.session.user.id);
    const attempt = db.prepare('SELECT * FROM game_attempts WHERE id = ?').get(result.lastInsertRowid);
    response.status(201).json({ attempt: publicState(attempt) });
  });

  app.post('/api/game/puzzle/discard', requirePlayer, requireCsrf, (request, response) => {
    const attempt = getLatestAttempt(request.session.user.id);
    if (!attempt || attempt.status !== 'active') return sendError(response, 409, 'There is no active adventure.');
    db.prepare('DELETE FROM puzzles WHERE attempt_id = ? AND answer_submitted = 0').run(attempt.id);
    response.json({ message: 'Unanswered puzzle cleared.' });
  });

  app.get('/api/game/puzzle', requirePlayer, async (request, response) => {
    const attempt = getLatestAttempt(request.session.user.id);
    if (!attempt || attempt.status !== 'active') return sendError(response, 409, 'Start or resume an active adventure first.');
    const pending = db.prepare('SELECT id, image_url FROM puzzles WHERE attempt_id = ? AND answer_submitted = 0 ORDER BY created_at DESC LIMIT 1').get(attempt.id);
    if (pending) return response.json({ puzzleId: pending.id, imageUrl: pending.image_url, source: pending.image_url.startsWith('data:') ? 'offline' : 'banana-api' });
    try {
      const offline = request.query.mode === 'offline';
      const puzzle = offline ? getOfflinePuzzle() : await getPuzzle();
      const puzzleId = randomUUID();
      db.prepare('INSERT INTO puzzles(id, attempt_id, image_url, solution) VALUES(?, ?, ?, ?)').run(puzzleId, attempt.id, puzzle.imageUrl, puzzle.solution);
      response.json({ puzzleId, imageUrl: puzzle.imageUrl, source: offline ? 'offline' : 'banana-api' });
    } catch {
      sendError(response, 503, 'The Banana puzzle service is unavailable. Retry in a moment, or choose Offline sample mode. No life was lost.');
    }
  });

  app.post('/api/game/answer', requirePlayer, requireCsrf, (request, response) => {
    const { puzzleId, answer } = request.body || {};
    if (typeof puzzleId !== 'string' || !Number.isInteger(answer) || answer < 0 || answer > 99) return sendError(response, 400, 'Enter a whole-number answer.');
    const attempt = getLatestAttempt(request.session.user.id);
    if (!attempt || attempt.status !== 'active') return sendError(response, 409, 'There is no active adventure.');
    const puzzle = db.prepare('SELECT * FROM puzzles WHERE id = ? AND attempt_id = ?').get(puzzleId, attempt.id);
    if (!puzzle) return sendError(response, 404, 'That puzzle does not belong to your current adventure.');
    if (puzzle.answer_submitted) return sendError(response, 409, 'This puzzle has already been answered.');

    const correct = answer === puzzle.solution;
    const nextCorrect = attempt.correct_answers + Number(correct);
    const nextLives = attempt.lives_remaining - Number(!correct);
    const status = nextLives === 0 ? 'game_over' : nextCorrect === 30 ? 'completed' : 'active';
    const transaction = db.transaction(() => {
      db.prepare('UPDATE puzzles SET answer_submitted = 1 WHERE id = ? AND answer_submitted = 0').run(puzzleId);
      db.prepare(`UPDATE game_attempts SET current_checkpoint = ?, correct_answers = ?, current_obstacle = ?, lives_remaining = ?, score = ?, status = ?, completed_at = CASE WHEN ? != 'active' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = ?`)
        .run(nextCorrect, nextCorrect, Math.min(5, Math.floor(nextCorrect / 5)), nextLives, attempt.score + Number(correct) * 100, status, status, attempt.id);
      if (status !== 'active') {
        db.prepare('INSERT INTO game_results(user_id, attempt_id, final_score, result) VALUES(?, ?, ?, ?)')
          .run(attempt.user_id, attempt.id, attempt.score + Number(correct) * 100, status);
      }
      if (status === 'completed') db.prepare('INSERT OR IGNORE INTO achievements(user_id, achievement_name) VALUES(?, ?)').run(attempt.user_id, 'Jungle Champion');
    });
    transaction();
    const updated = db.prepare('SELECT * FROM game_attempts WHERE id = ?').get(attempt.id);
    response.json({ correct, obstacleCompleted: correct && nextCorrect > 0 && nextCorrect % 5 === 0, attempt: publicState(updated), answerMessage: correct ? 'Correct! The explorer moves ahead.' : 'Not quite. One life has been used.' });
  });

  app.use('/api', (_request, response) => sendError(response, 404, 'That game service was not found.'));
  app.use((error, _request, response, _next) => {
    console.error(error);
    if (!response.headersSent) sendError(response, 500, 'Something went wrong. Please try again.');
  });
  return app;
}

const port = Number(process.env.PORT || 3000);
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createApp();
  app.listen(port, () => console.log(`Banana Quest listening on http://localhost:${port}`));
}

export default createApp;