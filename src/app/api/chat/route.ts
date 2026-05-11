import { agentEvents } from "@/lib/agent-orchestrator";
import type { ChartPayload, ChatEvent, ToolName } from "@/lib/agent-types";
import { isDcmshriramSite } from "@/lib/site-variant";

export const runtime = "nodejs";

function encode(event: ChatEvent) {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(request: Request) {
  if (!isDcmshriramSite()) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { message?: string; question?: string; history?: unknown };
  const message = body.message ?? body.question ?? "";
  const history = normalizeHistory(body.history);
  const backendUrl = backendBaseUrl();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const write = (event: ChatEvent) => controller.enqueue(encoder.encode(encode(event)));

      if (backendUrl) {
        try {
          for await (const event of eceoBackendEvents(backendUrl, message, history, request.signal)) {
            write(event);
          }
          controller.close();
          return;
        } catch (error) {
          write({
            type: "error",
            message: error instanceof Error ? error.message : "ECEO backend stream failed.",
          });
          controller.close();
          return;
        }
      }

      for await (const event of agentEvents(message, request.signal)) {
        write(event);
        await new Promise((resolve) => setTimeout(resolve, event.type === "chart" ? 260 : 120));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function backendBaseUrl() {
  if (process.env.ECEO_BACKEND_DISABLED === "1") {
    if (process.env.ECEO_BACKEND_REQUIRED === "1") {
      throw new Error("ECEO_BACKEND_REQUIRED=1 but ECEO_BACKEND_DISABLED=1.");
    }
    return "";
  }
  return (process.env.ECEO_BACKEND_URL ?? process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
}

type BackendHistoryMessage = { role: "user" | "assistant"; content: string };

function normalizeHistory(history: unknown): BackendHistoryMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .flatMap((item): BackendHistoryMessage[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const record = item as Record<string, unknown>;
      const role = record.role === "assistant" ? "assistant" : record.role === "user" ? "user" : null;
      const content = typeof record.content === "string" ? record.content.trim() : "";
      return role && content ? [{ role, content }] : [];
    })
    .slice(-8);
}

async function* eceoBackendEvents(baseUrl: string, question: string, history: BackendHistoryMessage[], signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  yield trace("eceo-interpreter-start", "list_tables", "running", "Interpreter agent: clarifying business intent");

  const response = await fetch(`${baseUrl}/query/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, history }),
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`ECEO backend failed with ${response.status} ${response.statusText}`);
  }

  for await (const frame of parseSse(response.body)) {
    for (const event of mapEceoEvent(frame.event, frame.data)) {
      yield event;
    }
  }
}

function* mapEceoEvent(eventName: string, data: unknown): Generator<ChatEvent> {
  const payload = asRecord(data);

  if (eventName === "interpretation") {
    const understood = payload.intent_understood !== false;
    yield trace(
      "eceo-interpreter-end",
      "list_tables",
      understood ? "complete" : "complete",
      understood
        ? `Interpreter understood: ${String(payload.interpreted_question ?? "question is clear")}`
        : "Interpreter needs a clarification before analysis",
      { payload },
    );

    if (!understood) {
      const options = Array.isArray(payload.options_for_user) ? payload.options_for_user.map(String) : [];
      const question = String(payload.clarifying_question ?? "Can you clarify what you want to analyse?");
      yield {
        type: "final",
        text: [question, options.length ? options.map((option, index) => `${index + 1}. ${option}`).join("\n") : ""].filter(Boolean).join("\n\n"),
      };
    }
    return;
  }

  if (eventName === "plan") {
    const analyses = Array.isArray(payload.analyses) ? payload.analyses : [];
    const rationale = typeof payload.plan_rationale === "string" ? payload.plan_rationale : "";
    yield trace(
      "eceo-plan-end",
      "describe_table",
      "complete",
      `AnalysisPlanner created ${analyses.length || 0} ${analyses.length === 1 ? "analysis" : "analyses"}${rationale ? `: ${rationale}` : ""}`,
      { payload },
    );
    return;
  }

  if (eventName === "analysis_started") {
    yield trace(
      `eceo-analysis-${String(payload.analysis_id ?? crypto.randomUUID())}-start`,
      "run_sql",
      "running",
      `QueryExecutor: ${String(payload.purpose ?? "running analysis")}`,
      { payload },
    );
    return;
  }

  if (eventName === "analysis_complete") {
    const success = payload.success !== false;
    const rowCount = typeof payload.row_count === "number" ? payload.row_count : 0;
    yield trace(
      `eceo-analysis-${String(payload.analysis_id ?? crypto.randomUUID())}-end`,
      "run_sql",
      success ? "complete" : "error",
      success
        ? `QueryExecutor completed ${String(payload.analysis_id ?? "analysis")} with ${rowCount} rows`
        : `QueryExecutor failed ${String(payload.analysis_id ?? "analysis")}: ${String(payload.error ?? "unknown error")}`,
      {
        payload,
        ...(typeof payload.sql === "string" && payload.sql.trim() ? { sql: payload.sql } : {}),
      },
    );
    return;
  }

  if (eventName === "narrative_chunk") {
    yield { type: "narrative_chunk", text: String(payload.text ?? "") };
    return;
  }

  if (eventName === "presentation") {
    const charts = chartEventsFromPresentation(payload);
    yield trace(
      "eceo-presentation-end",
      "render_chart",
      "complete",
      `PresentationDesigner produced narrative and ${charts.length} ${charts.length === 1 ? "visual" : "visuals"}`,
      { payload },
    );
    for (const chart of charts) yield { type: "chart", chart };
    return;
  }

  if (eventName === "error") {
    yield { type: "error", message: String(payload.message ?? "ECEO backend returned an error.") };
    return;
  }
}

function chartEventsFromPresentation(payload: Record<string, unknown>): ChartPayload[] {
  const specs = Array.isArray(payload.chart_specs) ? payload.chart_specs.map(asRecord) : [];
  const layout = Array.isArray(payload.layout) ? payload.layout.map(asRecord) : [];
  const evidenceById = new Map<string, Record<string, unknown>>();
  for (const item of Array.isArray(payload.query_evidence) ? payload.query_evidence.map(asRecord) : []) {
    const analysisId = String(item.analysis_id ?? "");
    if (analysisId) evidenceById.set(analysisId, item);
  }

  return specs
    .flatMap((spec, index) => {
      const element = layout[index] ?? {};
      const rows = Array.isArray(spec.data) ? spec.data.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object" && !Array.isArray(row))) : [];
      const type = String(spec.type ?? element.type ?? "");
      if (!rows.length || type === "narrative_only") return [];

      const title = String(spec.title ?? element.title ?? `Analysis ${index + 1}`);
      const subtitle = spec.subtitle ?? element.subtitle;
      const xKey = typeof spec.x_key === "string" ? spec.x_key : undefined;
      const yKey = typeof spec.y_key === "string" ? spec.y_key : undefined;
      const analysisId = String(element.analysis_id ?? `analysis ${index + 1}`);
      const evidence = evidenceById.get(analysisId);
      const sql = typeof evidence?.sql === "string" && evidence.sql.trim()
        ? evidence.sql
        : `-- ECEO backend result for ${analysisId}; SQL executed in Python sidecar.`;
      const chartOptions = asRecord(element.chart_options);
      const tableOptions = asRecord(element.table_options);
      const stackKeys = Array.isArray(spec.stack_keys) ? spec.stack_keys.map(String) : undefined;
      return [{
        id: `eceo-${analysisId}-${Date.now()}-${index}`,
        title,
        narrative: typeof subtitle === "string" ? subtitle : "ECEO backend analysis result.",
        sql,
        visualType: type,
        chartOptions,
        tableOptions,
        stackKeys,
        spec: {
          data: { values: rows },
          mark: markForChartType(type),
          encoding: {
            x: xKey ? { field: xKey } : undefined,
            y: yKey ? { field: yKey } : undefined,
            color: chartOptions.stack_field ? { field: String(chartOptions.stack_field) } : undefined,
          },
        },
        span: spanForChartType(type),
        rows,
      } satisfies ChartPayload];
    });
}

function markForChartType(type: string) {
  if (type === "line_chart") return "line";
  if (type === "scatter") return "point";
  if (type === "bar_chart" || type === "stacked_bar" || type === "kpi_card" || type === "table") return "bar";
  return "bar";
}

function spanForChartType(type: string): ChartPayload["span"] {
  if (type === "kpi_card") return 1;
  if (type === "table") return 2;
  return 2;
}

function trace(id: string, tool: ToolName, status: "running" | "complete" | "error", label: string, extra?: Record<string, unknown>): ChatEvent {
  return {
    type: status === "running" ? "tool_start" : "tool_end",
    id,
    tool,
    status,
    label,
    ...(extra ?? {}),
  } as ChatEvent;
}

async function* parseSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: unknown }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

    let separator = buffer.indexOf("\n\n");
    while (separator !== -1) {
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const parsed = parseSseFrame(frame);
      if (parsed) yield parsed;
      separator = buffer.indexOf("\n\n");
    }
  }

  const final = buffer.trim();
  const parsed = final ? parseSseFrame(final) : null;
  if (parsed) yield parsed;
}

function parseSseFrame(frame: string) {
  let event = "message";
  const dataLines: string[] = [];

  for (const rawLine of frame.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line || line.startsWith(":")) continue;
    const index = line.indexOf(":");
    const field = index === -1 ? line : line.slice(0, index);
    const value = index === -1 ? "" : line.slice(index + 1).replace(/^ /, "");
    if (field === "event") event = value;
    if (field === "data") dataLines.push(value);
  }

  if (!dataLines.length) return null;
  const dataText = dataLines.join("\n");
  try {
    return { event, data: JSON.parse(dataText) as unknown };
  } catch {
    return { event, data: dataText };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
