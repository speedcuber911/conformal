"use client";

import Link from "next/link";
import { BarChart3, ChevronRight, Clock3, Home, Loader2, MessageSquare, Send } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { DuckDBStore } from "@/lib/duckdb-store";
import {
  applyChatEvent,
  AssistantMarkdown,
  buildPreparedTrustResponse,
  businessStarters,
  ChatPanel,
  consumeNdjson,
  processingInsightFromTrace,
  questionBankBuildSteps,
  starters,
  useProcessingStatus,
  useQuestionBankIntro,
} from "./ChatPanel";
import { LiveChart } from "./LiveChart";
import type { ChartBundle, ChatMessage } from "./types";

const PINNED_CHARTS_KEY = "project-leap-pinned-charts";

export function CockpitShell() {
  const [live, setLive] = useState(false);
  const [pinnedCharts, setPinnedCharts] = usePinnedCharts();
  const [workspaceActive, setWorkspaceActive] = useState(false);

  useEffect(() => {
    if (!live) return;

    const tables = [
      "secondary_sales",
      "field_force_activity",
      "channel_partners",
      "farmer_engagement",
      "procurement_spend",
      "wave1_microbattles",
      "commodity_prices",
      "farmer_nps",
    ];
    let index = 0;
    const timer = window.setInterval(() => {
      DuckDBStore.mutate(tables[index % tables.length]);
      DuckDBStore.mutate(tables[(index + 3) % tables.length]);
      index += 1;
    }, 4200);

    return () => window.clearInterval(timer);
  }, [live]);

  const pinnedIds = useMemo(() => new Set(pinnedCharts.map((chart) => chart.id)), [pinnedCharts]);

  const togglePin = (chart: ChartBundle) => {
    setPinnedCharts((current) => {
      if (current.some((item) => item.id === chart.id)) return current.filter((item) => item.id !== chart.id);
      return [{ ...chart, generatedAt: chart.generatedAt ?? Date.now() }, ...current];
    });
  };

  return (
    <main className={cn("app-shell", workspaceActive && "app-shell-sidebar-collapsed")}>
      <MobileShell live={live} pinnedIds={pinnedIds} onPinChart={togglePin} />

      <aside className="sfs-sidebar">
        <div className="brand-lockup">
          <div className="sfs-mark">SFS</div>
          <div>
            <div className="project-label">Project Leap</div>
            <p>Shriram Farm Solutions</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          <a href="#" className="active" title="Chat">
            <MessageSquare size={17} />
            <span>Chat</span>
          </a>
          <Link href="/dashboard" title="Dashboard">
            <BarChart3 size={17} />
            <span>Dashboard</span>
          </Link>
        </nav>

        <section className="sidebar-section">
          <h2>Conversations</h2>
          <a className="conversation active" href="#">
            <strong>Field force Q3</strong>
            <span>2 mins ago</span>
          </a>
          <a className="conversation" href="#">
            <strong>Procurement</strong>
            <span>Yesterday</span>
          </a>
          <a className="conversation" href="#">
            <strong>Farmer NPS</strong>
            <span>Mon</span>
          </a>
        </section>

        <section className="sidebar-section sidebar-pinned">
          <h2>Pinned</h2>
          <Link href="/dashboard" className="pinned-link">
            <BarChart3 size={15} />
            <span>Main dashboard</span>
          </Link>
        </section>
      </aside>

      <div className="app-main">
        <header className="top-bar">
          <div className="breadcrumb">
            <strong>Executive Cockpit</strong>
            <span>/</span>
            <em>Shriram Farm Solutions</em>
          </div>

          <div className="top-actions">
            <button type="button" className={cn("live-toggle", live && "live-toggle-on")} onClick={() => setLive((current) => !current)}>
              <span />
              {live ? "Live" : "Stable"}
            </button>
            <div className="top-divider" />
            <div className="avatar">AK</div>
          </div>
        </header>

        <ChatPanel live={live} pinnedIds={pinnedIds} onPinChart={togglePin} onWorkspaceActiveChange={setWorkspaceActive} />
      </div>
    </main>
  );
}

