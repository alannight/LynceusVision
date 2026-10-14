import type {
  AdvancedOperators,
  DateFilters,
  DocumentTypeFilter,
  KeywordLogic,
  PageAttributes,
  SearchProvider,
  SearchOperator,
  SearchProviderConfig,
  SiteFilter,
  StructuredFilters,
} from "../types/search";

// These lists describe syntax confirmed in each provider's own help pages.
// Missing entries are reported as unverified, not silently translated.
export const SEARCH_PROVIDERS: Record<Exclude<SearchProvider, "custom">, SearchProviderConfig> = {
  google: {
    id: "google", name: "Google", searchUrl: "https://www.google.com/search",
    supportedOperators: ["site", "filetype", "after", "before", "exclude", "exact"],
    notes: "Google documents site, filetype, before, after, exact phrases, and exclusions. OR/grouping syntax is not covered by the cited help page.",
  },
  bing: {
    id: "bing", name: "Bing", searchUrl: "https://www.bing.com/search",
    supportedOperators: ["site", "filetype", "exact", "exclude", "or"],
    notes: "Microsoft documents site, filetype, exact matching, exclusions, OR, and parenthesized grouping. Date operators are not listed.",
  },
  duckduckgo: {
    id: "duckduckgo", name: "DuckDuckGo", searchUrl: "https://duckduckgo.com/",
    supportedOperators: ["site", "filetype", "intitle", "inurl", "exact", "exclude"],
    notes: "DuckDuckGo documents site, filetype, intitle, inurl, exact phrases, and exclusions. OR/grouping and date operators are not verified.",
  },
  brave: {
    id: "brave", name: "Brave Search", searchUrl: "https://search.brave.com/search",
    supportedOperators: ["site", "filetype", "exclude", "exact", "or", "intitle"],
    notes: "Brave documents site, filetype, intitle, exact phrases, exclusions, and OR. Date and inurl syntax are not listed, and operator behavior is experimental.",
  },
};

export const PLATFORM_DOMAINS = {
  facebook: "facebook.com", instagram: "instagram.com", linkedin: "linkedin.com",
  github: "github.com", youtube: "youtube.com", reddit: "reddit.com", twitter: "twitter.com",
  tiktok: "tiktok.com", wikipedia: "wikipedia.org", stackoverflow: "stackoverflow.com",
  medium: "medium.com", news: "news.google.com",
} as const;

export const DOCUMENT_TYPES = {
  pdf: "pdf", doc: "doc", docx: "docx", xls: "xls", xlsx: "xlsx", ppt: "ppt", pptx: "pptx",
  csv: "csv", txt: "txt", json: "json", xml: "xml", html: "html", md: "md",
} as const;

export interface QuerySerialization {
  query: string;
  url: string;
  operators: SearchOperator[];
  warnings: string[];
}

