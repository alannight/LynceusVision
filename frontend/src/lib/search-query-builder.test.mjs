import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const sourcePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "search-query-builder.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: sourcePath,
}).outputText;
const compiledModule = new Module(sourcePath);
compiledModule.filename = sourcePath;
compiledModule.paths = Module._nodeModulePaths(path.dirname(sourcePath));
compiledModule._compile(output, sourcePath);
const { SearchQueryBuilder } = compiledModule.exports;

function build({ keywords = [], sites = [], files = [], exact = [], exclude = [], dates = {}, provider = "google" } = {}) {
  return new SearchQueryBuilder({}, provider)
    .setKeywords(keywords)
    .setSites(sites.map(domain => ({ domain })))
    .setDocumentTypes(files.map(filetype => ({ filetype })))
    .setKeywordLogic({ operator: "AND", exactPhrases: exact, excludeTerms: exclude, termGroups: [] })
    .setDateFilters(dates);
}

test("acceptance A: exact phrase is emitted once with site and filetype", () => {
  assert.equal(build({ sites: ["go.id"], exact: ["laporan tahunan"], files: ["pdf"] }).buildQuery(), 'site:go.id "laporan tahunan" filetype:pdf');
});

test("acceptance B: exact phrases can be explicitly connected with AND", () => {
  const builder = build({ sites: ["ac.id"], exact: ["kecerdasan buatan", "pembelajaran mesin"] });
  builder.setKeywordLogic({ operator: "AND", exactPhrases: ["kecerdasan buatan", "pembelajaran mesin"], exactPhraseOperator: "AND", excludeTerms: [], termGroups: [] });
  assert.equal(builder.buildQuery(), 'site:ac.id "kecerdasan buatan" AND "pembelajaran mesin"');
});

test("acceptance C: site and extension alternatives do not absorb required phrases", () => {
  const builder = build({ sites: ["edu", "ac.id"], exact: ["jurnal", "keamanan jaringan"] });
  builder.setDocumentTypes([{ filetype: "docx", operator: "ext" }]);
  assert.equal(builder.buildQuery(), '(site:edu OR site:ac.id) "jurnal" "keamanan jaringan" ext:docx');
});

test("acceptance D: excluded domain and exact phrase remain negative", () => {
  const builder = build({ exact: ["panduan mitigasi bencana"], files: ["pdf"], exclude: ["berbayar"] });
  builder.setSites([{ domain: "com", exclude: true }]);
  assert.equal(builder.buildQuery(), '"panduan mitigasi bencana" filetype:pdf -site:com -"berbayar"');
});

test("acceptance E: title and URL attributes precede body phrase", () => {
  const builder = build({ sites: ["org"], exact: ["kesehatan masyarakat"] });
  builder.setPageAttributes({ intitle: ["data statistik"], inurl: ["2023"] });
  assert.equal(builder.buildQuery(), 'site:org intitle:"data statistik" inurl:2023 "kesehatan masyarakat"');
});

test("acceptance F: multiple ext alternatives form one OR group", () => {
  const builder = build({ sites: ["bps.go.id"], exact: ["sensus penduduk"] });
  builder.setAdvancedOperators({ ext: ["xls", "xlsx", "csv"] });
  assert.equal(builder.buildQuery(), 'site:bps.go.id "sensus penduduk" (ext:xls OR ext:xlsx OR ext:csv)');
});

test("keyword only omits all optional operators", () => {
  assert.equal(build({ keywords: ["keamanan siber Indonesia"] }).buildQuery(), "keamanan siber Indonesia");
});

test("one site uses a compact site operator", () => {
  assert.equal(build({ keywords: ["museum nasional Jakarta"], sites: ["facebook.com"] }).buildQuery(), "site:facebook.com museum nasional Jakarta");
});

test("multiple sites are grouped as alternatives", () => {
  assert.equal(build({ keywords: ["museum nasional"], sites: ["facebook.com", "instagram.com"] }).buildQuery(), "(site:facebook.com OR site:instagram.com) museum nasional");
});

test("site alternatives scope one keyword without duplicating it", () => {
  const query = build({ keywords: ["KATA_KUNCI"], sites: ["domain-a.test", "domain-b.test"] }).buildQuery();
  assert.equal(query, "(site:domain-a.test OR site:domain-b.test) KATA_KUNCI");
  assert.equal(query.split("KATA_KUNCI").length - 1, 1);
  assert.doesNotMatch(query, /KATA_KUNCI.*\bOR\b.*KATA_KUNCI/);
});

test("intentional repeated keyword entries remain repeated", () => {
  assert.equal(build({ keywords: ["keyword", "keyword"] }).buildQuery(), "keyword keyword");
});

test("one file type and one site compose independently", () => {
  assert.equal(build({ keywords: ["keamanan informasi"], sites: ["upnvj.ac.id"], files: ["pdf"] }).buildQuery(), "site:upnvj.ac.id keamanan informasi filetype:pdf");
});