type MobileTab = "home" | "chat" | "charts" | "history";

function MobileShell({ live, pinnedIds, onPinChart }: { live: boolean; pinnedIds: Set<string>; onPinChart: (chart: ChartBundle) => void }) {
  const [activeTab, setActiveTab] = useState<MobileTab>("home");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mobileInput, setMobileInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const charts = useMemo(() => messages.flatMap((message) => message.charts ?? []), [messages]);

  async function submitMobilePrompt(event?: FormEvent, override?: string) {
    event?.preventDefault();
    const prompt = (override ?? mobileInput).trim();
    if (!prompt || isSending) return;

    setActiveTab("chat");
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
    setMobileInput("");
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
              }
            : message,
        ),
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="mobile-shell" aria-label="Project Leap mobile cockpit">
      <MobileHeader live={live} />

      <div className="mobile-content" id="mobile-main">
        {activeTab === "home" ? <MobileHome onAsk={(prompt) => void submitMobilePrompt(undefined, prompt)} /> : null}
        {activeTab === "chat" ? (
          <MobileChat
            messages={messages}
            input={mobileInput}
            isSending={isSending}
            onInput={setMobileInput}
            onSubmit={submitMobilePrompt}
            onOpenCharts={() => setActiveTab("charts")}
          />
        ) : null}
        {activeTab === "charts" ? <MobileCharts charts={charts} live={live} pinnedIds={pinnedIds} onPinChart={onPinChart} /> : null}
        {activeTab === "history" ? <MobileHistory onOpenChat={() => setActiveTab("chat")} /> : null}
      </div>

      <nav className="mobile-tabbar" aria-label="Mobile primary navigation">
        <MobileTabButton active={activeTab === "home"} icon={<Home size={21} />} label="Home" onClick={() => setActiveTab("home")} />
        <MobileTabButton active={activeTab === "chat"} icon={<MessageSquare size={21} />} label="Chat" onClick={() => setActiveTab("chat")} />
        <MobileTabButton active={activeTab === "charts"} icon={<BarChart3 size={22} />} label="Charts" onClick={() => setActiveTab("charts")} />
        <MobileTabButton active={activeTab === "history"} icon={<Clock3 size={21} />} label="History" onClick={() => setActiveTab("history")} />
      </nav>
    </section>
  );
}

function MobileHeader({ live }: { live: boolean }) {
  return (
    <header className="mobile-header">
      <div className="mobile-brand">
        <div className="mobile-mark">SFS</div>
        <strong>Project Leap</strong>
      </div>
      <div className={cn("mobile-live", live && "mobile-live-on")}>
        <span />
        {live ? "live" : "stable"}
      </div>
    </header>
  );
}

function MobileHome({ onAsk }: { onAsk: (prompt: string) => void }) {
  const intro = useQuestionBankIntro(3);

  return (
    <div className="mobile-home" aria-label="Project Leap home">
      <section className="mobile-home-hero">
        <span>Today</span>
        <h1>Executive cockpit</h1>
        <p>Ask business questions, review generated charts, and keep recurring operating views close.</p>
      </section>

      <section className="mobile-home-kpis" aria-label="Today snapshot">
        <article>
          <span>Coverage</span>
          <strong>73%</strong>
          <em>+4pp vs plan</em>
        </article>
        <article>
          <span>Orders</span>
          <strong>₹14.2 Cr</strong>
          <em>+12% vs plan</em>
        </article>
      </section>

      <section className={cn("mobile-home-build", intro.complete && "mobile-home-build-complete")} aria-live="polite" aria-label="Question generation status">
        <strong>{intro.complete ? "Questions ready" : "Building questions"}</strong>
        <span>{intro.complete ? "Source trails and chart rationale are locked." : questionBankBuildSteps[intro.currentStep]}</span>
      </section>

      <section className="mobile-home-list" aria-label="Business questions">
        <h2>Business questions</h2>
        {businessStarters.slice(0, 3).map((starter, index) =>
          index < intro.revealedCount ? (
            <button type="button" key={starter.prompt} onClick={() => onAsk(starter.prompt)}>
              <strong>{starter.label}</strong>
              <span>{starter.prompt}</span>
            </button>
          ) : (
            <div className="mobile-question-skeleton" key={`mobile-skeleton-${starter.prompt}`} aria-hidden="true">
              <strong />
              <span />
            </div>
          ),
        )}
      </section>
    </div>
  );
}

