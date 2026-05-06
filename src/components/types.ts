export type ChatRole = "user" | "assistant" | "system";

export type TraceEvent = {
  id: string;
  type: string;
  tool?: string;
  label: string;
  status?: "pending" | "running" | "complete" | "error";
  detail?: string;
  sql?: string;
  durationMs?: number;
  payload?: unknown;
  timestamp: number;
};

export type ChartBundle = {
  id: string;
  title: string;
  sql: string;
  description?: string;
  spec?: Record<string, unknown>;
  span?: 1 | 2 | 3 | 4;
  generatedAt?: number;
  rows?: Record<string, unknown>[];
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  trace?: TraceEvent[];
  charts?: ChartBundle[];
  createdAt: number;
};
