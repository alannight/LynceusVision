# LynceusVision Remediation Report

Date: 2026-10-15

## Status by area

| Area | Status | Evidence / remaining condition |
|---|---|---|
| Dorking builder semantics | **PASS** | 22 query-builder tests pass; the direct repeated-keyword/site regression is covered. No live search was run. |
| Provider serialization and raw mode | **PASS WITH CONDITIONS** | Provider URLs and `q` round trips are tested; unlisted syntax is preserved and warned. Browser-level action flow was not run. |
| Authentication | **PASS WITH CONDITIONS** | Passwords use Argon2 and access tokens expire after 30 minutes. Registration is open and has no rate limiter yet. |
| Resource ownership | **PASS WITH CONDITIONS** | API operations scope investigations, their entities/observations, collect persistence, and saved queries to the token owner. Existing rows remain ownerless and inaccessible pending an explicit data-owner assignment. |
| Deployment configuration | **PASS WITH CONDITIONS** | Tracked Compose has no fixed database password, PostgreSQL has no default host port, and production omits reload. Compose ports bind to loopback; operators must supply strong secrets and deliberately configure any external reverse proxy. |
| SSRF controls | **PASS WITH CONDITIONS** | Private and non-global address classes are rejected; redirects are disabled and DNS lookup is asynchronous. Connections are not IP-pinned. RDAP redirects therefore return a provider error. |
| Response limits and timeouts | **PASS** | Streaming counts actual decoded bytes, applies a total timeout, closes the response on overflow, and never persists partial bodies. Unit tests cover body size without `Content-Length`. |
| Collect API behavior | **PASS** | Unknown IDs and empty selections return 422; inaccessible investigations are rejected before collection; persisted status is returned only after persistence work completes. |
| Backend tests and lint | **PASS** | 57 backend tests pass on Python 3.12.15; Ruff passes for `app`, `tests`, and `alembic`. Migrations 001–004 upgraded a fresh temporary SQLite database. |
| Frontend tests and static checks | **PASS** | `npm test`: TypeScript, ESLint, and 22 query-builder tests passed. |
| Frontend production build | **PASS WITH CONDITIONS** | `next build --webpack` completed, including TypeScript and static page generation. Default Turbopack could not bind its worker port in this environment. |
| Browser automation | **NOT TESTED** | No browser automation suite or browser session was available. |

## 1. Git baseline

- Repository: `/home/night/Cyber Security/LynceusVision`
- Baseline commit: `843639f New Update`
- At the start, these four frontend files already had uncommitted changes: `DorkingStudio.tsx`, `search-query-builder.ts`, `search-query-builder.test.mjs`, and `types/search.ts`. They were preserved and treated as user work. The current query changes build on their structured grouping and regression tests.
- No repository `AGENTS.md` was present. Existing audit and Dorking remediation documents were read and checked against current code.
- No reset or branch cleanup was performed. PANOPTILENS was not accessed.

## 2. Findings and root causes

### Dorking

The committed builder exposed a single `keywordLogic.operator` over all main keyword operands and folded explicit term groups into that same top-level OR. That model did not express whether OR belonged to keyword alternatives, sites, or file types. The UI also exposed a broad “operator between keywords” control rather than a distinct alternative-keyword group. Site and file ORs were serialized as separate filter groups, but the model did not make the intended scope explicit enough to prevent UI state from conflating alternatives.

The exact reported string is not reproduced by the simple baseline input of one keyword plus two sites. The confirmed defect was the ambiguous OR scope and the possibility of user state containing repeated main keyword operands; the remediation makes those scopes explicit and tests the reported shape directly.

### Backend and deployment

- Sensitive routes had no authentication and investigation/query records had no owner field or owner filter.
- Collect filtered unknown connector IDs away, treated an empty list like “all,” and silently skipped a missing investigation after the connectors ran.
- `raw_response` stored JSON made from normalized connector data; it was not a raw provider response.
- A response-size setting existed but connector code read bodies without enforcing it.
- SSRF code used synchronous DNS resolution. RDAP followed redirects after validation, but the HTTP client could resolve the name again at connection time.
- Compose contained a fixed database password, published PostgreSQL, and started the backend with reload.
- The former Google font imports required network access during frontend builds.

## 3. Files changed

