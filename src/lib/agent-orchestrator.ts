import type { ChartPayload, ChatEvent } from "@/lib/agent-types";
import { callAzureOpenAi, isAzureOpenAiConfigured } from "@/lib/azure-openai";
import { dataDictionary } from "@/lib/data-dictionary";
import { runStaticDemoSql } from "@/lib/demo-query-runner";
import { scriptedEvents } from "@/lib/hero-queries";
import { responseContract, sfsModelContext } from "@/lib/sfs-model-context";

type RouteId = "finance" | "field_force" | "procurement" | "nps" | "microbattle" | "churn" | "commodity" | "sales";

type PlannerOutput = {
  route?: string;
  sql?: string;
  description?: string;
};

type CheckerOutput = {
  status?: string;
  route?: string;
  description?: string;
  reason?: string;
};

type VisualOutput = {
  chartIds?: string[];
  insight?: string;
  chartObservations?: string[];
  watchOut?: string;
};

type TimedResult<T> = {
  durationMs: number;
  value: T;
};

const ROUTE_PROMPTS: Record<RouteId, string> = {
  finance: "Show me the revenue and EBITDA time series.",
  field_force: "How is the field force tracking this quarter?",
  procurement: "Show me procurement savings vs target by category.",
  nps: "What's happening with farmer NPS across regions?",
  microbattle: "Status of Wave 1 micro-battles.",
  churn: "Channel partners at churn risk in North zone.",
  commodity: "What's moving in commodity markets today?",
  sales: "Show me revenue by zones.",
};

const ROUTE_LABELS: Record<RouteId, string> = {
  finance: "financial_performance",
  field_force: "field_force_activity",
  procurement: "procurement_spend",
  nps: "farmer_nps",
  microbattle: "wave1_microbattles",
  churn: "channel_partners",
  commodity: "commodity_prices",
  sales: "secondary_sales",
};

const ROUTE_CATALOG = Object.entries(ROUTE_PROMPTS).map(([route, prompt]) => ({ route, example: prompt, primary_table: ROUTE_LABELS[route as RouteId] }));

export async function* agentEvents(message: string, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  if (!isAzureOpenAiConfigured()) {
    yield* scriptedEvents(message);
    return;
  }

  let route = pickLocalRoute(message);
  let planner: PlannerOutput = {};

  yield { type: "tool_start", id: "azure-planner-start", tool: "list_tables", status: "running", label: "Planner agent: selecting dataset and SQL" };
  try {
    const result = await timed(() => runPlannerAgent(message, route, signal));
    planner = result.value;
    route = sanitizeRoute(planner.route) ?? route;
    yield {
      type: "tool_end",
      id: "azure-planner-end",
      tool: "list_tables",
      status: "complete",
      label: `Planner selected ${ROUTE_LABELS[route]}`,
      durationMs: result.durationMs,
    };
  } catch {
    yield {
      type: "tool_end",
      id: "azure-planner-fallback",
      tool: "list_tables",
      status: "complete",
      label: `Planner fallback selected ${ROUTE_LABELS[route]}`,
      durationMs: 0,
    };
  }

  let scenarioEvents = scriptedEvents(promptForRoute(route, message));
  let charts = chartPayloads(scenarioEvents);
  let previews = previewCharts(charts);
  let checker: CheckerOutput = {};

  yield { type: "tool_start", id: "azure-checker-start", tool: "run_sql", status: "running", label: "Checker agent: validating SQL against generated data" };
  try {
    const result = await timed(() => runCheckerAgent(message, planner, previews, signal));
    checker = result.value;
    const correctedRoute = sanitizeRoute(checker.route);
    if (correctedRoute && correctedRoute !== route) {
      route = correctedRoute;
      scenarioEvents = scriptedEvents(promptForRoute(route, message));
      charts = chartPayloads(scenarioEvents);
      previews = previewCharts(charts);
    }

    yield {
      type: "tool_end",
      id: "azure-checker-end",
      tool: "run_sql",
      status: "complete",
      label: checker.description ?? checker.reason ?? `Checker accepted ${ROUTE_LABELS[route]} at ${previews[0]?.rowCount ?? 0} rows`,
      durationMs: result.durationMs,
    };
  } catch {
    yield {
      type: "tool_end",
      id: "azure-checker-fallback",
      tool: "run_sql",
      status: "complete",
      label: `Checker fallback accepted ${ROUTE_LABELS[route]}`,
      durationMs: 0,
    };
  }

  let visual: VisualOutput = {};

  yield { type: "tool_start", id: "azure-visual-start", tool: "render_chart", status: "running", label: "Visual picker: choosing chart set and briefing copy" };
  try {
    const result = await timed(() => runVisualAgent(message, checker, charts, previews, signal));
    visual = result.value;
    charts = orderCharts(charts, visual.chartIds);

    yield {
      type: "tool_end",
      id: "azure-visual-end",
      tool: "render_chart",
      status: "complete",
      label: `Visual picker selected ${charts.map((chart) => chart.title).join(" + ")}`,
      durationMs: result.durationMs,
    };
  } catch {
    yield {
      type: "tool_end",
      id: "azure-visual-fallback",
      tool: "render_chart",
      status: "complete",
      label: "Visual picker fallback used the curated demo chart set",
      durationMs: 0,
    };
  }

  for (const chart of charts) {
    yield { type: "chart", chart };
  }

  yield finalEventFromVisual(visual) ?? fallbackFinal(scenarioEvents);
}