export interface QueryValidation {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

const clean = (value: string | undefined): string => value?.trim() ?? "";
const unique = <T,>(values: T[]): T[] => [...new Set(values)];

function quoteAlternative(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if ((trimmed.match(/"/g) ?? []).length % 2 !== 0) throw new Error("Keyword contains unbalanced quotation marks.");
  return /\s/.test(trimmed) && !trimmed.startsWith('"') ? `"${trimmed}"` : trimmed;
}

function validateDomain(domain: string): string {
  const value = clean(domain);
  if (!value) throw new Error("A selected site filter has an empty domain.");
  if (value.includes("://") || value.includes("/") || value.includes("?") || value.includes("#") || value.includes("@")) {
    throw new Error(`Invalid site domain: ${value}. Enter a hostname only.`);
  }
  const normalized = value.toLowerCase().replace(/\.$/, "");
  if (normalized.length > 253 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/.test(normalized)) {
    throw new Error(`Invalid site domain: ${value}.`);
  }
  return normalized;
}

function validateFiletype(filetype: string): string {
  const value = clean(filetype).toLowerCase().replace(/^\./, "");
  if (!value) throw new Error("A selected file type is empty.");
  if (!/^[a-z0-9][a-z0-9._+-]{0,31}$/.test(value)) throw new Error(`Invalid file type: ${filetype}.`);
  return value;
}

function formatDate(value: string, operator: string): string {
  const date = clean(value);
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${operator} date must use YYYY-MM-DD format.`);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${operator} date is not a valid calendar date.`);
  }
  return date;
}

function validateQuerySyntax(query: string): string[] {
  const errors: string[] = [];
  let quoteOpen = false;
  let depth = 0;
  for (const character of query) {
    if (character === '"') quoteOpen = !quoteOpen;
    if (quoteOpen) continue;
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth < 0) errors.push("Query has an unmatched closing parenthesis.");
  }
  if (quoteOpen) errors.push("Query has unbalanced quotation marks.");
  if (depth > 0) errors.push("Query has an unmatched opening parenthesis.");
  // Keep a token where each phrase appeared so it remains an operand in OR checks.
  const outsideQuotes = query.replace(/"[^"\n]*"/g, " PHRASE ");
  const tokens = outsideQuotes.match(/\(|\)|[^\s()]+/g) ?? [];
  tokens.forEach((token, index) => {
    if (token !== "OR") return;
    const left = tokens[index - 1];
    const right = tokens[index + 1];
    if (!left || left === "(" || left === "OR" || !right || right === ")" || right === "OR") {
      errors.push("OR must have a valid expression on both sides.");
    }
  });
  if (/\(\s*\)/.test(outsideQuotes)) errors.push("Query cannot contain an empty group.");
  if (/\b(?:site|filetype|after|before|related|cache|ext):(?:\s|$)/i.test(query)) errors.push("Search operators must have a value with no space after the colon.");
  for (const match of outsideQuotes.matchAll(/(?:^|\s|\()(-?site:)([^\s)]+)/gi)) {
    try { validateDomain(match[2]); }
    catch (error) { errors.push(error instanceof Error ? error.message : "Invalid site domain."); }
  }
  for (const match of outsideQuotes.matchAll(/(?:^|\s|\()(filetype:)([^\s)]+)/gi)) {
    try { validateFiletype(match[2]); }
    catch (error) { errors.push(error instanceof Error ? error.message : "Invalid file type."); }
  }
  for (const match of outsideQuotes.matchAll(/\b(after|before):([^\s)]+)/gi)) {
    try { formatDate(match[2], match[1]); }
    catch (error) { errors.push(error instanceof Error ? error.message : `Invalid ${match[1]} date.`); }
  }
  const after = outsideQuotes.match(/\bafter:(\d{4}-\d{2}-\d{2})\b/i)?.[1];
  const before = outsideQuotes.match(/\bbefore:(\d{4}-\d{2}-\d{2})\b/i)?.[1];
  if (after && before && after > before) errors.push("Start date must be on or before end date.");
  return unique(errors);
}

export class SearchQueryBuilder {
  private filters: StructuredFilters;
  private provider: SearchProvider;

  constructor(initialFilters: Partial<StructuredFilters> = {}, provider: SearchProvider = "google") {
    this.provider = provider;
    this.filters = {
      mainKeywords: [], searchEngine: provider, searchType: "general", ...initialFilters,
    };
  }

  setKeywords(values: string[]): this { this.filters.mainKeywords = values; return this; }
  setSites(values: SiteFilter[]): this { this.filters.sites = values; return this; }
  setDocumentTypes(values: DocumentTypeFilter[]): this { this.filters.documentTypes = values; return this; }
  setKeywordLogic(value: KeywordLogic): this { this.filters.keywordLogic = value; return this; }
  setPageAttributes(value: PageAttributes): this { this.filters.pageAttributes = value; return this; }
  setDateFilters(value: DateFilters): this { this.filters.dateFilters = value; return this; }
  setAdvancedOperators(value: AdvancedOperators): this { this.filters.advancedOperators = value; return this; }
  setProvider(value: SearchProvider): this { this.provider = value; this.filters.searchEngine = value; return this; }

