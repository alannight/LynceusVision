# Dorking Studio - Search Engine OSINT Query Builder

## Overview

Dorking Studio is a specialized module within LynceusVision for constructing advanced search engine queries for OSINT investigations. It provides a visual interface for building complex search queries with multiple filters, operators, and provider-specific syntax.

## Key Features

### 1. **Flexible Query Building**
- All filters are optional - build queries with only the constraints you need
- Multiple keyword support with AND/OR logic
- Exact phrase matching with quote handling
- Term exclusion with negative operators

### 2. **Search Provider Support**
- **Google** - Full operator support including grouping
- **Bing** - Limited operator compatibility
- **DuckDuckGo** - Privacy-focused, simplified operators
- **Brave Search** - Privacy-focused alternative

### 3. **Advanced Filter Categories**

#### A. Site/Domain Filtering
- Pre-defined platforms (Facebook, Instagram, LinkedIn, GitHub, etc.)
- Custom domain input
- Site exclusion option
- Multiple site selection with OR grouping

#### B. Document Type Filtering
- Common document formats (PDF, DOCX, XLSX, etc.)
- Custom filetype extensions
- Multiple document type selection

#### C. Keyword Logic
- AND/OR operators between keywords
- Term exclusion (negative search)
- Exact phrase matching
- Complex term grouping (future enhancement)

#### D. Page Attributes
- `intitle:` - Search within page titles
- `inurl:` - Search within URLs
- `intext:` - Search within page text
- `allintitle:`, `allinurl:`, `allintext:` (Google only)

#### E. Date Filters
- `after:` - Results after specific date
- `before:` - Results before specific date
- Date range specification

### 4. **Live Query Preview**
- Real-time query generation
- Raw query editing mode
- Provider-specific syntax validation
- Active filters summary
- URL encoding for direct browser opening

### 5. **Investigation Integration**
- Save queries to investigations
- Query history and persistence
- Structured filter preservation
- Search provenance tracking

## Architecture

### Frontend Components

#### `SearchQueryBuilder` Class
- Core query construction logic
- Provider-specific serialization
- URL generation
- Syntax validation
- Operator compatibility checking

#### `DorkingStudio` Component
- Main UI interface
- Filter management
- State synchronization
- API integration
- User interaction handling

### Backend API

#### Search Query Model
```python
class SearchQuery(Base):
    id: str
    investigation_id: Optional[str]
    title: str
    query_text: str
    provider: str  # google, bing, duckduckgo, brave
    category: str  # general, website, document, username, etc.
    structured_filters: Optional[dict]  # JSON field
    status: str  # DRAFT, READY_TO_OPEN, OPENED_BY_USER
    created_at: datetime
    updated_at: datetime
```

#### API Endpoints
- `GET /api/v1/search-queries` - List queries (filter by investigation)
- `GET /api/v1/search-queries/{id}` - Get specific query
- `POST /api/v1/search-queries` - Create new query
- `PATCH /api/v1/search-queries/{id}` - Update query
- `DELETE /api/v1/search-queries/{id}` - Delete query

## Usage Examples

### Basic Keyword Search
```
museum nasional Jakarta
```

### Site-Restricted Search
```
museum nasional site:facebook.com
```

### Multiple Sites with Document Type
```
kebijakan keamanan (site:example.org OR site:example.net) filetype:pdf
```

### Complex Query with Exclusions
```
"laporan audit" -lowongan -iklan intitle:2024 after:2024-01-01
```

### Username Search Across Platforms
```
johndoe (site:github.com OR site:linkedin.com OR site:twitter.com)
```

## Implementation Principles

### 1. **Optional Filter Philosophy**
- Empty filters don't add constraints
- Users can build queries with any combination of filters
- No default filters are applied automatically

### 2. **Provider Compatibility**
- Operator support varies by search engine
- Warnings shown for incompatible operators
- Query syntax adjusted per provider capabilities

### 3. **Provenance and Integrity**
- Queries saved with full context
- Structured filters preserved for reproducibility
- Clear distinction between query building and execution

### 4. **Security Considerations**
- No automatic query execution
- No scraping or result collection
- URL encoding prevents injection
- No credential storage for search engines

## Testing Strategy

### Unit Tests
- Query builder logic
- URL generation
- Provider compatibility
- Edge case handling

### Integration Tests
- API endpoint functionality
- Database persistence
- Frontend-backend communication

### User Acceptance Tests
- All test cases from specification document
- Provider-specific behavior verification
- UI interaction validation

## Limitations and Considerations

### 1. **Search Engine Limitations**
- Operators may change without notice
- Rate limiting may apply
- Some operators deprecated or ignored
- Geographic/content restrictions may affect results

### 2. **Technical Constraints**
- No automatic result scraping
- Query building only - execution happens in browser
- No integration with search engine APIs (MVP)
- Date filtering accuracy varies by provider

### 3. **Privacy and Legal**
- Users responsible for compliance with ToS
- No automated bulk searching
- Manual query review recommended
- Attribution to original sources required

## Future Enhancements

### Planned Features
1. **Query Templates** - Pre-defined search patterns
2. **Result Preview** - Limited result display via APIs
3. **Batch Queries** - Multiple query generation
4. **Advanced Operators** - `AROUND(n)`, `cache:`, `related:`
5. **More Providers** - Yandex, Baidu, regional search engines

### Technical Improvements
1. **Caching Layer** - Query result caching
2. **API Integration** - Official search engine APIs
3. **Analytics** - Query usage patterns
4. **Export Formats** - CSV, JSON, Markdown

## Getting Started

### Quick Test
1. Navigate to "Dorking Studio" in the sidebar
2. Enter keywords in the main textarea
3. Select search engine (default: Google)
4. Add optional filters
5. Review query in live preview
6. Copy query or open in browser

### Saving to Investigation
1. Provide a search title
2. Select target investigation (optional)
3. Click "Save to Investigation"
4. Query will be available in investigation details

### Testing Different Providers
1. Change search engine in dropdown
2. Note compatibility warnings
3. Review generated query syntax
4. Open in respective search engine

## Troubleshooting

### Common Issues

#### Query Not Generating
- Check if keywords are provided
- Verify no validation errors
- Ensure at least one filter is active

#### Operator Not Working
- Check provider compatibility
- Review operator syntax
- Test directly in search engine

#### URL Encoding Problems
- Special characters may need escaping
- Use raw mode to inspect encoding
- Test URL in browser directly

#### Save Failed
- Verify search title is provided
- Check backend connection
- Review error message details

### Provider-Specific Notes

#### Google
- Best operator support
- Supports parentheses for grouping
- `allintitle:` etc. work as expected

#### Bing
- Limited advanced operators
- May ignore some modifiers
- Different date format handling

#### DuckDuckGo
- Privacy-focused
- Simplified syntax
- May not support all operators

#### Brave Search
- Similar to Google syntax
- Privacy-focused
- Independent index

## Security Best Practices

1. **No Sensitive Data** - Avoid PII in search queries
2. **Rate Limiting** - Respect search engine policies
3. **Terms of Service** - Comply with provider ToS
4. **Attribution** - Cite sources when using results
5. **Legal Compliance** - Follow applicable laws and regulations

## Contributing

### Adding New Providers
1. Add provider config to `SEARCH_PROVIDERS`
2. Implement operator compatibility mapping
3. Add URL generation logic
4. Update validation rules
5. Add tests

### Adding New Filter Types
1. Define interface in `types/search.ts`
2. Add builder logic in `SearchQueryBuilder`
3. Implement UI components in `DorkingStudio`
4. Update validation and serialization
5. Add tests and documentation