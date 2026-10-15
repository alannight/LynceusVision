# Dorking Studio

Dorking Studio builds a search query in the browser and can open it on the selected search provider. It does not request, scrape, or collect provider results. Saving a query stores the query text, provider, optional investigation link, category, structured filters, and timestamps in LynceusVision.

## Query behavior

All filters are optional. Empty values are omitted. A query must contain at least one nonempty keyword, exact phrase, or filter; otherwise Copy/Open/Save remain unavailable and the preview explains what is missing.

- Keywords are joined with AND by default. Selecting OR places keyword alternatives in a parenthesized group.
- Exact phrases are enclosed in double quotes.
- One site or file type uses `site:domain.example` or `filetype:pdf`.
- Multiple included sites and file types are grouped with uppercase `OR`; exclusion terms use a leading minus.
- Keyword alternatives are a separate OR group from the main keyword. Selecting several sites does not expand or duplicate the keyword into each OR branch.
- Dates use strict `YYYY-MM-DD` values. `after:` and `before:` are emitted only for selected dates, and reversed ranges are rejected.
- Domains must be hostnames; schemes, paths, credentials, and malformed labels are rejected.
- Raw mode keeps the user's text as the effective query. Provider changes only change the destination URL and compatibility warning. Raw syntax is checked for empty input, unbalanced quotes/parentheses, incomplete OR, and valueless common operators; it is not parsed or rewritten.
- Copy, Open, and Save all use the same effective preview string. Search URLs are built with the provider's configured query parameter and `URL.searchParams` so the query is encoded once. Open is restricted to the four configured HTTPS providers.

## Provider operator compatibility

Compatibility is based on provider help pages and is not a guarantee that every query returns results. Search engines can change behavior, and Brave describes operators as experimental. Unverified operators remain in the query and produce a warning; the builder does not rewrite them into a different expression.

| Provider | Documented here | Unverified / warned |
|---|---|---|
| Google | `site:`, `filetype:`, exact phrase, `-term`, `after:`, `before:` | `OR` and parentheses are not listed on the cited Search Help page; page attributes and advanced operators are warned |
| Bing | `site:`, `filetype:`, exact phrase, exclusion, `OR` and grouping | `after:` / `before:` and unsupported page attributes |
| DuckDuckGo | `site:`, `filetype:`, exact phrase, exclusion, `intitle:`, `inurl:` | `OR` / grouping and date operators |
| Brave Search | `site:`, `filetype:`, exact phrase, exclusion, `OR`, `intitle:` | `after:` / `before:` and `inurl:` are not listed; the provider identifies operator behavior as experimental |

Provider references (official help): [Google Search operators](https://support.google.com/websearch/answer/2466433?hl=en), [Microsoft Bing advanced keywords](https://support.microsoft.com/en-us/bing/advanced-search-keywords), [Microsoft Bing Boolean syntax](https://support.microsoft.com/en-gb/bing/advanced-search-options), [DuckDuckGo syntax](https://duckduckgo.com/duckduckgo-help-pages/results/syntax), [Brave Search operators](https://search.brave.com/help/operators).

## Query persistence

The API endpoints require a bearer token. `POST /api/v1/search-queries` validates required title and query text, assigns the current owner, and verifies an optional investigation belongs to that owner. Read/update/delete operations are also owner-scoped. Its successful response is evidence that the query was saved. This endpoint persists query intent only; it does not indicate that a provider search was run or that results were found.

## Verification

Run the frontend checks and query-builder unit cases with:

```bash
cd frontend
npm test
```

Run backend tests with:

```bash
cd backend
pytest
```

The frontend test uses Node's built-in test runner and the TypeScript compiler already present in the project; no additional dependency is needed. Tests verify query strings, malformed input, provider warnings, and decoded URL round trips. No live provider query is made.
