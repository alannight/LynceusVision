# LynceusVision Dorking Studio Remediation Report

Date: 2026-10-14

## 1. Root causes found

| Evidence in the pre-remediation implementation | Effect | Remediation |
|---|---|---|
| `frontend/src/lib/search-query-builder.ts`, `buildKeywords()` (formerly around lines 145–190) joined terms inside each `termGroup`, then combined those strings with the outer keyword operator without consistently grouping inner OR expressions. | A term-group OR could bind differently when mixed with outer AND logic. | Explicit keyword operands and nested groups now serialize independently. AND operands remain conjunctive; OR alternatives are parenthesized. |
| `buildSiteFilters()` (formerly around lines 195–220) OR-grouped every site filter, including exclusions. | `(-site:a OR -site:b)` can admit results from one of the excluded sites; it does not mean “exclude both.” | Included sites use an OR group; each excluded site is a separate negative constraint. Empty or malformed domains fail validation. |
| `escapeTerm()` escaped parentheses and quotation marks; date formatting accepted malformed values after `Date` conversion failed. | Query text could be changed, and invalid dates could pass through as if valid. | Input is preserved where valid; unbalanced syntax, bad domains/file types, invalid dates, and reversed date ranges are rejected. |
| Provider metadata asserted grouping/operator support more broadly than provider help pages supported. `validateQuery()` checked only that incomplete metadata. | Users received no reliable indication that provider syntax was unverified. | Provider registries now record documented operators conservatively. Unsupported or unverified syntax stays visible and gets a warning. |
| `buildSearchUrl()` (formerly around lines 380–405) manually concatenated an encoded string and used `query || buildQuery()`. | Empty raw text could silently fall back to builder output; URL construction and effective query could diverge. | `serialize()` creates a provider `URL`, sets `q` once with `URLSearchParams`, and preserves the explicitly supplied raw string. |
| `DorkingStudio.tsx` called effects before helper/callback declarations (formerly around lines 69–100), producing hook-order lint failures. The query effect reset raw text and builder/raw state was split between `queryText` and `rawQuery` (formerly around lines 190–230). | Preview and actions could use stale or overwritten raw text; hook lint failed. | Query and validation are derived synchronously from current builder inputs or the raw draft. Hooks are unconditional. Preview, Copy, Open, and Save use the same effective `queryText`. |
| Search-query persistence routes existed, but had no route tests. | Save/link validation and persisted query data lacked endpoint regression coverage. | Added tests for create/list round trip, nonexistent investigation, and empty query request validation. Backend execution is blocked by the local Python environment; see verification. |

## 2. Changed files

- `frontend/src/lib/search-query-builder.ts` — provider registry, structured query construction, validation, compatibility warnings, operator reporting, and safe URL serialization.
- `frontend/src/components/DorkingStudio.tsx` — synchronous derived preview/state, raw draft preservation, effective-query action consistency, safe HTTPS provider allowlist, and accurate active-filter summary.
- `frontend/src/types/search.ts` — explicit raw/builder mode metadata and query operator identifiers.
- `frontend/src/lib/search-query-builder.test.mjs` — 20 Node test-runner cases for query semantics, validation, raw mode serialization, provider round trips, and URL encoding.
- `frontend/package.json` — runs the query-builder test with existing Node and TypeScript tooling; no package dependency was added.
- `backend/tests/test_api_search_queries.py` — three API persistence and validation regression tests.
- `docs/DORKING_STUDIO.md`, `README.md` — supported behavior and provider caveats; clarifies that the module opens provider pages and does not collect results.
- This report.

No database model or schema changes were required; no migration was added. No search-result records or fake result UI were introduced.

## 3. Query-builder design after remediation

The existing structured TypeScript model remains the query intent. The builder composes keyword operands, exact phrases, included and excluded sites, file-type alternatives, page attributes, dates, exclusions, and explicit term groups into validated expressions. Empty filters are omitted. Empty overall input is rejected with a user-facing message.

Query construction is separate from URL serialization. `serialize()` returns the effective query, provider URL, detected operators, and provider compatibility warnings. URL generation sets the provider's `q` parameter once. Raw mode is authoritative while selected; provider changes do not replace the raw text. The raw query is syntax-checked without rewriting it.

## 4. Provider operator matrix

“Documented” means listed in the official provider help page linked in [DORKING_STUDIO.md](../DORKING_STUDIO.md). Provider behavior can change; Brave describes its operators as experimental.

| Provider | Documented operators represented as supported | Warnings |
|---|---|---|
| Google | `site:`, `filetype:`, `after:`, `before:`, exact phrase, `-term` | OR/grouping and page attributes are not listed on the cited Google Search Help page. OR is preserved and warned. |
| Bing | `site:`, `filetype:`, exact phrase, exclusion, `OR` and parentheses | Date operators and unlisted page attributes are warned. Microsoft notes that OR has low precedence and should be grouped. |
| DuckDuckGo | `site:`, `filetype:`, exact phrase, exclusion, `intitle:`, `inurl:` | OR/grouping and date operators are not listed; preserved with warnings. |
| Brave Search | `site:`, `filetype:`, exact phrase, exclusion, `OR`, `intitle:` | Date operators and `inurl:` are not listed. Other operators remain experimental. |

