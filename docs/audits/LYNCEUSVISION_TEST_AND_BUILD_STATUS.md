# LynceusVision — Test and Build Status

## Summary

The project has a working backend test suite and a successful frontend production build, but the frontend static linting fails on the Dorking Studio component. This means the current repository is partially verified but not fully operationally clean.

## Backend verification

### Command executed

```bash
cd "/home/night/Cyber Security/LynceusVision/backend" && ./.venv/bin/python -m pytest -q
```

### Result

- Status: PASS
- Exit: success
- Python: 3.14.7
- Pytest: 9.1.1
- Collected: 36 tests
- Passed: 36
- Failed: 0
- Warnings: 1 Pydantic deprecation warning in the Dorking Studio search query response model

### Coverage summary

- Total coverage: 81%
- Key modules covered: investigation API, entity API, collect API, connector logic, SSRF logic, persistence
- Notable gap: `search_queries.py` has 43% coverage and no dedicated endpoint tests

## Frontend verification

### TypeScript + ESLint command executed

```bash
cd "/home/night/Cyber Security/LynceusVision/frontend" && npx tsc --noEmit && npx eslint . --max-warnings=0
```

### Result

- Status: FAIL
- Cause: React hook ordering errors in the Dorking Studio component
- Key offending file: [frontend/src/components/DorkingStudio.tsx](../../frontend/src/components/DorkingStudio.tsx)
- Main issue: functions and `updateQuery` are used before declaration; this violates the React hooks dependency and declaration flow assumptions

### Evidence from output

The lint output reported errors including:

- `Cannot access variable before it is declared` at the `useEffect` block for `updateQuery`
- `Cannot access variable before it is declared` for `getSiteFilters`, `getDocumentFilters`, `getKeywordLogic`, and `getPageAttributes`
- `react-hooks/exhaustive-deps` warnings as a consequence

### Result interpretation

This is not a build blocker for Next.js production generation, but it is a real static code-quality failure in the current repository.

## Frontend production build

### Command executed

```bash
cd "/home/night/Cyber Security/LynceusVision/frontend" && npx next build
```

### Result

- Status: PASS
- Next.js: 16.4.0
- Output: Compiled successfully
- Static routes generated: `/` and `/_not-found`

### Important distinction

The application can build, but the repository’s lint/static verification still fails. Therefore, we cannot classify the frontend as “fully clean” or “MVP verified” based on build success alone.

## Local app runtime status

Runtime was not manually browser-validated as part of this baseline audit, because the instruction set prohibits unverified interactive verification unless browser tooling is available and safe. Since the repo was read-only and the audit focused on repository evidence, runtime UI verification remains at the code-level only.

## Test matrix

| Category | Status | Evidence |
|---|---|---|
| Backend unit/integration tests | PASS | `pytest -q` with 36 passed |
| SSRF security tests | PASS | backend tests include SSRF validation |
| Connector unit tests | PASS | mocked external provider responses |
| Persistence tests | PASS | relational lifecycle verified |
| Frontend TypeScript | PASS | `tsc --noEmit` executed but not the end state because ESLint fails |
| Frontend ESLint | FAIL | DorkingStudio hook ordering issue |
| Frontend production build | PASS | Next.js build completed successfully |
| Browser/manual UI verification | NOT TESTED | Not executed as part of the baseline audit |
| Real external provider verification | NOT TESTED | No live provider calls were executed |

## Final status

The project currently has verified backend correctness and a passing frontend build, but the frontend lint gate is presently red due to the Dorking Studio implementation issues.

---

Status: BACKEND VERIFIED / FRONTEND PARTIALLY VERIFIED