function MobileChat({
  messages,
  input,
  isSending,
  onInput,
  onSubmit,
  onOpenCharts,
}: {
  messages: ChatMessage[];
  input: string;
  isSending: boolean;
  onInput: (value: string) => void;
  onSubmit: (event?: FormEvent, override?: string) => void;
  onOpenCharts: () => void;
}) {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const trace = lastAssistant?.trace ?? [];
  const chartCount = lastAssistant?.charts?.length ?? 0;
  const processingStatus = useProcessingStatus(isSending);
  const backendStatus = processingInsightFromTrace(trace, processingStatus);
  const completedSteps = trace.filter((item) => item.type !== "tool_start" && !item.id.startsWith("sql-")).length;

  return (
    <div className="mobile-chat-view">
      {lastUser ? <div className="mobile-question">{lastUser.content}</div> : <MobileStarterPrompts onPick={(prompt) => onSubmit(undefined, prompt)} />}
      {trace.length ? (
        <div className="mobile-trace">
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <strong>{isSending ? "Building analysis artifacts" : `Analysis artifacts ready · ${completedSteps || trace.length} steps`}</strong>
        </div>
      ) : isSending ? (
        <div className="mobile-trace" aria-live="polite">
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <strong>{backendStatus}</strong>
        </div>
      ) : null}
      {chartCount ? (
        <button className="mobile-chart-jump" type="button" onClick={onOpenCharts}>
          {chartCount} {chartCount === 1 ? "chart" : "charts"} <span aria-hidden="true">→</span>
        </button>
      ) : null}
      {lastAssistant?.content || isSending ? (
        <AssistantMarkdown className={cn("mobile-answer", !lastAssistant?.content && isSending && "mobile-answer-loading")} text={lastAssistant?.content || backendStatus} />
      ) : null}
      <div className="mobile-followups" aria-label="Follow up prompts">
        {starters.slice(1, 5).map((starter) => (
          <button type="button" key={starter.prompt} onClick={() => onSubmit(undefined, starter.prompt)} disabled={isSending}>
            {starter.label}
          </button>
        ))}
      </div>
      <div className="mobile-chat-spacer" aria-hidden="true" />
      <form className="mobile-compose" onSubmit={(event) => onSubmit(event)}>
        <input aria-label="Follow up question" placeholder="Follow up..." value={input} onChange={(event) => onInput(event.target.value)} />
        <button type="submit" aria-label="Ask follow up" disabled={!input.trim() || isSending}>
          {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </form>
    </div>
  );
}

function MobileStarterPrompts({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="mobile-starters">
      {starters.slice(0, 4).map((starter) => (
        <button type="button" key={starter.prompt} onClick={() => onPick(starter.prompt)}>
          <span>{starter.domain}</span>
          <strong>{starter.label}</strong>
          <em>{starter.prompt}</em>
        </button>
      ))}
    </div>
  );
}

function MobileCharts({
  charts,
  live,
  pinnedIds,
  onPinChart,
}: {
  charts: ChartBundle[];
  live: boolean;
  pinnedIds: Set<string>;
  onPinChart: (chart: ChartBundle) => void;
}) {
  const churnRows = [
    ["LKO", 0.81, "high"],
    ["PAT", 0.74, "highAlt"],
    ["BPL", 0.52, "medium"],
    ["JPR", 0.38, "low"],
    ["AMD", 0.22, "lowAlt"],
  ] as const;

  return (
    <div className="mobile-charts-view">
      {charts.length ? (
        <div className="mobile-chart-stack">
          {charts.map((chart) => (
            <LiveChart key={chart.id} chart={chart} compact live={live} pinned={pinnedIds.has(chart.id)} onPin={onPinChart} />
          ))}
        </div>
      ) : null}

      <div className="mobile-chart-title">
        <span>Field Force</span>
        <h1>
          How is field force tracking <em>this quarter?</em>
        </h1>
      </div>

      <section className="mobile-kpis" aria-label="Field force KPIs">
        <article>
          <span>Coverage</span>
          <strong>73<small>%</small></strong>
          <em>+4pp vs plan</em>
        </article>
        <article>
          <span>Orders Booked</span>
          <strong>₹14.2 <small>Cr</small></strong>
          <em>+12% vs plan</em>
        </article>
      </section>

      <section className="mobile-mini-chart" aria-label="Weekly visits planned versus actual">
        <h2>Weekly visits · planned vs actual</h2>
        <div className="mobile-line-chart">
          <svg viewBox="0 0 340 118" role="img" aria-label="Actual visits dip in week 5 and recover by week 11">
            <line x1="0" x2="340" y1="24" y2="24" />
            <line x1="0" x2="340" y1="58" y2="58" />
            <line x1="0" x2="340" y1="92" y2="92" />
            <path className="planned" d="M0 54 L34 50 L74 54 L135 51 L204 54 L272 52 L340 55" />
            <path className="area" d="M0 58 L34 54 L135 92 L204 68 L272 44 L340 35 L340 92 L0 92 Z" />
            <path className="actual" d="M0 58 L34 54 L135 92 L204 68 L272 44 L340 35" />
            <circle cx="340" cy="35" r="5" />
          </svg>
          <div className="mobile-axis">
            <span>W1</span>
            <span>W5</span>
            <span>W11</span>
          </div>
          <div className="mobile-legend">
            <span className="actual-key" /> Actual
            <span className="planned-key" /> Planned
          </div>
        </div>
      </section>

      <section className="mobile-risk-list" aria-label="North zone churn risk">
        <h2>Churn risk · North zone dealers</h2>
        {churnRows.map(([dealer, score, risk]) => (
          <div className="mobile-risk-row" key={dealer}>
            <span>{dealer}</span>
            <div className="mobile-risk-track">
              <i className={`risk-${risk}`} style={{ width: `${score * 100}%` }} />
            </div>
            <strong className={`risk-${risk}`}>{score.toFixed(2)}</strong>
          </div>
        ))}
      </section>
    </div>
  );
}

function MobileHistory({ onOpenChat }: { onOpenChat: () => void }) {
  const groups = [
    {
      label: "Today",
      items: [
        ["Field force Q3", "2 charts · 2 min ago"],
        ["Procurement savings", "3 charts · 1 hr ago"],
        ["Farmer NPS by region", "2 charts · 3 hr ago"],
      ],
    },
    {
      label: "Yesterday",
      items: [
        ["Wave 1 status", "4 charts · Yesterday"],
        ["Commodity markets", "2 charts · Yesterday"],
      ],
    },
  ];

  return (
    <div className="mobile-history-view">
      {groups.map((group) => (
        <section key={group.label}>
          <h2>{group.label}</h2>
          {group.items.map(([title, meta]) => (
            <button type="button" className="mobile-history-item" key={title} onClick={onOpenChat}>
              <span>
                <strong>{title}</strong>
                <em>{meta}</em>
              </span>
              <ChevronRight size={24} />
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

function MobileTabButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" className={cn("mobile-tab", active && "mobile-tab-active")} aria-current={active ? "page" : undefined} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function usePinnedCharts() {
  const [charts, setCharts] = useState<ChartBundle[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(PINNED_CHARTS_KEY);
        setCharts(raw ? (JSON.parse(raw) as ChartBundle[]) : []);
      } catch {
        setCharts([]);
      } finally {
        setHydrated(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(PINNED_CHARTS_KEY, JSON.stringify(charts));
  }, [charts, hydrated]);

  return [charts, setCharts] as const;
}