- Auth, ownership, and API: `backend/app/security/auth.py`, `backend/app/api/v1/auth.py`, `backend/app/api/v1/__init__.py`, `backend/app/api/v1/investigations.py`, `backend/app/api/v1/entities.py`, `backend/app/api/v1/search_queries.py`, `backend/app/api/v1/collect.py`, `backend/app/main.py`, `backend/app/models/models.py`, `backend/app/schemas/schemas.py`, and `backend/app/alembic/env.py`.
- Connector safety and configuration: `backend/app/config.py`, `backend/app/security/ssrf.py`, `backend/app/security/__init__.py`, `backend/app/connectors/base.py`, `backend/app/connectors/{rdap,crtsh,wayback,dns_lookup,registry}.py`.
- Migrations and dependencies: `backend/alembic/versions/003_users_and_ownership.py`, `backend/alembic/versions/004_rename_normalized_snapshot.py`, `backend/requirements.txt`, and `backend/pyproject.toml`.
- Backend tests: `backend/tests/conftest.py`, `test_api_collect.py`, `test_api_investigations.py`, `test_api_search_queries.py`, `test_connectors.py`, `test_persistence.py`, `test_security_ssrf.py`, and new `test_response_limits.py`.
- Frontend auth and collect flow: `frontend/src/app/page.tsx`, `frontend/src/lib/api.ts`, `frontend/src/components/SearchSection.tsx`, and `frontend/src/types/index.ts`.
- Dorking and build: existing user changes in `DorkingStudio.tsx`, `search-query-builder.ts`, `search-query-builder.test.mjs`, and `types/search.ts` were retained; invalid raw syntax now prevents Copy/Save while preserving the raw text. `frontend/src/app/layout.tsx`, `globals.css`, and `frontend/Dockerfile` were updated for network-independent font and public API URL setup.
- Operations and documentation: `docker-compose.yml`, new `docker-compose.dev.yml`, `.env.example`, `README.md`, `docs/DORKING_STUDIO.md`, and this report.

## 4. Migrations and legacy records

- `003_users_and_ownership` creates `users` and adds nullable owner foreign keys to investigations and saved queries.
- Existing rows are retained with `owner_id = NULL`; they are intentionally not visible to any new account. An operator must decide and perform an explicit ownership assignment before those records can be accessed. No automatic first-user claim or cross-user default was introduced.
- `004_rename_normalized_snapshot` renames the old `raw_response` column to `normalized_snapshot`; existing contents are retained and the name now describes what was stored.
- Fresh SQLite upgrade through migration 004 succeeded. The migration chain was not exercised against a live PostgreSQL server in this environment.

## 5. Authentication and authorization

- Public `/api/v1/auth/register` and `/api/v1/auth/login` issue HS256 bearer tokens with 30-minute expiration. Passwords require 12–256 characters and are hashed with Argon2 through `pwdlib`.
- `APP_SECRET_KEY` has no production default and must be at least 32 characters. Development without an explicit key gets a process-local random signing key, so tokens expire on backend restart.
- Every non-auth `/api/v1` route requires a valid token. Investigation CRUD, child entity and observation operations, collect persistence, and saved-query CRUD enforce ownership in backend queries.
- Authentication uses an Authorization header rather than cookies, so CSRF cookie defenses are not needed. CORS is not used for authorization and credentials are disabled.
- Risk: registration and login are not rate-limited. Deployments exposed beyond a trusted local network should add edge rate limits and an account invitation/creation policy.

## 6. Deployment and secret handling

- Compose reads PostgreSQL and app signing secrets from environment; no tracked fixed DB password remains. PostgreSQL is on the internal Compose network and has no host port in the base config.
- Backend runs production mode and migrates before starting without `--reload`. Frontend and backend published ports bind to `127.0.0.1`.
- `docker-compose.dev.yml` is an explicit local override with a loopback PostgreSQL port and reload. `NEXT_PUBLIC_API_URL` is a browser-visible build argument, never a server secret.
- Production requires `APP_SECRET_KEY` and `DATABASE_URL`; config rejects missing/invalid DB settings rather than falling back to SQLite. Compose constructs the internal DB URL from `POSTGRES_PASSWORD`; use a URL-safe hex password.

## 7. SSRF, timeouts, and response limits

- Both IPv4 and IPv6 private, loopback, link-local, multicast, reserved, and non-global addresses are rejected, including IPv4-mapped IPv6. Async connector validation resolves through the event loop and has a five-second DNS timeout.
- Connector HTTP clients retain TLS verification, explicit connect/read timeouts, and disabled automatic redirects. RDAP no longer manually follows redirects because DNS pre-validation without connection pinning is vulnerable to rebinding; redirect responses become provider errors.
- Response bodies are consumed incrementally. The byte count applies to decoded chunks, not `Content-Length`; the configured cap defaults to 5 MiB and a 30-second total request timeout bounds trickle responses. An overflow closes the stream and yields `RESPONSE_TOO_LARGE` with no partial payload.
- Residual: upstream connections use trusted, fixed provider hostnames but the HTTP client does not pin resolved addresses to sockets. Do not introduce user-controlled outbound URL hosts or redirects until the transport can enforce a validated IP while preserving Host and TLS identity.

## 8. Collect API contract and provenance

