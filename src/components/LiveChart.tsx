"use client";

import { Check, Copy, FileText, Pin, PinOff, RefreshCw, Table2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { getDuckDbStore, rowsToCsv, tablesForSql } from "./duckdb-client";
import type { ChartBundle } from "./types";

type LiveChartProps = {
  chart: ChartBundle;
  live?: boolean;
  pinned?: boolean;
  compact?: boolean;
  onPin?: (chart: ChartBundle) => void;
  onRemove?: (id: string) => void;
};

type QueryState = {
  rows: Record<string, unknown>[];
  error?: string;
  loading: boolean;
  tables: string[];
};

type ChartKind = "area" | "line" | "bar" | "stacked-bar" | "horizontal-bar" | "scatter";

type ChartModel = {
  kind: ChartKind;
  data: Record<string, unknown>[];
  config: ChartConfig;
  xKey: string;
  yKeys: string[];
  labelKey?: string;
  colorKey?: string;
};

const SERIES_COLORS = ["#bd2430", "#2f7d87", "#bc7a22", "#5f7d4f", "#d86b73", "#6f6b66", "#7f6bbd", "#119c72"];

export function LiveChart({ chart, live = true, pinned, compact, onPin, onRemove }: LiveChartProps) {
  const [query, setQuery] = useState<QueryState>({ rows: [], loading: true, tables: [] });
  const [copied, setCopied] = useState<"sql" | "csv" | null>(null);
  const isAnalysisReport = chart.visualType === "analysis_report";

  const runQuery = useCallback(async () => {
    if (isAnalysisReport) {
      setQuery({ rows: [], loading: false, tables: [] });
      return;
    }

    setQuery((current) => ({ ...current, loading: true, error: undefined }));

    if (chart.rows?.length) {
      setQuery({ rows: chart.rows, loading: false, tables: await tablesForSql(chart.sql) });
      return;
    }

    const [store, tables] = await Promise.all([getDuckDbStore(), tablesForSql(chart.sql)]);
    if (!store) {
      setQuery({
        rows: [],
        tables,
        loading: false,
        error: "DuckDB store is not available yet.",
      });
      return;
    }

    try {
      const rows = await store.runSql(chart.sql);
      setQuery({ rows: Array.isArray(rows) ? rows : [], loading: false, tables });
    } catch (error) {
      setQuery({
        rows: [],
        tables,
        loading: false,
        error: error instanceof Error ? error.message : "Query failed.",
      });
    }
  }, [chart.rows, chart.sql, isAnalysisReport]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (!cancelled) await runQuery();
    };

    start();
    return () => {
      cancelled = true;
    };
  }, [runQuery]);

  useEffect(() => {
    if (!live || chart.rows?.length || isAnalysisReport) return;

    let cleanup: (() => void) | undefined;
    let active = true;

    const wireSubscription = async () => {
      const [store, tables] = await Promise.all([getDuckDbStore(), tablesForSql(chart.sql)]);
      if (!active || !store?.subscribe || !tables.length) return;

      const subscription = store.subscribe(tables, runQuery);
      cleanup = typeof subscription === "function" ? subscription : () => subscription.unsubscribe();
    };

    wireSubscription();

    return () => {
      active = false;
      cleanup?.();
    };
  }, [chart.rows, chart.sql, isAnalysisReport, live, runQuery]);

  const copy = async (kind: "sql" | "csv") => {
    const text = kind === "sql" ? chart.sql : isAnalysisReport ? analysisReportToText(chart) : rowsToCsv(query.rows);
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1400);
  };

  return (
    <section className={cn("chart-panel group", compact && "chart-panel-compact", chart.span && `chart-span-${chart.span}`)}>
      <header className="chart-header">
        <div className="chart-title-block">
          <div className="chart-eyebrow">{inferDomain(chart, query.tables)}</div>
          <h3>{chart.title}</h3>
          {chart.description && chart.span !== 1 ? <p>{chart.description}</p> : null}
        </div>
        <div className="chart-actions">
          {!isAnalysisReport ? (
            <>
              <button type="button" title="Refresh" onClick={runQuery}>
                <RefreshCw size={15} className={query.loading ? "animate-spin" : undefined} />
              </button>
              <button type="button" title="Copy SQL" onClick={() => copy("sql")}>
                {copied === "sql" ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </>
          ) : null}
          <button type="button" title={isAnalysisReport ? "Copy analysis" : "Copy CSV"} onClick={() => copy("csv")} disabled={!isAnalysisReport && !query.rows.length}>
            {isAnalysisReport ? <FileText size={15} /> : <Table2 size={15} />}
          </button>
          {onPin ? (
            <button type="button" title={pinned ? "Pinned" : "Pin chart"} onClick={() => onPin(chart)}>
              {pinned ? <PinOff size={15} /> : <Pin size={15} />}
            </button>
          ) : null}
          {onRemove ? (
            <button type="button" title="Remove" onClick={() => onRemove(chart.id)}>
              <Trash2 size={15} />
            </button>
          ) : null}
        </div>
      </header>

      <div className="chart-canvas">
        {isAnalysisReport ? (
          <GeneratedAnalysisReport chart={chart} />
        ) : query.loading && !query.rows.length ? (
          <div className="chart-loading">Running SQL and preparing chart</div>
        ) : query.error ? (
          <div className="chart-empty">
            <strong>Waiting for data runtime</strong>
            <span>{query.error}</span>
          </div>
        ) : !query.rows.length ? (
          <div className="chart-empty">
            <strong>No rows returned</strong>
            <span>The generated SQL ran successfully but returned an empty result set.</span>
          </div>
        ) : (
          <GeneratedChart chart={chart} rows={query.rows} compact={compact} />
        )}
      </div>
    </section>
  );
}