test("multiple file types are grouped without swallowing keywords", () => {
  assert.equal(build({ keywords: ["keamanan informasi"], files: ["pdf", "docx"] }).buildQuery(), 'keamanan informasi (filetype:pdf OR filetype:docx)');
});

test("exact phrases remain quoted alongside ordinary keywords", () => {
  assert.equal(build({ keywords: ["security operations center"], exact: ["incident response"] }).buildQuery(), '"incident response" security operations center');
});

test("OR alternatives quote multiword alternatives and keep site scope grouped", () => {
  const builder = build({ sites: ["upnvj.ac.id"] });
  builder.setKeywords(["cybersecurity", "keamanan siber"]);
  builder.setKeywordLogic({ operator: "OR", exactPhrases: [], excludeTerms: [], termGroups: [] });
  assert.equal(builder.buildQuery(), 'site:upnvj.ac.id (cybersecurity OR "keamanan siber")');
});

test("main keywords combine with an explicit alternative-keyword group", () => {
  const builder = build({ keywords: ["laporan tahunan"], sites: ["upnvj.ac.id"] });
  builder.setKeywordLogic({
    operator: "AND", exactPhrases: [], excludeTerms: [],
    termGroups: [{ terms: ["cybersecurity", "keamanan siber"], operator: "OR" }],
  });
  assert.equal(builder.buildQuery(), 'site:upnvj.ac.id laporan tahunan (cybersecurity OR "keamanan siber")');
});

test("explicit term groups retain their AND/OR nesting", () => {
  const builder = build({ keywords: ["public data"] });
  builder.setKeywordLogic({
    operator: "AND", exactPhrases: [], excludeTerms: [],
    termGroups: [{ terms: ["incident response", "breach handling"], operator: "OR" }],
  });
  assert.equal(builder.buildQuery(), 'public data ("incident response" OR "breach handling")');
});

test("exclusions are appended as negative terms", () => {
  assert.equal(build({ keywords: ["phishing detection"], exclude: ["job", "vacancy"] }).buildQuery(), 'phishing detection -"job" -"vacancy"');
});

test("after, before, and valid date ranges serialize consistently", () => {
  assert.equal(build({ sites: ["upnvj.ac.id"], keywords: ["cybersecurity"], dates: { startDate: "2024-01-01" } }).buildQuery(), "site:upnvj.ac.id cybersecurity after:2024-01-01");
  assert.equal(build({ keywords: ["cybersecurity"], dates: { endDate: "2024-12-31" } }).buildQuery(), "cybersecurity before:2024-12-31");
  assert.equal(build({ keywords: ["cybersecurity"], dates: { startDate: "2024-01-01", endDate: "2024-12-31" } }).buildQuery(), "cybersecurity after:2024-01-01 before:2024-12-31");
});

test("combined site, file, phrase, and exclusion filters preserve each group", () => {
  assert.equal(build({ sites: ["upnvj.ac.id", "komdigi.go.id"], files: ["pdf", "docx"], exact: ["keamanan informasi"], exclude: ["lowongan"] }).buildQuery(), '(site:upnvj.ac.id OR site:komdigi.go.id) "keamanan informasi" (filetype:pdf OR filetype:docx) -"lowongan"');
});

test("empty input is rejected with a clear message", () => {
  assert.throws(() => build().buildQuery(), /Enter a keyword, exact phrase, or search filter/);
});

test("empty optional filters are ignored", () => {
  assert.equal(build({ keywords: ["keamanan informasi"], sites: [], files: [], exact: ["  "], exclude: [""] }).buildQuery(), "keamanan informasi");
});

test("a selected filter can form a query without a separate keyword", () => {
  assert.equal(build({ sites: ["upnvj.ac.id"] }).buildQuery(), "site:upnvj.ac.id");
});

test("Unicode and reserved punctuation survive query and URL round trip exactly once", () => {
  const query = 'C++ security "informasi publik" nama organisasi & lokasi';
  const builder = build({ keywords: [query] });
  const serialization = builder.serialize(query);
  assert.equal(new URL(serialization.url).searchParams.get("q"), query);
  assert.equal(serialization.url.includes("%2520"), false);
});

test("each provider URL round trips the exact query through q", () => {
  for (const provider of ["google", "bing", "duckduckgo", "brave"]) {
    const builder = build({ keywords: ["keamanan siber Indonesia"] , provider });
    const serialized = builder.serialize();
    assert.equal(new URL(serialized.url).searchParams.get("q"), serialized.query, provider);
    assert.equal(new URL(serialized.url).protocol, "https:");
  }
});

