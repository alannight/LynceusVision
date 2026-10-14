# LynceusVision — Remaining Work Priorities

## P0 — Blockers

### LV-RW-01: Fix frontend Dorking Studio hook-order and lint failure
- Problem: The Dorking Studio component contains function and hook ordering issues that fail ESLint and reduce confidence in the UI logic.
- Evidence: [frontend/src/components/DorkingStudio.tsx](../../frontend/src/components/DorkingStudio.tsx)
- Expected outcome: lint passes and hook-related state updates are stable and predictable.
- Dependencies: none beyond the existing frontend codebase.
- Acceptance criteria: `npx eslint . --max-warnings=0` exits successfully.
- Required tests: frontend lint + targeted Dorking component checks.

### LV-RW-02: Add explicit authentication and authorization controls
- Problem: The repository contains no application-level auth or authorization layer.
- Evidence: no auth code found in backend or frontend route handling.
- Expected outcome: role-based or basic access controls are defined if the app is meant to operate beyond local development.
- Dependencies: project security policy and deployment model.
- Acceptance criteria: API access model documented and enforced.
- Required tests: auth unit and integration tests.

### LV-RW-03: Clarify product scope against the README claims
- Problem: Several feature claims are described in README but absent from the repository.
- Evidence: [README.md](../../README.md), [docs/DORKING_STUDIO.md](../DORKING_STUDIO.md), and repository tree.
- Expected outcome: README, documentation, and code match the actual implementation.
- Dependencies: product roadmap and release scope decisions.
- Acceptance criteria: docs reflect current repo state and future roadmap is segmented clearly.
- Required tests: documentation review + repo consistency check.

## P1 — Foundation MVP

### LV-RW-04: Add robust Dorking Studio tests
- Problem: The query builder is implemented but not validated against the expected semantics.
- Evidence: [frontend/src/lib/search-query-builder.ts](../../frontend/src/lib/search-query-builder.ts)
- Expected outcome: query-generation tests cover keyword-only, site filtering, document types, exact phrases, Unicode, raw override, and empty query validation.
- Dependencies: Dorking builder refactor and rule decisions.
- Acceptance criteria: all required semantic cases are represented as automated tests.
- Required tests: frontend unit tests and provider-aware conversion tests.

### LV-RW-05: Add backend search-query API tests
- Problem: Search-query CRUD is implemented but not covered by automated tests.
- Evidence: [backend/app/api/v1/search_queries.py](../../backend/app/api/v1/search_queries.py)
- Expected outcome: create/list/get/update/delete flows are verified under the app test stack.
- Dependencies: existing FastAPI test infra.
- Acceptance criteria: at least one positive and one negative test per major endpoint.
- Required tests: backend API tests.

### LV-RW-06: Harden provider-specific query logic
- Problem: provider support metadata is declared, but semantics are not provider-accurate across Google/Bing/DuckDuckGo/Brave.
- Evidence: [frontend/src/lib/search-query-builder.ts](../../frontend/src/lib/search-query-builder.ts)
- Expected outcome: provider-specific operator compatibility is validated and warnings become explicit.
- Dependencies: query-builder semantics and UI controls.
- Acceptance criteria: unsupported operators are warned or suppressed clearly.
- Required tests: provider compatibility tests.

### LV-RW-07: Create real external verification plan for connectors
- Problem: All current connector tests are mocked; no live network verification was performed.
- Evidence: [backend/tests/test_connectors.py](../../backend/tests/test_connectors.py)
- Expected outcome: providers are tested with controlled, safe, non-destructive live checks or documented non-live verification limits.
- Dependencies: network access policy and external provider rules.
- Acceptance criteria: provider behavior and failure modes are documented and reproducible.
- Required tests: mocked + live integration tests as allowed.

## P2 — Functional improvements

### LV-RW-08: Add richer search presets and category logic
- Problem: The UI has search categories and presets, but the builder does not fully implement advanced preset semantics.
- Evidence: [frontend/src/components/DorkingStudio.tsx](../../frontend/src/components/DorkingStudio.tsx)
- Expected outcome: usernames, person names, organizations, and location-based presets produce sensible search strings.
- Dependencies: query-builder semantics.
- Acceptance criteria: preset examples generate valid queries and preserve user overrides.
- Required tests: preset-generation tests.

### LV-RW-09: Improve search-result execution model
- Problem: The project only opens browser searches; it does not fetch and store search results.
- Evidence: Dorking Studio builder and API do not fetch actual provider results.
- Expected outcome: a clear distinction between query generation and search-result retrieval is enforced in both UI and backend.
- Dependencies: data models and result storage design.
- Acceptance criteria: result retrieval is optional, explicit, and separately modeled.
- Required tests: architecture and API tests.

### LV-RW-10: Expand documentation and operational runbooks
- Problem: Missing architecture and roadmap documentation reduces maintainability.
- Evidence: missing docs in repository tree.
- Expected outcome: project docs cover architecture, deployment, security, and roadmap status.
- Dependencies: product strategy and architecture decisions.
- Acceptance criteria: docs match code and are updated with release status.
- Required tests: documentation review.

## P3 — Future modules

### LV-RW-11: Build the planned additional connectors
- Target: Shodan, VirusTotal, Censys, Hunt.io, etc.
- Expected outcome: connector registry, API, UI, and provenance models mature to a broader OSINT platform.

### LV-RW-12: Add correlation and evidence graph workflows
- Target: knowledge graph, entity correlation, timeline views, and reporting automation.
- Expected outcome: evidence becomes better connected and easier to analyze in investigations.

### LV-RW-13: Add deployment hardening and operational controls
- Target: access control, observability, backup/recovery, deployment checks, and security review for external data sources.
- Expected outcome: the project becomes deployable beyond local prototype use.

## Suggested implementation order

1. Fix DorkingStudio lint and state-management errors.
2. Add Dorking Studio provider-and-query tests.
3. Add backend search-query tests.
4. Clarify docs and product claims.
5. Implement auth and deployment rules.
6. Expand connectors and result retrieval workflows.

---

Status: HIGH-PRIORITY FOUNDATION SHORE-UP REQUIRED
