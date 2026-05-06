import { demoTables, type Row } from "@/lib/demo-data";

export type TableGetter = (name: string) => Row[];

export function latestDate(rows: Row[]) {
  return String(rows.at(-1)?.date ?? rows.at(-1)?.week ?? rows.at(-1)?.month ?? "");
}

export function sum(rows: Row[], field: string) {
  return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
}

export function groupBy(rows: Row[], key: string) {
  return rows.reduce<Record<string, Row[]>>((groups, row) => {
    const value = String(row[key]);
    groups[value] = groups[value] ?? [];
    groups[value].push(row);
    return groups;
  }, {});
}

export function runStaticDemoSql(sql: string) {
  return runDemoSql(sql, (name) => demoTables[name] ?? []);
}

export function runDemoSql(sql: string, table: TableGetter): Row[] {
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
        week_starting: date,
        planned: sum(rows, "visits_planned"),
        actual: sum(rows, "visits_done"),
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

  if (normalized.includes("finance_revenue_ebitda_timeseries")) {
    return table("financial_performance").map((row) => ({
      month: row.month,
      revenue_cr: row.revenue_cr,
      ebitda_cr: row.ebitda_cr,
    }));
  }

  if (normalized.includes("finance_revenue_timeseries")) {
    return table("financial_performance").map((row) => ({
      month: row.month,
      revenue_cr: row.revenue_cr,
      budget_revenue_cr: row.budget_revenue_cr,
    }));
  }

  if (normalized.includes("finance_ebitda_timeseries")) {
    return table("financial_performance").map((row) => ({
      month: row.month,
      ebitda_cr: row.ebitda_cr,
      budget_ebitda_cr: row.budget_ebitda_cr,
    }));
  }

  if (normalized.includes("finance_margin_timeseries")) {
    return table("financial_performance").map((row) => ({
      month: row.month,
      ebitda_margin_pct: row.ebitda_margin_pct,
    }));
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

  if (normalized.includes("north_churn_inline")) {
    return [
      { dealer_id: "LKO", churn_risk: 0.8 },
      { dealer_id: "PAT", churn_risk: 0.74 },
      { dealer_id: "BPL", churn_risk: 0.52 },
      { dealer_id: "JPR", churn_risk: 0.38 },
      { dealer_id: "AMD", churn_risk: 0.22 },
    ];
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
