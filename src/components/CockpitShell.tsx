"use client";

import Link from "next/link";
import { BarChart3, Command, Gauge, Moon, PanelLeft, RadioTower, Search, SunMedium } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { DuckDBStore } from "@/lib/duckdb-store";
import { ChatPanel } from "./ChatPanel";
import type { ChartBundle } from "./types";

const PINNED_CHARTS_KEY = "project-leap-pinned-charts";

export function CockpitShell() {
  const [dark, setDark] = useState(false);
  const [live, setLive] = useState(true);
  const [pinnedCharts, setPinnedCharts] = usePinnedCharts();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

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
      <aside className="left-rail">
        <div className="rail-mark">
          <span>PL</span>
        </div>
        <nav aria-label="Primary">
          <a href="#" className="active" title="Cockpit">
            <Gauge size={19} />
          </a>
          <Link href="/dashboard" title="Pinned dashboard">
            <BarChart3 size={19} />
          </Link>
          <a href="#" title="Live signals">
            <RadioTower size={19} />
          </a>
        </nav>
        <button className="rail-button" type="button" title="Collapse rail">
          <PanelLeft size={18} />
        </button>
      </aside>

      <div className="app-main">
        <header className="top-bar">
          <div className="top-title">
            <span>Project Leap</span>
            <h1>Executive cockpit</h1>
          </div>

          <div className="command-visual">
            <Search size={15} />
            <span>Ask, drill, pin, export</span>
            <kbd>
              <Command size={12} />K
            </kbd>
          </div>

          <div className="top-actions">
            <button type="button" className={cn("live-toggle", live && "live-toggle-on")} onClick={() => setLive((current) => !current)}>
              <span />
              Live
            </button>
            <button type="button" className="icon-toggle" onClick={() => setDark((current) => !current)} title="Toggle theme">
              {dark ? <SunMedium size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        <ChatPanel live={live} pinnedIds={pinnedIds} onPinChart={togglePin} />
      </div>
    </main>
  );
}

export function usePinnedCharts() {
  const [charts, setCharts] = useState<ChartBundle[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(PINNED_CHARTS_KEY);
      return raw ? (JSON.parse(raw) as ChartBundle[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(PINNED_CHARTS_KEY, JSON.stringify(charts));
  }, [charts]);

  return [charts, setCharts] as const;
}
