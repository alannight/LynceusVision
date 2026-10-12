"use client";

import React, { useEffect, useState } from "react";
import { Entity, Investigation, Observation } from "../types";
import { api } from "../lib/api";

interface InvestigationsSectionProps {
  investigations: Investigation[];
  onRefresh: () => void;
}

export function InvestigationsSection({
  investigations,
  onRefresh,
}: InvestigationsSectionProps) {
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // New Investigation form state
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Load entities when selected investigation changes
  useEffect(() => {
    let isMounted = true;
    if (!selectedInvId) return;

    const loadEntities = async () => {
      setLoadingDetails(true);
      try {
        const ents = await api.getEntities(selectedInvId);
        if (isMounted) {
          setEntities(ents);
          if (ents.length > 0) {
            setSelectedEntityId(ents[0].id);
          } else {
            setSelectedEntityId(null);
            setObservations([]);
          }
        }
      } catch (err) {
        console.error("Failed to load entities", err);
      } finally {
        if (isMounted) setLoadingDetails(false);
      }
    };

    void loadEntities();
    return () => {
      isMounted = false;
    };
  }, [selectedInvId]);

  // Load observations when selected entity changes
  useEffect(() => {
    let isMounted = true;
    if (!selectedInvId || !selectedEntityId) return;

    const loadObservations = async () => {
      try {
        const obs = await api.getObservations(selectedInvId, selectedEntityId);
        if (isMounted) setObservations(obs);
      } catch (err) {
        console.error("Failed to load observations", err);
      }
    };

    void loadObservations();
    return () => {
      isMounted = false;
    };
  }, [selectedInvId, selectedEntityId]);

  const handleSelectInv = (id: string) => {
    setSelectedInvId(id);
    setEntities([]);
    setSelectedEntityId(null);
    setObservations([]);
  };

  const handleCreateInvestigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreateLoading(true);
    try {
      const inv = await api.createInvestigation(newTitle.trim(), newDesc.trim() || undefined);
      setNewTitle("");
      setNewDesc("");
      setIsCreating(false);
      onRefresh();
      handleSelectInv(inv.id);
    } catch (err) {
      console.error("Failed to create investigation", err);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteInvestigation = async (id: string) => {
    if (!confirm("Are you sure you want to delete this investigation and all its entities?")) return;
    try {
      await api.deleteInvestigation(id);
      if (selectedInvId === id) {
        setSelectedInvId(null);
        setEntities([]);
        setSelectedEntityId(null);
        setObservations([]);
      }
      onRefresh();
    } catch (err) {
      console.error("Failed to delete investigation", err);
    }
  };

  const selectedInv = investigations.find((i) => i.id === selectedInvId);
  const selectedEntity = entities.find((e) => e.id === selectedEntityId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Investigations List */}
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold font-mono uppercase text-zinc-300 tracking-wider">
            Active Cases ({investigations.length})
          </h2>
          <button
            id="create-inv-modal-btn"
            onClick={() => setIsCreating(true)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-md shadow-cyan-950"
          >
            <span>+ New Case</span>
          </button>
        </div>

        {/* Create Modal / Inlined Form */}
        {isCreating && (
          <form
            onSubmit={handleCreateInvestigation}
            className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3 shadow-xl"
          >
            <div className="text-xs font-bold font-mono text-cyan-400">Create Investigation</div>
            <div>
              <input
                id="new-inv-title"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Case Title / Operation Name"
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-mono"
                required
              />
            </div>
            <div>
              <textarea
                id="new-inv-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description / Objective"
                rows={2}
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-xs text-zinc-400 hover:text-white px-2 py-1"
              >
                Cancel
              </button>
              <button
                id="submit-create-inv-btn"
                type="submit"
                disabled={createLoading || !newTitle.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium px-3 py-1 rounded transition-colors"
              >
                {createLoading ? "Creating..." : "Save Case"}
              </button>
            </div>
          </form>
        )}

        {/* List of Investigations */}
        <div className="space-y-2">
          {investigations.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-6 text-center text-zinc-500 text-xs font-mono">
              No investigations created yet.
            </div>
          ) : (
            investigations.map((inv) => (
              <div
                key={inv.id}
                onClick={() => handleSelectInv(inv.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedInvId === inv.id
                    ? "bg-zinc-800 border-cyan-500/80 shadow-lg shadow-cyan-950/20"
                    : "bg-zinc-900/80 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white truncate">{inv.title}</h3>
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-bold ${
                      inv.status === "active"
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {inv.status}
                  </span>
                </div>
                {inv.description && (
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{inv.description}</p>
                )}
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 mt-3 pt-2 border-t border-zinc-800/60">
                  <span>{inv.entity_count} entities</span>
                  <div className="flex items-center gap-2">
                    <span>{new Date(inv.created_at).toLocaleDateString()}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteInvestigation(inv.id);
                      }}
                      className="text-red-400 hover:text-red-300 text-xs hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Investigation Details (Entities & Evidence) */}
      <div className="lg:col-span-2 space-y-6">
        {selectedInv ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl space-y-6">
            {/* Header info */}
            <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{selectedInv.title}</h2>
                  <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/60">
                    ID: {selectedInv.id.slice(0, 8)}...
                  </span>
                </div>
                {selectedInv.description && (
                  <p className="text-xs text-zinc-400 mt-1">{selectedInv.description}</p>
                )}
              </div>
            </div>

            {/* Entities sub-section */}
            <div>
              <h3 className="text-xs font-mono uppercase text-zinc-400 mb-3 tracking-wider">
                Entities In Case ({entities.length})
              </h3>

              {loadingDetails ? (
                <div className="text-xs text-zinc-500 font-mono">Loading case entities...</div>
              ) : entities.length === 0 ? (
                <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-6 text-center text-zinc-500 text-xs font-mono">
                  No entities added to this investigation yet. Run a Global Collect query and attach results here!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {entities.map((ent) => (
                    <div
                      key={ent.id}
                      onClick={() => setSelectedEntityId(ent.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedEntityId === ent.id
                          ? "bg-zinc-950 border-cyan-500 text-white"
                          : "bg-zinc-950/60 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-cyan-400 font-bold">
                          {ent.entity_type}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {ent.observation_count} evidence items
                        </span>
                      </div>
                      <div className="text-xs font-mono font-semibold mt-2 truncate">
                        {ent.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Evidence / Observations sub-section */}
            {selectedEntity && (
              <div className="border-t border-zinc-800 pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase text-zinc-400 tracking-wider">
                    Evidence & Provenance: <span className="text-cyan-400">{selectedEntity.value}</span>
                  </h3>
                  <span className="text-xs text-zinc-500 font-mono">
                    {observations.length} Observations
                  </span>
                </div>

                {observations.length === 0 ? (
                  <div className="text-xs text-zinc-500 font-mono italic">
                    No collection records persisted for this entity.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {observations.map((obs) => (
                      <div
                        key={obs.id}
                        className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between text-xs font-mono">
                          <div className="flex items-center gap-2">
                            <span className="uppercase font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/60">
                              {obs.source_id}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                obs.status === "OK" ? "text-emerald-400" : "text-amber-400"
                              }`}
                            >
                              {obs.status}
                            </span>
                          </div>
                          <span className="text-zinc-500">{new Date(obs.collected_at).toUTCString()}</span>
                        </div>

                        <div className="text-xs font-mono text-zinc-400 bg-zinc-900/60 p-2.5 rounded border border-zinc-800/50">
                          <span className="text-zinc-500">Query Context:</span> {obs.query_context}
                        </div>

                        {obs.normalized_data && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-mono text-zinc-500 uppercase">Normalized Observation Data:</div>
                            <pre className="bg-zinc-900/80 border border-zinc-800/60 p-3 rounded text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-48">
                              {JSON.stringify(obs.normalized_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-12 text-center text-zinc-500 font-mono text-xs">
            Select a case from the list on the left to inspect entities and evidence logs.
          </div>
        )}
      </div>
    </div>
  );
}
