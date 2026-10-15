"use client";

import React, { useCallback, useMemo, useState } from "react";
import { SearchQueryBuilder, SEARCH_PROVIDERS, PLATFORM_DOMAINS, DOCUMENT_TYPES } from "../lib/search-query-builder";
import { Investigation } from "../types";
import { api } from "../lib/api";
import { 
  StructuredFilters, 
  SiteFilter, 
  DocumentTypeFilter,
  SearchProvider,
  SearchCategory,
  SearchQueryCreateRequest,
} from "../types/search";

interface DorkingStudioProps {
  investigations: Investigation[];
  onRefreshInvestigations: () => Promise<void>;
}

export function DorkingStudio({ investigations, onRefreshInvestigations }: DorkingStudioProps) {
  // State for filters
  const [filters, setFilters] = useState<Partial<StructuredFilters>>({
    mainKeywords: [],
    searchEngine: "google" as SearchProvider,
    searchType: "general" as SearchCategory,
  });

  // UI state
  const [keywordsInput, setKeywordsInput] = useState("");
  const [rawQuery, setRawQuery] = useState("");
  const [hasRawDraft, setHasRawDraft] = useState(false);
  const [isRawMode, setIsRawMode] = useState(false);
  const [selectedInvestigation, setSelectedInvestigation] = useState<string>("");
  const [searchTitle, setSearchTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Site selection state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [customDomain, setCustomDomain] = useState("");
  const [excludeSites, setExcludeSites] = useState(false);

  // Document type selection
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);
  const [customFiletype, setCustomFiletype] = useState("");

  // Keyword logic
  const [alternativeKeywordsInput, setAlternativeKeywordsInput] = useState("");
  const [excludeTerms, setExcludeTerms] = useState<string[]>([]);
  const [excludeTermInput, setExcludeTermInput] = useState("");
  const [exactPhrases, setExactPhrases] = useState<string[]>([]);
  const [exactPhraseInput, setExactPhraseInput] = useState("");

  // Page attributes
  const [intitle, setIntitle] = useState("");
  const [inurl, setInurl] = useState("");
  const [intext, setIntext] = useState("");

  // Date filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Helper functions
  const getSiteFilters = useCallback((): SiteFilter[] => {
    const sites: SiteFilter[] = [];

    // Add selected platforms
    selectedPlatforms.forEach(platform => {
      const domain = PLATFORM_DOMAINS[platform as keyof typeof PLATFORM_DOMAINS];
      if (domain) {
        sites.push({
          domain,
          platform,
          exclude: excludeSites,
        });
      }
    });

    // Add custom domain
    if (customDomain.trim()) {
      sites.push({
        domain: customDomain.trim(),
        exclude: excludeSites,
      });
    }

    return sites;
  }, [selectedPlatforms, excludeSites, customDomain]);

  const getDocumentFilters = useCallback((): DocumentTypeFilter[] => {
    const docs: DocumentTypeFilter[] = [];

    // Add selected document types
    selectedDocTypes.forEach(docType => {
      const filetype = DOCUMENT_TYPES[docType as keyof typeof DOCUMENT_TYPES];
      if (filetype) {
        docs.push({
          filetype,
          extension: filetype,
        });
      }
    });

    // Add custom filetype
    if (customFiletype.trim()) {
      docs.push({
        filetype: customFiletype.trim(),
        extension: customFiletype.trim(),
      });
    }

    return docs;
  }, [selectedDocTypes, customFiletype]);

  const getKeywordLogic = useCallback(() => {
    const alternativeKeywords = alternativeKeywordsInput
      .split(/[\n,]/)
      .map(keyword => keyword.trim())
      .filter(Boolean);
    if (!filters.mainKeywords?.length && !exactPhrases.length && !excludeTerms.length && !alternativeKeywords.length) {
      return undefined;
    }

    return {
      operator: "AND" as const,
      excludeTerms,
      exactPhrases,
      termGroups: alternativeKeywords.length
        ? [{ terms: alternativeKeywords, operator: "OR" as const }]
        : [],
    };
  }, [filters.mainKeywords, exactPhrases, excludeTerms, alternativeKeywordsInput]);

  const getPageAttributes = useCallback((): StructuredFilters["pageAttributes"] => {
    const attrs: NonNullable<StructuredFilters["pageAttributes"]> = {};

    if (intitle.trim()) attrs.intitle = [intitle.trim()];
    if (inurl.trim()) attrs.inurl = [inurl.trim()];
    if (intext.trim()) attrs.intext = [intext.trim()];

    return Object.keys(attrs).length > 0 ? attrs : undefined;
  }, [intitle, inurl, intext]);

  const getDateFilters = useCallback(() => {
    if (!startDate && !endDate) return undefined;

    return {
      startDate,
      endDate,
    };
  }, [startDate, endDate]);

  // Main query update function
  const effectiveFilters = useMemo(() => ({
    ...filters,
    mainKeywords: filters.mainKeywords || [],
    sites: getSiteFilters(),
    documentTypes: getDocumentFilters(),
    keywordLogic: getKeywordLogic(),
    pageAttributes: getPageAttributes(),
    dateFilters: getDateFilters(),
  } as StructuredFilters), [filters, getSiteFilters, getDocumentFilters, getKeywordLogic,
    getPageAttributes, getDateFilters]);
  const queryBuilder = useMemo(
    () => new SearchQueryBuilder(effectiveFilters, effectiveFilters.searchEngine || "google"),
    [effectiveFilters],
  );
  const builderState = useMemo(() => {
    try {
      return { query: queryBuilder.buildQuery(), validation: queryBuilder.validateQuery() };
    } catch (error) {
      return {
        query: "",
        validation: { valid: false, warnings: [], errors: [error instanceof Error ? error.message : "Invalid query."] },
      };
    }
  }, [queryBuilder]);
  const queryText = isRawMode ? rawQuery : builderState.query;
  const validation = isRawMode ? queryBuilder.validateRawQuery(rawQuery) : builderState.validation;

  // Event handlers
  const handleKeywordsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setKeywordsInput(value);

    const keywords = value
      .split(/[\n,]/)
      .map(k => k.trim())
      .filter(k => k.length > 0);

    setFilters(prev => ({ ...prev, mainKeywords: keywords }));
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleDocTypeToggle = (docType: string) => {
    setSelectedDocTypes(prev =>
      prev.includes(docType)
        ? prev.filter(d => d !== docType)
        : [...prev, docType]
    );
  };

  const handleAddExcludeTerm = () => {
    if (excludeTermInput.trim()) {
      setExcludeTerms(prev => [...prev, excludeTermInput.trim()]);
      setExcludeTermInput("");
    }
  };

  const handleRemoveExcludeTerm = (index: number) => {
    setExcludeTerms(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddExactPhrase = () => {
    if (exactPhraseInput.trim()) {
      setExactPhrases(prev => [...prev, exactPhraseInput.trim()]);
      setExactPhraseInput("");
    }
  };

  const handleRemoveExactPhrase = (index: number) => {
    setExactPhrases(prev => prev.filter((_, i) => i !== index));
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = e.target.value as SearchProvider;
    setFilters(prev => ({ ...prev, searchEngine: provider }));
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value as SearchCategory;
    setFilters(prev => ({ ...prev, searchType: category }));
  };

  const handleRawQueryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRawQuery(e.target.value);
  };

  const handleReset = () => {
    // Reset all filters
    setFilters({
      mainKeywords: [],
      searchEngine: "google",
      searchType: "general",
    });
    setKeywordsInput("");
    setSelectedPlatforms([]);
    setCustomDomain("");
    setExcludeSites(false);
    setSelectedDocTypes([]);
    setCustomFiletype("");
    setAlternativeKeywordsInput("");
    setExcludeTerms([]);
    setExcludeTermInput("");
    setExactPhrases([]);
    setExactPhraseInput("");
    setIntitle("");
    setInurl("");
    setIntext("");
    setStartDate("");
    setEndDate("");
    setRawQuery("");
    setHasRawDraft(false);
    setSearchTitle("");
    setSelectedInvestigation("");
    setIsRawMode(false);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleCopyQuery = () => {
    navigator.clipboard.writeText(queryText);
  };

  const handleOpenSearch = () => {
    try {
      const url = new URL(queryBuilder.buildSearchUrl(queryText));
      if (url.protocol !== "https:" || !Object.values(SEARCH_PROVIDERS).some(provider => provider.searchUrl === `${url.origin}${url.pathname}`)) {
        throw new Error("Search URL is not an approved HTTPS provider URL.");
      }
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Failed to open search:", error);
    }
  };

  const handleSaveToInvestigation = async () => {
    if (!queryText.trim()) {
      setSaveError("Cannot save empty query");
      return;
    }

    if (!searchTitle.trim()) {
      setSaveError("Please provide a search title");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const saveRequest: SearchQueryCreateRequest = {
        investigation_id: selectedInvestigation || null,
        title: searchTitle.trim(),
        query_text: queryText,
        provider: filters.searchEngine || "google",
        category: filters.searchType || "general",
        structured_filters: { ...effectiveFilters, queryMode: isRawMode ? "raw" : "builder" },
      };

      await api.createSearchQuery(saveRequest);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      // Refresh investigations list
      await onRefreshInvestigations();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save query");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRawMode = () => {
    if (!isRawMode) {
      if (!hasRawDraft) {
        setRawQuery(queryText);
        setHasRawDraft(true);
      }
      setIsRawMode(true);
    } else {
      setIsRawMode(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Dorking Studio</h1>
        <p className="text-zinc-400">
          Build advanced search engine queries for OSINT investigations. All filters are optional.
        </p>
      </div>

      {/* Panel A - Search Context */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Search Context</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Search Title (optional)
              </label>
              <input
                type="text"
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="My OSINT search for..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Main Keywords (one per line or comma separated)
              </label>
              <textarea
                value={keywordsInput}
                onChange={handleKeywordsChange}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-mono text-sm"
                placeholder="museum nasional&#10;Jakarta&#10;sejarah"
                rows={4}
              />
              <div className="mt-1 text-xs text-zinc-500">
                Enter one keyword per line or separate with commas
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Search Engine
              </label>
              <select
                value={filters.searchEngine}
                onChange={handleProviderChange}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                {Object.values(SEARCH_PROVIDERS).map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Search Category
              </label>
              <select
                value={filters.searchType}
                onChange={handleCategoryChange}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="general">General</option>
                <option value="website">Website</option>
                <option value="document">Document</option>
                <option value="username">Username</option>
                <option value="person_name">Person Name</option>
                <option value="organization">Organization</option>
                <option value="location_place">Location/Place</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Save to Investigation (optional)
              </label>
              <select
                value={selectedInvestigation}
                onChange={(e) => setSelectedInvestigation(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="">-- Select investigation --</option>
                {investigations.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Panel B - Search Operators (Collapsible sections) */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Search Operators</h2>
        
        <div className="space-y-6">
          {/* Sites section */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-zinc-300">A. Site / Domain</h3>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.keys(PLATFORM_DOMAINS).map(platform => (
                <button
                  key={platform}
                  onClick={() => handlePlatformToggle(platform)}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    selectedPlatforms.includes(platform)
                      ? "bg-cyan-900 text-cyan-300 border border-cyan-800"
                      : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                  }`}
                >
                  {platform}
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Custom Domain
                </label>
                <input
                  type="text"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="example.com"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={excludeSites}
                    onChange={(e) => setExcludeSites(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-zinc-300">Exclude sites</span>
                </label>
              </div>
            </div>
          </div>

          {/* Document types section */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-zinc-300">B. Document Type</h3>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.keys(DOCUMENT_TYPES).map(docType => (
                <button
                  key={docType}
                  onClick={() => handleDocTypeToggle(docType)}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    selectedDocTypes.includes(docType)
                      ? "bg-cyan-900 text-cyan-300 border border-cyan-800"
                      : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                  }`}
                >
                  {docType.toUpperCase()}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Custom Filetype
              </label>
              <input
                type="text"
                value={customFiletype}
                onChange={(e) => setCustomFiletype(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="py, js, php, etc."
              />
            </div>
          </div>

          {/* Keyword logic section */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-zinc-300">C. Keyword Logic</h3>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Alternative Keywords (OR)
              </label>
              <textarea
                value={alternativeKeywordsInput}
                onChange={(e) => setAlternativeKeywordsInput(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-mono text-sm"
                placeholder={'cybersecurity\nkeamanan siber'}
                rows={2}
              />
              <div className="mt-1 text-xs text-zinc-500">
                Any term here may match; main keywords and selected filters still apply.
              </div>
            </div>

            {/* Exclude terms */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Exclude Terms
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={excludeTermInput}
                  onChange={(e) => setExcludeTermInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddExcludeTerm()}
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="lowongan, iklan, etc."
                />
                <button
                  onClick={handleAddExcludeTerm}
                  className="px-3 py-2 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-md border border-zinc-700"
                >
                  Add
                </button>
              </div>
              {excludeTerms.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {excludeTerms.map((term, index) => (
                    <div
                      key={index}
                      className="px-2 py-1 bg-red-900/30 text-red-300 rounded text-sm flex items-center"
                    >
                      -{term}
                      <button
                        onClick={() => handleRemoveExcludeTerm(index)}
                        className="ml-2 text-red-400 hover:text-red-300"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Exact phrases */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Exact Phrases
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={exactPhraseInput}
                  onChange={(e) => setExactPhraseInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddExactPhrase()}
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder='"Museum Nasional"'
                />
                <button
                  onClick={handleAddExactPhrase}
                  className="px-3 py-2 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-md border border-zinc-700"
                >
                  Add
                </button>
              </div>
              {exactPhrases.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {exactPhrases.map((phrase, index) => (
                    <div
                      key={index}
                      className="px-2 py-1 bg-green-900/30 text-green-300 rounded text-sm flex items-center"
                    >
                      <span>{`"${phrase}"`}</span>
                      <button
                        onClick={() => handleRemoveExactPhrase(index)}
                        className="ml-2 text-green-400 hover:text-green-300"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Page attributes section */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-zinc-300">D. Page Attributes</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  in title (intitle:)
                </label>
                <input
                  type="text"
                  value={intitle}
                  onChange={(e) => setIntitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="keyword in page title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  in URL (inurl:)
                </label>
                <input
                  type="text"
                  value={inurl}
                  onChange={(e) => setInurl(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="keyword in URL"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  in text (intext:)
                </label>
                <input
                  type="text"
                  value={intext}
                  onChange={(e) => setIntext(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="keyword in page text"
                />
              </div>
            </div>
          </div>

          {/* Date filters section */}
          <div className="space-y-4">
            <h3 className="text-md font-medium text-zinc-300">E. Date Filters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Start Date (after:)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  End Date (before:)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel C - Live Query Preview */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Live Query Preview</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleRawMode}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                isRawMode
                  ? "bg-cyan-900 text-cyan-300 border border-cyan-800"
                  : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
              }`}
            >
              {isRawMode ? "Builder Mode" : "Raw Mode"}
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-md text-sm bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 border border-zinc-700"
            >
              Reset All
            </button>
          </div>
        </div>

        {/* Validation messages */}
        {validation.errors.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-200 text-sm">
            <div className="font-semibold mb-1">Errors:</div>
            <ul className="list-disc list-inside space-y-1">
              {validation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {validation.warnings.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-amber-950/40 border border-amber-800 text-amber-200 text-sm">
            <div className="font-semibold mb-1">Warnings:</div>
            <ul className="list-disc list-inside space-y-1">
              {validation.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Query preview */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            {isRawMode ? "Edit Query Directly" : "Generated Query"}
          </label>
          <textarea
            value={queryText}
            onChange={handleRawQueryChange}
            className="w-full px-3 py-3 bg-zinc-800 border border-zinc-700 rounded-md text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            rows={4}
            readOnly={!isRawMode}
          />
          <div className="mt-1 text-xs text-zinc-500">
            {isRawMode
              ? "Editing query directly. Changes will be used for copy/open operations."
              : `Preview of the query that will be sent to ${SEARCH_PROVIDERS[(filters.searchEngine || "google") as keyof typeof SEARCH_PROVIDERS].name}.`}
          </div>
        </div>

        {/* Active filters summary */}
        <div className="mb-6 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
          <div className="text-sm font-medium text-zinc-300 mb-2">Active Filters:</div>
          <div className="flex flex-wrap gap-2">
            {filters.mainKeywords && filters.mainKeywords.length > 0 && (
              <div className="px-2 py-1 bg-zinc-700 text-zinc-300 rounded text-xs">
                Keywords: {filters.mainKeywords.length}
              </div>
            )}
            {effectiveFilters.sites && effectiveFilters.sites.length > 0 && (
              <div className="px-2 py-1 bg-cyan-900/30 text-cyan-300 rounded text-xs">
                Sites: {effectiveFilters.sites.length}
              </div>
            )}
            {effectiveFilters.documentTypes && effectiveFilters.documentTypes.length > 0 && (
              <div className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-xs">
                Document types: {effectiveFilters.documentTypes.length}
              </div>
            )}
            {excludeTerms.length > 0 && (
              <div className="px-2 py-1 bg-red-900/30 text-red-300 rounded text-xs">
                Excluded terms: {excludeTerms.length}
              </div>
            )}
            {exactPhrases.length > 0 && (
              <div className="px-2 py-1 bg-green-900/30 text-green-300 rounded text-xs">
                Exact phrases: {exactPhrases.length}
              </div>
            )}
            {(startDate || endDate) && (
              <div className="px-2 py-1 bg-purple-900/30 text-purple-300 rounded text-xs">
                Date filters
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCopyQuery}
            disabled={!queryText.trim() || validation.errors.length > 0}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              queryText.trim()
                ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }`}
          >
            Copy Query
          </button>

          <button
            onClick={handleOpenSearch}
            disabled={!queryText.trim() || validation.errors.length > 0}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              queryText.trim() && validation.errors.length === 0
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }`}
          >
            Open in {SEARCH_PROVIDERS[(filters.searchEngine || "google") as keyof typeof SEARCH_PROVIDERS].name}
          </button>

          <div className="flex-1" />

          <button
            onClick={handleSaveToInvestigation}
            disabled={isSaving || !queryText.trim() || !searchTitle.trim() || validation.errors.length > 0}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              !isSaving && queryText.trim() && searchTitle.trim()
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            }`}
          >
            {isSaving ? "Saving..." : "Save to Investigation"}
          </button>
        </div>

        {/* Save status */}
        {saveError && (
          <div className="mt-3 p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-200 text-sm">
            {saveError}
          </div>
        )}

        {saveSuccess && (
          <div className="mt-3 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-200 text-sm">
            Query saved successfully!
          </div>
        )}
      </div>

      {/* Provider compatibility note */}
      <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700 text-sm text-zinc-400">
        <div className="font-medium text-zinc-300 mb-1">Note:</div>
        <p>
          Query syntax and operator support vary by search engine. The preview shows the query as it will be sent, 
          but some providers may ignore or interpret operators differently. Check provider documentation for details.
        </p>
      </div>
    </div>
  );
}
