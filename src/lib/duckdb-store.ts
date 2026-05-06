"use client";

import { dataDictionary, getTableMeta } from "@/lib/data-dictionary";
import { cloneRows, demoTables, type Row } from "@/lib/demo-data";
import { latestDate, runDemoSql } from "@/lib/demo-query-runner";

type Handler = () => void;

const mutableTables: Record<string, Row[]> = Object.fromEntries(
  Object.entries(demoTables).map(([name, rows]) => [name, cloneRows(rows)]),
);

const subscribers = new Set<{ tables: string[]; handler: Handler }>();

function table(name: string) {
  return mutableTables[name] ?? [];
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
    const rows = runDemoSql(sql, table);
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