function pickLocalRoute(prompt: string): RouteId {
  const lower = prompt.toLowerCase();
  const hasFinanceMetric = /\b(revenue|sales|ebitda|pbd?t|profit|margin)\b/.test(lower);
  const hasTimeIntent = /\b(time series|trend|monthly|month|over time|run[- ]?rate|trajectory|fy|quarter)\b/.test(lower);
  const hasExplicitFinance = /\b(ebitda|pbd?t|p&l|financial|margin)\b/.test(lower);
  const asksRegionalCut = /\b(region|zone|state|product|channel|dealer|cohort)\b/.test(lower);
  if (hasExplicitFinance || (hasFinanceMetric && hasTimeIntent && !asksRegionalCut)) return "finance";
  if (lower.includes("field force")) return "field_force";
  if (lower.includes("procurement")) return "procurement";
  if (lower.includes("nps")) return "nps";
  if (lower.includes("micro")) return "microbattle";
  if (lower.includes("churn") || lower.includes("channel")) return "churn";
  if (lower.includes("commodity") || lower.includes("markets")) return "commodity";
  return "sales";
}

function promptForRoute(route: RouteId, originalPrompt: string) {
  if (route === "finance" && /\b(revenue|sales|ebitda|pbd?t|profit|margin)\b/i.test(originalPrompt)) return originalPrompt;
  return ROUTE_PROMPTS[route];
}

async function runPlannerAgent(message: string, localRoute: RouteId, signal?: AbortSignal) {
  const text = await callAzureOpenAi(
    [
      { role: "system", content: jsonAgentSystem("first planner agent") },
      {
        role: "user",
        content: [
          "Select the best route and primary SQL for this user question.",
          "Return JSON only with keys: route, sql, description.",
          "Do not invent tables. Choose route from this catalog:",
          JSON.stringify(ROUTE_CATALOG, null, 2),
          `Local fallback route: ${localRoute}`,
          `Question: ${message}`,
        ].join("\n\n"),
      },
    ],
    signal,
  );
  return parseJson<PlannerOutput>(text);
}

async function runCheckerAgent(message: string, planner: PlannerOutput, previews: ReturnType<typeof previewCharts>, signal?: AbortSignal) {
  const text = await callAzureOpenAi(
    [
      { role: "system", content: jsonAgentSystem("SQL checker agent") },
      {
        role: "user",
        content: [
          "Validate whether the planner selected the right route and dataset for the user question.",
          "Return JSON only with keys: status, route, description, reason.",
          "Use the same route if correct. Use a corrected route only if the selected data cannot answer the question.",
          `Question: ${message}`,
          `Planner output: ${JSON.stringify(planner, null, 2)}`,
          `Executed dataset previews: ${JSON.stringify(previews, null, 2)}`,
        ].join("\n\n"),
      },
    ],
    signal,
  );
  return parseJson<CheckerOutput>(text);
}

