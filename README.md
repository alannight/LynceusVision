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
| Backend | Python 3.14, FastAPI, Pydantic v2 |
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
# Edit .env — fill in DATABASE_URL and any connector API keys
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

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
cp ../.env.example .env
# Edit .env — set DATABASE_URL

# Run migrations (including Dorking Studio tables)
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
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
pytest -v

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
- **Flexible Filtering** - Site restrictions, document types, date ranges, page attributes
- **Live Preview** - Real-time query generation with syntax validation
- **Investigation Integration** - Save queries to investigations with full provenance

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
- `intitle:`, `inurl:`, `intext:` - Page attribute search
- `after:`, `before:` - Date range filtering
- `-term` - Term exclusion
- `"exact phrase"` - Exact phrase matching
- Parentheses for grouping (Google only)

### Provider Compatibility
- **Google** - Full operator support with grouping
- **Bing** - Limited advanced operators
- **DuckDuckGo** - Simplified privacy-focused syntax
- **Brave Search** - Privacy-focused with Google-like syntax

See [DORKING_STUDIO.md](docs/DORKING_STUDIO.md) for detailed documentation.

---

## Security Notes

- No API keys or secrets are committed. Use `.env` (not `.env.example`).
- All outbound connector requests use `httpx` with explicit timeouts.
- SSRF mitigations validate targets against a private-IP blocklist before any request.
- Redirect following is disabled on connector requests.
- Input is validated via Pydantic before reaching the database or any external service.
- Error responses are sanitized; internal stack traces are not returned to clients.
- Audit logging is written for every connector invocation.

---

## Privacy and Legal Use

LynceusVision queries publicly accessible data sources only. Users are responsible for complying with applicable laws, terms of service, and privacy requirements in their jurisdiction. Do not use this tool to collect information on private individuals without appropriate legal authority.

**Dorking Studio Note**: This module only builds search queries. Execution happens in your browser via official search engine websites. No automatic searching, scraping, or result collection is performed by LynceusVision. Users are responsible for complying with search engine terms of service.