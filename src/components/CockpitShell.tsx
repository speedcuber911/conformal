"use client";

import Link from "next/link";
import { BarChart3, ChevronRight, Clock3, Home, MessageSquare, Send } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { DuckDBStore } from "@/lib/duckdb-store";
import { ChatPanel } from "./ChatPanel";
import type { ChartBundle } from "./types";

const PINNED_CHARTS_KEY = "project-leap-pinned-charts";

export function CockpitShell() {
  const [live, setLive] = useState(true);
  const [pinnedCharts, setPinnedCharts] = usePinnedCharts();

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
    <main className="app-shell">
      <MobileShell live={live} />

      <aside className="sfs-sidebar">
        <div className="brand-lockup">
          <div className="sfs-mark">SFS</div>
          <div>
            <div className="project-label">Project Leap</div>
            <p>Shriram Farm Solutions</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          <a href="#" className="active">
            <MessageSquare size={17} />
            Chat
          </a>
          <Link href="/dashboard">
            <BarChart3 size={17} />
            Dashboard
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
              Live
            </button>
            <div className="top-divider" />
            <div className="avatar">AK</div>
          </div>
        </header>

        <ChatPanel live={live} pinnedIds={pinnedIds} onPinChart={togglePin} />
      </div>
    </main>
  );
}

type MobileTab = "home" | "chat" | "charts" | "history";

function MobileShell({ live }: { live: boolean }) {
  const [activeTab, setActiveTab] = useState<MobileTab>("home");

  return (
    <section className="mobile-shell" aria-label="Project Leap mobile cockpit">
      <MobileHeader live={live} />

      <div className="mobile-content" id="mobile-main">
        {activeTab === "home" ? <MobileHome /> : null}
        {activeTab === "chat" ? <MobileChat onOpenCharts={() => setActiveTab("charts")} /> : null}
        {activeTab === "charts" ? <MobileCharts /> : null}
        {activeTab === "history" ? <MobileHistory onOpenChat={() => setActiveTab("chat")} /> : null}
      </div>

      <nav className="mobile-tabbar" aria-label="Mobile primary navigation">
        <MobileTabButton active={activeTab === "home"} icon={<Home size={24} />} label="Home" onClick={() => setActiveTab("home")} />
        <MobileTabButton active={activeTab === "chat"} icon={<MessageSquare size={24} />} label="Chat" onClick={() => setActiveTab("chat")} />
        <MobileTabButton active={activeTab === "charts"} icon={<BarChart3 size={25} />} label="Charts" onClick={() => setActiveTab("charts")} />
        <MobileTabButton active={activeTab === "history"} icon={<Clock3 size={24} />} label="History" onClick={() => setActiveTab("history")} />
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
        live
      </div>
    </header>
  );
}

function MobileHome() {
  return <div className="mobile-home" aria-label="Project Leap home" />;
}

function MobileChat({ onOpenCharts }: { onOpenCharts: () => void }) {
  return (
    <div className="mobile-chat-view">
      <div className="mobile-question">How is the field force tracking this quarter?</div>
      <div className="mobile-trace">
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <strong>4 tool calls · 182ms</strong>
      </div>
      <button className="mobile-chart-jump" type="button" onClick={onOpenCharts}>
        2 charts <span aria-hidden="true">→</span>
      </button>
      <p className="mobile-answer">
        North leads at 86% coverage; East trails at 61% — weakest since Q1 FY24. The week-9 recovery holds. FY28 trajectory intact
        if East sustains through March.
      </p>
      <div className="mobile-followups" aria-label="Follow up prompts">
        <button type="button">Farmer NPS</button>
        <button type="button">Procurement</button>
        <button type="button">Wave 1</button>
        <button type="button">Markets</button>
      </div>
      <form className="mobile-compose">
        <input aria-label="Follow up question" placeholder="Follow up..." />
        <button type="button" aria-label="Ask follow up">
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

function MobileCharts() {
  const churnRows = [
    ["LKO", 0.81, "high"],
    ["PAT", 0.74, "highAlt"],
    ["BPL", 0.52, "medium"],
    ["JPR", 0.38, "low"],
    ["AMD", 0.22, "lowAlt"],
  ] as const;

  return (
    <div className="mobile-charts-view">
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
