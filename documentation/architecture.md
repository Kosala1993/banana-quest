# Architecture

## Components

The browser loads the static `public/` application from Express. `public/js/app.js` handles interface events and calls JSON endpoints; `public/js/world.js` maps checkpoint numbers to locations in a single 3,000-unit SVG panorama. The browser never decides whether an answer is correct or calculates an authoritative score.

`server/app.js` is the HTTP boundary. It validates inputs, checks the authenticated session and CSRF token, calls the Banana adapter, and applies game rules. `server/database.js` defines and opens SQLite. The puzzle adapter is injected into the app factory, making external requests replaceable in tests without changing route logic.

## Data flow

1. An unauthenticated browser obtains a CSRF token and submits registration or login over HTTP JSON.
2. Express verifies the account and stores a user ID in a regenerated, SQLite-backed session.
3. The authenticated client requests a puzzle. The server fetches an image and solution from Banana, persists both, and returns only a puzzle ID and image URL.
4. On answer submission, the server finds the puzzle by its ID and current player's attempt, rejects reuse, compares the answer, and updates lives, score, status, and checkpoint in one SQLite transaction.
5. The client animates to the returned checkpoint. Completed and failed attempts are recorded in `game_results`; a win also awards the Jungle Champion achievement.

## Database

`users`, `game_attempts`, `puzzles`, `game_results`, and `achievements` are normalized around foreign keys. `quest_sessions` stores serialized `express-session` data and expiry in the same SQLite database. SQL uses prepared statements; user-owned data queries include the authenticated user ID. SQLite foreign-key enforcement is enabled.

## Distributed architecture

The system has a browser frontend, an HTTP application server, a persistent database, and an independently operated Banana web service. In this coursework version the browser, app, and database are local components, while the puzzle service is external. They communicate through browser HTTP/JSON and server-to-server HTTP/JSON boundaries. The application is not deployed as a multi-host production system.

## Trust and failure boundaries

The browser can be modified by a player, so it sends neither trusted scores nor trusted progress. The server keeps solutions private, validates single-use puzzle IDs, and derives all state. If Banana fails or its response is malformed, the route returns HTTP 503; no life is changed. Offline addition puzzles are a separate labelled provider. Production requires a long session secret and uses secure cookies over HTTPS.

## Main files

- `server/app.js`: application factory and REST routes.
- `server/database.js`: schema and SQLite configuration.
- `server/sessionStore.js`: persistent session adapter.
- `server/bananaService.js`: external service and offline mode.
- `public/js/app.js`: browser event handlers and API calls.
- `public/js/world.js`: checkpoint-to-position map and camera-follow effects.