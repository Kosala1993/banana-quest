# Virtual Identity

## Registration and authentication

The registration endpoint validates usernames, email addresses, and password length. SQLite unique constraints prevent duplicate usernames and emails even if concurrent requests race. Passwords are hashed with bcryptjs before storage; the database contains no plaintext password. Login checks the hash and returns the player's public ID and username, not the hash.

## Sessions and cookies

The app uses `express-session` with a project-owned SQLite store. A successful login regenerates the session ID to reduce session-fixation risk. The cookie is HTTP-only, `SameSite=Strict`, and expires after 12 hours. Production mode marks it `Secure`, so production must use HTTPS. Logout destroys the server-side session and clears the cookie.

## Request protection

State-changing requests require a session CSRF token in a custom header. The cookie's same-site policy and the absence of cross-origin access are additional protections. Registration and login endpoints are rate-limited. Protected APIs check the authenticated player, and every puzzle/attempt query is scoped to that player.

The browser receives no puzzle solution. Scores and checkpoint values supplied by the browser are ignored. Input constraints are repeated on the server and SQL is parameterized.

## Limitations and alternatives

This is a local coursework system, not a security-reviewed production identity provider. It does not include email verification, password reset, account deletion, multi-factor authentication, or an account lockout workflow. For a public service, consider a mature identity provider, HTTPS deployment, operational session cleanup, audit logging, and independent security review. A signed stateless token was not selected because revocable server sessions and logout are explicit assignment goals.