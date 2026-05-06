"use client";

import Link from "next/link";
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { ArrowLeft, GripVertical, LayoutDashboard, RadioTower, Trash2 } from "lucide-react";
import { CSSProperties, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { DuckDBStore } from "@/lib/duckdb-store";
import { LiveChart } from "./LiveChart";
import type { ChartBundle } from "./types";

const PINNED_CHARTS_KEY = "project-leap-pinned-charts";

export function DashboardGrid() {
  const [charts, setCharts] = useState<ChartBundle[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [live, setLive] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  useEffect(() => {
    queueMicrotask(() => {
      try {
        setCharts(JSON.parse(localStorage.getItem(PINNED_CHARTS_KEY) ?? "[]") as ChartBundle[]);
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

  const remove = (id: string) => setCharts((current) => current.filter((chart) => chart.id !== id));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setCharts((current) => {
      const oldIndex = current.findIndex((chart) => chart.id === active.id);
      const newIndex = current.findIndex((chart) => chart.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
  };

  return (
    <main className="dashboard-shell">
      <header className="dashboard-top">
        <Link href="/" className="back-link">
          <ArrowLeft size={16} />
          Cockpit
        </Link>
        <div>
          <span>Pinned board</span>
          <h1>Executive dashboard</h1>
        </div>
        <button type="button" className={cn("live-toggle", live && "live-toggle-on")} onClick={() => setLive((current) => !current)}>
          <span />
          {live ? "Live" : "Stable"}
        </button>
      </header>

      {charts.length ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <section className="dashboard-grid">
            {charts.map((chart) => (
              <DashboardTile key={chart.id} chart={chart} live={live} onRemove={remove} />
            ))}
          </section>
        </DndContext>
      ) : (
        <section className="dashboard-empty">
          <LayoutDashboard size={28} />
          <h2>No pinned charts yet</h2>
          <p>Pin charts from the cockpit canvas to build a live board for recurring operating reviews.</p>
          <Link href="/">Open cockpit</Link>
        </section>
      )}
    </main>
  );
}

function DashboardTile({ chart, live, onRemove }: { chart: ChartBundle; live: boolean; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: chart.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: chart.id });
  const style: CSSProperties = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {};
  const setRefs = (node: HTMLElement | null) => {
    setNodeRef(node);
    setDropRef(node);
  };

  return (
    <article ref={setRefs} style={style} className={cn("dashboard-tile", isDragging && "dashboard-tile-dragging", isOver && "dashboard-tile-over")}>
      <div className="tile-toolbar">
        <button type="button" title="Drag chart" {...listeners} {...attributes}>
          <GripVertical size={16} />
        </button>
        <span>
          <RadioTower size={13} />
          {live ? "Live" : "Manual"}
        </span>
        <button type="button" title="Remove chart" onClick={() => onRemove(chart.id)}>
          <Trash2 size={15} />
        </button>
      </div>
      <LiveChart chart={chart} live={live} compact onRemove={onRemove} />
    </article>
  );
}
