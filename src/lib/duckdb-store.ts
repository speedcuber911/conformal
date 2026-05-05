"use client";

import { dataDictionary, getTableMeta } from "@/lib/data-dictionary";
import { cloneRows, demoTables, type Row } from "@/lib/demo-data";

type Handler = () => void;

const mutableTables: Record<string, Row[]> = Object.fromEntries(
  Object.entries(demoTables).map(([name, rows]) => [name, cloneRows(rows)]),
);

const subscribers = new Set<{ tables: string[]; handler: Handler }>();

function latestDate(rows: Row[]) {
  return String(rows.at(-1)?.date ?? rows.at(-1)?.week ?? rows.at(-1)?.month ?? "");
}

function sum(rows: Row[], field: string) {
  return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
}

function groupBy(rows: Row[], key: string) {
  return rows.reduce<Record<string, Row[]>>((groups, row) => {
    const value = String(row[key]);
    groups[value] = groups[value] ?? [];
    groups[value].push(row);
    return groups;
  }, {});
}

function table(name: string) {
  return mutableTables[name] ?? [];
}

function runHeroQuery(sql: string): Row[] {
  const normalized = sql.toLowerCase();

  if (normalized.includes("field_force_coverage")) {
    return Object.entries(groupBy(table("field_force_activity").filter((row) => String(row.date) >= "2026-04-01"), "region"))
      .map(([region, rows]) => ({
        region,
        coverage: Number((sum(rows, "visits_done") / sum(rows, "visits_planned")).toFixed(2)),
        orders: sum(rows, "orders_booked"),
      }))
      .sort((a, b) => Number(b.coverage) - Number(a.coverage));
  }

  if (normalized.includes("weekly_visits")) {
    return Array.from(groupBy(table("field_force_activity").filter((row) => String(row.date) >= "2026-02-01"), "date").entries ?? []);
  }

  if (normalized.includes("field_force_trend")) {
    const buckets = groupBy(table("field_force_activity").filter((row) => String(row.date) >= "2026-02-01"), "date");
    return Object.entries(buckets)
      .filter((_, index) => index % 7 === 0)
      .map(([date, rows]) => ({
        week: date,
        planned: sum(rows, "visits_planned"),
        done: sum(rows, "visits_done"),
      }));
  }

  if (normalized.includes("mgo_leaderboard")) {
    return Object.entries(groupBy(table("field_force_activity").filter((row) => String(row.date) >= "2026-04-01"), "mgo_id"))
      .map(([mgo_id, rows]) => ({
        mgo_id,
        region: rows[0]?.region,
        orders: sum(rows, "orders_booked"),
      }))
      .sort((a, b) => Number(b.orders) - Number(a.orders))
      .slice(0, 10);
  }

  if (normalized.includes("procurement_savings")) {
    return Object.entries(groupBy(table("procurement_spend").filter((row) => String(row.month) >= "2026-01-01"), "category"))
      .map(([category, rows]) => ({
        category,
        savings: sum(rows, "savings_vs_baseline"),
        target: 10_000_000,
      }))
      .sort((a, b) => Number(b.savings) - Number(a.savings));
  }

  if (normalized.includes("procurement_trend")) {
    return table("procurement_spend")
      .filter((row) => String(row.month) >= "2025-11-01")
      .map((row) => ({
        month: row.month,
        category: row.category,
        savings_vs_baseline: row.savings_vs_baseline,
      }));
  }

  if (normalized.includes("farmer_nps_trend")) {
    return table("farmer_nps");
  }

  if (normalized.includes("farmer_engagement_now")) {
    const rows = table("farmer_engagement");
    const latest = latestDate(rows);
    return rows
      .filter((row) => row.week === latest)
      .sort((a, b) => Number(b.app_dau) - Number(a.app_dau));
  }

  if (normalized.includes("microbattle_status")) {
    return table("wave1_microbattles").sort((a, b) => Number(b.percent_complete) - Number(a.percent_complete));
  }

  if (normalized.includes("microbattle_completion")) {
    return table("wave1_microbattles").sort((a, b) => Number(a.percent_complete) - Number(b.percent_complete));
  }

  if (normalized.includes("north_churn_risk")) {
    return table("channel_partners")
      .filter((row) => row.region === "North")
      .sort((a, b) => Number(b.churn_risk) - Number(a.churn_risk))
      .slice(0, 12);
  }

  if (normalized.includes("north_churn_dso")) {
    return table("channel_partners")
      .filter((row) => row.region === "North")
      .sort((a, b) => Number(b.payment_dso) - Number(a.payment_dso))
      .slice(0, 18);
  }

  if (normalized.includes("commodity_today")) {
    const rows = table("commodity_prices");
    const last = latestDate(rows);
    return rows.filter((row) => row.date === last).sort((a, b) => Number(b.dod_change_pct) - Number(a.dod_change_pct));
  }

  if (normalized.includes("commodity_sparkline")) {
    return table("commodity_prices").filter((row) => String(row.date) >= "2026-03-15");
  }

  if (normalized.includes("sales_by_region")) {
    return Object.entries(groupBy(table("secondary_sales").filter((row) => String(row.date) >= "2026-04-01"), "region")).map(([region, rows]) => ({
      region,
      revenue_inr: sum(rows, "revenue_inr"),
      units: sum(rows, "units"),
    }));
  }

  return table("secondary_sales").slice(0, 100);
}

