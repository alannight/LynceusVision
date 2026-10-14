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

test("keyword only omits all optional operators", () => {
  assert.equal(build({ keywords: ["keamanan siber Indonesia"] }).buildQuery(), "keamanan siber Indonesia");
});

test("one site uses a compact site operator", () => {
  assert.equal(build({ keywords: ["museum nasional Jakarta"], sites: ["facebook.com"] }).buildQuery(), "museum nasional Jakarta site:facebook.com");
});

test("multiple sites are grouped as alternatives", () => {
  assert.equal(build({ keywords: ["museum nasional"], sites: ["facebook.com", "instagram.com"] }).buildQuery(), "museum nasional (site:facebook.com OR site:instagram.com)");
});

test("one file type and one site compose independently", () => {
  assert.equal(build({ keywords: ["keamanan informasi"], sites: ["upnvj.ac.id"], files: ["pdf"] }).buildQuery(), "keamanan informasi site:upnvj.ac.id filetype:pdf");
});

test("multiple file types are grouped without swallowing keywords", () => {
  assert.equal(build({ keywords: ["keamanan informasi"], files: ["pdf", "docx"] }).buildQuery(), "keamanan informasi (filetype:pdf OR filetype:docx)");
});

test("exact phrases remain quoted alongside ordinary keywords", () => {
  assert.equal(build({ keywords: ["security operations center"], exact: ["incident response"] }).buildQuery(), 'security operations center "incident response"');
});

test("OR alternatives quote multiword alternatives and keep site scope grouped", () => {
  const builder = build({ sites: ["upnvj.ac.id"] });
  builder.setKeywords(["cybersecurity", "keamanan siber"]);
  builder.setKeywordLogic({ operator: "OR", exactPhrases: [], excludeTerms: [], termGroups: [] });
  assert.equal(builder.buildQuery(), '(cybersecurity OR "keamanan siber") site:upnvj.ac.id');
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
  assert.equal(build({ keywords: ["phishing detection"], exclude: ["job", "vacancy"] }).buildQuery(), "phishing detection -job -vacancy");
});

test("after, before, and valid date ranges serialize consistently", () => {
  assert.equal(build({ sites: ["upnvj.ac.id"], keywords: ["cybersecurity"], dates: { startDate: "2024-01-01" } }).buildQuery(), "cybersecurity site:upnvj.ac.id after:2024-01-01");
  assert.equal(build({ keywords: ["cybersecurity"], dates: { endDate: "2024-12-31" } }).buildQuery(), "cybersecurity before:2024-12-31");
  assert.equal(build({ keywords: ["cybersecurity"], dates: { startDate: "2024-01-01", endDate: "2024-12-31" } }).buildQuery(), "cybersecurity after:2024-01-01 before:2024-12-31");
});

test("combined site, file, phrase, and exclusion filters preserve each group", () => {
  assert.equal(build({ sites: ["upnvj.ac.id", "komdigi.go.id"], files: ["pdf", "docx"], exact: ["keamanan informasi"], exclude: ["lowongan"] }).buildQuery(), '"keamanan informasi" (site:upnvj.ac.id OR site:komdigi.go.id) (filetype:pdf OR filetype:docx) -lowongan');
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
});

test("URL builder rejects unknown or custom providers", () => {
  assert.throws(() => new SearchQueryBuilder({}, "custom").buildSearchUrl("query"), /Unsupported search provider/);
});