- Missing/null connector list means all enabled connectors. An explicit empty list is 422. Unknown IDs are 422 before connector work.
- An investigation ID is checked for existence and ownership before any connector runs. A persistence-time missing investigation raises an error instead of returning a false success.
- Response field `collection_status` distinguishes complete collection from partial connector failure, while per-connector result statuses retain detail. `persistence_status` is `NOT_REQUESTED` or `SAVED`; save commits before returning `SAVED`. A commit failure returns HTTP 500 with `PERSISTENCE_FAILED` and cannot produce a false success.
- The database field is now `normalized_snapshot`; it stores the normalized JSON snapshot. The application does not claim to retain provider wire responses. Connector error details are retained as result provenance; provider auth secrets are not configured for these public connectors.

## 9. Dorking query examples

| Intent | Before / ambiguous shape | Canonical output now |
|---|---|---|
| One term, two sites | `KATA_KUNCI site:domain-a OR KATA_KUNCI site:domain-b` | `(site:domain-a.test OR site:domain-b.test) KATA_KUNCI` |
| One site, no keyword alternative | `KATA_KUNCI site:domain OR KATA_KUNCI` | `site:domain.test KATA_KUNCI` |
| Site with two file types | `keamanan informasi filetype:pdf OR filetype:docx` | `(filetype:pdf OR filetype:docx) keamanan informasi` with `site:` included as its own AND condition when selected |
| Site plus alternative terms | no distinct UI state for main vs alternative terms | `site:upnvj.ac.id (cybersecurity OR "keamanan siber")` |
| Exact phrase, terms, exclusions | filter order/scope was not explicit | `"incident response" "security operations center" -job -vacancy` |

The effective `queryText` supplies preview, Copy, Open URL serialization, and Save. Raw mode remains an independent text draft when switching modes or provider. Invalid raw input is surfaced; it is not rewritten. URL parameter encoding is applied once using each configured provider's parameter (`q` for all four current engines).

## 10. Provider operator matrix

The builder warns for operators not listed in provider documentation and preserves their text rather than changing semantics. Compatibility references are official help pages listed in [DORKING_STUDIO.md](../DORKING_STUDIO.md).

| Provider | Marked documented | Preserved with warning when not listed |
|---|---|---|
| Google | `site:`, `filetype:`, `after:`, `before:`, exact phrase, exclusion | `OR`/parentheses and page attributes |
| Bing | `site:`, `filetype:`, exact phrase, exclusion, `OR` and grouping | `after:`/`before:` and page attributes |
| DuckDuckGo | `site:`, `filetype:`, exact phrase, exclusion, `intitle:`, `inurl:` | `OR`/grouping and dates |
| Brave Search | `site:`, `filetype:`, exact phrase, exclusion, `OR`, `intitle:` | dates and `inurl:`; provider describes operator behavior as experimental |

This is query construction only. The app does not issue provider searches, scrape result pages, or claim that a generated query returned results.

## 11. Verification results

- Frontend: `npm test` passed; includes `tsc --noEmit`, ESLint, and 22 Node query tests.
- Backend: Python 3.12.15 with pinned project/test requirements; `PYTHONPATH=. python -m pytest -p no:cacheprovider` passed **57 tests**. The tests use synthetic/mock provider responses and do not do live OSINT queries.
- Backend lint: `ruff check app tests alembic` passed.
- Migration: Alembic upgrade 001–004 succeeded against a new temporary SQLite DB. No PostgreSQL service was used for migration validation.
- Frontend production: `next build --webpack` passed compile, TypeScript, and static-page generation. Turbopack failed to bind a worker port in the restricted environment; the successful Webpack run was made outside the sandbox. No Google Fonts network fetch is required now.
- Browser automation: **not run**; no browser test harness was available. Copy/Open/Save were checked through the shared query state and serializer tests, not a browser session.
- No live search or search-result scraping was performed.

## 12. Remaining risks

1. Existing ownerless records need a deliberate operator-led ownership mapping; the migration preserves them but they are inaccessible by default.
2. RDAP redirects are intentionally unsupported until connection pinning is available; lookup coverage may be lower for domains whose bootstrap service redirects.
3. Outbound HTTP destinations are fixed provider hosts, but their DNS resolution is not pinned at the transport layer. Keep redirect following disabled.
4. Public registration/login have no built-in rate limiting, email verification, or recovery workflow.
5. Browser-level regression, live PostgreSQL migration, and connector integration against provider services were not run.

## 13. Run instructions

- Docker production-style/local loopback: set `POSTGRES_PASSWORD` and `APP_SECRET_KEY` in `.env`, then `docker compose up --build`.
- Docker development with local PostgreSQL port: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build`.
- Backend development: Python 3.12; install `backend/requirements.txt` and `requirements-dev.txt`, set `DATABASE_URL` and `APP_SECRET_KEY`, run `alembic upgrade head`, then `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`.
- Backend tests from `backend/`: `PYTHONPATH=. python -m pytest -p no:cacheprovider`; lint: `ruff check app tests alembic`.
- Frontend from `frontend/`: `npm test`; production build verified with `./node_modules/.bin/next build --webpack`.
