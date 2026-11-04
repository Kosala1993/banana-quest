# Interoperability

The server calls the documented Banana API endpoint `https://marcconrad.com/uob/banana/api.php` using Node's Fetch API. The official documentation and endpoint were checked during implementation: the JSON response contains `question` (an image URL) and `solution` (a number). The documented response example hosts the image on `www.sanfoh.com`, so the adapter accepts HTTPS images from `sanfoh.com` or `marcconrad.com` and their subdomains, and uses an eight-second timeout.

Puzzle and solution handling stays on the server. A puzzle receives a random UUID and is associated with the current attempt in SQLite. The browser receives the UUID, image URL, and a source label. On submission, the server checks ownership, one-use status, and answer before changing the game state.

Unavailable HTTP service, invalid JSON, unexpected fields, and unsafe image URLs lead to a friendly HTTP 503 response. The route does not subtract a life. A player can explicitly switch to the locally generated sample provider; the client labels it as offline, and changing sources clears an unanswered puzzle. Tests inject a fake provider and do not depend on network availability.

This adapter is a small anti-corruption layer: provider-specific response fields do not leak into game rules. Alternatives include caching API puzzles or using a queue for retries, but neither is needed for a single-user local game. The sample provider is deliberately separate and never described as Banana content.

Source: [Banana API documentation](https://marcconrad.com/uob/banana/doc.php), [Banana API endpoint](https://marcconrad.com/uob/banana/api.php). The documentation states that the service is provided as-is, may be discontinued, and must not be used for commercial applications. External API availability and image format are outside this project's control.