  private getProvider(): SearchProviderConfig {
    if (this.provider === "custom" || !(this.provider in SEARCH_PROVIDERS)) throw new Error(`Unsupported search provider: ${this.provider}`);
    return SEARCH_PROVIDERS[this.provider];
  }

  buildQuery(): string {
    const filters = this.filters;
    const keywords = (filters.mainKeywords ?? []).map(clean).filter(Boolean);
    const logic = filters.keywordLogic;
    const parts: string[] = [];

    const termGroups = (logic?.termGroups ?? [])
      .map(group => ({ ...group, terms: group.terms.map(clean).filter(Boolean) }))
      .filter(group => group.terms.length > 0);
    const hasTopLevelOr = logic?.operator === "OR";
    const keywordOperands = hasTopLevelOr
      ? keywords.map(quoteAlternative)
      : keywords.length ? [keywords.map(value => {
          if ((value.match(/"/g) ?? []).length % 2 !== 0) throw new Error("Keyword contains unbalanced quotation marks.");
          return value;
        }).join(" ")] : [];
    const groupOperands = termGroups.map(group => {
      const terms = group.terms.map(quoteAlternative);
      if (group.operator === "OR" && terms.length > 1) return `(${terms.join(" OR ")})`;
      const conjunction = terms.join(" ");
      return hasTopLevelOr && terms.length > 1 ? `(${conjunction})` : conjunction;
    });
    const keywordOperandsWithGroups = [...keywordOperands, ...groupOperands].filter(Boolean);
    if (hasTopLevelOr && keywordOperandsWithGroups.length > 1) {
      parts.push(`(${keywordOperandsWithGroups.join(" OR ")})`);
    } else {
      parts.push(...keywordOperandsWithGroups);
    }

    const phrases = (logic?.exactPhrases ?? []).map(clean).filter(Boolean);
    phrases.forEach(phrase => {
      if ((phrase.match(/"/g) ?? []).length > 0) throw new Error("Exact phrases must not include quotation marks; the builder adds them.");
      parts.push(`"${phrase}"`);
    });

    const sites = filters.sites ?? [];
    if (filters.sites?.some(site => !clean(site.domain))) throw new Error("A selected site filter has an empty domain.");
    const includedSites = unique(sites.filter(site => !site.exclude).map(site => `site:${validateDomain(site.domain)}`));
    const excludedSites = unique(sites.filter(site => site.exclude).map(site => `-site:${validateDomain(site.domain)}`));
    if (includedSites.length === 1) parts.push(includedSites[0]);
    else if (includedSites.length > 1) parts.push(`(${includedSites.join(" OR ")})`);
    parts.push(...excludedSites);

    const types = unique((filters.documentTypes ?? []).map(doc => validateFiletype(doc.filetype)));
    if (types.length === 1) parts.push(`filetype:${types[0]}`);
    else if (types.length > 1) parts.push(`(${types.map(type => `filetype:${type}`).join(" OR ")})`);

    const attrs = filters.pageAttributes;
    for (const [key, values] of Object.entries(attrs ?? {}) as [keyof PageAttributes, string[] | undefined][]) {
      const normalized = (values ?? []).map(clean).filter(Boolean);
      if (!normalized.length) continue;
      const op = key as SearchOperator;
      if (normalized.length > 1) {
        parts.push(`(${normalized.map(value => `${op}:${quoteAlternative(value)}`).join(" OR ")})`);
      } else parts.push(`${op}:${quoteAlternative(normalized[0])}`);
    }

    const start = formatDate(filters.dateFilters?.startDate ?? "", "after");
    const end = formatDate(filters.dateFilters?.endDate ?? "", "before");
    if (start && end && start > end) throw new Error("Start date must be on or before end date.");
    if (start) parts.push(`after:${start}`);
    if (end) parts.push(`before:${end}`);

    const excluded = (logic?.excludeTerms ?? []).map(clean).filter(Boolean);
    excluded.forEach(term => {
      if ((term.match(/"/g) ?? []).length % 2 !== 0) throw new Error("Excluded term contains unbalanced quotation marks.");
      parts.push(`-${quoteAlternative(term)}`);
    });

    // Legacy advanced controls remain represented, but operators without a value are rejected.
    if (filters.advancedOperators?.related?.some(value => clean(value))) {
      throw new Error("The related: operator is not included because provider behavior is unverified.");
    }
    if (filters.advancedOperators?.cache) throw new Error("The cache: operator requires a value and is not supported by this builder.");
    if (filters.advancedOperators?.ext?.some(value => clean(value))) {
      throw new Error("Use the file type filter; ext: compatibility is not verified consistently.");
    }
    if (filters.advancedOperators?.around) throw new Error("AROUND(n) compatibility is not verified across providers.");

    const query = parts.filter(Boolean).join(" ").trim();
    if (!query) throw new Error("Enter a keyword, exact phrase, or search filter before continuing.");
    const errors = validateQuerySyntax(query);
    if (errors.length) throw new Error(errors[0]);
    return query;
  }

  serialize(query?: string): QuerySerialization {
    const finalQuery = query ?? this.buildQuery();
    if (!finalQuery.trim()) throw new Error("Enter a query before opening search.");
    const provider = this.getProvider();
    const url = new URL(provider.searchUrl);
    url.searchParams.set("q", finalQuery);
    const operators = this.detectOperators(finalQuery);
    const warnings = operators
      .filter(operator => operator !== "or" && !provider.supportedOperators.includes(operator))
      .map(operator => `${operator} syntax is not verified for ${provider.name}; the query is preserved as entered.`);
    if (operators.includes("or") && !provider.supportedOperators.includes("or")) {
      warnings.push(`${provider.name} OR/grouping compatibility is not verified; the grouped query is preserved.`);
    }
    return { query: finalQuery, url: url.toString(), operators, warnings: unique(warnings) };
  }

  buildSearchUrl(query?: string): string { return this.serialize(query).url; }

  validateRawQuery(query: string): QueryValidation {
    const errors = query.trim() ? validateQuerySyntax(query) : ["Enter a query before continuing."];
    let warnings: string[] = [];
    try { warnings = this.serialize(query).warnings; }
    catch (error) { errors.push(error instanceof Error ? error.message : "Invalid provider."); }
    return { valid: errors.length === 0, warnings: unique(warnings), errors: unique(errors) };
  }

  validateQuery(): QueryValidation {
    try {
      const query = this.buildQuery();
      return { valid: true, warnings: this.serialize(query).warnings, errors: [] };
    } catch (error) {
      return { valid: false, warnings: [], errors: [error instanceof Error ? error.message : "Invalid query."] };
    }
  }

  getFilters(): StructuredFilters { return { ...this.filters }; }

  private detectOperators(query: string): SearchOperator[] {
    const found = new Set<SearchOperator>();
    if (/\bsite:/i.test(query)) found.add("site");
    if (/\bfiletype:/i.test(query)) found.add("filetype");
    if (/\bafter:/i.test(query)) found.add("after");
    if (/\bbefore:/i.test(query)) found.add("before");
    if (/\bintitle:/i.test(query)) found.add("intitle");
    if (/\ballintitle:/i.test(query)) found.add("allintitle");
    if (/\binurl:/i.test(query)) found.add("inurl");
    if (/\ballinurl:/i.test(query)) found.add("allinurl");
    if (/\bintext:/i.test(query)) found.add("intext");
    if (/\ballintext:/i.test(query)) found.add("allintext");
    if (/\brelated:/i.test(query)) found.add("related");
    if (/\bcache:/i.test(query)) found.add("cache");
    if (/\bext:/i.test(query)) found.add("ext");
    if (/\bAROUND\s*\(/i.test(query)) found.add("around");
    if (/(?:^|\s)-\S/.test(query)) found.add("exclude");
    if (/"[^"\n]+"/.test(query)) found.add("exact");
    if (/\bOR\b/.test(query)) found.add("or");
    return [...found];
  }
}
