import type { ChartPayload, ChatEvent } from "@/lib/agent-types";
import { callAzureOpenAi, isAzureOpenAiConfigured } from "@/lib/azure-openai";
import { dataDictionary } from "@/lib/data-dictionary";
import { runGeneratedSql } from "@/lib/demo-query-runner";
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
  sql?: string;
  description?: string;
  reason?: string;
};

type VisualOutput = {
  chartType?: string;
  title?: string;
  description?: string;
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
  finance: "fact_finance_pl",
  field_force: "fact_field_visits",
  procurement: "fact_procurement",
  nps: "fact_targets",
  microbattle: "wave1_microbattles",
  churn: "fact_collections",
  commodity: "fact_commodity_prices",
  sales: "fact_targets",
};

const ROUTE_CATALOG = Object.entries(ROUTE_PROMPTS).map(([route, prompt]) => ({ route, example: prompt, primary_table: ROUTE_LABELS[route as RouteId] }));

export async function* agentEvents(message: string, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  const useAzure = isAzureOpenAiConfigured();
  let route = pickLocalRoute(message);
  let planner: PlannerOutput = {};
  let sql = "";
  let rows: Record<string, unknown>[] = [];
  let rowError = "";

  yield { type: "tool_start", id: "azure-planner-start", tool: "list_tables", status: "running", label: "Planner agent: selecting dataset and SQL" };
  if (!useAzure) {
    const localPlan = localPlanForPrompt(message, route);
    route = localPlan.route;
    sql = localPlan.sql;
    planner = {
      route,
      sql,
      description: localPlan.description,
    };
    yield {
      type: "tool_end",
      id: "local-planner-end",
      tool: "list_tables",
      status: "complete",
      label: planner.description ?? `Local planner selected ${ROUTE_LABELS[route]}`,
      sql,
      durationMs: 0,
    };
  } else {
    try {
      const result = await timed(() => runPlannerAgent(message, route, signal));
      planner = result.value;
      route = sanitizeRoute(planner.route) ?? route;
      sql = sanitizeSql(planner.sql) ?? defaultSqlForRoute(route);
      yield {
        type: "tool_end",
        id: "azure-planner-end",
        tool: "list_tables",
        status: "complete",
        label: planner.description ?? `Planner selected ${ROUTE_LABELS[route]}`,
        sql,
        durationMs: result.durationMs,
      };
    } catch {
      sql = defaultSqlForRoute(route);
      yield {
        type: "tool_end",
        id: "azure-planner-fallback",
        tool: "list_tables",
        status: "complete",
        label: `Planner fallback selected ${ROUTE_LABELS[route]}`,
        sql,
        durationMs: 0,
      };
    }
  }

  let checker: CheckerOutput = {};

  yield { type: "tool_start", id: "azure-checker-start", tool: "run_sql", status: "running", label: "Checker agent: validating SQL against generated data" };
  const firstRun = runSqlAttempt(sql);
  rows = firstRun.rows;
  rowError = firstRun.error;

  if (!useAzure) {
    if (rowError) {
      sql = defaultSqlForRoute(route);
      const fallbackRun = runSqlAttempt(sql);
      rows = fallbackRun.rows;
      rowError = fallbackRun.error;
    }

    yield {
      type: "tool_end",
      id: "local-checker-end",
      tool: "run_sql",
      status: rowError ? "error" : "complete",
      label: rowError ? `SQL failed: ${rowError}` : `Checker ran ${rows.length} rows from ${ROUTE_LABELS[route]}`,
      sql,
      durationMs: 0,
    };
  } else {
    try {
      const result = await timed(() => runCheckerAgent(message, planner, sql, rows, rowError, signal));
      checker = result.value;
      const correctedRoute = sanitizeRoute(checker.route);
      route = correctedRoute ?? route;
      const correctedSql = sanitizeSql(checker.sql);
      if (correctedSql && correctedSql !== sql) {
        sql = correctedSql;
        const correctedRun = runSqlAttempt(sql);
        rows = correctedRun.rows;
        rowError = correctedRun.error;
      }

      if (rowError) throw new Error(rowError);

      yield {
        type: "tool_end",
        id: "azure-checker-end",
        tool: "run_sql",
        status: "complete",
        label: checker.description ?? checker.reason ?? `Checker ran ${rows.length} rows from ${ROUTE_LABELS[route]}`,
        sql,
        durationMs: result.durationMs,
      };
    } catch {
      if (rowError) {
        sql = defaultSqlForRoute(route);
        const fallbackRun = runSqlAttempt(sql);
        rows = fallbackRun.rows;
        rowError = fallbackRun.error;
      }

      yield {
        type: "tool_end",
        id: "azure-checker-fallback",
        tool: "run_sql",
        status: "complete",
        label: rowError ? `Checker fallback could not run SQL: ${rowError}` : `Checker fallback ran ${rows.length} rows from ${ROUTE_LABELS[route]}`,
        sql,
        durationMs: 0,
      };
    }
  }

  let visual: VisualOutput = {};
  let chart = buildChartFromRows({
    id: `agent-${route}-${Date.now()}`,
    title: titleForRequest(message, route, sql),
    description: planner.description ?? checker.description ?? `Generated from ${ROUTE_LABELS[route]}`,
    chartType: inferChartType(rows),
    sql,
    rows,
  });

  yield { type: "tool_start", id: "azure-visual-start", tool: "render_chart", status: "running", label: "Visual picker: choosing chart set and briefing copy" };
  if (!useAzure) {
    yield {
      type: "tool_end",
      id: "local-visual-end",
      tool: "render_chart",
      status: "complete",
      label: `Visual picker rendered ${chart.title} from executed rows`,
      durationMs: 0,
    };
  } else {
    try {
      const result = await timed(() => runVisualAgent(message, checker, sql, rows, signal));
      visual = result.value;
      chart = buildChartFromRows({
        id: chart.id,
        title: visual.title ?? chart.title,
        description: visual.description ?? chart.narrative,
        chartType: visual.chartType ?? inferChartType(rows),
        sql,
        rows,
      });

      yield {
        type: "tool_end",
        id: "azure-visual-end",
        tool: "render_chart",
        status: "complete",
        label: `Visual picker selected ${chart.title}`,
        durationMs: result.durationMs,
      };
    } catch {
      yield {
        type: "tool_end",
        id: "azure-visual-fallback",
        tool: "render_chart",
        status: "complete",
        label: "Visual picker fallback used the executed SQL result",
        durationMs: 0,
      };
    }
  }

  yield { type: "chart", chart };

  yield finalEventFromVisual(visual) ?? fallbackFinalFromRows(route, rows);
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

async function runPlannerAgent(message: string, localRoute: RouteId, signal?: AbortSignal) {
  const text = await callAzureOpenAi(
    [
      { role: "system", content: jsonAgentSystem("first planner agent") },
      {
        role: "user",
        content: [
          "Select the best route and primary SQL for this user question.",
          "Return JSON only with keys: route, sql, description.",
          "Do not invent tables. Choose route from this catalog, then write a real SQL SELECT over the table columns.",
          "Supported SQL: SELECT columns and SUM/AVG/MIN/MAX/COUNT aggregates, FROM one table, optional WHERE with AND, optional GROUP BY, ORDER BY, LIMIT.",
          "Do not use joins, CTEs, date functions, window functions, QUALIFY, NULLIF, arithmetic expressions, or table aliases.",
          JSON.stringify(ROUTE_CATALOG, null, 2),
          `Local fallback route: ${localRoute}`,
          `Data dictionary: ${JSON.stringify(dataDictionary, null, 2)}`,
          `Question: ${message}`,
        ].join("\n\n"),
      },
    ],
    signal,
  );
  return parseJson<PlannerOutput>(text);
}

async function runCheckerAgent(message: string, planner: PlannerOutput, sql: string, rows: Record<string, unknown>[], error: string, signal?: AbortSignal) {
  const text = await callAzureOpenAi(
    [
      { role: "system", content: jsonAgentSystem("SQL checker agent") },
      {
        role: "user",
        content: [
          "Validate whether the planner selected the right route and dataset for the user question.",
          "Return JSON only with keys: status, route, sql, description, reason.",
          "If the SQL errored, return corrected SQL using the supported SQL subset.",
          "If the SQL ran but does not answer the question, return corrected route and SQL.",
          `Question: ${message}`,
          `Planner output: ${JSON.stringify(planner, null, 2)}`,
          `SQL executed: ${sql}`,
          `Execution error: ${error || "none"}`,
          `Rows returned: ${rows.length}`,
          `Sample rows: ${JSON.stringify(rows.slice(0, 8), null, 2)}`,
        ].join("\n\n"),
      },
    ],
    signal,
  );
  return parseJson<CheckerOutput>(text);
}

async function runVisualAgent(message: string, checker: CheckerOutput, sql: string, rows: Record<string, unknown>[], signal?: AbortSignal) {
  const text = await callAzureOpenAi(
    [
      { role: "system", content: jsonAgentSystem("visual picker and executive narrative agent") },
      {
        role: "user",
        content: [
          "Pick the best chart type for the executed result and write the final executive answer.",
          "Return JSON only with keys: title, description, chartType, insight, chartObservations, watchOut.",
          "chartType must be one of line, area, bar, horizontal-bar, scatter.",
          "chartObservations must be an array of 2-3 strings.",
          `Question: ${message}`,
          `Checker output: ${JSON.stringify(checker, null, 2)}`,
          `SQL: ${sql}`,
          `Rows returned: ${rows.length}`,
          `Columns: ${JSON.stringify(Object.keys(rows[0] ?? {}))}`,
          `Sample rows: ${JSON.stringify(rows.slice(0, 12), null, 2)}`,
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

function fallbackFinalFromRows(route: RouteId, rows: Record<string, unknown>[]): ChatEvent {
  const columns = Object.keys(rows[0] ?? {});
  const primaryNumeric = columns.find((column) => rows.some((row) => isNumeric(row[column])));
  const labelColumn = columns.find((column) => column !== primaryNumeric && !rows.some((row) => isNumeric(row[column])));
  const topRow =
    primaryNumeric && labelColumn
      ? [...rows].sort((left, right) => Number(right[primaryNumeric] ?? 0) - Number(left[primaryNumeric] ?? 0))[0]
      : undefined;
  const total =
    primaryNumeric && /revenue|value|spend|sales|invoice|target|actual|ebitda/i.test(primaryNumeric)
      ? rows.reduce((sum, row) => sum + Number(row[primaryNumeric] ?? 0), 0)
      : null;

  return {
    type: "final",
    text: [
      topRow && primaryNumeric && labelColumn
        ? `Insight: ${String(topRow[labelColumn])} is the largest contributor on ${metricLabel(primaryNumeric).toLowerCase()}${total ? `; total is ${formatBusinessNumber(total)} across ${rows.length} rows` : ""}.`
        : `Insight: The agents executed a live SQL query against ${ROUTE_LABELS[route]} and returned ${rows.length} rows for analysis.`,
      `Chart observations:\n- The chart uses ${labelColumn ? metricLabel(labelColumn) : metricLabel(columns[0] ?? "the category")} on the x-axis and ${primaryNumeric ? metricLabel(primaryNumeric).toLowerCase() : "the selected metric"} on the y-axis.\n- The result columns are: ${columns.map(metricLabel).join(", ") || "none"}.`,
    ].join("\n\n"),
  };
}

function sanitizeRoute(route: unknown): RouteId | null {
  if (typeof route !== "string") return null;
  const normalized = route.toLowerCase().replace(/[\s-]+/g, "_");
  return normalized in ROUTE_LABELS ? (normalized as RouteId) : null;
}

function sanitizeSql(sql: unknown) {
  if (typeof sql !== "string") return null;
  const trimmed = sql.trim();
  if (!/^select\b/i.test(trimmed)) return null;
  if (trimmed.replace(/;+\s*$/, "").includes(";")) return null;
  return trimmed;
}

function runSqlAttempt(sql: string) {
  try {
    const rows = runGeneratedSql(sql) as Record<string, unknown>[];
    return { rows, error: "" };
  } catch (error) {
    return { rows: [] as Record<string, unknown>[], error: error instanceof Error ? error.message : "SQL failed" };
  }
}

function defaultSqlForRoute(route: RouteId) {
  const sqlByRoute: Record<RouteId, string> = {
    finance: "SELECT month, SUM(revenue_inr) AS revenue_inr, SUM(ebitda_inr) AS ebitda_inr, AVG(ebitda_pct) AS ebitda_pct FROM fact_finance_pl GROUP BY month ORDER BY month LIMIT 24",
    field_force: "SELECT visit_outcome, COUNT(*) AS visits, AVG(duration_min) AS avg_duration_min FROM fact_field_visits GROUP BY visit_outcome ORDER BY visits DESC LIMIT 10",
    procurement: "SELECT material_category, SUM(total_value_inr) AS total_value_inr, AVG(premium_vs_market_pct) AS premium_vs_market_pct FROM fact_procurement GROUP BY material_category ORDER BY total_value_inr DESC LIMIT 10",
    nps: "SELECT region, category, AVG(achievement_pct) AS achievement_pct, SUM(actual_net_value_inr) AS actual_net_value_inr FROM fact_targets GROUP BY region, category ORDER BY achievement_pct DESC LIMIT 12",
    microbattle: "SELECT name, owner_function, status, percent_complete FROM wave1_microbattles ORDER BY percent_complete ASC LIMIT 12",
    churn: "SELECT status, AVG(days_overdue) AS avg_days_overdue, SUM(invoice_value_inr) AS invoice_value_inr, COUNT(*) AS invoices FROM fact_collections GROUP BY status ORDER BY avg_days_overdue DESC LIMIT 10",
    commodity: "SELECT commodity, AVG(spot_price_inr) AS spot_price_inr FROM fact_commodity_prices GROUP BY commodity ORDER BY spot_price_inr DESC LIMIT 10",
    sales: "SELECT region, category, SUM(actual_net_value_inr) AS actual_net_value_inr, SUM(target_net_value_inr) AS target_net_value_inr, AVG(achievement_pct) AS achievement_pct FROM fact_targets GROUP BY region, category ORDER BY actual_net_value_inr DESC LIMIT 12",
  };
  return sqlByRoute[route];
}

function localPlanForPrompt(prompt: string, route: RouteId) {
  const lower = prompt.toLowerCase();
  const asksRevenue = /\b(revenue|sales|topline|turnover)\b/.test(lower);
  const asksEbitda = /\b(ebitda|profit|margin|pbd?t)\b/.test(lower);
  const asksLastQuarter = /\b(last|previous|prior)\s+(quarter|qtr)\b/.test(lower);
  const asksTrend = /\b(time series|trend|monthly|over time|trajectory|run[- ]?rate)\b/.test(lower);

  if (route === "finance" && asksRevenue && asksLastQuarter && !asksTrend) {
    return {
      route,
      sql:
        asksEbitda
          ? "SELECT business_unit, SUM(revenue_inr) AS revenue_inr, SUM(ebitda_inr) AS ebitda_inr, AVG(ebitda_pct) AS ebitda_pct FROM fact_finance_pl WHERE fiscal_year = 'FY26' AND fiscal_quarter = 'Q4' GROUP BY business_unit ORDER BY revenue_inr DESC LIMIT 10"
          : "SELECT business_unit, SUM(revenue_inr) AS revenue_inr FROM fact_finance_pl WHERE fiscal_year = 'FY26' AND fiscal_quarter = 'Q4' GROUP BY business_unit ORDER BY revenue_inr DESC LIMIT 10",
      description: "Local planner selected FY26 Q4 revenue from fact_finance_pl and grouped it by business unit.",
    };
  }

  if (route === "finance" && asksRevenue && !asksEbitda && !asksTrend) {
    return {
      route,
      sql: "SELECT fiscal_year, fiscal_quarter, SUM(revenue_inr) AS revenue_inr FROM fact_finance_pl GROUP BY fiscal_year, fiscal_quarter ORDER BY fiscal_year, fiscal_quarter LIMIT 8",
      description: "Local planner selected quarterly revenue from fact_finance_pl.",
    };
  }

  return {
    route,
    sql: defaultSqlForRoute(route),
    description: `Local planner selected ${ROUTE_LABELS[route]} and generated SQL for the request.`,
  };
}

function titleForRoute(route: RouteId) {
  const titles: Record<RouteId, string> = {
    finance: "Financial performance trend",
    field_force: "Field-force execution",
    procurement: "Procurement performance",
    nps: "Farmer NPS analysis",
    microbattle: "Wave 1 execution status",
    churn: "Channel-partner churn risk",
    commodity: "Commodity market movement",
    sales: "Revenue analysis",
  };
  return titles[route];
}

function titleForRequest(prompt: string, route: RouteId, sql: string) {
  const lower = `${prompt} ${sql}`.toLowerCase();
  if (route === "finance" && lower.includes("revenue_inr") && lower.includes("business_unit") && lower.includes("fiscal_quarter = 'q4'")) {
    return "Last-quarter revenue by business unit";
  }
  if (route === "finance" && lower.includes("revenue_inr") && lower.includes("fiscal_quarter")) {
    return "Quarterly revenue trend";
  }
  return titleForRoute(route);
}

function buildChartFromRows(input: {
  id: string;
  title: string;
  description: string;
  chartType: string;
  sql: string;
  rows: Record<string, unknown>[];
}): ChartPayload {
  const mark = markForChartType(input.chartType);
  const columns = Object.keys(input.rows[0] ?? {});
  const xField = columns.find((column) => !input.rows.some((row) => isNumeric(row[column]))) ?? columns[0] ?? "category";
  const yField = columns.find((column) => column !== xField && input.rows.some((row) => isNumeric(row[column]))) ?? columns[1] ?? "value";

  return {
    id: input.id,
    title: input.title,
    narrative: input.description,
    sql: input.sql,
    span: 3,
    rows: input.rows,
    spec: {
      data: { name: "data" },
      mark,
      encoding: {
        x: { field: xField, type: isDateLike(input.rows[0]?.[xField]) ? "temporal" : "nominal" },
        y: { field: yField, type: "quantitative" },
      },
    },
  };
}

function markForChartType(chartType: string) {
  const normalized = chartType.toLowerCase();
  if (normalized.includes("scatter")) return { type: "circle", tooltip: true } as const;
  if (normalized.includes("bar")) return { type: "bar", tooltip: true } as const;
  if (normalized.includes("area")) return { type: "area", tooltip: true } as const;
  return { type: "line", point: true, tooltip: true } as const;
}

function inferChartType(rows: Record<string, unknown>[]) {
  const columns = Object.keys(rows[0] ?? {});
  const hasTime = columns.some((column) => rows.some((row) => isDateLike(row[column])));
  const numericCount = columns.filter((column) => rows.some((row) => isNumeric(row[column]))).length;
  if (hasTime && numericCount >= 1) return "line";
  if (numericCount >= 2 && rows.length <= 30) return "scatter";
  return "bar";
}

function isNumeric(value: unknown) {
  return typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)));
}

function isDateLike(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}(?:-\d{2})?$/.test(value);
}

function labelize(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function metricLabel(key: string) {
  const normalized = key.toLowerCase().replace(/^(sum|avg|min|max|count)\s+/, "");
  if (normalized === "revenue_inr") return "Revenue";
  if (normalized === "ebitda_inr") return "EBITDA";
  if (normalized === "total_value_inr") return "Total value";
  if (normalized === "actual_net_value_inr") return "Actual sales";
  if (normalized === "target_net_value_inr") return "Target sales";
  return labelize(key)
    .replace(/\bInr\b/g, "INR")
    .replace(/\bPct\b/g, "%")
    .replace(/\bEbitda\b/g, "EBITDA")
    .replace(/\bNps\b/g, "NPS");
}

function formatBusinessNumber(value: number) {
  const abs = Math.abs(value);
  if (abs >= 10_000_000) return `₹${(value / 10_000_000).toFixed(abs >= 100_000_000 ? 1 : 2)} Cr`;
  if (abs >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value);
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
