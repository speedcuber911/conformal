"use client";

import { CirclePlus, Loader2, Send } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { PromptInput, PromptInputActions, PromptInputTextarea } from "@/components/ui/prompt-input";
import { LiveChart } from "./LiveChart";
import type { ChartBundle, ChatMessage, TraceEvent } from "./types";

type ChatPanelProps = {
  live: boolean;
  pinnedIds: Set<string>;
  onPinChart: (chart: ChartBundle) => void;
};

export const starters = [
  { domain: "Finance", prompt: "Revenue over last 12 months" },
  { domain: "Finance", prompt: "Show me the revenue and EBITDA time series." },
  { domain: "EBITDA", prompt: "Why did Q2 FY26 EBITDA miss budget?" },
  { domain: "Procurement", prompt: "Show me procurement savings vs target by category. Time period: FY26 year-to-date" },
  { domain: "Distributor Risk", prompt: "Show me distributors who are buying less, paying late, and selling slow" },
  { domain: "Field Force", prompt: "How is the field force tracking this quarter?" },
  { domain: "Regulatory", prompt: "What's in our regulatory pipeline?" },
];

const processingStatuses = [
  "Thinking through the question...",
  "Getting data from database...",
  "Checking business context...",
  "Building the SQL plan...",
  "Running calculations...",
  "Shaping the chart view...",
  "Writing the answer...",
];

export function useProcessingStatus(active: boolean) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % processingStatuses.length);
    }, 1400);

    return () => window.clearInterval(timer);
  }, [active]);

  return active ? processingStatuses[index] : processingStatuses[0];
}

export function processingInsightFromTrace(trace: TraceEvent[] | undefined, fallback: string) {
  const latest = trace?.at(-1);
  if (!latest) return fallback;

  const tool = latest.tool ?? inferTool(latest);
  const table = tableFromSql(latest.sql ?? latest.detail) ?? tableFromLabel(latest.label);
  const label = latest.label.replace(/\s+/g, " ").trim();

  if (latest.status === "error") return `Blocked while ${friendlyToolAction(tool)}: ${label}`;

  if (latest.status === "running") {
    if (tool === "list_tables") return "Planner is selecting the right business table and query route...";
    if (tool === "describe_table") return `Reading schema${table ? ` for ${table}` : ""} and sample rows...`;
    if (tool === "run_sql") return `Running generated SQL${table ? ` against ${table}` : " against the selected data"}...`;
    if (tool === "render_chart") return "Choosing the chart type and briefing copy...";
    return `${label}...`;
  }

  if (tool === "list_tables") return `${label}. Next, validating the SQL path.`;
  if (tool === "describe_table") return `${label}. Schema context is loaded.`;
  if (tool === "run_sql") {
    const rowCount = label.match(/\b(\d+)\s+rows?\b/i)?.[1];
    if (rowCount && table) return `Query returned ${rowCount} rows from ${table}. Shaping the insight...`;
    if (rowCount) return `Query returned ${rowCount} rows. Shaping the insight...`;
    if (latest.type === "run_sql") return `Chart data is ready${table ? ` from ${table}` : ""}. Writing the answer...`;
    return `${label}. Shaping the insight...`;
  }
  if (tool === "render_chart") return `${label}. Writing the final answer...`;

  return label || fallback;
}

function inferTool(trace: TraceEvent) {
  const text = `${trace.type} ${trace.label}`.toLowerCase();
  if (text.includes("describe") || text.includes("schema")) return "describe_table";
  if (text.includes("sql") || text.includes("checker")) return "run_sql";
  if (text.includes("visual") || text.includes("chart")) return "render_chart";
  if (text.includes("planner") || text.includes("table")) return "list_tables";
  return trace.type;
}

function friendlyToolAction(tool: string) {
  if (tool === "list_tables") return "selecting the dataset";
  if (tool === "describe_table") return "reading the schema";
  if (tool === "run_sql") return "running SQL";
  if (tool === "render_chart") return "building the visual";
  return "processing the request";
}

