# LynceusVision

**See Beyond the Surface.**

LynceusVision is a standalone OSINT investigation platform for collecting, normalizing, correlating, and analyzing legitimately accessible open-source intelligence with full source attribution and evidence traceability.

Named after Lynceus, the Argonaut legendary for superhuman sight.

---

## Project Status

| Layer | Status |
|---|---|
| Project foundation | ✅ Complete |
| Backend API (FastAPI) | ✅ Foundation MVP |
| Database (PostgreSQL + Alembic) | ✅ Foundation MVP |
| Frontend (Next.js 15 + Tailwind) | ✅ Foundation MVP |
| RDAP connector | ✅ Implemented |
| DNS lookup connector | ✅ Implemented |
| Certificate Transparency connector | ✅ Implemented |
| Wayback Machine connector | ✅ Implemented |
| Investigation workflow | ✅ End-to-end |
| **Dorking Studio** | ✅ **Implemented** |
| Shodan connector | 🔵 Planned |
| VirusTotal connector | 🔵 Planned |
| Hunter.io connector | 🔵 Planned |
| Censys connector | 🔵 Planned |
| Knowledge graph | 🔵 Planned |
| Timeline view | 🔵 Planned |
| Reporting engine | 🔵 Planned |
| Onion-source intelligence | 🔵 Planned (pending security review) |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Backend | Python 3.12, FastAPI, Pydantic v2 |
| ORM / Migrations | SQLAlchemy 2, Alembic |
| Primary Database | PostgreSQL 16 |
| Dev Fallback DB | SQLite (explicit, documented) |
| Container | Docker Compose |
| HTTP Client | httpx (async) |
| Testing | pytest, pytest-asyncio, httpx (test client) |
| Linting | ruff, mypy |
| Frontend testing | TypeScript, ESLint |

---

## Quick Start (Docker)

```bash
git clone <repo>
cd LynceusVision
cp .env.example .env
# Generate two unique values and put them in POSTGRES_PASSWORD and APP_SECRET_KEY in .env.
# Hex values are URL-safe for the database connection string.
openssl rand -hex 32
openssl rand -hex 32
docker compose up --build
```

- Frontend: http://localhost:3000 (loopback only)
- Backend API: http://localhost:8000 (loopback only)
- API docs: http://localhost:8000/docs
- Create an account from the sign-in page. Passwords must be at least 12 characters.
- Compose applies Alembic migrations before starting the API. PostgreSQL is not published to the host.

Compose requires `POSTGRES_PASSWORD` and `APP_SECRET_KEY`; production refuses to start without them. Set `CORS_ORIGINS` to the exact frontend origin when it differs from localhost. `NEXT_PUBLIC_API_URL` is a public browser URL compiled into the frontend. Never put server credentials there.

For local development with a loopback PostgreSQL port:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

---

## Local Development (no Docker)

### Prerequisites

- Node.js ≥ 20, npm ≥ 10
- Python ≥ 3.12
- PostgreSQL ≥ 14 running locally (or use the SQLite fallback for development)

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt  # for backend tests and lint
cp ../.env.example .env
# Set DATABASE_URL to the local PostgreSQL/SQLite database and set APP_SECRET_KEY.

# Run migrations (including Dorking Studio tables)
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp ../.env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
```

---

## Testing

```bash
# Backend tests
cd backend
source .venv/bin/activate
PYTHONPATH=. python -m pytest -p no:cacheprovider

# Frontend tests
cd frontend
npm test

# Type-check
cd frontend && npx tsc --noEmit
cd backend && mypy app/

# Lint
cd backend && ruff check app/ tests/
cd frontend && npm run lint
```

---

## Project Map

```
LynceusVision/
├── .env.example              # Secret placeholders — never commit real values
├── .gitignore
├── docker-compose.yml
├── AGENTS.md                 # Coding and security rules
├── README.md
├── docs/
│   ├── DORKING_STUDIO.md     # Dorking Studio documentation
│   ├── FOUNDATION_AUDIT.md   # Initial empty-state audit (historical)
│   ├── ARCHITECTURE.md       # System design and data model
│   └── ROADMAP.md            # Phased implementation plan
├── backend/
│   ├── alembic/              # Database migrations
│   ├── app/
│   │   ├── api/v1/           # Versioned API routes
│   │   │   └── search_queries.py  # Dorking Studio endpoints
│   │   ├── connectors/       # OSINT source connectors
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── services/         # Business logic
│   │   └── main.py           # FastAPI application entry point
│   ├── tests/
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── app/              # Next.js App Router pages
    │   ├── components/       # Shared UI components
    │   │   └── DorkingStudio.tsx  # Main query builder UI
    │   ├── lib/
    │   │   ├── search-query-builder.ts  # Core query construction
    │   │   └── search-query-builder.test.ts  # Unit tests
    │   └── types/
    │       └── search.ts     # TypeScript interfaces
    └── package.json