function GeneratedChart({ chart, rows, compact }: { chart: ChartBundle; rows: Record<string, unknown>[]; compact?: boolean }) {
  const isTable = chart.visualType === "table";
  const model = useMemo(() => (isTable ? null : buildChartModel(chart, rows)), [chart, rows, isTable]);

  if (isTable) {
    return <GeneratedTable chart={chart} rows={rows} />;
  }

  if (!model) {
    return (
      <div className="chart-empty">
        <strong>Chart ready</strong>
        <span>The SQL returned rows, but there was no numeric field to plot.</span>
      </div>
    );
  }

  const heightClass = compact ? "h-[220px]" : chart.span === 1 ? "h-[226px]" : "h-[272px]";
  const axisProps = {
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
    minTickGap: 22,
  };
  const yAxisWidth = compact ? 58 : 76;

  if (model.kind === "scatter") {
    return (
      <ChartContainer config={model.config} className={cn("shadcn-chart aspect-auto w-full", heightClass)}>
        <ScatterChart margin={{ left: 12, right: 14, top: 10, bottom: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis {...axisProps} type="number" dataKey={model.xKey} name={labelize(model.xKey)} tickFormatter={formatAxisTick} />
          <YAxis {...axisProps} type="number" dataKey={model.yKeys[0]} name={labelize(model.yKeys[0])} width={yAxisWidth} tickFormatter={formatAxisTick} domain={domainForSeries(model)} />
          <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltipContent indicator="dot" />} />
          <Scatter data={model.data} dataKey={model.yKeys[0]}>
            {model.data.map((entry, index) => (
              <Cell key={`${entry[model.labelKey ?? model.xKey]}-${index}`} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
            ))}
          </Scatter>
        </ScatterChart>
      </ChartContainer>
    );
  }

  if (model.kind === "horizontal-bar") {
    return (
      <ChartContainer config={model.config} className={cn("shadcn-chart aspect-auto w-full", heightClass)}>
        <BarChart data={model.data} layout="vertical" margin={{ left: 8, right: 20, top: 10, bottom: 4 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis {...axisProps} type="number" tickFormatter={formatAxisTick} domain={domainForSeries(model)} />
          <YAxis {...axisProps} type="category" dataKey={model.xKey} width={70} />
          {crossesZero(model) ? <ReferenceLine x={0} stroke="#91887c" strokeDasharray="3 3" /> : null}
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
          <Bar dataKey={model.yKeys[0]} radius={[0, 5, 5, 0]} fill={`var(--color-${cssVarKey(model.yKeys[0])})`} />
        </BarChart>
      </ChartContainer>
    );
  }

  if (model.kind === "bar") {
    return (
      <ChartContainer config={model.config} className={cn("shadcn-chart aspect-auto w-full", heightClass)}>
        <BarChart data={model.data} margin={{ left: 12, right: 12, top: 10, bottom: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis {...axisProps} dataKey={model.xKey} />
          <YAxis {...axisProps} width={yAxisWidth} tickFormatter={formatAxisTick} domain={domainForSeries(model)} />
          {crossesZero(model) ? <ReferenceLine y={0} stroke="#91887c" strokeDasharray="3 3" /> : null}
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          {model.yKeys.map((key, index) => (
            <Bar key={key} dataKey={key} radius={[5, 5, 0, 0]} fill={`var(--color-${cssVarKey(key)})`} opacity={index ? 0.72 : 1} />
          ))}
        </BarChart>
      </ChartContainer>
    );
  }

  if (model.kind === "stacked-bar") {
    return (
      <ChartContainer config={model.config} className={cn("shadcn-chart aspect-auto w-full", heightClass)}>
        <BarChart data={model.data} margin={{ left: 12, right: 12, top: 10, bottom: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis {...axisProps} dataKey={model.xKey} />
          <YAxis {...axisProps} width={yAxisWidth} tickFormatter={formatAxisTick} domain={domainForStackedSeries(model)} />
          {crossesZero(model) ? <ReferenceLine y={0} stroke="#91887c" strokeDasharray="3 3" /> : null}
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          <ChartLegend content={<ChartLegendContent />} />
          {model.yKeys.map((key) => (
            <Bar key={key} dataKey={key} stackId="a" radius={[4, 4, 0, 0]} fill={`var(--color-${cssVarKey(key)})`} />
          ))}
        </BarChart>
      </ChartContainer>
    );
  }

  if (model.kind === "line") {
    const dualAxis = shouldUseDualAxis(model);
    return (
      <ChartContainer config={model.config} className={cn("shadcn-chart aspect-auto w-full", heightClass)}>
        <LineChart data={model.data} margin={{ left: 12, right: dualAxis ? 22 : 14, top: 10, bottom: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis {...axisProps} dataKey={model.xKey} />
          <YAxis {...axisProps} yAxisId="left" width={yAxisWidth} tickFormatter={formatAxisTick} domain={domainForKey(model, model.yKeys[0])} />
          {dualAxis ? (
            <YAxis
              {...axisProps}
              yAxisId="right"
              orientation="right"
              width={yAxisWidth}
              tickFormatter={formatAxisTick}
              domain={domainForKey(model, model.yKeys[1])}
            />
          ) : null}
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
          {model.yKeys.map((key, index) => (
            <Line
              key={key}
              yAxisId={dualAxis && index === 1 ? "right" : "left"}
              dataKey={key}
              type="monotone"
              stroke={`var(--color-${cssVarKey(key)})`}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
          {model.yKeys.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
        </LineChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer config={model.config} className={cn("shadcn-chart aspect-auto w-full", heightClass)}>
      <AreaChart data={model.data} margin={{ left: 12, right: 14, top: 10, bottom: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis {...axisProps} dataKey={model.xKey} />
        <YAxis {...axisProps} width={yAxisWidth} tickFormatter={formatAxisTick} domain={domainForSeries(model)} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
        <Area
          dataKey={model.yKeys[0]}
          type="natural"
          fill={`var(--color-${cssVarKey(model.yKeys[0])})`}
          fillOpacity={0.18}
          stroke={`var(--color-${cssVarKey(model.yKeys[0])})`}
          strokeWidth={2.5}
          activeDot={{ r: 5 }}
        />
        {model.yKeys.slice(1).map((key) => (
          <Line key={key} dataKey={key} type="monotone" stroke={`var(--color-${cssVarKey(key)})`} strokeWidth={2.25} dot={false} activeDot={{ r: 5 }} />
        ))}
        {model.yKeys.length > 1 ? <ChartLegend content={<ChartLegendContent />} /> : null}
      </AreaChart>
    </ChartContainer>
  );
}

function GeneratedTable({ chart, rows }: { chart: ChartBundle; rows: Record<string, unknown>[] }) {
  const maxRows = typeof chart.tableOptions?.max_rows === "number" ? chart.tableOptions.max_rows : 12;
  const highlights = Array.isArray(chart.tableOptions?.highlight_rows) ? chart.tableOptions.highlight_rows.map(String) : [];
  const visibleRows = rows.slice(0, maxRows);
  const columns = Object.keys(visibleRows[0] ?? {});

  if (!visibleRows.length) {
    return (
      <div className="chart-empty">
        <strong>No rows returned</strong>
        <span>The table query ran successfully but returned an empty result set.</span>
      </div>
    );
  }

  return (
    <div className="analysis-table-wrap">
      <table className="analysis-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{labelize(column)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => {
            const highlighted = highlights.some((needle) => Object.values(row).some((value) => String(value).includes(needle)));
            return (
              <tr key={`${index}-${Object.values(row).join("-")}`} className={highlighted ? "row-highlight" : undefined}>
                {columns.map((column) => (
                  <td key={column} className={isNumericValue(row[column]) ? "num" : undefined}>
                    {formatTableCell(row[column], column)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GeneratedAnalysisReport({ chart }: { chart: ChartBundle }) {
  const trace = chart.analysisTrace ?? [];
  const completed = trace.filter((item) => item.status === "complete").length;
  const errored = trace.filter((item) => item.status === "error").length;

  return (
    <div className="analysis-report-card">
      <div className="analysis-report-summary">
        <strong>{stripInlineMarkdown(chart.analysisContent || chart.description || "Pinned analysis from the cockpit conversation.")}</strong>
        <span>
          {completed} completed artifacts
          {errored ? ` · ${errored} needs review` : ""}
          {chart.relatedCharts?.length ? ` · ${chart.relatedCharts.length} linked charts` : ""}
        </span>
      </div>
      {chart.relatedCharts?.length ? (
        <ul className="analysis-report-links">
          {chart.relatedCharts.slice(0, 6).map((title) => (
            <li key={title}>{title}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function buildChartModel(chart: ChartBundle, sourceRows: Record<string, unknown>[]): ChartModel | null {
  const rows = normalizeRows(sourceRows);
  const columns = Object.keys(rows[0] ?? {});
  const numericColumns = columns.filter((column) => rows.some((row) => isNumericValue(row[column])));
  if (!numericColumns.length) return null;

  const textColumns = columns.filter((column) => !numericColumns.includes(column));
  const kind = inferChartKind(chart, columns, numericColumns);

  if (kind === "scatter") {
    const [xKey, yKey] = numericColumns;
    if (!xKey || !yKey) return buildSingleSeriesModel(chart, rows, columns, numericColumns, textColumns, "bar");
    const labelKey = textColumns[0];
    const yAlias = cssVarKey(yKey);
    return {
      kind: "scatter",
      data: rows.map((row, index) => ({ ...row, [yAlias]: row[yKey], fill: SERIES_COLORS[index % SERIES_COLORS.length] })),
      config: buildConfig([yAlias], [yKey]),
      xKey,
      yKeys: [yAlias],
      labelKey,
    };
  }

  return buildSingleSeriesModel(chart, rows, columns, numericColumns, textColumns, kind);
}

function buildSingleSeriesModel(
  chart: ChartBundle,
  rows: Record<string, unknown>[],
  columns: string[],
  numericColumns: string[],
  textColumns: string[],
  preferredKind: ChartKind,
): ChartModel {
  const xKey = pickXKey(chart, columns, numericColumns, textColumns);
  const yKey = pickYKey(chart, numericColumns, xKey);
  const stackField = optionString(chart.chartOptions, "stack_field");
  if (preferredKind === "stacked-bar" && stackField) {
    const pivot = pivotRows(rows, xKey, stackField, yKey);
    return {
      kind: "stacked-bar",
      data: pivot.data,
      config: buildConfig(pivot.series, pivot.labels),
      xKey,
      yKeys: pivot.series,
    };
  }

  const seriesKey = textColumns.find((column) => column !== xKey && uniqueValues(rows, column).length > 1 && uniqueValues(rows, column).length <= 8);
  const shouldPivot = Boolean(seriesKey && preferredKind !== "horizontal-bar" && preferredKind !== "bar");

  if (shouldPivot && seriesKey) {
    const pivot = pivotRows(rows, xKey, seriesKey, yKey);
    return {
      kind: preferredKind === "bar" ? "bar" : preferredKind,
      data: pivot.data,
      config: buildConfig(pivot.series, pivot.labels),
      xKey,
      yKeys: pivot.series,
    };
  }

  const explicitYKey = optionString(chart.chartOptions, "y_field");
  const yKeys = explicitYKey && numericColumns.includes(explicitYKey)
    ? [explicitYKey]
    : numericColumns.filter((column) => column !== xKey).slice(0, preferredKind === "bar" ? 3 : 2);
  const finalYKeys = yKeys.length ? yKeys : [yKey];
  const aliases = finalYKeys.map(cssVarKey);

  return {
    kind: preferredKind,
    data: rows.map((row) => ({
      ...row,
      ...Object.fromEntries(finalYKeys.map((key, index) => [aliases[index], row[key]])),
    })),
    config: buildConfig(aliases, finalYKeys),
    xKey,
    yKeys: aliases,
  };
}

function inferChartKind(chart: ChartBundle, columns: string[], numericColumns: string[]): ChartKind {
  const text = `${chart.title} ${chart.description ?? ""} ${columns.join(" ")}`.toLowerCase();
  const mark = chart.spec?.mark;
  const markType = typeof mark === "string" ? mark : mark && typeof mark === "object" && "type" in mark ? String(mark.type) : "";
  const hasTime = columns.some((column) => /(^|_)(date|month|week|quarter|period|year)($|_)/i.test(column));

  if (chart.visualType === "stacked_bar") return "stacked-bar";
  if (chart.visualType === "line_chart") return "line";
  if (chart.visualType === "scatter") return "scatter";
  if (chart.visualType === "bar_chart") return "bar";
  if (markType.includes("line")) return "line";
  if (markType.includes("area")) return "area";
  if (markType.includes("point") || markType.includes("circle") || text.includes("scatter") || text.includes("digital engagement")) return "scatter";
  if (text.includes("risk") || text.includes("churn") || text.includes("dealer")) return "horizontal-bar";
  if (markType.includes("bar") || text.includes("orders") || text.includes("coverage by") || text.includes("by region")) return "bar";
  if (hasTime) return "line";
  if (text.includes("trend") || text.includes("weekly") || text.includes("quarter") || text.includes("wave")) return "area";
  if (numericColumns.length >= 2) return "area";
  return "bar";
}

function normalizeRows(rows: Record<string, unknown>[]) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        if (isNumericValue(value)) return [key, Number(value)];
        return [key, value == null ? "" : String(value)];
      }),
    ),
  );
}

function pickXKey(chart: ChartBundle, columns: string[], numericColumns: string[], textColumns: string[]) {
  const explicit = optionString(chart.chartOptions, "x_field");
  if (explicit && columns.includes(explicit)) return explicit;
  const preferredText = textColumns.find((column) => /(date|week|quarter|month|period|wave|year|zone|region|dealer|category|name)/i.test(column));
  if (preferredText) return preferredText;
  return textColumns[0] ?? columns.find((column) => !numericColumns.includes(column)) ?? columns[0] ?? "category";
}

function pickYKey(chart: ChartBundle, numericColumns: string[], xKey: string) {
  const explicit = optionString(chart.chartOptions, "y_field");
  if (explicit && numericColumns.includes(explicit)) return explicit;
  const text = chart.title.toLowerCase();
  const preferred = numericColumns.find((column) => {
    const normalized = column.toLowerCase();
    return (
      column !== xKey &&
      (text.includes(normalized) ||
        /(nps|value|coverage|actual|planned|order|score|risk|amount|sales|visit|percent|rate|revenue|ebitda|margin|budget|crore|booked)/i.test(column))
    );
  });
  return preferred ?? numericColumns.find((column) => column !== xKey) ?? numericColumns[0] ?? "value";
}

function pivotRows(rows: Record<string, unknown>[], xKey: string, seriesKey: string, yKey: string) {
  const labels = uniqueValues(rows, seriesKey);
  const series = labels.map(cssVarKey);
  const byX = new Map<string, Record<string, unknown>>();

  rows.forEach((row) => {
    const xValue = String(row[xKey]);
    const seriesValue = cssVarKey(String(row[seriesKey]));
    const current = byX.get(xValue) ?? { [xKey]: xValue };
    current[seriesValue] = Number(row[yKey]);
    byX.set(xValue, current);
  });

  return { data: Array.from(byX.values()), series, labels };
}

function uniqueValues(rows: Record<string, unknown>[], key: string) {
  return Array.from(new Set(rows.map((row) => String(row[key])).filter(Boolean)));
}

function isNumericValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string" || value.trim() === "") return false;
  return Number.isFinite(Number(value));
}

function buildConfig(keys: string[], labels = keys): ChartConfig {
  return Object.fromEntries(
    keys.map((key, index) => [
      key,
      {
        label: labelize(labels[index] ?? key),
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      },
    ]),
  ) satisfies ChartConfig;
}

function domainForSeries(model: ChartModel): [number | "auto", number | "auto"] {
  const values = model.data.flatMap((row) => model.yKeys.map((key) => Number(row[key])).filter(Number.isFinite));
  return domainForValues(values);
}

function domainForStackedSeries(model: ChartModel): [number | "auto", number | "auto"] {
  const values = model.data.map((row) =>
    model.yKeys.reduce((sum, key) => {
      const value = Number(row[key]);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0),
  );
  return domainForValues(values);
}

function domainForKey(model: ChartModel, key: string): [number | "auto", number | "auto"] {
  const values = model.data.map((row) => Number(row[key])).filter(Number.isFinite);
  return domainForValues(values);
}

function domainForValues(values: number[]): [number | "auto", number | "auto"] {
  if (!values.length) return ["auto", "auto"];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min >= 0) return [0, niceCeiling(max * 1.08)];

  const padding = Math.max((max - min) * 0.12, 2);
  return [niceFloor(min - padding), max <= 0 ? 0 : niceCeiling(max + padding)];
}

function shouldUseDualAxis(model: ChartModel) {
  if (model.yKeys.length < 2) return false;
  const maxima = model.yKeys
    .slice(0, 2)
    .map((key) => Math.max(...model.data.map((row) => Math.abs(Number(row[key]))).filter(Number.isFinite)));
  const [first, second] = maxima;
  if (!first || !second) return false;
  return Math.max(first, second) / Math.min(first, second) >= 8;
}

function niceCeiling(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

function niceFloor(value: number) {
  if (!Number.isFinite(value) || value >= 0) return 0;
  return -niceCeiling(Math.abs(value));
}

function crossesZero(model: ChartModel) {
  const values = model.data.flatMap((row) => model.yKeys.map((key) => Number(row[key])).filter(Number.isFinite));
  return values.some((value) => value < 0) && values.some((value) => value > 0);
}

function analysisReportToText(chart: ChartBundle) {
  const lines = [
    chart.title,
    chart.description ?? "",
    chart.analysisContent ?? "",
    chart.relatedCharts?.length ? `Linked charts: ${chart.relatedCharts.join(", ")}` : "",
  ];
  return lines.filter(Boolean).join("\n\n");
}

function stripInlineMarkdown(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function cssVarKey(key: string) {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function optionString(options: Record<string, unknown> | undefined, key: string) {
  const value = options?.[key];
  return typeof value === "string" ? value : undefined;
}

function labelize(key: string) {
  const normalized = key.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const knownLabels: Record<string, string> = {
    revenue: "Revenue",
    "revenue inr": "Revenue",
    "sum revenue inr": "Revenue",
    ebitda: "EBITDA",
    "ebitda inr": "EBITDA",
    "sum ebitda inr": "EBITDA",
    "ebitda pct": "EBITDA %",
    "sell in value inr": "Sell-in value",
    "sum sell in value inr": "Sell-in value",
    "sell out value inr": "Sell-out value",
    "sum sell out value inr": "Sell-out value",
    "net sales value inr": "Net sales value",
    "sum net sales value inr": "Net sales value",
    "invoice value inr": "Invoice value",
    "sum invoice value inr": "Invoice value",
    "total value inr": "Total value",
    "sum total value inr": "Total value",
    "premium vs market pct": "Premium vs market",
    "collection amount inr": "Collection amount",
    "overdue amount inr": "Overdue amount",
    "inventory value inr": "Inventory value",
  };

  return (knownLabels[normalized] ?? key)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatAxisTick(value: string | number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  const abs = Math.abs(number);
  if (abs >= 1_000_000_000) return `${trimNumber(number / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trimNumber(number / 1_000_000)}M`;
  if (abs >= 1_000) return `${trimNumber(number / 1_000)}K`;
  return trimNumber(number);
}

function formatTableCell(value: unknown, column: string) {
  if (value == null || value === "") return "—";
  if (!isNumericValue(value)) return String(value);

  const number = Number(value);
  if (column.endsWith("_pct") || column.includes("achievement")) return `${trimNumber(number)}%`;
  if (column.endsWith("_cr") || column.includes("revenue") || column.includes("ebitda") || column.includes("budget") || column.includes("variance") || column.includes("gm")) {
    return `₹${trimNumber(number)} Cr`;
  }
  return number.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

function trimNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function inferDomain(chart: ChartBundle, tables: string[]) {
  const text = `${chart.title} ${tables.join(" ")}`.toLowerCase();
  if (text.includes("fact_finance_pl") || text.includes("financial_performance") || text.includes("finance") || text.includes("revenue") || text.includes("ebitda")) return "Finance";
  if (text.includes("field_visits_enriched") || text.includes("field_force_activity") || text.includes("fact_field_visits") || text.includes("field")) return "Field force";
  if (text.includes("channel_partners") || text.includes("distributor_health") || text.includes("channel")) return "Channel partners";
  if (text.includes("procurement_enriched") || text.includes("procurement_spend") || text.includes("fact_procurement") || text.includes("procurement")) return "Procurement";
  if (text.includes("farmer_engagement") || text.includes("farmer")) return "Farmer engagement";
  if (text.includes("commodity_prices") || text.includes("fact_commodity_prices") || text.includes("commodity")) return "Markets";
  if (text.includes("wave1_microbattles") || text.includes("project leap") || text.includes("microbattle")) return "Project Leap";
  if (text.includes("sales_enriched") || text.includes("secondary_sales") || text.includes("primary_sales") || text.includes("sales")) return "Sales";
  if (text.includes("churn") || text.includes("channel")) return "North Zone";
  if (text.includes("nps")) return "Farmer engagement";
  return "Analysis";
}
