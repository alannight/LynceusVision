import {
  StructuredFilters,
  SiteFilter,
  DocumentTypeFilter,
  KeywordLogic,
  TermGroup,
  PageAttributes,
  DateFilters,
  AdvancedOperators,
  SearchProvider,
} from "../types/search";

// Search provider configurations
export const SEARCH_PROVIDERS = {
  google: {
    id: "google" as SearchProvider,
    name: "Google",
    searchUrl: "https://www.google.com/search",
    supportsGrouping: true,
    supportsParentheses: true,
    supportedOperators: [
      "site",
      "filetype",
      "intitle",
      "allintitle",
      "inurl",
      "allinurl",
      "intext",
      "allintext",
      "after",
      "before",
      "related",
      "cache",
      "ext",
    ],
    urlEncodingRules: "standard" as const,
    notes: "Google supports most operators but may change behavior over time.",
  },
  bing: {
    id: "bing" as SearchProvider,
    name: "Bing",
    searchUrl: "https://www.bing.com/search",
    supportsGrouping: true,
    supportsParentheses: true,
    supportedOperators: [
      "site",
      "filetype",
      "intitle",
      "inurl",
      "intext",
    ],
    urlEncodingRules: "standard" as const,
    notes: "Bing has limited support for advanced operators.",
  },
  duckduckgo: {
    id: "duckduckgo" as SearchProvider,
    name: "DuckDuckGo",
    searchUrl: "https://duckduckgo.com/",
    supportsGrouping: true,
    supportsParentheses: true,
    supportedOperators: [
      "site",
      "filetype",
    ],
    urlEncodingRules: "standard" as const,
    notes: "DuckDuckGo focuses on privacy and has simplified operators.",
  },
  brave: {
    id: "brave" as SearchProvider,
    name: "Brave Search",
    searchUrl: "https://search.brave.com/search",
    supportsGrouping: true,
    supportsParentheses: true,
    supportedOperators: [
      "site",
      "filetype",
    ],
    urlEncodingRules: "standard" as const,
    notes: "Brave Search is a privacy-focused alternative.",
  },
} as const;

// Default platforms with their domains
export const PLATFORM_DOMAINS = {
  facebook: "facebook.com",
  instagram: "instagram.com",
  linkedin: "linkedin.com",
  github: "github.com",
  youtube: "youtube.com",
  reddit: "reddit.com",
  twitter: "twitter.com",
  tiktok: "tiktok.com",
  wikipedia: "wikipedia.org",
  stackoverflow: "stackoverflow.com",
  medium: "medium.com",
  news: "news.google.com",
} as const;

// Document types with file extensions
export const DOCUMENT_TYPES = {
  pdf: "pdf",
  doc: "doc",
  docx: "docx",
  xls: "xls",
  xlsx: "xlsx",
  ppt: "ppt",
  pptx: "pptx",
  csv: "csv",
  txt: "txt",
  json: "json",
  xml: "xml",
  html: "html",
  md: "md",
} as const;

export class SearchQueryBuilder {
  private filters: StructuredFilters;
  private provider: SearchProvider;

  constructor(initialFilters: Partial<StructuredFilters> = {}, provider: SearchProvider = "google") {
    this.filters = {
      mainKeywords: [],
      searchEngine: provider,
      searchType: "general",
      ...initialFilters,
    };
    this.provider = provider;
  }

  // Setters for individual filter components
  setKeywords(keywords: string[]): this {
    this.filters.mainKeywords = keywords;
    return this;
  }

  setSites(sites: SiteFilter[]): this {
    this.filters.sites = sites;
    return this;
  }

  setDocumentTypes(docs: DocumentTypeFilter[]): this {
    this.filters.documentTypes = docs;
    return this;
  }

  setKeywordLogic(logic: KeywordLogic): this {
    this.filters.keywordLogic = logic;
    return this;
  }

  setPageAttributes(attrs: PageAttributes): this {
    this.filters.pageAttributes = attrs;
    return this;
  }

  setDateFilters(dates: DateFilters): this {
    this.filters.dateFilters = dates;
    return this;
  }

  setAdvancedOperators(advanced: AdvancedOperators): this {
    this.filters.advancedOperators = advanced;
    return this;
  }

  setProvider(provider: SearchProvider): this {
    this.provider = provider;
    this.filters.searchEngine = provider;
    return this;
  }

