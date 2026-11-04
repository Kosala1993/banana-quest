# Version Control

## Repository workflow

Keep `main` for stable work. For a focused change, create a branch such as `feature/authentication`, `feature/banana-api`, `feature/game-world`, or `feature/testing`. Make small commits with messages that describe implemented behavior, for example `Add SQLite-backed player sessions`. Run `npm.cmd test` before merging. Review the diff and retain a clean working tree.

This is a proposed workflow, not evidence that branches, reviews, or collaboration occurred. Do not invent commit history for an assessment. If the workspace has no Git repository, initialize one with `git init`; inspect `git status` before adding files. Never commit `.env`, `node_modules`, or `data/`.

## Publishing to GitHub

Create an empty repository on GitHub, then add its URL as `origin`, check the branch name, and push the intended branch. For example, after replacing the URL:

```powershell
git remote add origin https://github.com/YOUR-NAME/banana-quest.git
git branch -M main
git push -u origin main
```

GitHub authentication is managed by Git Credential Manager or the user's configured SSH key; do not place a token in project files.

## Maintainability

Responsibilities are separated by folder: HTTP and game rules (`server/app.js`), schema (`server/database.js`), session persistence (`server/sessionStore.js`), provider integration (`server/bananaService.js`), browser event handling (`public/js/app.js`), and world geometry (`public/js/world.js`). This makes changes reviewable and helps a beginner locate behavior without a framework-wide abstraction.