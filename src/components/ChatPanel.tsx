"use client";

import { CirclePlus, Loader2, Pin, PinOff, Send } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { PromptInput, PromptInputActions, PromptInputTextarea } from "@/components/ui/prompt-input";
import { LiveChart } from "./LiveChart";
import type { ChartBundle, ChatMessage, TraceEvent } from "./types";

type ChatPanelProps = {
  live: boolean;
  pinnedIds: Set<string>;
  onPinChart: (chart: ChartBundle) => void;
  onWorkspaceActiveChange?: (active: boolean) => void;
};

export type StarterPrompt = {
  domain: string;
  label: string;
  prompt: string;
  detail: string;
  anchor?: string;
  group: "business" | "trust";
  responseKind?: "source" | "assumptions" | "chart-choice" | "limits";
};

export const businessStarters: StarterPrompt[] = [
  {
    domain: "Finance",
    label: "FY26 vs plan",
    prompt: "How is FY26 closing? Where are we vs plan?",
    detail: "KPI strip for revenue, plan gap, achievement, and FY28 ambition context.",
    anchor: "₹1,553.8 Cr vs ₹1,724.5 Cr plan",
    group: "business",
  },
  {
    domain: "EBITDA",
    label: "EBITDA bridge",
    prompt: "Why did Q2 FY26 EBITDA miss budget?",
    detail: "Variance bridge across revenue, COGS, opex, and BU contribution.",
    anchor: "Q2: ₹16.5 Cr vs ₹52.3 Cr budget",
    group: "business",
  },
  {
    domain: "Gap Drivers",
    label: "BU / region gap",
    prompt: "Where are we vs plan by BU and region, and which area is causing the FY26 gap?",
    detail: "Contribution-to-miss view, not just a performance ranking.",
    anchor: "CCC EBITDA variance about -₹33.2 Cr",
    group: "business",
  },
  {
    domain: "Distributor Risk",
    label: "Commercial risk",
    prompt: "Show me distributors who are buying less, paying late, and selling slow",
    detail: "Ranked risk table with revenue decline, DSO, sell-through, and inventory age.",
    anchor: "Defines buying less, paying late, selling slow",
    group: "business",
  },
  {
    domain: "Procurement",
    label: "Savings lever",
    prompt: "Are we paying above market on any raw material?",
    detail: "Premium vs market, supplier drilldown, and material action table.",
    anchor: "Glyphosate Technical premium near 9.3%",
    group: "business",
  },
  {
    domain: "Regulatory",
    label: "Pipeline watch",
    prompt: "What's in our regulatory pipeline?",
    detail: "Country-status split, top molecule table, and expected Y1 uplift.",
    anchor: "Filed + under review pipeline about ₹388 Cr",
    group: "business",
  },
  {
    domain: "Field Force",
    label: "Productivity",
    prompt: "How is the field force tracking this quarter?",
    detail: "Visit volume, order conversion, region variance, and MGO leaderboard.",
    anchor: "Conversion quality over raw activity",
    group: "business",
  },
  {
    domain: "Channel",
    label: "Sell-through",
    prompt: "Show distributor risk: buying less, paying late, weak sell-through, and aging inventory.",
    detail: "Distributor risk view using buying decline, DSO, sell-through, and inventory age.",
    anchor: "Weak sell-through and inventory age",
    group: "business",
  },
  {
    domain: "Actions",
    label: "Next moves",
    prompt: "For the FY26 close, where are we vs plan and which BU or region needs the next operating-review action?",
    detail: "Turns the FY26 close view into the next operating-review focus area.",
    anchor: "Next action from BU / region evidence",
    group: "business",
  },
];

