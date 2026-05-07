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
  visualType?: string;
  chartOptions?: Record<string, unknown>;
  tableOptions?: Record<string, unknown>;
  stackKeys?: string[];
  generatedAt?: number;
  rows?: Record<string, unknown>[];
  analysisContent?: string;
  analysisTrace?: TraceEvent[];
  relatedCharts?: string[];
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  trace?: TraceEvent[];
  charts?: ChartBundle[];
  createdAt: number;
};