export const DuckDBStore = {
  listTables() {
    return dataDictionary.map((entry) => ({
      name: entry.name,
      description: entry.description,
      row_count: table(entry.name).length || entry.row_count,
    }));
  },

  describeTable(name: string) {
    const meta = getTableMeta(name);
    if (!meta) throw new Error(`Unknown table: ${name}`);
    return {
      columns: meta.columns,
      sample: table(name).slice(0, 5),
    };
  },

  async runSql(sql: string) {
    const rows = runHeroQuery(sql);
    const columns = Object.keys(rows[0] ?? {});
    return { columns, rows, row_count: rows.length, sql };
  },

  mutate(tableName: string) {
    const rowsForTable = table(tableName);

    if (tableName === "commodity_prices") {
      const rows = rowsForTable;
      const lastDate = latestDate(rows);
      rows.filter((row) => row.date === lastDate).forEach((row, index) => {
        const drift = (index % 2 === 0 ? 1 : -1) * (0.12 + index * 0.04);
        row.dod_change_pct = Number((Number(row.dod_change_pct) + drift).toFixed(2));
        row.price_inr = Number((Number(row.price_inr) * (1 + drift / 100)).toFixed(2));
      });
    }

    if (tableName === "secondary_sales") {
      const rows = rowsForTable;
      const lastDate = latestDate(rows);
      rows.filter((row) => row.date === lastDate).forEach((row, index) => {
        row.units = Number(row.units) + 2 + index;
        row.revenue_inr = Number(row.revenue_inr) + (2 + index) * 1040;
      });
    }

    if (tableName === "field_force_activity") {
      const lastDate = latestDate(rowsForTable);
      rowsForTable.filter((row) => row.date === lastDate).forEach((row, index) => {
        row.visits_done = Math.min(Number(row.visits_planned), Number(row.visits_done) + (index % 3 === 0 ? 1 : 0));
        row.orders_booked = Number(row.orders_booked) + (index % 4 === 0 ? 1 : 0);
      });
    }

    if (tableName === "channel_partners") {
      rowsForTable.slice(0, 24).forEach((row, index) => {
        row.churn_risk = Number(Math.max(0.05, Math.min(0.98, Number(row.churn_risk) + (index % 2 === 0 ? -0.01 : 0.01))).toFixed(2));
        row.payment_dso = Math.max(12, Number(row.payment_dso) + (index % 3 === 0 ? -1 : 1));
      });
    }

    if (tableName === "farmer_engagement") {
      const lastDate = latestDate(rowsForTable);
      rowsForTable.filter((row) => row.week === lastDate).forEach((row, index) => {
        row.app_dau = Number(row.app_dau) + 12 + index * 3;
        row.calls_handled = Number(row.calls_handled) + (index % 2 === 0 ? 4 : -2);
      });
    }

    if (tableName === "procurement_spend") {
      const lastDate = latestDate(rowsForTable);
      rowsForTable.filter((row) => row.month === lastDate).forEach((row, index) => {
        row.savings_vs_baseline = Number(row.savings_vs_baseline) + 32000 + index * 1800;
      });
    }

    if (tableName === "wave1_microbattles") {
      rowsForTable.forEach((row, index) => {
        if (row.status !== "Blocked") {
          row.percent_complete = Math.min(99, Number(row.percent_complete) + (index % 3 === 0 ? 1 : 0));
        }
      });
    }

    if (tableName === "farmer_nps") {
      rowsForTable.slice(-5).forEach((row, index) => {
        row.nps = Number(row.nps) + (index % 2 === 0 ? 1 : 0);
      });
    }

    subscribers.forEach((subscription) => {
      if (subscription.tables.includes(tableName)) subscription.handler();
    });
  },

  subscribe(tables: string[], handler: Handler) {
    const subscription = { tables, handler };
    subscribers.add(subscription);
    return () => subscribers.delete(subscription);
  },

  tablesReferencedBy(sql: string) {
    const found = new Set<string>();
    const lower = sql.toLowerCase();
    dataDictionary.forEach((entry) => {
      if (lower.includes(entry.name.toLowerCase())) found.add(entry.name);
    });
    return [...found];
  },
};

export function rowsToCsv(rows: Row[]) {
  const columns = Object.keys(rows[0] ?? {});
  return [columns.join(","), ...rows.map((row) => columns.map((column) => JSON.stringify(row[column] ?? "")).join(","))].join("\n");
}
