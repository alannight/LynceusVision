# LynceusVision — Current State Audit

## Executive summary

The repository is in a clean Git state and contains a real but partial foundation of a FastAPI + SQLAlchemy + Next.js OSINT platform. The project has working prosecution of the core investigation workflow, connectors, and persistence tests, but the Dorking Studio and several claims in the public documentation are not yet fully aligned with the actual repository state.

## Repository baseline

- Git status: clean, branch `main`, no tracked or untracked changes at audit time.
- Recent history: last three commits include `Update fitur pencarian (Dorking)`, `Update baru`, and the repository initialization commit.
- Root structure includes the backend, frontend, docs, Docker Compose, and a local `.env` file that is git-ignored.
- README documents a Dorking Studio as implemented, but the repository currently contains only one doc file in `docs/` and no `AGENTS.md`, `ARCHITECTURE.md`, `ROADMAP.md`, or prior foundation audit files.

## Actual architecture

### Backend

- App entry point: [backend/app/main.py](../../backend/app/main.py)
- API routers: [backend/app/api/v1/__init__.py](../../backend/app/api/v1/__init__.py)
- Settings and env validation: [backend/app/config.py](../../backend/app/config.py)
- Database session and engine: [backend/app/database.py](../../backend/app/database.py)
- Models: [backend/app/models/models.py](../../backend/app/models/models.py)
- Connector registry: [backend/app/connectors/registry.py](../../backend/app/connectors/registry.py)

### Frontend

- App home: [frontend/src/app/page.tsx](../../frontend/src/app/page.tsx)
- Header nav with Dorking button: [frontend/src/components/Header.tsx](../../frontend/src/components/Header.tsx)
- Dorking page component: [frontend/src/components/DorkingStudio.tsx](../../frontend/src/components/DorkingStudio.tsx)
- Query builder logic: [frontend/src/lib/search-query-builder.ts](../../frontend/src/lib/search-query-builder.ts)
- API client: [frontend/src/lib/api.ts](../../frontend/src/lib/api.ts)

## What is implemented and verified

### Backend API and workflows

The backend includes working CRUD routes for investigations, entities, and observations:

- [backend/app/api/v1/investigations.py](../../backend/app/api/v1/investigations.py)
- [backend/app/api/v1/entities.py](../../backend/app/api/v1/entities.py)
- [backend/app/api/v1/collect.py](../../backend/app/api/v1/collect.py)
- [backend/app/api/v1/sources.py](../../backend/app/api/v1/sources.py)

These endpoints support:

- Create and list investigations
- Create entities within investigations
- Persist connector observations with source attribution
- Collect against configured connectors
- Save connector results to an investigation

### Persistence model

The actual ORM layer has the expected foundation models:

- `Investigation`
- `Entity`
- `Observation`
- `Source`
- `SearchQuery`

Evidence: [backend/app/models/models.py](../../backend/app/models/models.py)

Migrations exist for the initial schema and the Dorking Studio search query table:

- [backend/alembic/versions/001_initial_schema.py](../../backend/alembic/versions/001_initial_schema.py)
- [backend/alembic/versions/002_add_search_queries.py](../../backend/alembic/versions/002_add_search_queries.py)

### Connectors

The connector registry currently contains four connectors:

- RDAP: [backend/app/connectors/rdap.py](../../backend/app/connectors/rdap.py)
- DNS: [backend/app/connectors/dns_lookup.py](../../backend/app/connectors/dns_lookup.py)
- crt.sh CT: [backend/app/connectors/crtsh.py](../../backend/app/connectors/crtsh.py)
- Wayback: [backend/app/connectors/wayback.py](../../backend/app/connectors/wayback.py)

The registry is wired in [backend/app/connectors/registry.py](../../backend/app/connectors/registry.py).

### SSRF protections

The project does implement SSRF blocking and domain validation in [backend/app/security/ssrf.py](../../backend/app/security/ssrf.py). This is a substantive feature and is not just a stub.

## What is only partially implemented

- Dorking Studio is present, but it is not a full provider-accurate query engine.
- The UI exists but the frontend lint reveals a hook-order bug in [frontend/src/components/DorkingStudio.tsx](../../frontend/src/components/DorkingStudio.tsx).
- The backend includes `search_queries` CRUD but there are no dedicated tests for those endpoints.
- The README references more docs and architecture files that are absent from the repository.
- The code uses a local `.env` with database settings but no formal app-level authentication or authorization implementation.

## What is documented but absent

The following items are described in the README but not currently present in the repository:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/FOUNDATION_AUDIT.md`
- Shodan, VirusTotal, Hunter.io, and Censys connectors
- Knowledge graph, timeline, and reporting modules

Observed evidence: `docs/` currently contains only [docs/DORKING_STUDIO.md](../DORKING_STUDIO.md).

## What exists in code but is not connected to UI/backend

- The Dorking Studio builder logic exists in the frontend and is wired to the app, but it does not implement the required provider-accurate semantics for all expected operators.
- Some advanced operator concepts are included in types and builder code, but there is no actual backend search-result retrieval or provider API integration.
- There is no real search execution engine behind the UI; the app opens a browser URL based on the query rather than fetching provider results through the backend.

## Findings summary

| ID | Severity | Finding | Status |
|---|---|---|---|
| LV-001 | High | Backend investigation/entity/collect flow is working and persistence is verified. | PASS |
| LV-002 | Medium | Search-query persistence exists but endpoint coverage is limited and untested. | PARTIAL |
| LV-003 | High | Dorking Studio UI exists but query builder semantics are incomplete and not provider-accurate. | PARTIAL |
| LV-004 | Medium | Frontend static checks fail due React hook ordering in DorkingStudio component. | FAIL |
| LV-005 | Medium | README claims documents that are absent from the repo. | NOT IMPLEMENTED |
| LV-006 | High | Search results are opened in a browser but not retrieved through the backend. | PARTIAL |
| LV-007 | Medium | No app authentication or authorization layer is present. | NOT IMPLEMENTED |
| LV-008 | Low | Several planned OSINT connectors are absent. | NOT IMPLEMENTED |
| LV-009 | Low | No explicit user-facing verification of live external connector behavior against real providers. | NOT TESTED |

## Overall assessment

This is not a greenfield empty repo; it is a functioning foundation with evidence-backed backend workflows and a more ambitious Dorking Studio prototype. It is not yet a reliable Foundation MVP, and it is not yet sufficiently complete to be called operationally ready for controlled use.

---

Status: FOUNDATION PARTIAL
