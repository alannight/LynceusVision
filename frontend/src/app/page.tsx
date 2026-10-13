"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Header } from "../components/Header";
import { SearchSection } from "../components/SearchSection";
import { DorkingStudio } from "../components/DorkingStudio";
import { InvestigationsSection } from "../components/InvestigationsSection";
import { SourcesSection } from "../components/SourcesSection";
import { Investigation } from "../types";
import { api } from "../lib/api";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"search" | "investigations" | "sources" | "dorking">("search");
  const [systemStatus, setSystemStatus] = useState<"online" | "offline" | "checking">("checking");
  const [investigations, setInvestigations] = useState<Investigation[]>([]);

  const loadData = useCallback(async () => {
    try {
      await api.getHealth();
      setSystemStatus("online");
    } catch {
      setSystemStatus("offline");
    }

    try {
      const invs = await api.getInvestigations();
      setInvestigations(invs);
    } catch (err) {
      console.error("Failed to load investigations list", err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const checkAndLoad = async () => {
      try {
        await api.getHealth();
        if (isMounted) setSystemStatus("online");
      } catch {
        if (isMounted) setSystemStatus("offline");
      }

      try {
        const invs = await api.getInvestigations();
        if (isMounted) setInvestigations(invs);
      } catch (err) {
        console.error("Failed to load investigations list", err);
      }
    };

    void checkAndLoad();
    const interval = setInterval(() => {
      void checkAndLoad();
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemStatus={systemStatus}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {systemStatus === "offline" && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-200 text-xs font-mono flex items-center justify-between">
            <div>
              <span className="font-bold text-amber-400">Notice:</span> LynceusVision backend is currently unreachable at http://localhost:8000. Start the backend with{" "}
              <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-amber-300">uvicorn app.main:app --reload</code>.
            </div>
            <button
              onClick={() => void loadData()}
              className="px-3 py-1 bg-amber-900/60 hover:bg-amber-800 text-white rounded text-xs transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}

        {activeTab === "search" && (
          <SearchSection
            investigations={investigations}
            onRefreshInvestigations={() => void loadData()}
          />
        )}

        {activeTab === "dorking" && (
          <DorkingStudio
            investigations={investigations}
            onRefreshInvestigations={async () => { await loadData(); }}
          />
        )}

        {activeTab === "investigations" && (
          <InvestigationsSection
            investigations={investigations}
            onRefresh={() => void loadData()}
          />
        )}

        {activeTab === "sources" && <SourcesSection />}
      </main>

      <footer className="border-t border-zinc-900 py-6 text-center text-xs font-mono text-zinc-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>LynceusVision OSINT Platform • Legitimate Research & Provenance Integrity</span>
          <span className="text-zinc-500">FastAPI • PostgreSQL / SQLite • Next.js 16</span>
        </div>
      </footer>
    </div>
  );
}
