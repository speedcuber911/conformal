"use client";

import { Check, Copy, Pin, PinOff, RefreshCw, Table2, Trash2 } from "lucide-react";
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
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
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

type ChartKind = "area" | "line" | "bar" | "horizontal-bar" | "scatter";

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

  const runQuery = useCallback(async () => {
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
  }, [chart.rows, chart.sql]);

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
    if (!live || chart.rows?.length) return;

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
  }, [chart.rows, chart.sql, live, runQuery]);

  const copy = async (kind: "sql" | "csv") => {
    const text = kind === "sql" ? chart.sql : rowsToCsv(query.rows);
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
          <button type="button" title="Refresh" onClick={runQuery}>
            <RefreshCw size={15} className={query.loading ? "animate-spin" : undefined} />
          </button>
          <button type="button" title="Copy SQL" onClick={() => copy("sql")}>
            {copied === "sql" ? <Check size={15} /> : <Copy size={15} />}
          </button>
          <button type="button" title="Copy CSV" onClick={() => copy("csv")} disabled={!query.rows.length}>
            <Table2 size={15} />
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
        {query.loading && !query.rows.length ? (
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
  const model = useMemo(() => buildChartModel(chart, rows), [chart, rows]);

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
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
          {model.yKeys.map((key, index) => (
            <Bar key={key} dataKey={key} radius={[5, 5, 0, 0]} fill={`var(--color-${cssVarKey(key)})`} opacity={index ? 0.72 : 1} />
          ))}
        </BarChart>
      </ChartContainer>
    );
  }

  if (model.kind === "line") {
    return (
      <ChartContainer config={model.config} className={cn("shadcn-chart aspect-auto w-full", heightClass)}>
        <LineChart data={model.data} margin={{ left: 12, right: 14, top: 10, bottom: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis {...axisProps} dataKey={model.xKey} />
          <YAxis {...axisProps} width={yAxisWidth} tickFormatter={formatAxisTick} domain={domainForSeries(model)} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
          {model.yKeys.map((key) => (
            <Line key={key} dataKey={key} type="monotone" stroke={`var(--color-${cssVarKey(key)})`} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          ))}
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
      </AreaChart>
    </ChartContainer>
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
  const xKey = pickXKey(columns, numericColumns, textColumns);
  const yKey = pickYKey(chart, numericColumns, xKey);
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

  const yKeys = numericColumns.filter((column) => column !== xKey).slice(0, preferredKind === "bar" ? 3 : 2);
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

function pickXKey(columns: string[], numericColumns: string[], textColumns: string[]) {
  const preferredText = textColumns.find((column) => /(date|week|quarter|month|period|wave|year|zone|region|dealer|category|name)/i.test(column));
  if (preferredText) return preferredText;
  return textColumns[0] ?? columns.find((column) => !numericColumns.includes(column)) ?? columns[0] ?? "category";
}

function pickYKey(chart: ChartBundle, numericColumns: string[], xKey: string) {
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
  if (!values.length) return ["auto", "auto"];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min >= 0) return [0, niceCeiling(max * 1.08)];

  const padding = Math.max((max - min) * 0.12, 2);
  return [Math.floor(min - padding), niceCeiling(max + padding)];
}

function niceCeiling(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

function cssVarKey(key: string) {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function labelize(key: string) {
  return key
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

function trimNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function inferDomain(chart: ChartBundle, tables: string[]) {
  const text = `${chart.title} ${tables.join(" ")}`.toLowerCase();
  if (text.includes("field")) return "Field Force";
  if (text.includes("churn") || text.includes("channel")) return "North Zone";
  if (text.includes("procurement")) return "Procurement";
  if (text.includes("nps") || text.includes("farmer")) return "Farmer Engagement";
  if (text.includes("commodity")) return "Markets";
  return tables.length ? tables.join(", ") : "Analysis";
}
