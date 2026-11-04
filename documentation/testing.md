# Testing

## Run

Install packages, then run:

```powershell
npm.cmd test
```

The Node built-in test runner and Supertest exercise the Express app without opening a listening port. Each integration test uses an in-memory SQLite database and an injected Banana provider, so tests do not depend on external network access.

## Covered scenarios

- Registration validation, duplicate users, login success/failure, password hashes, protected routes, and logout.
- CSRF rejection and player-specific puzzle ownership.
- New attempts, initial lives/checkpoint/score, untrusted client score fields, and resume through the persisted state endpoint.
- Private puzzle answers, successful and duplicate submissions, five-answer obstacle boundaries, and all 30 checkpoint transitions.
- Life loss, game over, restart, completed score/result, and Jungle Champion achievement.
- Explicit offline sample puzzles, Banana outage behavior, and adapter response/URL validation.

## Verified result

Verified in this checkout with `npm.cmd test`: 6 tests passed, 0 failed (Node test runner, 4 November 2026). The suite includes a full 30-checkpoint traversal. Browser layout and animation have not yet been covered by an automated browser test; a browser walkthrough remains a separate check.

## Known gaps

The suite verifies API and persistence behavior but does not automate keyboard, responsive visual, browser animation, real Banana-service availability, production HTTPS, or long-running session-expiry checks. Real API tests are intentionally not part of the default suite.