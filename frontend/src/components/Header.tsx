"use client";

import React from "react";

interface HeaderProps {
  activeTab: "search" | "investigations" | "sources";
  setActiveTab: (tab: "search" | "investigations" | "sources") => void;
  systemStatus: "online" | "offline" | "checking";
}

export function Header({ activeTab, setActiveTab, systemStatus }: HeaderProps) {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <span className="font-bold text-white text-base">LV</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                LynceusVision
                <span className="text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                  MVP 0.1
                </span>
              </h1>
              <p className="text-xs text-zinc-400 -mt-0.5">OSINT Investigation Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex items-center space-x-1 sm:space-x-2">
          <button
            id="nav-search-btn"
            onClick={() => setActiveTab("search")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "search"
                ? "bg-zinc-800 text-cyan-400 border border-zinc-700"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            Global Collect
          </button>
          <button
            id="nav-investigations-btn"
            onClick={() => setActiveTab("investigations")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "investigations"
                ? "bg-zinc-800 text-cyan-400 border border-zinc-700"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            Investigations
          </button>
          <button
            id="nav-sources-btn"
            onClick={() => setActiveTab("sources")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === "sources"
                ? "bg-zinc-800 text-cyan-400 border border-zinc-700"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
            }`}
          >
            Sources & Registry
          </button>
        </nav>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-1.5 bg-zinc-900 px-2.5 py-1 rounded-full border border-zinc-800">
            <span
              className={`h-2 w-2 rounded-full ${
                systemStatus === "online"
                  ? "bg-emerald-500 animate-pulse"
                  : systemStatus === "checking"
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
            />
            <span className="text-zinc-300">
              {systemStatus === "online"
                ? "BACKEND ONLINE"
                : systemStatus === "checking"
                ? "CHECKING"
                : "BACKEND OFFLINE"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