export const trustStarters: StarterPrompt[] = [
  {
    domain: "Trust",
    label: "Source",
    prompt: "For the current answer, where did the headline number come from? Show source tables, row counts, SQL, and export options.",
    detail: "Source tables, row counts, SQL, and copy CSV/SQL affordances.",
    group: "trust",
    responseKind: "source",
  },
  {
    domain: "Trust",
    label: "Assumptions",
    prompt: "For the current answer, what assumptions did the agent make? Include fiscal-year mapping, plan definition, and metric definitions if relevant.",
    detail: "Interpreter assumptions made explicit before leadership asks.",
    group: "trust",
    responseKind: "assumptions",
  },
  {
    domain: "Trust",
    label: "Chart choice",
    prompt: "For the current answer, why did the agent choose this chart type instead of another view?",
    detail: "Chart rationale tied to the question and the shape of the data.",
    group: "trust",
    responseKind: "chart-choice",
  },
  {
    domain: "Limits",
    label: "Limits",
    prompt: "What can this cockpit not answer yet? Be clear about static workbook scope, live SAP or Ariba refresh, and synthetic customer data.",
    detail: "Graceful limitation state for product credibility.",
    group: "trust",
    responseKind: "limits",
  },
];

export const starters = [...businessStarters, ...trustStarters];
const followUpStarters = [businessStarters[2], businessStarters[4], businessStarters[5], ...trustStarters];