function tableFromSql(sql: string | undefined) {
  return sql?.match(/\bfrom\s+["`[]?([a-zA-Z0-9_.-]+)/i)?.[1];
}

function tableFromLabel(label: string) {
  return label.match(/\b(?:from|for|selected|against)\s+([a-zA-Z0-9_.-]+)/i)?.[1];
}

export function ChatPanel({ live, pinnedIds, onPinChart }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const processingStatus = useProcessingStatus(isSending);

  const activeCharts = useMemo(() => messages.flatMap((message) => message.charts ?? []), [messages]);
  const displayCharts = useMemo(() => pickDisplayCharts(activeCharts), [activeCharts]);
  const kpiChart = displayCharts[0] ?? activeCharts[0];
  const hasConversation = messages.length > 0 || isSending;

  async function submitPrompt(event?: FormEvent, override?: string) {
    event?.preventDefault();
    const prompt = (override ?? input).trim();
    if (!prompt || isSending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      createdAt: Date.now(),
    };
    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      trace: [],
      charts: [],
      createdAt: Date.now(),
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setIsSending(true);

    try {
      const history = messages
        .filter((message) => (message.role === "user" || message.role === "assistant") && message.content.trim())
        .map((message) => ({ role: message.role, content: message.content.trim() }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: prompt, history }),
      });

      if (!response.ok) throw new Error(`Chat failed with ${response.status}`);
      if (!response.body) throw new Error("Chat stream did not start.");

      await consumeNdjson(response.body, (eventData) => {
        setMessages((current) =>
          current.map((message) => (message.id === assistantId ? applyChatEvent(message, eventData) : message)),
        );
      });
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: error instanceof Error ? error.message : "The agent could not complete the request.",
                trace: [
                  ...(message.trace ?? []),
                  {
                    id: crypto.randomUUID(),
                    type: "error",
                    label: "Stream error",
                    status: "error",
                    detail: error instanceof Error ? error.message : "Unknown failure",
                    timestamp: Date.now(),
                  },
                ],
              }
            : message,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className={cn("cockpit-workspace", !hasConversation && "cockpit-workspace-welcome")}>
      <section className="chat-pane">
        {hasConversation ? (
          <div className="message-list">
            {messages.map((message) => (
              <motion.article
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("message", message.role === "user" && "message-user")}
                key={message.id}
              >
                <div className="message-body">
                  {message.role === "user" ? <p className="user-question">{message.content}</p> : null}
                  {message.trace?.length ? <TraceSummary trace={message.trace} /> : null}
                  {message.role === "assistant" ? (
                    <AssistantMarkdown
                      className={cn("answer-copy", !message.content && isSending && "answer-copy-loading")}
                      text={message.content || (isSending ? processingInsightFromTrace(message.trace, processingStatus) : "")}
                    />
                  ) : null}
                </div>
              </motion.article>
            ))}
          </div>
        ) : (
          <WelcomeState onPickPrompt={setInput} />
        )}

        <div className="chat-composer">
          {hasConversation ? (
            <div className="starter-row" aria-label="Suggested follow-up prompts">
              {starters.slice(1, 4).map((starter) => (
                <button type="button" key={starter.prompt} onClick={() => setInput(starter.prompt)}>
                  {starter.domain}
                </button>
              ))}
            </div>
          ) : null}

          <PromptInput
            className="prompt-box"
            value={input}
            onValueChange={setInput}
            onSubmit={() => void submitPrompt()}
            isLoading={isSending}
            disabled={isSending}
            maxHeight={132}
          >
            <PromptInputTextarea
              suppressHydrationWarning
              placeholder="Or ask your own question..."
              aria-label="Ask Project Leap"
            />
            <PromptInputActions className="prompt-actions">
              <span className="prompt-hint">Enter to send · Shift Enter for a new line</span>
              <button type="button" className="prompt-submit" disabled={!input.trim() || isSending} title="Send prompt" onClick={() => void submitPrompt()}>
                {isSending ? <Loader2 size={18} className="animate-spin" /> : <><span>Ask</span><Send size={18} /></>}
              </button>
            </PromptInputActions>
          </PromptInput>
        </div>
      </section>

      <section className="canvas-pane">
        <div className={cn("chart-stack", activeCharts.length && "chart-stack-active")}>
          {activeCharts.length ? (
            <>
              <KpiStrip chart={kpiChart} />
              {displayCharts.slice(0, 2).map((chart) => (
                <LiveChart key={chart.id} chart={chart} live={live} pinned={pinnedIds.has(chart.id)} onPin={onPinChart} />
              ))}
            </>
          ) : (
            <div className="empty-canvas">
              <span>Charts appear after a query runs.</span>
              <small>The canvas keeps each analysis live while source tables move.</small>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function pickDisplayCharts(charts: ChartBundle[]) {
  const visualCharts = charts.filter((chart) => {
    const rows = chart.rows ?? [];
    if (rows.length > 1) return true;
    if (chart.span === 1) return false;
    return hasBothAxes(chart);
  });

  return visualCharts.length ? visualCharts : charts;
}

function hasBothAxes(chart: ChartBundle) {
  const encoding = chart.spec?.encoding;
  if (!encoding || typeof encoding !== "object" || Array.isArray(encoding)) return false;
  const record = encoding as Record<string, unknown>;
  return Boolean(record.x && record.y);
}

type MarkdownBlock =
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; ordered: boolean; items: string[] };

export function AssistantMarkdown({ className, text }: { className?: string; text: string }) {
  const blocks = parseMarkdownBlocks(text);

  return (
    <div className={className} aria-live="polite">
      {blocks.map((block, index) => {
        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag key={`${block.type}-${index}`}>
              {block.items.map((item, itemIndex) => (
                <li key={`${itemIndex}-${item}`}>{renderMarkdownInline(item)}</li>
              ))}
            </ListTag>
          );
        }

        return <p key={`${block.type}-${index}`}>{renderMarkdownInline(block.lines.join(" "))}</p>;
      })}
    </div>
  );
}

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: Extract<MarkdownBlock, { type: "list" }> | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", lines: paragraph });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push(list);
    list = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (orderedMatch || bulletMatch) {
      flushParagraph();
      const ordered = Boolean(orderedMatch);
      const item = orderedMatch?.[1] ?? bulletMatch?.[1] ?? "";
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { type: "list", ordered, items: [] };
      }
      list.items.push(item);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks.length ? blocks : [{ type: "paragraph", lines: [""] }];
}