  // Building methods
  private buildKeywords(): string {
    if (!this.filters.mainKeywords.length) return "";

    const { keywordLogic } = this.filters;
    
    if (keywordLogic) {
      const parts: string[] = [];

      // Handle term groups
      if (keywordLogic.termGroups && keywordLogic.termGroups.length > 0) {
        const groupStrings = keywordLogic.termGroups.map(group => {
          if (group.terms.length === 1) {
            return this.escapeTerm(group.terms[0]);
          }
          const terms = group.terms.map(term => this.escapeTerm(term));
          const operator = group.operator === "AND" ? " " : " OR ";
          const groupContent = terms.join(operator);
          return groupContent;
        });

        // Join groups with main operator
        const mainOperator = keywordLogic.operator === "AND" ? " " : " OR ";
        const mainKeywords = this.filters.mainKeywords.map(k => this.escapeTerm(k));
        const allParts = [...mainKeywords, ...groupStrings];
        
        if (allParts.length > 1 && this.supportsGrouping()) {
          return `(${allParts.join(mainOperator)})`;
        }
        return allParts.join(mainOperator);
      }

      // Simple case with main keywords only
      const mainKeywords = this.filters.mainKeywords.map(k => this.escapeTerm(k));
      const operator = keywordLogic.operator === "AND" ? " " : " OR ";
      
      if (mainKeywords.length > 1 && this.supportsGrouping()) {
        return `(${mainKeywords.join(operator)})`;
      }
      return mainKeywords.join(operator);
    }

    // Default: join with AND
    return this.filters.mainKeywords.map(k => this.escapeTerm(k)).join(" ");
  }

  private buildSiteFilters(): string {
    if (!this.filters.sites || !this.filters.sites.length) return "";

    const siteFilters = this.filters.sites.map(site => {
      const prefix = site.exclude ? "-site:" : "site:";
      return `${prefix}${site.domain}`;
    });

    if (siteFilters.length === 1) {
      return siteFilters[0];
    }

    const operator = " OR ";
    if (this.supportsGrouping()) {
      return `(${siteFilters.join(operator)})`;
    }
    return siteFilters.join(operator);
  }

  private buildDocumentFilters(): string {
    if (!this.filters.documentTypes || !this.filters.documentTypes.length) return "";

    const docFilters = this.filters.documentTypes.map(doc => {
      return `filetype:${doc.filetype}`;
    });

    if (docFilters.length === 1) {
      return docFilters[0];
    }

    const operator = " OR ";
    if (this.supportsGrouping()) {
      return `(${docFilters.join(operator)})`;
    }
    return docFilters.join(operator);
  }

  private buildPageAttributes(): string {
    if (!this.filters.pageAttributes) return "";

    const attrs = this.filters.pageAttributes;
    const parts: string[] = [];

    const addAttribute = (operator: string, values: string[] | undefined) => {
      if (values && values.length > 0) {
        if (values.length === 1) {
          parts.push(`${operator}:${this.escapeTerm(values[0])}`);
        } else if (this.supportsGrouping()) {
          const valueString = values.map(v => this.escapeTerm(v)).join(" OR ");
          parts.push(`${operator}:(${valueString})`);
        } else {
          values.forEach(v => parts.push(`${operator}:${this.escapeTerm(v)}`));
        }
      }
    };

    addAttribute("intitle", attrs.intitle);
    addAttribute("allintitle", attrs.allintitle);
    addAttribute("inurl", attrs.inurl);
    addAttribute("allinurl", attrs.allinurl);
    addAttribute("intext", attrs.intext);
    addAttribute("allintext", attrs.allintext);

    return parts.join(" ");
  }

  private buildDateFilters(): string {
    if (!this.filters.dateFilters) return "";

    const { startDate, endDate } = this.filters.dateFilters;
    const parts: string[] = [];

    if (startDate) {
      parts.push(`after:${this.formatDateForSearch(startDate)}`);
    }

    if (endDate) {
      parts.push(`before:${this.formatDateForSearch(endDate)}`);
    }

    return parts.join(" ");
  }

  private buildAdvancedOperators(): string {
    if (!this.filters.advancedOperators) return "";

    const advanced = this.filters.advancedOperators;
    const parts: string[] = [];

    if (advanced.related && advanced.related.length > 0) {
      parts.push(`related:${advanced.related[0]}`);
    }

    if (advanced.cache) {
      parts.push("cache:");
    }

    if (advanced.ext && advanced.ext.length > 0) {
      advanced.ext.forEach(ext => {
        parts.push(`ext:${ext}`);
      });
    }

    if (advanced.around && advanced.around.terms.length === 2) {
      parts.push(`"${advanced.around.terms[0]}" AROUND(${advanced.around.distance}) "${advanced.around.terms[1]}"`);
    }

    return parts.join(" ");
  }

  private buildExcludeTerms(): string {
    if (!this.filters.keywordLogic?.excludeTerms?.length) return "";

    return this.filters.keywordLogic.excludeTerms
      .map(term => `-${this.escapeTerm(term)}`)
      .join(" ");
  }

  private buildExactPhrases(): string {
    if (!this.filters.keywordLogic?.exactPhrases?.length) return "";

    return this.filters.keywordLogic.exactPhrases
      .map(phrase => `"${this.escapePhrase(phrase)}"`)
      .join(" ");
  }

