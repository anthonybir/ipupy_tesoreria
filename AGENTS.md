# Repository Guidelines

## Project Structure & Module Organization
- Root offline build: `index.html` hosts the tesorero dashboard, `mobile.html` handles congregational input, and optional `server.py` + `ipupy_treasurer.db` persist shared data while timestamped uploads land in `uploads/`.
- Helper scripts: `start.sh` (workflow menu) and `test_codex.sh` (environment check) live at the top level for quick onboarding.
- Cloud deployment lives in `cloud-gateway/`: `api/` for serverless endpoints, `server.js` for the Node 18 Express gateway, `lib/db.js` for Postgres wiring, and `public/` for static assets including the legacy HTML.

## Build, Test, and Development Commands
- `bash start.sh`: guided launcher; option 1 opens the offline HTML in the default browser, option 2 boots the Python server.
- `python3 server.py`: initialize SQLite schema and serve `index.html` at `http://localhost:8000`.
- `npm install && npm run dev` (inside `cloud-gateway/`): install dependencies and run the Express gateway for API iteration.
- `npm start`: mimic production entry on Vercel using the same `server.js`.
- `bash test_codex.sh`: sanity-check Codex config, local SQLite artefacts, and the `mcp-sqlite` CLI.

## Coding Style & Naming Conventions
- HTML/CSS/JS in `index.html` and `mobile.html` use 4-space indentation; keep inline `<style>` blocks at the top and `<script>` logic consolidated at the end.
- JavaScript identifiers follow camelCase (`saveReport`, `loadDashboard`); preserve Spanish UI copy and storage keys to avoid breaking existing data.
- Python in `server.py` should follow PEP 8 (4 spaces, snake_case) and log concise messages.
- Node/Express code prefers `const` imports, 2-space indentation, and async-aware helpers that return JSON with explicit status codes.
- Database columns mirror snake_case names; add new fields through migrations rather than ad-hoc writes.

## Testing Guidelines
- Offline mode: reload `index.html`, clear `localStorage`, and recreate a sample church/report to validate dashboards, exports, and alerts.
- Python server: run `python3 server.py`, POST a dummy image to `/api/upload`, and verify the file appears in `uploads/` with a timestamped name.
- Vercel app: with `npm run dev`, call `curl http://localhost:3000/api/dashboard` to confirm aggregates and round-trip through `api/reports`.
- Document manual test scenarios in pull requests; no automated coverage exists yet, so regression risk is mitigated through checklist testing.

## Commit & Pull Request Guidelines
- Repository snapshots are often shared without `.git`; when using Git, adopt Conventional Commits (`feat:`, `fix:`, `chore:`) and keep the subject under 72 characters.
- Scope each commit to a single concern (e.g., `feat: add church export filters`) and detail schema or config updates in the body.
- Pull requests should include a purpose summary, manual test evidence (screenshots or command logs), notes about database changes, and rollout steps for both offline and Vercel deployments.
- Link tracking issues when available and request review from both frontend and backend maintainers when altering shared contracts.

## Data & Security Notes
- Do not commit populated databases, `.env*` files, or anything under `uploads/`; provide sanitized fixtures instead.
- Rotate JWT secrets and database URLs via environment variables before deploying to Vercel; ensure `JWT_SECRET` is at least 32 characters.
- When handling uploads, enforce the existing Multer size limit, scrub temporary files after export, and avoid storing sensitive receipts in version control.