async function runVisualAgent(message: string, checker: CheckerOutput, charts: ChartPayload[], previews: ReturnType<typeof previewCharts>, signal?: AbortSignal) {
  const text = await callAzureOpenAi(
    [
      { role: "system", content: jsonAgentSystem("visual picker and executive narrative agent") },
      {
        role: "user",
        content: [
          "Pick the best charts from the candidates and write the final executive answer.",
          "Return JSON only with keys: chartIds, insight, chartObservations, watchOut.",
          "chartObservations must be an array of 2-3 strings. chartIds must only contain candidate ids.",
          `Question: ${message}`,
          `Checker output: ${JSON.stringify(checker, null, 2)}`,
          `Chart candidates: ${JSON.stringify(charts.map(({ id, title, narrative, sql }) => ({ id, title, narrative, sql })), null, 2)}`,
          `Executed data previews: ${JSON.stringify(previews, null, 2)}`,
        ].join("\n\n"),
      },
    ],
    signal,
  );
  return parseJson<VisualOutput>(text);
}

function jsonAgentSystem(agentName: string) {
  return [
    `You are the ${agentName} inside the Shriram Farm Solutions executive cockpit.`,
    "Return strict JSON only. No markdown, no prose outside JSON.",
    responseContract,
    sfsModelContext,
    `Data dictionary: ${JSON.stringify(dataDictionary)}`,
  ].join("\n\n");
}

function chartPayloads(events: ChatEvent[]) {
  return events.flatMap((event) => (event.type === "chart" ? [event.chart] : []));
}

function previewCharts(charts: ChartPayload[]) {
  return charts.map((chart) => {
    const rows = runStaticDemoSql(chart.sql);
    return {
      chartId: chart.id,
      title: chart.title,
      sql: chart.sql,
      rowCount: rows.length,
      columns: Object.keys(rows[0] ?? {}),
      sample: rows.slice(0, 6),
    };
  });
}

function orderCharts(charts: ChartPayload[], chartIds: unknown) {
  if (!Array.isArray(chartIds) || !chartIds.length) return charts;
  const requested = chartIds.map(String);
  const byId = new Map(charts.map((chart) => [chart.id, chart]));
  const ordered = requested.map((id) => byId.get(id)).filter(Boolean) as ChartPayload[];
  const remaining = charts.filter((chart) => !requested.includes(chart.id));
  return ordered.length ? [...ordered, ...remaining] : charts;
}

function finalEventFromVisual(visual: VisualOutput): ChatEvent | null {
  if (!visual.insight || !Array.isArray(visual.chartObservations) || !visual.chartObservations.length) return null;
  return {
    type: "final",
    text: [
      `Insight: ${visual.insight}`,
      `Chart observations:\n${visual.chartObservations.map((observation) => `- ${observation}`).join("\n")}`,
      visual.watchOut ? `Watch-out: ${visual.watchOut}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function fallbackFinal(events: ChatEvent[]): ChatEvent {
  return events.find((event): event is Extract<ChatEvent, { type: "final" }> => event.type === "final") ?? {
    type: "final",
    text: "Insight: The query completed, but the agent did not return a final narrative.\n\nChart observations:\n- Review the rendered chart for the selected data cut.",
  };
}

function sanitizeRoute(route: unknown): RouteId | null {
  if (typeof route !== "string") return null;
  const normalized = route.toLowerCase().replace(/[\s-]+/g, "_");
  return normalized in ROUTE_LABELS ? (normalized as RouteId) : null;
}

async function timed<T>(fn: () => Promise<T>): Promise<TimedResult<T>> {
  const start = performance.now();
  const value = await fn();
  return { value, durationMs: Math.max(1, Math.round(performance.now() - start)) };
}

function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Agent did not return JSON.");
    return JSON.parse(match[0]) as T;
  }
}
