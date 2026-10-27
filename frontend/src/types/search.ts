export interface SearchQuery {
  id: string;
  investigation_id: string | null;
  title: string;
  query_text: string;
  provider: SearchProvider;
  category: SearchCategory;
  structured_filters: StructuredFilters | null;
  status: SearchQueryStatus;
  created_at: string;
  updated_at: string;
}

export type SearchProvider = 
  | 'google'
  | 'bing'
  | 'duckduckgo'
  | 'brave'
  | 'custom';

export type SearchCategory =
  | 'general'
  | 'website'
  | 'document'
  | 'username'
  | 'person_name'
  | 'organization'
  | 'location_place'
  | 'custom';

export type SearchQueryStatus =
  | 'DRAFT'
  | 'READY_TO_OPEN'
  | 'OPENED_BY_USER';

export interface StructuredFilters {
  queryMode?: 'builder' | 'raw';
  // Panel A - Search Context
  searchTitle?: string;
  mainKeywords: string[];
  searchEngine: SearchProvider;
  investigationTarget?: string;
  searchType: SearchCategory;

  // Panel B - Search Operators
  sites?: SiteFilter[];
  documentTypes?: DocumentTypeFilter[];
  keywordLogic?: KeywordLogic;
  pageAttributes?: PageAttributes;
  dateFilters?: DateFilters;
  advancedOperators?: AdvancedOperators;
}

export interface SiteFilter {
  domain: string;
  platform?: string;
  exclude?: boolean;
}

export interface DocumentTypeFilter {
  filetype: string;
  extension?: string;
  operator?: 'filetype' | 'ext';
}

export interface KeywordLogic {
  operator: 'AND' | 'OR';
  excludeTerms: string[];
  exactPhrases: string[];
  termGroups: TermGroup[];
  exactPhraseOperator?: 'AND' | 'OR';
}

export interface TermGroup {
  terms: string[];
  operator: 'AND' | 'OR';
}

export interface PageAttributes {
  intitle?: string[];
  allintitle?: string[];
  inurl?: string[];
  allinurl?: string[];
  intext?: string[];
  allintext?: string[];
}

export interface DateFilters {
  startDate?: string;
  endDate?: string;
  relativeRange?: RelativeDateRange;
}

export type RelativeDateRange = 
  | 'past_hour'
  | 'past_24_hours'
  | 'past_week'
  | 'past_month'
  | 'past_year'
  | 'custom';

export interface AdvancedOperators {
  related?: string[];
  cache?: boolean;
  ext?: string[];
  around?: AroundOperator;
}

export interface AroundOperator {
  distance: number;
  terms: [string, string];
}

export interface SearchProviderConfig {
  id: SearchProvider;
  name: string;
  searchUrl: string;
  queryParameter: string;
  supportedOperators: SearchOperator[];
  notes?: string;
}

export type SearchOperator = 
  | 'site'
  | 'filetype'
  | 'intitle'
  | 'allintitle'
  | 'inurl'
  | 'allinurl'
  | 'intext'
  | 'allintext'
  | 'after'
  | 'before'
  | 'related'
  | 'cache'
  | 'ext'
  | 'around'
  | 'exact'
  | 'exclude'
  | 'and'
  | 'or';

export interface SearchQueryCreateRequest {
  investigation_id?: string | null;
  title: string;
  query_text: string;
  provider: SearchProvider;
  category: SearchCategory;
  structured_filters?: StructuredFilters | null;
}

export interface SearchQueryUpdateRequest {
  title?: string;
  query_text?: string;
  provider?: SearchProvider;
  category?: SearchCategory;
  structured_filters?: StructuredFilters | null;
  status?: SearchQueryStatus;
}
