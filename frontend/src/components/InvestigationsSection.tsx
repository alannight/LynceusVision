"use client";

import React, { useEffect, useState } from "react";
import { Entity, Investigation, Observation } from "../types";
import { api } from "../lib/api";

interface InvestigationsSectionProps {
  investigations: Investigation[];
  onRefresh: () => void;
}

const ENTITY_TYPES = [
  { value: "domain", label: "Domain" },
  { value: "ip", label: "IP Address" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "person", label: "Person" },
  { value: "org", label: "Organization" },
  { value: "hash", label: "File Hash" },
  { value: "phone", label: "Phone Number" },
];

export function InvestigationsSection({
  investigations,
  onRefresh,
}: InvestigationsSectionProps) {
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Filter & Search investigations
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // New Investigation form state
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Edit Investigation form state
  const [isEditingInv, setIsEditingInv] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState<string>("active");
  const [editLoading, setEditLoading] = useState(false);

  // Add Entity form state
  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [newEntityType, setNewEntityType] = useState("domain");
  const [newEntityValue, setNewEntityValue] = useState("");
  const [newEntityLabel, setNewEntityLabel] = useState("");
  const [newEntityNotes, setNewEntityNotes] = useState("");
  const [addEntityLoading, setAddEntityLoading] = useState(false);
  const [entityError, setEntityError] = useState<string | null>(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Select first investigation if none selected
  useEffect(() => {
    if (!selectedInvId && investigations.length > 0) {
      setSelectedInvId(investigations[0].id);
    }
  }, [investigations, selectedInvId]);

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
    setIsEditingInv(false);
    setIsAddingEntity(false);
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

  const handleStartEdit = () => {
    if (!selectedInv) return;
    setEditTitle(selectedInv.title);
    setEditDesc(selectedInv.description || "");
    setEditStatus(selectedInv.status);
    setIsEditingInv(true);
  };

  const handleSaveInvestigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvId || !editTitle.trim()) return;

    setEditLoading(true);
    try {
      await api.updateInvestigation(selectedInvId, {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        status: editStatus,
      });
      setIsEditingInv(false);
      onRefresh();
    } catch (err) {
      console.error("Failed to update investigation", err);
    } finally {
      setEditLoading(false);
    }
  };

  const handleCreateEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvId || !newEntityValue.trim()) return;

    setAddEntityLoading(true);
    setEntityError(null);
    try {
      const created = await api.createEntity(selectedInvId, {
        entity_type: newEntityType,
        value: newEntityValue.trim(),
        label: newEntityLabel.trim() || undefined,
        notes: newEntityNotes.trim() || undefined,
      });
      setEntities((prev) => [created, ...prev]);
      setSelectedEntityId(created.id);
      setNewEntityValue("");
      setNewEntityLabel("");
      setNewEntityNotes("");
      setIsAddingEntity(false);
      onRefresh();
    } catch (err) {
      setEntityError(err instanceof Error ? err.message : "Failed to add entity");
    } finally {
      setAddEntityLoading(false);
    }
  };

  const handleDeleteEntity = async (entityId: string) => {
    if (!selectedInvId) return;
    if (!confirm("Are you sure you want to delete this entity and its observations?")) return;
    try {
      await api.deleteEntity(selectedInvId, entityId);
      const remaining = entities.filter((e) => e.id !== entityId);
      setEntities(remaining);
      if (selectedEntityId === entityId) {
        if (remaining.length > 0) {
          setSelectedEntityId(remaining[0].id);
        } else {
          setSelectedEntityId(null);
          setObservations([]);
        }
      }
      onRefresh();
    } catch (err) {
      console.error("Failed to delete entity", err);
    }
  };

  const handleExportCase = async () => {
    if (!selectedInv) return;
    setIsExporting(true);
    try {
      // Fetch observations for all entities
      const entitiesWithObs = await Promise.all(
        entities.map(async (ent) => {
          try {
            const obs = await api.getObservations(selectedInv.id, ent.id);
            return { ...ent, observations: obs };
          } catch {
            return { ...ent, observations: [] };
          }
        })
      );

      const caseReport = {
        platform: "LynceusVision",
        report_version: "1.0",
        exported_at: new Date().toISOString(),
        investigation: {
          id: selectedInv.id,
          title: selectedInv.title,
          description: selectedInv.description,
          status: selectedInv.status,
          created_at: selectedInv.created_at,
          updated_at: selectedInv.updated_at,
          total_entities: entities.length,
        },
        entities: entitiesWithObs,
      };

      const blob = new Blob([JSON.stringify(caseReport, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `case-${selectedInv.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export case", err);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredInvestigations = investigations.filter((inv) => {
    const matchesSearch =
      inv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.description && inv.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

        {/* Filter and Search */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cases..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by case status"
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 font-mono focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="closed">Closed</option>
          </select>
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
          {filteredInvestigations.length === 0 ? (
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-6 text-center text-zinc-500 text-xs font-mono">
              {investigations.length === 0 ? "No investigations created yet." : "No matching cases found."}
            </div>
          ) : (
            filteredInvestigations.map((inv) => (
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
                        : inv.status === "archived"
                        ? "bg-amber-950 text-amber-400 border border-amber-800/60"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700"
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
            <div className="border-b border-zinc-800 pb-4">
              {isEditingInv ? (
                <form onSubmit={handleSaveInvestigation} className="space-y-3">
                  <div className="text-xs font-bold font-mono text-cyan-400 uppercase">Edit Investigation</div>
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Case Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Description</label>
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={2}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-zinc-400 mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      aria-label="Update case status"
                      className="bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                    >
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingInv(false)}
                      className="text-xs text-zinc-400 hover:text-white px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editLoading || !editTitle.trim()}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3 py-1 rounded font-medium"
                    >
                      {editLoading ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-white">{selectedInv.title}</h2>
                      <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/60">
                        ID: {selectedInv.id.slice(0, 8)}...
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                          selectedInv.status === "active"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                            : selectedInv.status === "archived"
                            ? "bg-amber-950 text-amber-400 border border-amber-800/60"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {selectedInv.status}
                      </span>
                    </div>
                    {selectedInv.description && (
                      <p className="text-xs text-zinc-400 mt-1.5">{selectedInv.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleStartEdit}
                      className="text-xs font-mono text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded border border-zinc-700 transition-colors"
                    >
                      Edit Case
                    </button>
                    <button
                      onClick={handleExportCase}
                      disabled={isExporting}
                      className="text-xs font-mono text-cyan-300 hover:text-white bg-cyan-950/80 hover:bg-cyan-900 px-3 py-1.5 rounded border border-cyan-800/60 transition-colors flex items-center gap-1.5"
                    >
                      <span>↓ Export JSON</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Entities sub-section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-mono uppercase text-zinc-400 tracking-wider">
                  Entities In Case ({entities.length})
                </h3>
                <button
                  onClick={() => setIsAddingEntity(!isAddingEntity)}
                  className="text-xs font-mono text-cyan-400 hover:text-cyan-300 bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-800/60 px-2.5 py-1 rounded transition-colors"
                >
                  {isAddingEntity ? "Cancel" : "+ Add Entity"}
                </button>
              </div>

              {/* Add Entity Inlined Form */}
              {isAddingEntity && (
                <form
                  onSubmit={handleCreateEntity}
                  className="bg-zinc-950 border border-cyan-800/60 rounded-xl p-4 mb-4 space-y-3 shadow-lg"
                >
                  <div className="text-xs font-bold font-mono text-cyan-400 uppercase">Manual Entity Entry</div>
                  {entityError && (
                    <div className="text-xs text-red-400 bg-red-950/60 border border-red-800 p-2 rounded font-mono">
                      {entityError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Type</label>
                      <select
                        value={newEntityType}
                        onChange={(e) => setNewEntityType(e.target.value)}
                        aria-label="Select entity type"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      >
                        {ENTITY_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Identifier / Value</label>
                      <input
                        type="text"
                        value={newEntityValue}
                        onChange={(e) => setNewEntityValue(e.target.value)}
                        placeholder="e.g. example.com, 1.2.3.4, analyst@target.org"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Label (Optional)</label>
                      <input
                        type="text"
                        value={newEntityLabel}
                        onChange={(e) => setNewEntityLabel(e.target.value)}
                        placeholder="e.g. Primary C2 Server"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-400 uppercase mb-1">Notes (Optional)</label>
                      <input
                        type="text"
                        value={newEntityNotes}
                        onChange={(e) => setNewEntityNotes(e.target.value)}
                        placeholder="Brief contextual notes"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingEntity(false)}
                      className="text-xs text-zinc-400 hover:text-white px-2 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addEntityLoading || !newEntityValue.trim()}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3 py-1 rounded font-medium"
                    >
                      {addEntityLoading ? "Saving..." : "Add to Case"}
                    </button>
                  </div>
                </form>
              )}

              {loadingDetails ? (
                <div className="text-xs text-zinc-500 font-mono">Loading case entities...</div>
              ) : entities.length === 0 ? (
                <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-6 text-center text-zinc-500 text-xs font-mono">
                  No entities added to this investigation yet. Use "+ Add Entity" or run a Global Collect query!
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
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-cyan-400 font-bold">
                            {ent.entity_type}
                          </span>
                          {ent.label && (
                            <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[120px]">
                              {ent.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-zinc-500">
                            {ent.observation_count} obs
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEntity(ent.id);
                            }}
                            className="text-zinc-500 hover:text-red-400 text-xs transition-colors"
                            title="Delete entity"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <div className="text-xs font-mono font-semibold mt-2 truncate">
                        {ent.value}
                      </div>
                      {ent.notes && (
                        <div className="text-[11px] text-zinc-500 mt-1 line-clamp-1 italic font-sans">
                          {ent.notes}
                        </div>
                      )}
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
                    No collection records persisted for this entity yet. Run a search in Global Collect targeting this entity!
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
                                obs.status === "OK" ? "text-emerald-400 bg-emerald-950/60 border border-emerald-800/40" : "text-amber-400 bg-amber-950/60 border border-amber-800/40"
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