  // Main build method
  buildQuery(): string {
    const parts: string[] = [];

    // Build all components
    const keywords = this.buildKeywords();
    const siteFilters = this.buildSiteFilters();
    const docFilters = this.buildDocumentFilters();
    const pageAttrs = this.buildPageAttributes();
    const dateFilters = this.buildDateFilters();
    const advancedOps = this.buildAdvancedOperators();
    const excludeTerms = this.buildExcludeTerms();
    const exactPhrases = this.buildExactPhrases();

    // Add all non-empty parts
    if (keywords) parts.push(keywords);
    if (exactPhrases) parts.push(exactPhrases);
    if (siteFilters) parts.push(siteFilters);
    if (docFilters) parts.push(docFilters);
    if (pageAttrs) parts.push(pageAttrs);
    if (dateFilters) parts.push(dateFilters);
    if (advancedOps) parts.push(advancedOps);
    if (excludeTerms) parts.push(excludeTerms);

    // Join all parts with AND (space)
    const query = parts.join(" ").trim();

    // Validate empty query
    if (!query) {
      throw new Error("Query cannot be empty. Please provide at least keywords or filters.");
    }

    return query;
  }

  // URL generation
  buildSearchUrl(query?: string): string {
    const finalQuery = query || this.buildQuery();
    const providerConfig = SEARCH_PROVIDERS[this.provider as keyof typeof SEARCH_PROVIDERS];
    
    if (!providerConfig) {
      throw new Error(`Unknown search provider: ${this.provider}`);
    }

    const encodedQuery = this.encodeQueryForUrl(finalQuery, providerConfig.urlEncodingRules);
    return `${providerConfig.searchUrl}?q=${encodedQuery}`;
  }

  // Helper methods
  private escapeTerm(term: string): string {
    // Escape special characters that might break query syntax
    return term.replace(/[()"]/g, '\\$&');
  }

  private escapePhrase(phrase: string): string {
    // Escape quotes within phrases
    return phrase.replace(/"/g, '\\"');
  }

  private formatDateForSearch(dateString: string): string {
    // Format date for search operators (YYYY-MM-DD)
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return dateString;
    }
  }

  private encodeQueryForUrl(query: string, encoding: string): string {
    if (encoding === "rfc3986") {
      // RFC 3986 encoding (more strict)
      return encodeURIComponent(query).replace(/[!'()*]/g, c => 
        `%${c.charCodeAt(0).toString(16).toUpperCase()}`
      );
    }
    // Standard encoding
    return encodeURIComponent(query);
  }

  private supportsGrouping(): boolean {
    return SEARCH_PROVIDERS[this.provider as keyof typeof SEARCH_PROVIDERS]?.supportsGrouping || false;
  }

  // Validation
  validateQuery(): { valid: boolean; warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for empty query
    try {
      const query = this.buildQuery();
      if (!query.trim()) {
        errors.push("Query is empty. Please provide keywords or filters.");
      }
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message);
      }
    }

    // Check provider compatibility
    const providerConfig = SEARCH_PROVIDERS[this.provider as keyof typeof SEARCH_PROVIDERS];
    if (!providerConfig) {
      errors.push(`Unsupported search provider: ${this.provider}`);
    }

    // Check for unsupported operators
    if (providerConfig) {
      const checkOperators = (operator: string, present: boolean) => {
        if (present && !providerConfig.supportedOperators.includes(operator as any)) {
          warnings.push(`Operator "${operator}" may not be supported by ${providerConfig.name}`);
        }
      };

      checkOperators("site", !!this.filters.sites?.length);
      checkOperators("filetype", !!this.filters.documentTypes?.length);
      checkOperators("intitle", !!this.filters.pageAttributes?.intitle?.length);
      checkOperators("allintitle", !!this.filters.pageAttributes?.allintitle?.length);
      checkOperators("inurl", !!this.filters.pageAttributes?.inurl?.length);
      checkOperators("allinurl", !!this.filters.pageAttributes?.allinurl?.length);
      checkOperators("intext", !!this.filters.pageAttributes?.intext?.length);
      checkOperators("allintext", !!this.filters.pageAttributes?.allintext?.length);
      checkOperators("after", !!this.filters.dateFilters?.startDate);
      checkOperators("before", !!this.filters.dateFilters?.endDate);
      checkOperators("related", !!this.filters.advancedOperators?.related?.length);
      checkOperators("cache", !!this.filters.advancedOperators?.cache);
      checkOperators("ext", !!this.filters.advancedOperators?.ext?.length);
      checkOperators("around", !!this.filters.advancedOperators?.around);
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  // Getter for current filters
  getFilters(): StructuredFilters {
    return { ...this.filters };
  }
}