"use client";

import React, { useEffect, useState } from "react";
import { Source } from "../types";
import { api } from "../lib/api";

const PLANNED_MODULES = [
  {
    id: "shodan",
    name: "Shodan Intelligence",
    category: "Network / Port Scan",
    description: "Planned integration for querying open ports, banners, and vulnerable host technologies via official Shodan API.",
    status: "Planned",
  },
  {
    id: "virustotal",
    name: "VirusTotal",
    category: "Threat Intelligence",
    description: "Planned connector for domain/IP reputation analysis, malware family associations, and detection engines.",
    status: "Planned",
  },
  {
    id: "hunterio",
    name: "Hunter.io",
    category: "Email Discovery",
    description: "Planned connector for organizational email format patterns and corporate contact verification.",
    status: "Planned",
  },
  {
    id: "censys",
    name: "Censys Search",
    category: "Attack Surface",
    description: "Planned connector for internet-wide scan data, TLS certificates, and service fingerprinting.",
    status: "Planned",
  },
  {
    id: "knowledge_graph",
    name: "Entity Knowledge Graph",
    category: "Visualization",
    description: "Planned interactive graph visualization correlating co-occurring nameservers, registrant orgs, and shared IPs.",
    status: "Planned",
  },
  {
    id: "onion_intel",
    name: "Tor / Onion Source Intelligence",
    category: "Deep Web",
    description: "Pending security and legal compliance review. Onion connectors are strictly prohibited until isolation sandbox is approved.",
    status: "Security Review Pending",
  },
];

export function SourcesSection() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSources = async () => {
      try {
        const data = await api.getSources();
        setSources(data);
      } catch (err) {
        console.error("Failed to load sources registry", err);
      } finally {
        setLoading(false);
      }
    };

    loadSources();
  }, []);

  return (
    <div className="space-y-8">
      {/* Active Connectors */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold font-mono uppercase text-zinc-300 tracking-wider">
              Active Registered Connectors ({sources.length})
            </h2>
            <p className="text-xs text-zinc-400">
              Verified functional sources with live data ingestion, timeout controls, and SSRF filtering.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-xs font-mono text-zinc-500">Loading sources...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sources.map((src) => (
              <div
                key={src.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3 shadow-lg"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      {src.display_name}
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-bold">
                        ✅ Active MVP
                      </span>
                    </h3>
                    <span className="text-xs font-mono text-cyan-400">ID: {src.id}</span>
                  </div>
                </div>

                <p className="text-xs text-zinc-400">{src.description}</p>

                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-500">
                  {src.source_url && (
                    <a
                      href={src.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      Documentation ↗
                    </a>
                  )}
                  <span>Status: {src.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Planned Modules (Strictly Labeled Coming Soon per AGENTS.md Rule 5) */}
      <div className="space-y-4 pt-6 border-t border-zinc-800">
        <div>
          <h2 className="text-sm font-bold font-mono uppercase text-zinc-300 tracking-wider">
            Planned & Future Modules (Not Yet Implemented)
          </h2>
          <p className="text-xs text-zinc-400">
            Per project transparency rules, these modules have no live connector code and return no synthetic findings in production.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLANNED_MODULES.map((mod) => (
            <div
              key={mod.id}
              className="bg-zinc-950/60 border border-zinc-800/60 rounded-xl p-4 space-y-2 opacity-80"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300">{mod.name}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-blue-400 border border-blue-900/60">
                  🔵 {mod.status}
                </span>
              </div>
              <div className="text-[10px] font-mono text-zinc-500 uppercase">{mod.category}</div>
              <p className="text-xs text-zinc-500 leading-relaxed">{mod.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
