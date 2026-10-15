import {
  CollectResponse,
  Entity,
  Investigation,
  Observation,
  Source,
} from "../types";
import { SearchQuery, SearchQueryCreateRequest } from "../types/search";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(typeof window !== "undefined" && sessionStorage.getItem("lv_access_token")
      ? { Authorization: `Bearer ${sessionStorage.getItem("lv_access_token")}` }
      : {}),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && typeof window !== "undefined" && !endpoint.startsWith("/api/v1/auth/")) {
    sessionStorage.removeItem("lv_access_token");
    window.dispatchEvent(new Event("lv-auth-change"));
  }
  if (!res.ok) {
    let errorDetail = `HTTP ${res.status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      errorDetail = errJson.error || errJson.detail || errorDetail;
    } catch {
      // Non-JSON response
    }
    throw new Error(errorDetail);
  }

  if (res.status === 204) {
    return null as unknown as T;
  }

  return res.json();
}

export const api = {
  register: (username: string, password: string) =>
    request<{ access_token: string }>("/api/v1/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string) =>
    request<{ access_token: string }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  getHealth: () => request<{ status: string; app: string; version: string }>("/api/health"),

  // Investigations
  getInvestigations: () => request<Investigation[]>("/api/v1/investigations"),
  getInvestigation: (id: string) => request<Investigation>(`/api/v1/investigations/${id}`),
  createInvestigation: (title: string, description?: string) =>
    request<Investigation>("/api/v1/investigations", {
      method: "POST",
      body: JSON.stringify({ title, description }),
    }),
  updateInvestigation: (id: string, payload: Partial<Investigation>) =>
    request<Investigation>(`/api/v1/investigations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteInvestigation: (id: string) =>
    request<void>(`/api/v1/investigations/${id}`, { method: "DELETE" }),

  // Entities
  getEntities: (investigationId: string) =>
    request<Entity[]>(`/api/v1/investigations/${investigationId}/entities`),
  createEntity: (
    investigationId: string,
    payload: { entity_type: string; value: string; label?: string; notes?: string }
  ) =>
    request<Entity>(`/api/v1/investigations/${investigationId}/entities`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteEntity: (investigationId: string, entityId: string) =>
    request<void>(`/api/v1/investigations/${investigationId}/entities/${entityId}`, {
      method: "DELETE",
    }),

  // Observations
  getObservations: (investigationId: string, entityId: string) =>
    request<Observation[]>(
      `/api/v1/investigations/${investigationId}/entities/${entityId}/observations`
    ),

  // Sources
  getSources: () => request<Source[]>("/api/v1/sources"),

  // Collect
  collect: (
    target: string,
    connectors?: string[],
    saveToInvestigationId?: string
  ) =>
    request<CollectResponse>("/api/v1/collect", {
      method: "POST",
      body: JSON.stringify({
        target,
        connectors: connectors ?? null,
        save_to_investigation_id: saveToInvestigationId || null,
      }),
    }),

  // Search Queries (Dorking Studio)
  getSearchQueries: (investigationId?: string) => {
    const endpoint = investigationId
      ? `/api/v1/search-queries?investigation_id=${investigationId}`
      : "/api/v1/search-queries";
    return request<SearchQuery[]>(endpoint);
  },
  
  getSearchQuery: (id: string) =>
    request<SearchQuery>(`/api/v1/search-queries/${id}`),
  
  createSearchQuery: (payload: SearchQueryCreateRequest) =>
    request<SearchQuery>("/api/v1/search-queries", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  
  updateSearchQuery: (id: string, payload: Partial<SearchQueryCreateRequest>) =>
    request<SearchQuery>(`/api/v1/search-queries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  
  deleteSearchQuery: (id: string) =>
    request<void>(`/api/v1/search-queries/${id}`, { method: "DELETE" }),
};
