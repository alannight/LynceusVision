# LynceusVision — Dorking Studio Audit

## Scope

This audit verifies the actual Dorking Studio implementation in code and compares it to the expected functionality described in the project requirements and the repository documentation.

## Evidence reviewed

- UI entry point: [frontend/src/app/page.tsx](../../frontend/src/app/page.tsx)
- Navigation button: [frontend/src/components/Header.tsx](../../frontend/src/components/Header.tsx)
- Main Dorking component: [frontend/src/components/DorkingStudio.tsx](../../frontend/src/components/DorkingStudio.tsx)
- Query builder: [frontend/src/lib/search-query-builder.ts](../../frontend/src/lib/search-query-builder.ts)
- Search query types: [frontend/src/types/search.ts](../../frontend/src/types/search.ts)
- Persistence model: [backend/app/models/models.py](../../backend/app/models/models.py)
- API endpoints: [backend/app/api/v1/search_queries.py](../../backend/app/api/v1/search_queries.py)
- Documentation: [docs/DORKING_STUDIO.md](../DORKING_STUDIO.md)

## F.1 Navigation and UI status

### Verified

- The Dorking Studio tab exists in the global header: [frontend/src/components/Header.tsx](../../frontend/src/components/Header.tsx)
- The page is reachable from the main app via `activeTab === "dorking"`: [frontend/src/app/page.tsx](../../frontend/src/app/page.tsx)
- The page includes major controls: search title, keywords, provider selector, site filters, document filters, keyword logic, date filters, live preview, raw mode, copy/open/save actions.

### Partial or broken

- The component has a React hook ordering bug that is flagged by ESLint. The root cause is that `useEffect` references `updateQuery` and helper functions before their declarations inside the same component.
- The raw-query editing flow exists, but the builder does not reliably maintain the distinction between user-edited raw queries and structured builder state; it can be overwritten when filters change.

### Verdict

Status: PARTIAL.

## F.2 Search-provider registry

The provider registry in [frontend/src/lib/search-query-builder.ts](../../frontend/src/lib/search-query-builder.ts) includes:

- google
- bing
- duckduckgo
- brave

The file also defines provider metadata including search URLs, supported operators, and grouping support.

### Observed behavior

- The builder defines provider-specific support arrays and generates URLs using `encodeURIComponent`.
- This is a browser-side query composition layer only.
- The app does not fetch real search results through a backend API.
- There is no provider backend integration; opening a search in a browser is not the same as retrieving results through the application.

### Verdict

Status: PARTIAL. The provider registry exists, but it is not a real search-result retrieval system.

## F.3 Filter and operator logic

The following expected features are partially represented in the builder but not fully implemented or validated:

- site restrictions: implemented
- document type filters: implemented
- keyword operators: implemented at a basic level
- exact phrases: implemented
- exclusion terms: implemented
- date filters: implemented
- page attributes: implemented
- advanced operator scaffolding: partly present

### Gaps and unsupported semantics

- `termGroups` exist in the type definitions and logic, but the UI does not populate or validate them meaningfully.
- `AROUND(n)` is modeled in the builder but not clearly supported across providers.
- `related:`, `cache:`, `ext:` support is minimal and not robustly validated.
- `allintitle`, `allinurl`, `allintext` appear in the provider metadata but the UI does not expose these fields comprehensively.
- Custom provider-specific rules are not enforced in a strict way.

### Verdict

Status: PARTIAL. The code contains operator scaffolding, but the complete semantics required for reliable search construction are not implemented.

## F.4 Optional filter semantics

The code attempts to satisfy the optional-filter philosophy; the builder only adds filters when present. However, real correctness is not fully established because:

- filter state is assembled from multiple local states and can be overwritten unexpectedly
- validation does not enforce nuanced semantic differences between OR groups and AND grouping in a provider-aware way
- empty queries are guarded in `buildQuery()`, but there is no broader validation framework covering all cases

### Verdict

Status: PARTIAL.

## F.5 Query builder correctness

The builder implements the following outputs:

- keyword-only queries
- site filter queries
- document-type filter queries
- with OR grouping for multiple domains and types
- exclusion terms
- exact phrases

The critical issue is not whether the code attempts these cases; it is whether the semantics are provider-correct and fully consistent. The builder is not yet robust enough to claim correctness for all required cases.

### Required semantic cases from the specification

| Case | Status |
|---|---|
| Keyword only | PARTIAL |
| One site | PARTIAL |
| Multiple sites OR | PARTIAL |
| Document type | PARTIAL |
| Multiple document types OR | PARTIAL |
| Exact phrase + location | PARTIAL |
| OR keyword group + AND location | PARTIAL |
| Excluded terms | PARTIAL |
| Combined site + file filters | PARTIAL |
| Empty query validation | PASS |
| Unicode/special characters | NOT TESTED |
| Raw query override | PARTIAL |

### Key issue

The builder is not covered by a dedicated frontend unit test suite. The repository does not contain the expected builder test file referenced by the README.

## F.6 Search-query persistence

The backend persists Dorking-style queries in a dedicated table and route layer:

- model: [backend/app/models/models.py](../../backend/app/models/models.py)
- router: [backend/app/api/v1/search_queries.py](../../backend/app/api/v1/search_queries.py)

This includes:

- `title`
- `query_text`
- `provider`
- `category`
- `structured_filters`
- `investigation_id`
- `status`
- `created_at` / `updated_at`

### Limitations

- No API tests verify these routes.
- The frontend does not show a query history or result-execution lifecycle in a thorough manner.
- There is no execution status or result retrieval layer tied to provider results.

### Verdict

Status: PARTIAL.

## Overall verdict for Dorking Studio

The Dorking Studio exists as a real UI and query-builder prototype, but it is not yet a reliable search-engine OSINT module. It is effectively a frontend query composer with persistence hooks, not a fully verified or provider-accurate search platform component.

Recommended next step: add parser-level and provider-aware unit tests before expanding the builder further.

---

Status: FOUNDATION PARTIAL / DORKING STUDIO PARTIAL