test("raw query validation preserves text and flags malformed grouping", () => {
  const builder = build({ provider: "brave" });
  const raw = '  "keamanan & siber" OR site:upnvj.ac.id  ';
  assert.equal(builder.validateRawQuery(raw).valid, true);
  assert.equal(builder.serialize(raw).query, raw);
  assert.match(builder.validateRawQuery('"unclosed').errors[0], /unbalanced quotation/);
  assert.match(builder.validateRawQuery("(one OR two").errors[0], /unmatched opening/);
  assert.match(builder.validateRawQuery("one OR").errors[0], /OR must have/);
  assert.match(builder.validateRawQuery("OR one").errors[0], /OR must have/);
  assert.match(builder.validateRawQuery("one OR OR two").errors[0], /OR must have/);
  assert.match(builder.validateRawQuery("one after:2025-01-01 before:2024-01-01").errors[0], /on or before/);
  assert.match(builder.validateRawQuery("site:javascript:alert").errors[0], /hostname only|Invalid site domain/);
});

test("provider change retains raw query and reports unverified syntax", () => {
  const builder = build({ provider: "google" });
  const query = "keyword after:2024-01-01";
  builder.setProvider("duckduckgo");
  const result = builder.serialize(query);
  assert.equal(result.query, query);
  assert.ok(result.warnings.some(warning => warning.includes("after syntax is not verified")));
  assert.equal(new URL(result.url).searchParams.get("q"), query);
});

test("invalid domains, file types, dates, ranges, and incomplete syntax are rejected", () => {
  assert.throws(() => build({ keywords: ["x"], sites: ["https://example.com/path"] }).buildQuery(), /hostname only/);
  assert.throws(() => build({ keywords: ["x"], sites: [""] }).buildQuery(), /empty domain/);
  assert.throws(() => build({ keywords: ["x"], files: [""] }).buildQuery(), /empty/);
  assert.throws(() => build({ keywords: ["x"], dates: { startDate: "2024-02-30" } }).buildQuery(), /valid calendar date/);
  assert.throws(() => build({ keywords: ["x"], dates: { startDate: "2025-01-01", endDate: "2024-01-01" } }).buildQuery(), /on or before/);
  assert.equal(build().validateRawQuery("site: example.com").valid, false);
  assert.throws(() => build({ keywords: ["x"], files: ["bad/extension"] }).buildQuery(), /Invalid file type/);
  const unmatched = build({ keywords: ["x"] });
  unmatched.setKeywordLogic({ operator: "AND", exactPhrases: ['unclosed"'], excludeTerms: [], termGroups: [] });
  assert.throws(() => unmatched.buildQuery(), /unbalanced quotation/);
  const singleAlternative = build({ keywords: ["x"] });
  singleAlternative.setKeywordLogic({ operator: "AND", exactPhrases: [], excludeTerms: [], termGroups: [{ operator: "OR", terms: ["one"] }] });
  assert.throws(() => singleAlternative.buildQuery(), /at least two/);
});

test("URL builder rejects unknown or custom providers", () => {
  assert.throws(() => new SearchQueryBuilder({}, "custom").buildSearchUrl("query"), /Unsupported search provider/);
});

test("supports valid Unicode and IDN domains without rejection", () => {
  const query = build({ keywords: ["stadtverwaltung"], sites: ["münchen.de"] }).buildQuery();
  assert.equal(query, "site:münchen.de stadtverwaltung");

  const idnQuery = build({ keywords: ["новости"], sites: ["россия.рф"] }).buildQuery();
  assert.equal(idnQuery, "site:россия.рф новости");
});

test("query consistency between Preview, Copy, Open, and Save inputs", () => {
  const builder = build({
    keywords: ["keamanan siber"],
    sites: ["upnvj.ac.id"],
    files: ["pdf"],
    exact: ["analisis risiko"],
    exclude: ["lowongan"],
    provider: "google",
  });
  const expectedQuery = 'site:upnvj.ac.id "analisis risiko" keamanan siber filetype:pdf -"lowongan"';

  // 1. Preview query
  const previewQuery = builder.buildQuery();
  assert.equal(previewQuery, expectedQuery);

  // 2. Serialized query for Copy & Open
  const serialized = builder.serialize();
  assert.equal(serialized.query, expectedQuery);
  assert.equal(new URL(serialized.url).searchParams.get("q"), expectedQuery);

  // 3. Raw query mode retains identical query without mutation
  const rawValidation = builder.validateRawQuery(expectedQuery);
  assert.equal(rawValidation.valid, true);
  assert.equal(builder.serialize(expectedQuery).query, expectedQuery);
});

test("retains structured filter input across provider changes without corruption", () => {
  const builder = build({
    keywords: ["data breach"],
    sites: ["example.com"],
    files: ["json"],
    provider: "google",
  });
  const googleQuery = builder.buildQuery();
  assert.equal(googleQuery, "site:example.com data breach filetype:json");

  builder.setProvider("bing");
  const bingQuery = builder.buildQuery();
  assert.equal(bingQuery, "site:example.com data breach filetype:json");

  builder.setProvider("duckduckgo");
  const ddgQuery = builder.buildQuery();
  assert.equal(ddgQuery, "site:example.com data breach filetype:json");
});
