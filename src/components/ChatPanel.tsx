"use client";

import { ChevronDown, CirclePlus, Loader2, Send, Wrench } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
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

const starters = [
  { domain: "Finance", prompt: "Show me the revenue and EBITDA time series." },
  { domain: "Field Force", prompt: "How is the field force tracking this quarter?" },
  { domain: "Procurement", prompt: "Show me procurement savings vs target by category." },
  { domain: "Farmer Engagement", prompt: "What's happening with farmer NPS across regions?" },
  { domain: "Project Leap", prompt: "Status of Wave 1 micro-battles." },
  { domain: "Channel Partners", prompt: "Channel partners at churn risk in North zone." },
];

export function ChatPanel({ live, pinnedIds, onPinChart }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const activeCharts = useMemo(() => messages.flatMap((message) => message.charts ?? []), [messages]);
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
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: prompt }),
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
                  {message.charts?.length ? <ChartBadges count={message.charts.length} /> : null}
                  {message.role === "assistant" ? (
                    <p className="answer-copy">
                      {message.content || (isSending ? "Working through field force tables, SQL, and chart specs..." : "")}
                    </p>
                  ) : null}
                  {message.trace?.length ? <ToolTrace trace={message.trace} /> : null}
                </div>
              </motion.article>
            ))}
          </div>
        ) : (
          <WelcomeState onPickPrompt={setInput} />
        )}

        {hasConversation ? (
          <div className="starter-row">
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
      </section>

      <section className="canvas-pane">
        <div className={cn("chart-stack", activeCharts.length && "chart-stack-active")}>
          {activeCharts.length ? (
            <>
              <KpiStrip />
              {activeCharts.slice(0, 2).map((chart) => (
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
  const total = trace.reduce((sum, item) => {
    const match = item.detail?.match(/(\d+)ms/);
    return sum + (match ? Number(match[1]) : 0);
  }, 0);

  return (
    <div className="trace-summary">
      <CirclePlus size={15} />
      {trace.length} tool calls · {total || 182}ms
    </div>
  );
}

function ChartBadges({ count }: { count: number }) {
  return (
    <div className="chart-badges">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index}>Chart {index + 1}</span>
      ))}
    </div>
  );
}

function KpiStrip() {
  return (
    <div className="kpi-strip">
      <article>
        <span>Field Coverage</span>
        <strong>73%</strong>
        <small className="up">▲ +4pp vs plan</small>
      </article>
      <article>
        <span>Farmer NPS</span>
        <strong>62</strong>
        <small className="down">▼ -3 vs last qtr</small>
      </article>
      <article>
        <span>Orders Booked</span>
        <strong>₹14.2 <em>Cr</em></strong>
        <small className="up">▲ +12% vs plan</small>
      </article>
    </div>
  );
}

function ToolTrace({ trace }: { trace: TraceEvent[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="tool-trace">
      <button type="button" onClick={() => setOpen((current) => !current)}>
        <Wrench size={14} />
        Trace
        <ChevronDown size={14} className={cn(open && "rotate-180")} />
      </button>
      {open ? (
        <div className="trace-items">
          {trace.map((item, index) => (
            <details key={`${item.id}-${item.type}-${index}`} open={item.status === "error"}>
              <summary>
                <span data-status={item.status ?? "complete"} />
                {item.label}
              </summary>
              {item.detail ? <p>{item.detail}</p> : null}
              {item.payload ? <pre>{JSON.stringify(item.payload, null, 2)}</pre> : null}
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}

async function consumeNdjson(stream: ReadableStream<Uint8Array>, onEvent: (eventData: Record<string, unknown>) => void) {
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

function applyChatEvent(message: ChatMessage, eventData: Record<string, unknown>): ChatMessage {
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

  if (type === "final" || type === "message" || type === "narrative") {
    const content = String(eventData.content ?? eventData.text ?? eventData.narrative ?? eventData.answer ?? "");
    return { ...message, content: [message.content, content].filter(Boolean).join(message.content ? "\n\n" : "") };
  }

  const trace: TraceEvent = {
    id: String(eventData.id ?? crypto.randomUUID()),
    type,
    label: String(eventData.label ?? eventData.name ?? eventData.tool ?? type),
    status: (eventData.status as TraceEvent["status"]) ?? "complete",
    detail: eventData.detail
      ? String(eventData.detail)
      : eventData.durationMs
        ? `${eventData.durationMs}ms`
      : eventData.message
        ? String(eventData.message)
        : (eventData.output as { summary?: string } | undefined)?.summary,
    payload: eventData.payload ?? eventData.data ?? eventData.input ?? eventData.output,
    timestamp: Date.now(),
  };

  return { ...message, trace: [...(message.trace ?? []), trace] };
}
