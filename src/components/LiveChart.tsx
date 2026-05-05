"use client";

import dynamic from "next/dynamic";
import { Check, Copy, DatabaseZap, Pin, PinOff, RefreshCw, Table2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VegaEmbedProps } from "react-vega";
import { cn } from "@/lib/utils";
import { getDuckDbStore, rowsToCsv, tablesForSql } from "./duckdb-client";
import type { ChartBundle } from "./types";

type SpecObject = Record<string, unknown>;

const VegaEmbed = dynamic(() => import("react-vega").then((mod) => mod.VegaEmbed), {
  ssr: false,
  loading: () => <div className="chart-loading">Preparing chart canvas</div>,
});

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

export function LiveChart({ chart, live = true, pinned, compact, onPin, onRemove }: LiveChartProps) {
  const [query, setQuery] = useState<QueryState>({ rows: [], loading: true, tables: [] });
  const [copied, setCopied] = useState<"sql" | "csv" | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [plotWidth, setPlotWidth] = useState(720);

  const runQuery = useCallback(async () => {
    setQuery((current) => ({ ...current, loading: true, error: undefined }));

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
  }, [chart.sql]);

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
    if (!live) return;

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
  }, [chart.sql, live, runQuery]);

  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;

    const updateWidth = () => setPlotWidth(Math.max(280, Math.floor(node.clientWidth - 170)));
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const spec = useMemo(() => buildSpec(chart, query.rows, compact, plotWidth), [chart, compact, plotWidth, query.rows]);

  const copy = async (kind: "sql" | "csv") => {
    const text = kind === "sql" ? chart.sql : rowsToCsv(query.rows);
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1400);
  };

  return (
    <section className={cn("chart-panel group", compact && "chart-panel-compact")}>
      <header className="chart-header">
        <div className="min-w-0">
          <div className="chart-eyebrow">
            <DatabaseZap size={13} />
            {query.tables.length ? query.tables.join(", ") : "Query"}
          </div>
          <h3>{chart.title}</h3>
          {chart.description ? <p>{chart.description}</p> : null}
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

      <div className="chart-canvas" ref={canvasRef}>
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
          <VegaEmbed spec={spec as VegaEmbedProps["spec"]} options={{ actions: false }} />
        )}
      </div>
    </section>
  );
}

function buildSpec(chart: ChartBundle, rows: Record<string, unknown>[], compact: boolean | undefined, plotWidth: number): SpecObject {
  const base: SpecObject = chart.spec && typeof chart.spec === "object" ? chart.spec : {};
  const chartWidth = hasFacet(base) ? Math.max(180, Math.floor(plotWidth / 3) - 28) : plotWidth;

  if (Object.keys(base).length) {
    return {
      ...base,
      width: chartWidth,
      height: compact ? 210 : 300,
      data: { values: rows },
      background: "transparent",
      config: chartConfig,
    };
  }

  const columns = Object.keys(rows[0] ?? { category: "No data", value: 0 });
  const x = columns[0] ?? "category";
  const y = columns.find((column) => rows.some((row) => typeof row[column] === "number")) ?? columns[1] ?? x;

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width: plotWidth,
    height: compact ? 210 : 300,
    background: "transparent",
    data: { values: rows.length ? rows : [{ [x]: "No rows", [y]: 0 }] },
    mark: { type: "bar", cornerRadiusTopLeft: 3, cornerRadiusTopRight: 3, color: "#B8232E" },
    encoding: {
      x: { field: x, type: "nominal", axis: { labelAngle: -30, title: null } },
      y: { field: y, type: "quantitative", axis: { title: null } },
      tooltip: columns.map((field) => ({ field })),
    },
    config: chartConfig,
  };
}

function hasFacet(spec: SpecObject) {
  const encoding = spec.encoding;
  return Boolean(
    spec.facet ||
      (encoding &&
        typeof encoding === "object" &&
        "facet" in encoding),
  );
}

const chartConfig = {
  font: "Inter, ui-sans-serif, system-ui, sans-serif",
  view: { stroke: "transparent" },
  axis: {
    domainColor: "#D7DCE2",
    gridColor: "#E9EDF2",
    labelColor: "#657080",
    tickColor: "#D7DCE2",
  },
};