export const questionBankBuildSteps = [
  "Reading leadership priorities and recent operating searches.",
  "Scoring questions by business relevance and evidence depth.",
  "Matching cards to verified finance, channel, procurement, and field-force routes.",
  "Locking source trails, assumptions, chart rationale, and limits.",
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

export function useQuestionBankIntro(totalCards: number) {
  const [currentStep, setCurrentStep] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);

  useEffect(() => {
    const timers: number[] = [];

    questionBankBuildSteps.forEach((_, index) => {
      timers.push(window.setTimeout(() => setCurrentStep(index), 320 + index * 560));
    });

    for (let index = 0; index <= totalCards; index += 1) {
      timers.push(window.setTimeout(() => setRevealedCount(index), 760 + index * 145));
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [totalCards]);

  return {
    currentStep,
    revealedCount,
    complete: revealedCount >= totalCards && currentStep >= questionBankBuildSteps.length - 1,
  };
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

type PreparedTrustResponse = {
  content: string;
  trace: TraceEvent[];
};

export function buildPreparedTrustResponse(prompt: string, history: ChatMessage[]): PreparedTrustResponse | null {
  const kind = trustKindForPrompt(prompt);
  if (!kind) return null;

  const currentAnswer = [...history]
    .reverse()
    .find((message) => message.role === "assistant" && (message.content.trim() || message.trace?.length || message.charts?.length));

  const trace = preparedTrustTrace(kind);
  if (!currentAnswer) {
    return {
      trace,
      content: "Run one of the business questions first, then this trust probe will explain the source trail, assumptions, chart choice, or operating limits for that answer.",
    };
  }

  if (kind === "source") return { trace, content: sourceTrailForAnswer(currentAnswer) };
  if (kind === "assumptions") return { trace, content: assumptionsForAnswer(currentAnswer) };
  if (kind === "chart-choice") return { trace, content: chartRationaleForAnswer(currentAnswer) };
  return { trace, content: limitsForCockpit() };
}

function trustKindForPrompt(prompt: string): StarterPrompt["responseKind"] | null {
  const configured = trustStarters.find((starter) => starter.prompt === prompt)?.responseKind;
  if (configured) return configured;

  const lower = prompt.toLowerCase();
  if (lower.includes("where did") || lower.includes("source") || lower.includes("sql") || lower.includes("row count")) return "source";
  if (lower.includes("assumption") || lower.includes("fiscal-year") || lower.includes("fiscal year")) return "assumptions";
  if (lower.includes("chart") && (lower.includes("why") || lower.includes("choose") || lower.includes("type"))) return "chart-choice";
  if (lower.includes("can this cockpit not answer") || lower.includes("limits") || lower.includes("not answer yet")) return "limits";
  return null;
}

function preparedTrustTrace(kind: NonNullable<StarterPrompt["responseKind"]>): TraceEvent[] {
  const labelByKind = {
    source: "Source trail assembled from current answer artifacts",
    assumptions: "Interpreter assumptions extracted from current answer artifacts",
    "chart-choice": "Chart rationale prepared from rendered evidence",
    limits: "Operating limits prepared from product scope",
  } satisfies Record<NonNullable<StarterPrompt["responseKind"]>, string>;

  return [{
    id: `trust-${kind}-${Date.now()}`,
    type: "artifact_review",
    tool: "render_chart",
    label: labelByKind[kind],
    status: "complete",
    detail: "Prepared locally from the current answer instead of re-running the business analysis.",
    timestamp: Date.now(),
  }];
}

function sourceTrailForAnswer(message: ChatMessage) {
  const charts = message.charts ?? [];
  const allTables = unique(charts.flatMap((chart) => tablesFromExecutedSql(chart.sql)));
  const traceEvidence = (message.trace ?? []).filter((item) => item.id.includes("eceo-analysis-") && item.status === "complete");
  const chartLines = charts.slice(0, 6).map((chart, index) => {
    const rowCount = chart.rows?.length ?? rowCountForAnalysis(message.trace, chart.id) ?? "live";
    const tables = tablesFromExecutedSql(chart.sql);
    return `${index + 1}. **${chart.title}**: ${rowCount} rows${tables.length ? ` from ${tables.join(", ")}` : ""}.`;
  });

  return [
    "Here is the source trail for the current answer.",
    "",
    `**Evidence artifacts:** ${charts.length || traceEvidence.length} generated ${charts.length === 1 ? "view" : "views"} attached to the answer.`,
    allTables.length ? `**Source tables:** ${allTables.join(", ")}.` : "**Source tables:** available in the analysis trace; chart SQL is attached when the backend exposes it.",
    chartLines.length ? chartLines.join("\n") : "- The answer has trace evidence but no chart/table artifact to export yet.",
    "",
    "**SQL and export:** every chart card has Copy SQL and Copy CSV buttons in the chart header. For backend-sidecar views, the SQL is now carried with the chart artifact when available; CSV export uses the exact rows rendered on screen.",
  ].join("\n");
}

function assumptionsForAnswer(message: ChatMessage) {
  const assumptions = unique([
    ...extractInterpreterAssumptions(message.trace),
    "Money values are reported in INR crores where applicable.",
  ]);

  return [
    "These are the assumptions behind the current answer.",
    "",
    ...assumptions.map((assumption) => `- ${assumption}`),
    "",
    "If leadership challenges a number, the next step is to open the source trail and inspect the source table, row count, and SQL behind the specific chart.",
  ].join("\n");
}

function chartRationaleForAnswer(message: ChatMessage) {
  const charts = message.charts ?? [];
  if (!charts.length) {
    return "The current answer is narrative-only, so there is no rendered chart choice to explain. Run a business card that returns visuals, then this probe will explain why each visual was selected.";
  }

  return [
    "The chart choices follow the shape of the evidence, not decoration.",
    "",
    ...charts.slice(0, 6).map((chart) => `- **${chart.title}** uses ${friendlyChartKind(chart)} because ${chartReason(chart)}.`),
    "",
    "The rule of thumb is: KPI for one headline number, line for time, bar for ranked comparisons, stacked bar for mix, scatter for risk quadrants, and table when the output is wide or action-oriented.",
  ].join("\n");
}

function limitsForCockpit() {
  return [
    "Clear limits for this cockpit:",
    "",
    "- It answers from the loaded SFS workbook and deterministic analytics backend, not live transactional systems.",
    "- SAP, Ariba, CRM, Growth Book, and regulatory-system refreshes are not live unless those connectors are explicitly wired.",
    "- Customer and distributor data in this environment should be treated as synthetic/static operating data.",
    "- It is an operating-analysis cockpit, not an approval, write-back, or financial close system.",
    "- Any leadership decision should still use the exported SQL/CSV trail for validation before action.",
  ].join("\n");
}

function extractInterpreterAssumptions(trace: TraceEvent[] | undefined) {
  const interpreterTrace = trace?.find((item) => item.id === "eceo-interpreter-end");
  const payload = asPlainRecord(interpreterTrace?.payload);
  const assumptions = payload.implicit_assumptions;
  return Array.isArray(assumptions) ? assumptions.map(String).filter(Boolean) : [];
}

function rowCountForAnalysis(trace: TraceEvent[] | undefined, chartId: string) {
  const analysisId = chartId.match(/eceo-(.+?)-\d{10,}/)?.[1];
  if (!analysisId) return undefined;
  const item = trace?.find((traceItem) => traceItem.id === `eceo-analysis-${analysisId}-end`);
  const payload = asPlainRecord(item?.payload);
  return typeof payload.row_count === "number" ? payload.row_count : undefined;
}

function tablesFromExecutedSql(sql: string | undefined) {
  if (!sql) return [];
  return Array.from(sql.matchAll(/\b(?:from|join)\s+["`[]?([a-zA-Z0-9_.-]+)/gi), (match) => match[1]);
}

function friendlyChartKind(chart: ChartBundle) {
  const type = chart.visualType ?? String(chart.spec?.mark ?? "chart");
  if (type === "line_chart" || type === "line") return "a line chart";
  if (type === "stacked_bar") return "a stacked bar chart";
  if (type === "bar_chart" || type === "bar") return "a bar chart";
  if (type === "scatter") return "a scatter plot";
  if (type === "table") return "a table";
  return "a chart";
}

function chartReason(chart: ChartBundle) {
  const type = chart.visualType ?? String(chart.spec?.mark ?? "");
  const rows = chart.rows ?? [];
  const columns = Object.keys(rows[0] ?? {});
  if (type === "line_chart" || columns.some((column) => /month|quarter|date|period/i.test(column))) {
    return "the question needs movement over time and exit-rate context";
  }
  if (type === "stacked_bar") return "the answer needs both total performance and mix by segment";
  if (type === "table") return "the output has several business columns that are easier to scan as rows";
  if (type === "scatter") return "the decision depends on two risk dimensions at once";
  return "the answer is a ranked comparison where bar length is easier to read than a table alone";
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function ChatPanel({ live, pinnedIds, onPinChart, onWorkspaceActiveChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const processingStatus = useProcessingStatus(isSending);

  const hasConversation = messages.length > 0 || isSending;

  useEffect(() => {
    onWorkspaceActiveChange?.(hasConversation);
  }, [hasConversation, onWorkspaceActiveChange]);

  useEffect(() => {
    const node = messageListRef.current;
    if (!node) return;
    window.requestAnimationFrame(() => {
      node.scrollTo({ top: node.scrollHeight, behavior: isSending ? "smooth" : "auto" });
    });
  }, [messages, isSending]);

  async function submitPrompt(event?: FormEvent, override?: string) {
    event?.preventDefault();
    const prompt = (override ?? input).trim();
    if (!prompt || isSending) return;

    const preparedResponse = buildPreparedTrustResponse(prompt, messages);
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
      trace: preparedResponse?.trace.map((item) => ({ ...item, status: "running" })) ?? [],
      charts: [],
      createdAt: Date.now(),
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setIsSending(true);

    if (preparedResponse) {
      window.setTimeout(() => {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: preparedResponse.content,
                  trace: preparedResponse.trace,
                }
              : message,
          ),
        );
        setIsSending(false);
      }, 680);
      return;
    }

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
          <div className="message-list" ref={messageListRef}>
            {messages.map((message, messageIndex) => {
              const activeAssistant = isSending && message.role === "assistant" && messageIndex === messages.length - 1;
              return (
                <motion.article
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("message", message.role === "user" && "message-user")}
                  key={message.id}
                >
                  <div className="message-body">
                    {message.role === "user" ? <p className="user-question">{message.content}</p> : null}
                    {message.trace?.length ? <TraceSummary trace={message.trace} active={activeAssistant} /> : null}
                    {message.role === "assistant" && activeAssistant && message.trace?.length ? <PlanProgress trace={message.trace} /> : null}
                    {message.role === "assistant" ? (
                      <AssistantMarkdown
                        className={cn("answer-copy", !message.content && activeAssistant && "answer-copy-loading")}
                        text={message.content || (activeAssistant ? processingInsightFromTrace(message.trace, processingStatus) : "")}
                      />
                    ) : null}
                    {message.role === "assistant" ? (
                      <InlineAnalysisArtifacts
                        message={message}
                        active={activeAssistant}
                        live={live}
                        pinnedIds={pinnedIds}
                        onPinChart={onPinChart}
                      />
                    ) : null}
                  </div>
                </motion.article>
              );
            })}
          </div>
        ) : (
          <WelcomeState
            onPickPrompt={(prompt) => void submitPrompt(undefined, prompt)}
            composer={
              <ChatComposer
                input={input}
                isSending={isSending}
                hasConversation={hasConversation}
                onInputChange={setInput}
                onSubmit={() => void submitPrompt()}
                onPickPrompt={(prompt) => void submitPrompt(undefined, prompt)}
              />
            }
          />
        )}

        {hasConversation ? (
          <ChatComposer
            input={input}
            isSending={isSending}
            hasConversation={hasConversation}
            onInputChange={setInput}
            onSubmit={() => void submitPrompt()}
            onPickPrompt={(prompt) => void submitPrompt(undefined, prompt)}
          />
        ) : null}
      </section>

    </div>
  );
}

function InlineAnalysisArtifacts({
  message,
  active,
  live,
  pinnedIds,
  onPinChart,
}: {
  message: ChatMessage;
  active: boolean;
  live: boolean;
  pinnedIds: Set<string>;
  onPinChart: (chart: ChartBundle) => void;
}) {
  const charts = pickDisplayCharts(message.charts ?? []);
  const report = buildPinnedAnalysisReport(message, charts);
  const canPinReport = Boolean(message.content.trim() || charts.length);

  if (!charts.length && !canPinReport) return null;

  return (
    <div className="inline-analysis">
      {canPinReport ? (
        <div className="inline-analysis-actions">
          <button type="button" onClick={() => onPinChart(report)} disabled={active}>
            {pinnedIds.has(report.id) ? <PinOff size={15} /> : <Pin size={15} />}
            {pinnedIds.has(report.id) ? "Pinned full analysis" : "Pin full analysis"}
          </button>
        </div>
      ) : null}

      {charts.length ? (
        <div className="inline-chart-grid" aria-label="Inline analysis charts">
          {charts.map((chart) => (
            <LiveChart key={chart.id} chart={chart} live={live} pinned={pinnedIds.has(chart.id)} onPin={onPinChart} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildPinnedAnalysisReport(message: ChatMessage, charts: ChartBundle[]): ChartBundle {
  const linkedCharts = charts.filter((chart) => chart.visualType !== "analysis_report");
  return {
    id: `analysis-report-${message.id}`,
    title: "Full analysis",
    description: "Pinned narrative, artifact trace, and linked charts from the cockpit conversation.",
    sql: "-- Pinned full analysis report. Source SQL is available on each linked chart artifact.",
    visualType: "analysis_report",
    span: 2,
    generatedAt: Date.now(),
    analysisContent: message.content.trim(),
    analysisTrace: message.trace,
    relatedCharts: linkedCharts.map((chart) => chart.title),
    linkedChartArtifacts: linkedCharts.map(stripNestedReportPayload),
  };
}

function stripNestedReportPayload(chart: ChartBundle): ChartBundle {
  const artifact = { ...chart };
  delete artifact.linkedChartArtifacts;
  delete artifact.analysisContent;
  delete artifact.analysisTrace;
  delete artifact.relatedCharts;
  return artifact;
}

function ChatComposer({
  input,
  isSending,
  hasConversation,
  onInputChange,
  onSubmit,
  onPickPrompt,
}: {
  input: string;
  isSending: boolean;
  hasConversation: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onPickPrompt: (prompt: string) => void;
}) {
  return (
    <div className="chat-composer">
      {hasConversation ? (
        <div className="starter-row" aria-label="Suggested follow-up prompts">
          {followUpStarters.map((starter) => (
            <button type="button" key={starter.prompt} onClick={() => onPickPrompt(starter.prompt)}>
              {starter.label}
            </button>
          ))}
        </div>
      ) : null}

      <PromptInput
        className="prompt-box"
        value={input}
        onValueChange={onInputChange}
        onSubmit={onSubmit}
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
          <button type="button" className="prompt-submit" disabled={!input.trim() || isSending} title="Send prompt" onClick={onSubmit}>
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <><span>Ask</span><Send size={18} /></>}
          </button>
        </PromptInputActions>
      </PromptInput>
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

type AnalysisPlanItem = {
  analysis_id: string;
  purpose: string;
  type: string;
};

type AnalysisPlan = {
  analyses: AnalysisPlanItem[];
  plan_rationale: string;
};

type AnalysisProgress = {
  state: "queued" | "running" | "complete" | "failed";
  rowCount?: number;
  notableObservations?: string;
  error?: string;
};

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

function WelcomeState({ onPickPrompt, composer }: { onPickPrompt: (prompt: string) => void; composer: ReactNode }) {
  const intro = useQuestionBankIntro(businessStarters.length);

  return (
    <div className="welcome-state">
      <div className="welcome-copy">
        <span>Leadership knowledge base</span>
        <h1>
          Leadership questions, <em>ready</em>
        </h1>
        <p>Fire the business probes first, then use the trust probes as follow-ups to show source, assumptions, chart rationale, and limits.</p>
      </div>

      <QuestionBankBuildLog currentStep={intro.currentStep} complete={intro.complete} />
      {composer}

      <div className="query-bank">
        <PromptSection
          title="Suggested Cards"
          count={businessStarters.length}
          revealedCount={intro.revealedCount}
          starters={businessStarters}
          onPickPrompt={onPickPrompt}
        />
      </div>
    </div>
  );
}

function QuestionBankBuildLog({ currentStep, complete }: { currentStep: number; complete: boolean }) {
  const progress = complete ? 100 : Math.min(92, Math.round(((currentStep + 1) / questionBankBuildSteps.length) * 100));

  return (
    <section className={cn("question-bank-build", complete && "question-bank-build-complete")} aria-live="polite" aria-label="Knowledge base generation status">
      <div className="build-copy">
        <strong>{complete ? "Knowledge base ready" : "Building knowledge base"}</strong>
        <div className="build-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <p>{complete ? "Source trails, assumptions, chart rationale, and limits are locked." : questionBankBuildSteps[currentStep]}</p>
      </div>
    </section>
  );
}

function PromptSection({
  title,
  count,
  revealedCount,
  starters,
  onPickPrompt,
}: {
  title: string;
  count: number;
  revealedCount: number;
  starters: StarterPrompt[];
  onPickPrompt: (prompt: string) => void;
}) {
  return (
    <section className="query-bank-section" aria-label={title}>
      <div className="query-bank-heading">
        <strong>{title}</strong>
        <span>{revealedCount >= count ? `${count} cards` : `Creating ${revealedCount}/${count}`}</span>
      </div>
      <div className="hero-query-grid">
        {starters.map((starter, index) =>
          index < revealedCount ? (
            <button
              type="button"
              key={starter.prompt}
              onClick={() => onPickPrompt(starter.prompt)}
            >
              <span className="query-card-kicker">
                <em>{starter.domain}</em>
                <b>{starter.label}</b>
              </span>
              <strong>{starter.prompt}</strong>
              <small>{starter.detail}</small>
              {starter.anchor ? <i>{starter.anchor}</i> : null}
            </button>
          ) : (
            <div className="query-card-skeleton" key={`skeleton-${starter.prompt}`} aria-hidden="true">
              <span />
              <strong />
              <small />
              <i />
            </div>
          ),
        )}
      </div>
    </section>
  );
}

function PlanProgress({ trace }: { trace: TraceEvent[] }) {
  const plan = extractPlan(trace);
  if (!plan?.analyses.length) return null;

  const progress = extractAnalysisProgress(trace);

  return (
    <div className="plan-display" aria-label="Analysis plan">
      <div className="plan-header">
        <strong>Thought-through artifacts</strong>
        <span>
          {plan.analyses.length} {plan.analyses.length === 1 ? "lens" : "lenses"}
        </span>
        {plan.plan_rationale ? <p>{compactRationale(plan.plan_rationale)}</p> : null}
      </div>
      <ul className="plan-list">
        {plan.analyses.map((analysis, index) => {
          const status = progress.get(analysis.analysis_id) ?? { state: "queued" as const };
          const statusLabel = analysisStatusLabel(status);
          return (
            <li key={analysis.analysis_id} className={cn("plan-item", `plan-${status.state}`)}>
              <span className="plan-icon" aria-hidden="true">
                {status.state === "complete" ? "✓" : status.state === "failed" ? "!" : status.state === "running" ? "" : index + 1}
              </span>
              <div className="plan-copy">
                <div className="plan-line">
                  <span className="plan-type">{analysis.type}</span>
                  <span className="plan-state">{statusLabel}</span>
                </div>
                <div className="plan-purpose">{analysis.purpose}</div>
                {status.notableObservations && status.state === "complete" ? <div className="plan-obs">{status.notableObservations}</div> : null}
                {status.error ? <div className="plan-err">Query failed: {status.error}</div> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function extractPlan(trace: TraceEvent[]): AnalysisPlan | null {
  const planTrace = trace.find((item) => item.id === "eceo-plan-end" || item.label.toLowerCase().includes("analysisplanner created"));
  const payload = asPlainRecord(planTrace?.payload);
  const analyses = Array.isArray(payload.analyses)
    ? payload.analyses.flatMap((item): AnalysisPlanItem[] => {
        const record = asPlainRecord(item);
        const analysisId = typeof record.analysis_id === "string" ? record.analysis_id : "";
        const purpose = typeof record.purpose === "string" ? record.purpose : "";
        const type = typeof record.type === "string" ? record.type : "analysis";
        return analysisId && purpose ? [{ analysis_id: analysisId, purpose, type }] : [];
      })
    : [];

  if (!analyses.length) return null;
  return {
    analyses,
    plan_rationale: typeof payload.plan_rationale === "string" ? payload.plan_rationale : "",
  };
}

function extractAnalysisProgress(trace: TraceEvent[]) {
  const progress = new Map<string, AnalysisProgress>();

  for (const item of trace) {
    const payload = asPlainRecord(item.payload);
    const analysisId = typeof payload.analysis_id === "string" ? payload.analysis_id : item.id.match(/eceo-analysis-(.+?)-(?:start|end)$/)?.[1];
    if (!analysisId) continue;

    if (item.status === "running") {
      progress.set(analysisId, { state: "running" });
      continue;
    }

    const success = payload.success !== false && item.status !== "error";
    progress.set(analysisId, {
      state: success ? "complete" : "failed",
      rowCount: typeof payload.row_count === "number" ? payload.row_count : undefined,
      notableObservations: typeof payload.notable_observations === "string" ? payload.notable_observations : undefined,
      error: typeof payload.error === "string" ? payload.error : undefined,
    });
  }

  return progress;
}

function compactRationale(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= 170) return text;
  const sentence = text.match(/^.{90,170}?[.!?](?:\s|$)/)?.[0]?.trim();
  return sentence ?? `${text.slice(0, 167).trim()}...`;
}

function analysisStatusLabel(status: AnalysisProgress) {
  if (status.state === "queued") return "Queued";
  if (status.state === "running") return "Running query";
  if (status.state === "failed") return "Needs correction";
  if (typeof status.rowCount === "number") return `${status.rowCount} rows checked`;
  return "Evidence ready";
}

function asPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function TraceSummary({ trace, active }: { trace: TraceEvent[]; active: boolean }) {
  const [open, setOpen] = useState(false);
  const completedSteps = trace.filter((item) => item.type !== "tool_start" && !item.id.startsWith("sql-"));
  const plan = extractPlan(trace);
  const progress = extractAnalysisProgress(trace);
  const analysesDone = Array.from(progress.values()).filter((item) => item.state === "complete" || item.state === "failed").length;
  const totalAnalyses = plan?.analyses.length ?? 0;
  const running = active && trace.some((item) => item.status === "running");
  const status = active ? (running ? "Building thought-through artifacts" : "Preparing analysis") : "Analysis artifacts ready";
  const count = totalAnalyses ? `${analysesDone}/${totalAnalyses} evidence checks` : `${completedSteps.length || trace.length} steps`;
  const visibleArtifacts = trace.filter((item) => item.type !== "tool_start").slice(0, 18);

  return (
    <div className={cn("trace-shell", open && "trace-shell-open")}>
      <button type="button" className="trace-summary" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <CirclePlus size={15} />
        <span>{status}</span>
        <small>{open ? "Hide artifact trail" : count}</small>
      </button>
      {open ? (
        <div className="trace-artifacts" aria-label="Visible analysis artifact trail">
          <div className="trace-artifacts-note">
            Visible artifact trail: planner decisions, SQL runs, chart/table artifacts, and source evidence. Hidden model reasoning is not exposed.
          </div>
          {plan?.analyses.length ? <PlanProgress trace={trace} /> : null}
          <ol>
            {visibleArtifacts.map((item) => (
              <li key={item.id}>
                <strong>{item.label}</strong>
                <span>{artifactDetail(item)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function artifactDetail(item: TraceEvent) {
  const status = item.status ? `${item.status}` : "complete";
  const detail = item.detail ?? item.sql ?? "";
  const suffix = item.durationMs ? ` · ${item.durationMs}ms` : "";
  if (!detail) return status + suffix;
  const compact = detail.replace(/\s+/g, " ").trim();
  return `${status}${suffix} · ${compact.length > 180 ? `${compact.slice(0, 177)}...` : compact}`;
}

export async function consumeNdjson(stream: ReadableStream<Uint8Array>, onEvent: (eventData: Record<string, unknown>) => void) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventIndex = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const text = line.trim();
      if (!text) continue;
      const eventData = JSON.parse(text) as Record<string, unknown>;
      await waitForReadableProgress(eventData, eventIndex);
      eventIndex += 1;
      onEvent(eventData);
    }
  }

  const final = buffer.trim();
  if (final) {
    const eventData = JSON.parse(final) as Record<string, unknown>;
    await waitForReadableProgress(eventData, eventIndex);
    onEvent(eventData);
  }
}

function waitForReadableProgress(eventData: Record<string, unknown>, index: number) {
  const delay = progressDelayMs(eventData, index);
  if (!delay) return Promise.resolve();
  return new Promise<void>((resolve) => window.setTimeout(resolve, delay));
}

function progressDelayMs(eventData: Record<string, unknown>, index: number) {
  const type = String(eventData.type ?? eventData.event ?? "");
  const id = String(eventData.id ?? "");
  const status = String(eventData.status ?? "");

  if (type === "error") return 0;
  if (index === 0) return 220;
  if (id === "eceo-plan-end") return 760;
  if (id.includes("eceo-analysis-") && status === "running") return 520;
  if (id.includes("eceo-analysis-")) return 620;
  if (type === "narrative_chunk") return 360;
  if (id === "eceo-presentation-end") return 520;
  if (type === "chart") return 150;
  return 180;
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
      visualType: typeof rawChart.visualType === "string" ? rawChart.visualType : undefined,
      chartOptions: rawChart.chartOptions && typeof rawChart.chartOptions === "object" ? rawChart.chartOptions : undefined,
      tableOptions: rawChart.tableOptions && typeof rawChart.tableOptions === "object" ? rawChart.tableOptions : undefined,
      stackKeys: Array.isArray(rawChart.stackKeys) ? rawChart.stackKeys.map(String) : undefined,
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
