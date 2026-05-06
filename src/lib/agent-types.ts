import type { TopLevelSpec } from "vega-lite";

export type TraceStatus = "running" | "complete" | "error";

export type ToolName = "list_tables" | "describe_table" | "run_sql" | "render_chart";

export type ChartSpan = 1 | 2 | 3 | 4;

export type ChartPayload = {
  id: string;
  title: string;
  narrative: string;
  sql: string;
  spec: TopLevelSpec;
  span: ChartSpan;
  rows?: Record<string, unknown>[];
};

export type TraceEvent = {
  id: string;
  type: "tool_start" | "tool_end";
  tool: ToolName;
  status: TraceStatus;
  label: string;
  sql?: string;
  durationMs?: number;
  payload?: unknown;
};

export type ChatEvent =
  | TraceEvent
  | { type: "chart"; chart: ChartPayload }
  | { type: "narrative_chunk"; text: string }
  | { type: "final"; text: string }
  | { type: "error"; message: string };

export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  trace?: TraceEvent[];
  charts?: ChartPayload[];
};
