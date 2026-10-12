"use client";

import React, { useState } from "react";
import { CollectResponse, ConnectorResult, Investigation } from "../types";
import { api } from "../lib/api";

interface SearchSectionProps {
  investigations: Investigation[];
  onRefreshInvestigations: () => void;
}

interface SnapshotRow {
  timestamp: string;
  status_code: string;
  mime_type: string;
  archive_url: string;
}

export function SearchSection({
  investigations,
  onRefreshInvestigations,
}: SearchSectionProps) {
  const [target, setTarget] = useState("");
  const [selectedConnectors, setSelectedConnectors] = useState<string[]>([
    "rdap",
    "dns",
    "crtsh",
    "wayback",
  ]);
  const [saveToInvId, setSaveToInvId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collectResponse, setCollectResponse] = useState<CollectResponse | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<string>("dns");

  const toggleConnector = (id: string) => {
    setSelectedConnectors((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleRunSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!target.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.collect(
        target.trim(),
        selectedConnectors,
        saveToInvId || undefined
      );
      setCollectResponse(res);
      if (res.results.length > 0) {
        setActiveResultTab(res.results[0].connector_id);
      }
      if (saveToInvId) {
        onRefreshInvestigations();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Failed to execute collect operation");
    } finally {
      setLoading(false);
    }
  };

  const currentResult: ConnectorResult | undefined = collectResponse?.results.find(
    (r) => r.connector_id === activeResultTab
  );

  return (
    <div className="space-y-6">
      {/* Search Bar & Controls */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl">
        <form onSubmit={handleRunSearch} className="space-y-4">
          <div>
            <label htmlFor="target-input" className="block text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2">
              Target Identifier (Domain, IP, or URL)
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="target-input"
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="e.g. example.com, 8.8.8.8, https://subdomain.target.org"
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono"
              />
              <button
                id="submit-collect-btn"
                type="submit"
                disabled={loading || !target.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-all shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Collecting...</span>
                  </>
                ) : (
                  <span>Run Intelligence Query</span>
                )}
              </button>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
            <span>Examples:</span>
            <button
              type="button"
              onClick={() => setTarget("example.com")}
              className="text-cyan-400 hover:underline"
            >
              example.com
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setTarget("8.8.8.8")}
              className="text-cyan-400 hover:underline"
            >
              8.8.8.8
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setTarget("127.0.0.1")}
              className="text-amber-400 hover:underline"
            >
              127.0.0.1 (SSRF test)
            </button>
          </div>

          {/* Filters & Options */}
          <div className="pt-4 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-mono text-zinc-400">Connectors:</span>
              {[
                { id: "dns", label: "DNS Lookup" },
                { id: "rdap", label: "RDAP" },
                { id: "crtsh", label: "crt.sh" },
                { id: "wayback", label: "Wayback" },
              ].map((c) => (
                <label
                  key={c.id}
                  className="flex items-center space-x-1.5 text-xs text-zinc-300 cursor-pointer bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800 hover:border-zinc-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedConnectors.includes(c.id)}
                    onChange={() => toggleConnector(c.id)}
                    className="rounded bg-zinc-900 border-zinc-700 text-cyan-500 focus:ring-0"
                  />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>

            {/* Save to Investigation dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="save-inv-select" className="text-xs font-mono text-zinc-400">
                Attach to Case:
              </label>
              <select
                id="save-inv-select"
                value={saveToInvId}
                onChange={(e) => setSaveToInvId(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">None (Ad-hoc query)</option>
                {investigations.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-950/40 border border-red-800/80 rounded-xl p-4 text-sm text-red-200 flex items-start space-x-3">
          <div className="text-red-400 font-bold">Error:</div>
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* Results Section */}
      {collectResponse && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                Results for: <span className="text-cyan-400">{collectResponse.target}</span>
              </h2>
              <p className="text-xs text-zinc-400">
                {collectResponse.results.length} connector modules executed
              </p>
            </div>
            {saveToInvId && (
              <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-2.5 py-1 rounded font-mono">
                Saved to Investigation
              </span>
            )}
          </div>

          {/* Result Tabs */}
          <div className="border-b border-zinc-800 flex overflow-x-auto bg-zinc-950/30 px-4">
            {collectResponse.results.map((r) => {
              const statusColor =
                r.status === "OK"
                  ? "text-emerald-400"
                  : r.status === "EMPTY"
                  ? "text-zinc-400"
                  : r.status === "SSRF_BLOCKED"
                  ? "text-amber-400"
                  : "text-red-400";

              return (
                <button
                  key={r.connector_id}
                  onClick={() => setActiveResultTab(r.connector_id)}
                  className={`px-4 py-3 text-xs font-mono font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                    activeResultTab === r.connector_id
                      ? "border-cyan-500 text-white bg-zinc-900/60"
                      : "border-transparent text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <span className="uppercase">{r.connector_id}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${statusColor}`}>
                    {r.status}
                  </span>
                  <span className="text-[10px] text-zinc-600">{r.duration_ms}ms</span>
                </button>
              );
            })}
          </div>

          {/* Active Result Content */}
          <div className="p-6">
            {currentResult && (
              <div className="space-y-4">
                {/* Meta details */}
                <div className="flex flex-wrap items-center justify-between text-xs font-mono text-zinc-400 pb-4 border-b border-zinc-800/60">
                  <div>
                    Source: <span className="text-zinc-200">{currentResult.connector_id}</span>
                  </div>
                  <div>
                    Timestamp: <span className="text-zinc-200">{currentResult.collected_at}</span>
                  </div>
                  <div>
                    Duration: <span className="text-zinc-200">{currentResult.duration_ms}ms</span>
                  </div>
                </div>

                {/* Status-specific views */}
                {currentResult.status === "SSRF_BLOCKED" && (
                  <div className="p-4 bg-amber-950/30 border border-amber-800/60 rounded-lg text-amber-200 text-sm">
                    <div className="font-bold flex items-center gap-2 mb-1">
                      <span>🛡️ SSRF Security Block</span>
                    </div>
                    <p className="text-xs text-amber-300 font-mono">
                      {currentResult.error || "Target resolved to a private or reserved network address."}
                    </p>
                  </div>
                )}

                {currentResult.status === "EMPTY" && (
                  <div className="p-8 text-center text-zinc-400 text-sm">
                    <p className="font-mono text-xs">No records or snapshots found for this target.</p>
                    {currentResult.error && (
                      <p className="text-xs text-zinc-500 mt-1 font-mono">{currentResult.error}</p>
                    )}
                  </div>
                )}

                {currentResult.status === "PROVIDER_ERROR" && (
                  <div className="p-4 bg-red-950/30 border border-red-800/60 rounded-lg text-red-200 text-sm">
                    <div className="font-bold mb-1">Provider Error</div>
                    <p className="text-xs text-red-300 font-mono">{currentResult.error}</p>
                  </div>
                )}

                {currentResult.status === "RATE_LIMITED" && (
                  <div className="p-4 bg-amber-950/30 border border-amber-800/60 rounded-lg text-amber-200 text-sm">
                    <div className="font-bold mb-1">Rate Limited</div>
                    <p className="text-xs text-amber-300 font-mono">
                      The external provider rate limited requests from this client. Please wait before retrying.
                    </p>
                  </div>
                )}

                {/* Successful data displays */}
                {currentResult.status === "OK" && currentResult.data && (
                  <div>
                    {/* DNS Display */}
                    {currentResult.connector_id === "dns" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries((currentResult.data.records as Record<string, string[]>) || {}).map(([rtype, records]) => (
                            <div key={rtype} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-mono font-bold text-xs text-cyan-400">{rtype}</span>
                                <span className="text-[10px] text-zinc-500 font-mono">
                                  {records.length} {records.length === 1 ? "record" : "records"}
                                </span>
                              </div>
                              {records.length > 0 ? (
                                <ul className="space-y-1">
                                  {records.map((r: string, idx: number) => (
                                    <li key={idx} className="font-mono text-xs text-zinc-200 bg-zinc-900/60 px-2 py-1 rounded truncate">
                                      {r}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-zinc-600 font-mono italic">None</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* RDAP Display */}
                    {currentResult.connector_id === "rdap" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs">
                          <div>
                            <span className="text-zinc-500">Domain:</span>{" "}
                            <span className="text-white font-bold">{String(currentResult.data.domain || "")}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Registrar:</span>{" "}
                            <span className="text-zinc-200">{String(currentResult.data.registrar || "Not disclosed")}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Registrant:</span>{" "}
                            <span className="text-zinc-200">{String(currentResult.data.registrant_name || "Redacted / Not disclosed")}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Country:</span>{" "}
                            <span className="text-zinc-200">{String(currentResult.data.registrant_country || "Unknown")}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Registered:</span>{" "}
                            <span className="text-emerald-400">{String(currentResult.data.registered || "Unknown")}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Expires:</span>{" "}
                            <span className="text-amber-400">{String(currentResult.data.expires || "Unknown")}</span>
                          </div>
                        </div>

                        {Array.isArray(currentResult.data.nameservers) && currentResult.data.nameservers.length > 0 && (
                          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                            <h3 className="text-xs font-mono text-zinc-400 mb-2">Nameservers:</h3>
                            <div className="flex flex-wrap gap-2">
                              {currentResult.data.nameservers.map((ns: unknown, idx: number) => (
                                <span key={idx} className="bg-zinc-900 border border-zinc-800 text-cyan-300 font-mono text-xs px-2.5 py-1 rounded">
                                  {String(ns)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* crt.sh Display */}
                    {currentResult.connector_id === "crtsh" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                          <div>
                            Total Certs Found: <span className="text-white font-bold">{String(currentResult.data.total_certificates_found || "0")}</span>
                          </div>
                          <div>
                            Unique Subdomains: <span className="text-cyan-400 font-bold">{(currentResult.data.unique_subdomains as string[])?.length || 0}</span>
                          </div>
                        </div>

                        {Array.isArray(currentResult.data.unique_subdomains) && currentResult.data.unique_subdomains.length > 0 && (
                          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                            <h3 className="text-xs font-mono text-zinc-400 mb-2">Discovered Subdomains:</h3>
                            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                              {(currentResult.data.unique_subdomains as string[]).map((sub: string, idx: number) => (
                                <span key={idx} className="bg-zinc-900 text-emerald-400 border border-zinc-800 font-mono text-xs px-2 py-0.5 rounded">
                                  {sub}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Wayback Display */}
                    {currentResult.connector_id === "wayback" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs">
                          <div>
                            <span className="text-zinc-500">Snapshots:</span>{" "}
                            <span className="text-white font-bold">{String(currentResult.data.total_found || "0")}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">First Seen:</span>{" "}
                            <span className="text-cyan-400">{String(currentResult.data.first_seen || "N/A")}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500">Last Seen:</span>{" "}
                            <span className="text-cyan-400">{String(currentResult.data.last_seen || "N/A")}</span>
                          </div>
                        </div>

                        {Array.isArray(currentResult.data.snapshots) && currentResult.data.snapshots.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs font-mono">
                              <thead className="bg-zinc-950 text-zinc-500 border-b border-zinc-800">
                                <tr>
                                  <th className="py-2 px-3">Timestamp</th>
                                  <th className="py-2 px-3">Status</th>
                                  <th className="py-2 px-3">MIME</th>
                                  <th className="py-2 px-3">Archive Link</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-800/60">
                                {(currentResult.data.snapshots as SnapshotRow[]).slice(0, 10).map((snap, idx: number) => (
                                  <tr key={idx} className="hover:bg-zinc-950/50">
                                    <td className="py-2 px-3 text-zinc-300">{snap.timestamp}</td>
                                    <td className="py-2 px-3 text-emerald-400">{snap.status_code}</td>
                                    <td className="py-2 px-3 text-zinc-400">{snap.mime_type}</td>
                                    <td className="py-2 px-3">
                                      <a
                                        href={snap.archive_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-cyan-400 hover:underline"
                                      >
                                        View Snapshot ↗
                                      </a>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