function renderMarkdownInline(text: string) {
  return text.split(/(\*\*.+?\*\*|`.+?`)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

function WelcomeState({ onPickPrompt }: { onPickPrompt: (prompt: string) => void }) {
  return (
    <div className="welcome-state">
      <div className="welcome-copy">
        <span>Growing with trust · since 1889</span>
        <h1>
          It&apos;s about <em>trust</em>
        </h1>
        <p>Ask anything about the business. The cockpit queries your data, writes its own analysis, and composes a chart for every answer.</p>
      </div>

      <div className="hero-query-grid">
        {starters.map((starter) => (
          <button type="button" key={starter.prompt} onClick={() => onPickPrompt(starter.prompt)}>
            <span>{starter.domain}</span>
            {starter.prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function TraceSummary({ trace }: { trace: TraceEvent[] }) {
  const completedSteps = trace.filter((item) => item.type !== "tool_start" && !item.id.startsWith("sql-"));
  const total = completedSteps.reduce((sum, item) => {
    if (typeof item.durationMs === "number") return sum + item.durationMs;
    const match = item.detail?.match(/(\d+)ms/);
    return sum + (match ? Number(match[1]) : 0);
  }, 0);

  return (
    <div className="trace-summary">
      <CirclePlus size={15} />
      {completedSteps.length || trace.length} tool calls · {formatTraceDuration(total || 182)}
    </div>
  );
}

function formatTraceDuration(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms >= 10_000 ? 1 : 2).replace(/\.0$/, "")}s`;
  return `${ms}ms`;
}

type KpiCard = {
  label: string;
  value: string;
  unit?: string;
  detail: string;
  tone?: "up" | "down" | "neutral";
};

const defaultKpis: KpiCard[] = [
  { label: "Field Coverage", value: "73%", detail: "▲ +4pp vs plan", tone: "up" },
  { label: "Farmer NPS", value: "62", detail: "▼ -3 vs last qtr", tone: "down" },
  { label: "Orders Booked", value: "₹14.2", unit: "Cr", detail: "▲ +12% vs plan", tone: "up" },
];

function KpiStrip({ chart }: { chart?: ChartBundle }) {
  const cards = buildKpiCards(chart);

  return (
    <div className="kpi-strip">
      {cards.map((card) => (
        <article key={card.label}>
          <span>{card.label}</span>
          <strong className="kpi-value">
            <span className="kpi-number">{card.value}</span>
            {card.unit ? <em>{card.unit}</em> : null}
          </strong>
          <small className={card.tone}>{card.detail}</small>
        </article>
      ))}
    </div>
  );
}

function buildKpiCards(chart?: ChartBundle): KpiCard[] {
  const rows = chart?.rows ?? [];
  if (!rows.length) return defaultKpis;

  const columns = Object.keys(rows[0] ?? {});
  const numericColumns = columns.filter((column) => rows.some((row) => Number.isFinite(Number(row[column]))));
  if (!numericColumns.length) return defaultKpis;

  const text = `${chart?.title ?? ""} ${chart?.description ?? ""} ${chart?.sql ?? ""}`.toLowerCase();
  const period = describeKpiPeriod(rows);

  const revenueKey = findColumn(numericColumns, /revenue.*(?:inr|cr)|net_sales_value_inr/);
  const ebitdaKey = findColumn(numericColumns, /ebitda.*(?:inr|cr)/);
  if (revenueKey && ebitdaKey) {
    const revenue = sumColumn(rows, revenueKey);
    const ebitda = sumColumn(rows, ebitdaKey);
    const marginKey = findColumn(numericColumns, /ebitda.*pct|margin/);
    const margin = marginKey ? averageColumn(rows, marginKey) : revenue ? (ebitda / revenue) * 100 : 0;
    return [
      { label: "Revenue", ...formatCurrencyMetric(revenueKey, revenue), detail: period, tone: "neutral" },
      { label: "EBITDA", ...formatCurrencyMetric(ebitdaKey, ebitda), detail: period, tone: "neutral" },
      { label: "EBITDA margin", value: `${formatNumber(margin, 1)}%`, detail: "weighted from result", tone: margin >= 0 ? "up" : "down" },
    ];
  }

  if (revenueKey) {
    const total = sumColumn(rows, revenueKey);
    const average = averageColumn(rows, revenueKey);
    const peak = maxRow(rows, revenueKey);
    return [
      { label: "Revenue", ...formatCurrencyMetric(revenueKey, total), detail: period, tone: "neutral" },
      { label: "Avg / month", ...formatCurrencyMetric(revenueKey, average), detail: "monthly run-rate", tone: "neutral" },
      {
        label: "Peak month",
        ...formatCurrencyMetric(revenueKey, peak.value),
        detail: peak.label,
        tone: "up",
      },
    ];
  }

  const totalValueKey = findColumn(numericColumns, /total.*value.*(?:inr|cr)|invoice.*value.*(?:inr|cr)|collection.*amount.*(?:inr|cr)|inventory.*value.*(?:inr|cr)|sell.*value.*(?:inr|cr)|spend.*cr|savings.*cr/);
  const premiumKey = findColumn(numericColumns, /premium.*pct/);
  if (text.includes("procurement") || premiumKey) {
    const cards: KpiCard[] = [];
    if (totalValueKey) cards.push({ label: "Spend value", ...formatCurrencyMetric(totalValueKey, sumColumn(rows, totalValueKey)), detail: period, tone: "neutral" });
    if (premiumKey) cards.push({ label: "Market premium", value: `${formatNumber(averageColumn(rows, premiumKey), 1)}%`, detail: "avg from returned rows", tone: averageColumn(rows, premiumKey) > 0 ? "down" : "up" });
    return padKpis(cards, rows);
  }

  const coverageKey = findColumn(numericColumns, /coverage|visit.*pct|completion.*pct/);
  const npsKey = findColumn(numericColumns, /nps|score/);
  const ordersKey = findColumn(numericColumns, /order|booked|volume/);
  if (coverageKey || npsKey || ordersKey) {
    return padKpis([
      ...(coverageKey ? [{ label: labelFromColumn(coverageKey), value: `${formatNumber(averageColumn(rows, coverageKey), 0)}%`, detail: period, tone: trendTone(rows, coverageKey) }] : []),
      ...(npsKey ? [{ label: labelFromColumn(npsKey), value: formatNumber(averageColumn(rows, npsKey), 0), detail: period, tone: trendTone(rows, npsKey) }] : []),
      ...(ordersKey ? [{ label: labelFromColumn(ordersKey), value: formatNumber(sumColumn(rows, ordersKey), 0), detail: period, tone: trendTone(rows, ordersKey) }] : []),
    ], rows);
  }

  return padKpis(
    numericColumns.slice(0, 3).map((column) => {
      const aggregate = isAverageMetric(column) ? averageColumn(rows, column) : sumColumn(rows, column);
      return {
        label: labelFromColumn(column),
        ...formatMetricValue(column, aggregate),
        detail: period,
        tone: trendTone(rows, column),
      };
    }),
    rows,
  );
}

function padKpis(cards: KpiCard[], rows: Record<string, unknown>[]) {
  const scopedCards = [...cards];

  for (const segment of segmentKpis(rows)) {
    if (scopedCards.length >= 3) break;
    if (scopedCards.some((card) => card.label.toLowerCase() === segment.label.toLowerCase())) continue;
    scopedCards.push(segment);
  }

  if (scopedCards.length < 3) {
    scopedCards.push({ label: "Records", value: formatCompactNumber(rows.length), detail: "in scope", tone: "neutral" });
  }

  return scopedCards.slice(0, 3);
}

function segmentKpis(rows: Record<string, unknown>[]): KpiCard[] {
  const columns = Object.keys(rows[0] ?? {});
  return columns
    .flatMap((column) => {
      if (/(^|_)(date|month|quarter|week|period|year)($|_)/i.test(column)) return [];
      const values = rows
        .map((row) => row[column])
        .filter((value) => value !== null && value !== undefined && String(value).trim())
        .map((value) => String(value).trim());
      if (!values.length || values.every((value) => Number.isFinite(Number(value)))) return [];
      const unique = new Set(values);
      if (unique.size < 2 || unique.size > Math.max(24, rows.length * 0.75)) return [];
      return [{
        label: labelFromColumn(column),
        value: formatCompactNumber(unique.size),
        detail: unique.size === 1 ? "segment" : "segments",
        tone: "neutral" as const,
      }];
    });
}

function findColumn(columns: string[], pattern: RegExp) {
  return columns.find((column) => pattern.test(column.toLowerCase()));
}

function sumColumn(rows: Record<string, unknown>[], column: string) {
  return rows.reduce((sum, row) => sum + numericValue(row[column]), 0);
}

function averageColumn(rows: Record<string, unknown>[], column: string) {
  const values = rows.map((row) => numericValue(row[column])).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function maxRow(rows: Record<string, unknown>[], column: string): { value: number; label: string } {
  const periodKey = Object.keys(rows[0] ?? {}).find((key) => /month|quarter|week|date|year/i.test(key));
  const fallback = { value: 0, label: "highest in scope" };
  return rows.reduce<{ value: number; label: string }>((best, row) => {
    const value = numericValue(row[column]);
    if (value <= best.value) return best;
    const rawLabel = periodKey ? String(row[periodKey] ?? "") : "";
    return { value, label: rawLabel ? formatPeriodLabel(rawLabel) : "highest in scope" };
  }, fallback);
}

function numericValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function describeKpiPeriod(rows: Record<string, unknown>[]) {
  const periodKey = Object.keys(rows[0] ?? {}).find((key) => /month|quarter|week|date|year/i.test(key));
  if (!periodKey) return "total in scope";
  const values = Array.from(new Set(rows.map((row) => String(row[periodKey])).filter(Boolean)));
  if (!values.length) return "total in scope";
  if (values.length === 1) return formatPeriodLabel(values[0]);
  return `${formatPeriodLabel(values[0])} - ${formatPeriodLabel(values[values.length - 1])}`;
}

function trendTone(rows: Record<string, unknown>[], column: string): KpiCard["tone"] {
  if (rows.length < 2) return "neutral";
  const first = numericValue(rows[0][column]);
  const last = numericValue(rows[rows.length - 1][column]);
  if (last > first) return "up";
  if (last < first) return "down";
  return "neutral";
}

function formatInCrore(value: number): Pick<KpiCard, "value" | "unit"> {
  return { value: `₹${formatNumber(value / 10_000_000, 1)}`, unit: "Cr" };
}

function formatCurrencyMetric(column: string, value: number): Pick<KpiCard, "value" | "unit"> {
  if (/(^|_)cr$/i.test(column) || /_cr($|_)/i.test(column)) return { value: `₹${formatNumber(value, 1)}`, unit: "Cr" };
  return formatInCrore(value);
}

function formatMetricValue(column: string, value: number): Pick<KpiCard, "value" | "unit"> {
  if (/inr|_cr$|value|amount|revenue|ebitda|sales|spend/i.test(column)) return formatCurrencyMetric(column, value);
  if (/pct|percent|coverage|margin|rate|premium/i.test(column)) return { value: `${formatNumber(value, 1)}%` };
  if (/qty|quantity|units|volume/i.test(column)) return { value: formatCompactNumber(value), unit: "units" };
  return { value: formatCompactNumber(value) };
}

function isAverageMetric(column: string) {
  return /pct|percent|coverage|margin|rate|premium|nps|score/i.test(column);
}

function labelFromColumn(column: string) {
  const normalized = column.toLowerCase().replace(/^(sum|avg|count|min|max)_/, "");
  const known: Record<string, string> = {
    revenue_cr: "Revenue",
    revenue_inr: "Revenue",
    sales_value: "Sales",
    sales_value_inr: "Sales",
    net_sales_value: "Net sales",
    net_value_inr: "Net sales",
    value_inr: "Value",
    invoice_value_inr: "Invoice value",
    spend_cr: "Spend value",
    savings_vs_market_cr: "Savings",
    ebitda_cr: "EBITDA",
    ebitda_inr: "EBITDA",
    ebitda_pct: "EBITDA margin",
    qty_units: "Volume",
    quantity_units: "Volume",
    region: "Regions",
    category: "Categories",
    business_unit: "Business units",
    distributor_name: "Distributors",
    supplier_name: "Suppliers",
    material_category: "Categories",
    premium_vs_market_pct: "Market premium",
    coverage_pct: "Coverage",
    farmer_nps: "Farmer NPS",
    nps: "Farmer NPS",
  };
  return (
    known[normalized] ??
    normalized
      .replace(/_inr$/, "")
      .replace(/_pct$/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${trimCompact(value / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${trimCompact(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trimCompact(value / 1_000)}K`;
  return formatNumber(value, Number.isInteger(value) ? 0 : 1);
}

function trimCompact(value: number) {
  return value.toFixed(value >= 100 ? 0 : 1).replace(/\.0$/, "");
}

function formatNumber(value: number, digits: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).replace(/\\.0$/, "");
}

function formatPeriodLabel(value: string) {
  const monthMatch = value.match(/^(20\d{2})-(\d{2})$/);
  if (!monthMatch) return value;
  const date = new Date(`${value}-01T00:00:00`);
  return date.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

export async function consumeNdjson(stream: ReadableStream<Uint8Array>, onEvent: (eventData: Record<string, unknown>) => void) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const text = line.trim();
      if (!text) continue;
      onEvent(JSON.parse(text));
    }
  }

  const final = buffer.trim();
  if (final) onEvent(JSON.parse(final));
}

export function applyChatEvent(message: ChatMessage, eventData: Record<string, unknown>): ChatMessage {
  const type = String(eventData.type ?? eventData.event ?? "trace");

  if (type === "chart" || eventData.chart || eventData.chartBundle) {
    const rawChart = (eventData.chart ?? eventData.chartBundle ?? eventData) as Partial<ChartBundle>;
    const chart: ChartBundle = {
      id: rawChart.id ?? crypto.randomUUID(),
      title: rawChart.title ?? "Generated analysis",
      sql: rawChart.sql ?? "select 1 as value",
      description: rawChart.description ?? (rawChart as { narrative?: string }).narrative,
      spec: rawChart.spec,
      span: rawChart.span,
      rows: Array.isArray(rawChart.rows) ? rawChart.rows : undefined,
      generatedAt: Date.now(),
    };

    const sqlTrace: TraceEvent = {
      id: `sql-${chart.id}`,
      type: "run_sql",
      label: `run_sql · ${chart.title}`,
      status: "complete",
      detail: chart.sql,
      timestamp: Date.now(),
    };

    return { ...message, charts: [...(message.charts ?? []), chart], trace: [...(message.trace ?? []), sqlTrace] };
  }

  if (type === "narrative_chunk") {
    const content = String(eventData.content ?? eventData.text ?? eventData.narrative ?? "");
    return { ...message, content: `${message.content}${content}` };
  }

  if (type === "final" || type === "message" || type === "narrative") {
    const content = String(eventData.content ?? eventData.text ?? eventData.narrative ?? eventData.answer ?? "");
    return { ...message, content: [message.content, content].filter(Boolean).join(message.content ? "\n\n" : "") };
  }

  if (type === "error") {
    const content = String(eventData.message ?? eventData.detail ?? "The agent could not complete the request.");
    return {
      ...message,
      content: [message.content, content].filter(Boolean).join(message.content ? "\n\n" : ""),
      trace: [
        ...(message.trace ?? []),
        {
          id: String(eventData.id ?? crypto.randomUUID()),
          type: "error",
          label: "Agent error",
          status: "error",
          detail: content,
          timestamp: Date.now(),
        },
      ],
    };
  }

  const trace: TraceEvent = {
    id: String(eventData.id ?? crypto.randomUUID()),
    type,
    tool: typeof eventData.tool === "string" ? eventData.tool : undefined,
    label: String(eventData.label ?? eventData.name ?? eventData.tool ?? type),
    status: (eventData.status as TraceEvent["status"]) ?? "complete",
    sql: typeof eventData.sql === "string" ? eventData.sql : undefined,
    durationMs: typeof eventData.durationMs === "number" ? eventData.durationMs : undefined,
    detail: eventData.detail
      ? String(eventData.detail)
      : eventData.durationMs
        ? `${eventData.durationMs}ms`
      : eventData.message
        ? String(eventData.message)
        : (eventData.output as { summary?: string } | undefined)?.summary,
    payload: eventData.payload ?? eventData.data ?? eventData.input ?? eventData.output ?? eventData.sql,
    timestamp: Date.now(),
  };

  return { ...message, trace: [...(message.trace ?? []), trace] };
}
