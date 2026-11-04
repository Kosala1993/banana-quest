# Banana Quest: The Lost Jungle

A local, browser-based maths adventure for the CIS046-3 Software for Enterprise assignment. Players register an account, solve 30 puzzles, and travel through one horizontally scrolling world containing six connected obstacles. This project implements Level 1 only.

## Requirements

- Node.js 20 or newer (the project has been checked with Node 24)
- npm, included with Node.js
- Windows PowerShell and a browser

## Install and run on Windows

Open PowerShell in the project folder:

```powershell
npm.cmd install
Copy-Item .env.example .env
```

For local work, the example session secret works. Before deployment, replace it in `.env` with a random value of at least 32 characters. One way to create a value is:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Start the development server and open **http://localhost:3000**:

```powershell
npm.cmd run dev
```

For a normal local start, use `npm.cmd start`. Stop the server with Ctrl+C. The application creates its SQLite database and session table in `data/` on first run; that folder is excluded from Git.

PowerShell may block the `npm.ps1` shim due to its execution policy. The `npm.cmd` form used above works without changing that policy.

## Create an account and play

1. Select **Create your explorer**, enter a username, email, and password of at least eight characters, then submit.
2. Log in using the username and password.
3. Read the story and rules, then start the adventure. Returning players can continue an active attempt or start a fresh one.
4. Solve the puzzle shown. Correct answers move one checkpoint and add 100 points; wrong answers cost one of the three shared lives.
5. Complete five puzzles at each of the Mountain, Bridge, Forest, Cave, Waterfall, and Ancient Gate to finish Level 1. The maximum score is 3,000.
6. If the external Banana service is unavailable, the page offers a retry message and a distinct **offline sample** mode. The source is labelled in the game.

Use the profile control for saved results. Logging out destroys the server session.

## Technology and architecture

- Frontend: HTML, CSS, vanilla JavaScript modules, and an original inline SVG world.
- Backend: Node.js and Express REST endpoints.
- Persistence: SQLite through `better-sqlite3`; password hashes use `bcryptjs`.
- Identity: `express-session` with a custom SQLite session store, HTTP-only `SameSite=Strict` cookies, session regeneration at login, and CSRF tokens for state-changing requests.
- Interoperability: the backend retrieves puzzles from the Banana API; the answer stays in SQLite and is never sent to the browser.
- Tests: Node's built-in test runner and Supertest, with an injected fake Banana service.

The browser, Express application, SQLite database, and Banana API are separate architectural components. During local use they may run on one computer; this is a distributed design across processes/services, not a claim that the prototype is deployed across multiple machines.

## Commands

```powershell
npm.cmd install       # install dependencies
npm.cmd run dev       # start with Node's file watcher
npm.cmd start         # start normally
npm.cmd test          # run automated tests
npm.cmd run check     # syntax-check the server entry point
```

## Project map

```text
public/index.html          Welcome, account, introduction, game and results views
public/css/style.css       Responsive visual design and animations
public/js/app.js           UI events and REST client
public/js/world.js         Checkpoint positions, camera follow and world effects
server/app.js              Express routes, auth, sessions and game rules
server/database.js         SQLite schema and connection
server/sessionStore.js     SQLite-backed Express session store
server/bananaService.js    External API adapter and explicit offline sample provider
test/app.test.js           HTTP and integration tests
documentation/             Assignment-area and implementation notes
```

## Troubleshooting

- **`npm` is blocked:** use `npm.cmd` in PowerShell; do not weaken the machine's execution policy for this project.
- **Port 3000 is busy:** set `PORT=3001` in `.env`, restart, and open `http://localhost:3001`.
- **Banana image does not load:** check internet connectivity and try again. Or choose offline sample mode; it is not represented as a Banana API puzzle.
- **Forgotten test data:** delete `data/banana-quest.sqlite` only after stopping the server. This deletes all local player accounts and results.
- **Session/login problems:** stop the server and restart it. For a completely fresh local session store, remove the ignored database only if its data is no longer needed.

## Git workflow

Use a feature branch for a focused change, run `npm.cmd test`, and make a commit with a short, factual message. Suggested branches include `feature/authentication`, `feature/banana-api`, `feature/game-world`, and `feature/testing`. See [version-control.md](documentation/version-control.md). No GitHub remote is required to run the local project; publishing steps are described there.

## Assignment notes

The four marking themes are mapped in the documentation: [version control](documentation/version-control.md), [event-driven programming](documentation/events.md), [interoperability](documentation/interoperability.md), and [virtual identity](documentation/virtual-identity.md). Read [architecture](documentation/architecture.md), [testing](documentation/testing.md), and [sources and AI assistance](documentation/sources-and-ai.md) before presenting the project. Verify the current test output locally; test documentation must reflect the actual command run on the machine.