## 5. Tested query examples

| Input intent | Tested output |
|---|---|
| Keyword only: `keamanan siber Indonesia` | `keamanan siber Indonesia` |
| One site: `museum nasional Jakarta`, `facebook.com` | `museum nasional Jakarta site:facebook.com` |
| Alternative sites: `museum nasional`, Facebook or Instagram | `museum nasional (site:facebook.com OR site:instagram.com)` |
| Site plus PDF: `keamanan informasi`, `upnvj.ac.id`, `pdf` | `keamanan informasi site:upnvj.ac.id filetype:pdf` |
| PDF or DOCX: `keamanan informasi` | `keamanan informasi (filetype:pdf OR filetype:docx)` |
| Exact phrase and keywords | `security operations center "incident response"` |
| Site with keyword OR alternatives: upnvj.ac.id; cybersecurity / keamanan siber | `(cybersecurity OR "keamanan siber") site:upnvj.ac.id` |
| Exclusions | `phishing detection -job -vacancy` |
| Start date | `cybersecurity site:upnvj.ac.id after:2024-01-01` |
| Combined filters | `"keamanan informasi" (site:upnvj.ac.id OR site:komdigi.go.id) (filetype:pdf OR filetype:docx) -lowongan` |

The URL tests build a search URL for Google, Bing, DuckDuckGo, and Brave, decode its `q` parameter once, and compare it with the effective query, including Unicode, `+`, ampersands, quotation marks, and raw input.

## 6. Unit test results

- Frontend `npm test`: **20 passed, 0 failed**. This command includes TypeScript `tsc --noEmit`, ESLint, and the query-builder tests.
- The test cases cover the required keyword/site/filetype/phrase/OR/exclusion/date/combined/empty/Unicode/raw/provider-round-trip/invalid-input behaviors. Explicit nested term-group behavior is also tested.

## 7. Backend, TypeScript, ESLint, and production build

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | PASS, run by `npm test` |
| ESLint | PASS, run by `npm test`; explicit `npx eslint . --max-warnings=0` also passed after hook fixes |
| Frontend unit tests | PASS, 20 passed, 0 failed |
| Backend tests | NOT RUN; blocked before test collection by the environment mismatch described below |
| Backend Ruff check for new API tests | PASS (`ruff check tests/test_api_search_queries.py`) |
| Production build | PASS using `npm run build -- --webpack`; compile, TypeScript, static pages, and traces completed |

The default Next.js Turbopack build could not start a worker because the sandbox denied process/port binding (`Operation not permitted`, `EPERM`). A webpack production build was then run outside the sandbox. The successful webpack build completed without turning off TypeScript checks.

Backend test setup first failed because `backend/.venv` had no SQLAlchemy. Installing the repository-pinned dependencies then failed building pinned `pydantic-core==2.33.2`: its PyO3 0.24.1 dependency rejects Python 3.14 (maximum supported version 3.13). Retrying with PyO3 stable-ABI compatibility reached `jiter` compilation, which failed because Python 3.14 C API symbols (`PyUnicode_KIND`, `PyUnicode_1BYTE_KIND`, `PyUnicode_DATA`) were unavailable. The backend declares pinned packages and this environment has only Python 3.14, so no successful backend pytest run can be claimed. No backend application code was changed.

## 8. Copy, Open Search, and persistence verification

- **Copy:** code path uses the same `queryText` as the visible preview, including raw mode. Browser clipboard interaction was not manually or end-to-end tested.
- **Open Search:** code path serializes that same `queryText`, validates an HTTPS URL against the four configured provider origins, and opens with `noopener,noreferrer`. Provider URL round trips were unit tested; no live provider search was performed.
- **Save:** request payload uses that same `queryText` and selected provider, includes `queryMode`, and handles API errors visibly. The endpoint implementation was inspected at `backend/app/api/v1/search_queries.py`; three persistence tests were added, but endpoint execution is unverified because backend tests could not run.
- The feature opens external provider pages only. It does not retrieve or scrape their results.

## 9. Incomplete work and remaining risks

- Backend pytest and its new persistence tests need to be run in the project's supported Python environment (Python 3.12/3.13 with compatible locked native dependencies).
- Browser interaction for preview, Copy, Open Search, and Save was not run; no browser automation setup is present in the repository.
- Provider operator syntax can change and may vary by region or query. Warnings intentionally communicate uncertainty instead of translating syntax with different meaning.
- Query-builder validation is syntax-level; it does not guarantee a provider will interpret a query as intended or return results.
- No live provider searches were made, and no results were represented as retrieved.

Recommended next step: run the backend suite in a Python 3.12/3.13 environment, then exercise the Dorking tab in a browser with clipboard and popup permissions to verify the interaction path and saved response.

## 10. Final status

**PASS WITH CONDITIONS** — query semantics, URL serialization, provider warnings, TypeScript, ESLint, 20 frontend unit tests, and a production webpack build are verified. Backend endpoint tests and browser interaction remain unverified for the documented environment reasons.
