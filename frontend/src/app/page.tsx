"use client";

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Header } from "../components/Header";
import { SearchSection } from "../components/SearchSection";
import { DorkingStudio } from "../components/DorkingStudio";
import { InvestigationsSection } from "../components/InvestigationsSection";
import { SourcesSection } from "../components/SourcesSection";
import { Investigation } from "../types";
import { api } from "../lib/api";

const subscribeAuth = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("lv-auth-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("lv-auth-change", callback);
  };
};
const getAuthToken = () => sessionStorage.getItem("lv_access_token");
const getServerAuthToken = () => null;

export default function Home() {
  const [activeTab, setActiveTab] = useState<"search" | "investigations" | "sources" | "dorking">("search");
  const [systemStatus, setSystemStatus] = useState<"online" | "offline" | "checking">("checking");
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const accessToken = useSyncExternalStore(subscribeAuth, getAuthToken, getServerAuthToken);
  const authenticated = Boolean(accessToken);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

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

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    try {
      const result = authMode === "register"
        ? await api.register(username, password)
        : await api.login(username, password);
      sessionStorage.setItem("lv_access_token", result.access_token);
      window.dispatchEvent(new Event("lv-auth-change"));
      setPassword("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setAuthBusy(false);
    }
  };

  useEffect(() => {
    if (!authenticated) return;
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
  }, [authenticated]);

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 grid place-items-center p-6">
        <form onSubmit={submitAuth} className="w-full max-w-md space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h1 className="text-xl font-semibold">LynceusVision sign in</h1>
          <p className="text-sm text-zinc-400">Create an account or sign in to access investigation data.</p>
          <label className="block text-sm">Username<input required minLength={3} maxLength={128} autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 p-2" /></label>
          <label className="block text-sm">Password<input required minLength={12} maxLength={256} type="password" autoComplete={authMode === "register" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 p-2" /><span className="mt-1 block text-xs text-zinc-500">Use at least 12 characters.</span></label>
          {authError && <p role="alert" className="text-sm text-red-300">{authError}</p>}
          <button disabled={authBusy} className="w-full rounded bg-cyan-700 px-4 py-2 font-medium disabled:opacity-50">{authBusy ? "Please wait…" : authMode === "register" ? "Create account" : "Sign in"}</button>
          <button type="button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(null); }} className="w-full text-sm text-cyan-300">{authMode === "login" ? "Create a new account" : "I already have an account"}</button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemStatus={systemStatus}
      />
      <div className="flex justify-end px-6 pt-3">
        <button onClick={() => { sessionStorage.removeItem("lv_access_token"); window.dispatchEvent(new Event("lv-auth-change")); setInvestigations([]); }} className="text-xs text-zinc-400 hover:text-white">Sign out</button>
      </div>

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