```

---

## Dorking Studio

**Search Engine OSINT Query Builder**

Dorking Studio is now available as a new module in LynceusVision. It provides advanced search engine query construction for OSINT investigations.

### Key Features
- **Visual Query Builder** - Construct complex search queries with multiple filters
- **Multiple Search Engines** - Google, Bing, DuckDuckGo, and Brave Search support
- **Flexible Filtering** - Optional site restrictions, document types, exclusions, exact phrases, and date ranges
- **Live Preview** - Real-time query generation with syntax validation
- **Investigation Integration** - Save effective query text and provider metadata to an investigation

### Usage
1. Navigate to **Dorking Studio** from the main sidebar
2. Enter keywords and select search engine
3. Apply optional filters (all filters are optional)
4. Review generated query in live preview
5. Copy query or open directly in browser
6. Save to investigation for future reference

### Search Operators Supported
- `site:` - Restrict to specific domains
- `filetype:` - Filter by document type
- `intitle:`, `inurl:` - Provider-dependent page attributes (compatibility warnings are shown)
- `after:`, `before:` - Date range filtering
- `-term` - Term exclusion
- `"exact phrase"` - Exact phrase matching
- Parentheses for OR grouping where provider syntax is documented; unverified syntax produces a warning

### Provider Compatibility
- **Google** - `site:`, `filetype:`, exact phrases, exclusions, and date operators documented; OR grouping is warned as unverified
- **Bing** - `site:`, `filetype:`, exact phrases, exclusions, OR, and grouping documented; date operators are warned as unverified
- **DuckDuckGo** - `site:`, `filetype:`, exact phrases, exclusions, `intitle:`, and `inurl:` documented; OR/date syntax is warned as unverified
- **Brave Search** - `site:`, `filetype:`, exact phrases, exclusions, `OR`, and `intitle:` are documented; date operators are warned as unverified and Brave describes operator behavior as experimental

See [DORKING_STUDIO.md](docs/DORKING_STUDIO.md) for detailed documentation. Dorking Studio opens provider search pages in the user's browser; it does not fetch or scrape results.

---

## Security Notes

- No API keys or secrets are committed. Use `.env` (not `.env.example`).
- All outbound connector requests use `httpx` with explicit timeouts.
- Sensitive API routes require a short-lived bearer token. Password hashes use Argon2; investigation and saved-query reads and writes are scoped to their owner.
- Legacy investigation data remains in place after migration but has no owner and is inaccessible to accounts until an operator explicitly assigns ownership.
- Connector requests have connect/read/total timeouts and a byte cap on streamed response bodies. Redirects are disabled; RDAP responses that redirect are provider errors until safe pinned redirect support is available.
- SSRF checks reject private, loopback, link-local, multicast, reserved, and non-global addresses, including IPv4-mapped IPv6. Connector destinations are fixed provider hosts; targets are validated before querying. The HTTP stack does not pin a DNS answer to a socket, so do not add user-controlled request destinations or redirects without connection pinning.
- Input is validated via Pydantic before reaching the database or any external service.
- Error responses are sanitized; internal stack traces are not returned to clients.
- Application logs record connector invocation summaries. This is not a tamper-resistant or complete audit log.

## Collect API and data status

- Omit `connectors` or send `null` to run all enabled connectors. An explicit empty list and unknown connector IDs return HTTP 422.
- When `save_to_investigation_id` is provided, the investigation must exist and belong to the signed-in account before collection starts.
- `collection_status` reports `COMPLETE` or `PARTIAL_FAILURE`, with per-connector statuses in `results`. `persistence_status` is `NOT_REQUESTED` or `SAVED`; a database commit failure returns HTTP 500 with `PERSISTENCE_FAILED`.
- Connector payloads stored by the app are normalized snapshots, not provider wire responses. `CONNECTOR_RESPONSE_MAX_BYTES` defaults to 5 MiB and is enforced while streaming.
- After upgrading existing databases, old investigation/query rows have no owner and remain inaccessible until an operator explicitly maps them to an account. The migration does not delete or automatically assign old data.

---

## Privacy and Legal Use

LynceusVision queries publicly accessible data sources only. Users are responsible for complying with applicable laws, terms of service, and privacy requirements in their jurisdiction. Do not use this tool to collect information on private individuals without appropriate legal authority.

**Dorking Studio Note**: This module only builds search queries. Execution happens in your browser via official search engine websites. No automatic searching, scraping, or result collection is performed by LynceusVision. Users are responsible for complying with search engine terms of service.
