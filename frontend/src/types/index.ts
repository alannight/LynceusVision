export interface Investigation {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  entity_count: number;
}

export interface Entity {
  id: string;
  investigation_id: string;
  entity_type: string;
  value: string;
  label: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  observation_count: number;
}

export interface Observation {
  id: string;
  entity_id: string;
  source_id: string;
  query_context: string;
  status: string;
  collected_at: string;
  duration_ms: number | null;
  normalized_data: Record<string, unknown> | null;
  error_detail: string | null;
}

export interface Source {
  id: string;
  display_name: string;
  description: string | null;
  source_url: string | null;
  enabled: boolean;
  status: string;
  created_at: string;
}

export interface ConnectorResult {
  connector_id: string;
  status:
    | "OK"
    | "EMPTY"
    | "TIMEOUT"
    | "RATE_LIMITED"
    | "AUTH_ERROR"
    | "PROVIDER_ERROR"
    | "SSRF_BLOCKED"
    | "VALIDATION_ERROR"
    | "RESPONSE_TOO_LARGE";
  query: string;
  collected_at: string;
  duration_ms: number;
  data: Record<string, unknown> | null;
  error: string | null;
}

export interface CollectResponse {
  target: string;
  results: ConnectorResult[];
  collection_status: "COMPLETE" | "PARTIAL_FAILURE";
  persistence_status: "SAVED" | "NOT_REQUESTED";
}
