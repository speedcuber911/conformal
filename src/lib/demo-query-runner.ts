import { demoTables, type Row } from "@/lib/demo-data";
import workbookTablesRaw from "@/lib/workbook-data.json";

export type TableGetter = (name: string) => Row[];
const workbookTables = workbookTablesRaw as Record<string, Row[]>;

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
  try {
    return runGenericSelect(sql, table);
  } catch {
    return runTaggedDemoSql(sql, table);
  }
}

export function runGeneratedSql(sql: string, table: TableGetter = (name) => workbookTables[name] ?? demoTables[name] ?? []) {
  return runGenericSelect(sql, table);
}

function runTaggedDemoSql(sql: string, table: TableGetter): Row[] {
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

type SelectItem = {
  expression: string;
  alias: string;
};

type OrderClause = {
  key: string;
  direction: "asc" | "desc";
};

const CLAUSE_PATTERN = /\b(where|group\s+by|order\s+by|limit)\b/i;
const AGG_PATTERN = /^(sum|avg|min|max|count)\((\*|[a-zA-Z0-9_]+)\)$/i;

function runGenericSelect(sql: string, table: TableGetter): Row[] {
  const cleanSql = stripSql(sql);
  if (!/^select\s+/i.test(cleanSql)) throw new Error("Only SELECT statements are supported.");

  const fromMatch = cleanSql.match(/\sfrom\s+([a-zA-Z0-9_]+)/i);
  if (!fromMatch?.index) throw new Error("SQL must include FROM <table>.");

  const selectPart = cleanSql.slice("select".length, fromMatch.index).trim();
  const tableName = fromMatch[1];
  const rest = cleanSql.slice(fromMatch.index + fromMatch[0].length).trim();
  const sourceRows = table(tableName);
  if (!sourceRows.length) throw new Error(`Unknown or empty table: ${tableName}`);

  const clauses = parseClauses(rest);
  const selectItems = splitTopLevel(selectPart).map(parseSelectItem);
  const whereRows = clauses.where ? sourceRows.filter((row) => matchesWhere(row, clauses.where ?? "")) : [...sourceRows];
  const groupKeys = clauses.groupBy ? splitTopLevel(clauses.groupBy).map((key) => key.trim()).filter(Boolean) : [];
  const hasAggregates = selectItems.some((item) => AGG_PATTERN.test(item.expression));

  let resultRows: Row[];
  if (groupKeys.length || hasAggregates) {
    resultRows = aggregateRows(whereRows, selectItems, groupKeys);
  } else {
    resultRows = whereRows.map((row) => projectRow(row, selectItems));
  }

  if (clauses.orderBy) {
    const order = parseOrder(clauses.orderBy);
    resultRows.sort((left, right) => compareValues(left[order.key], right[order.key], order.direction));
  }

  if (clauses.limit) resultRows = resultRows.slice(0, Number(clauses.limit));
  return resultRows;
}

function stripSql(sql: string) {
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const withoutSemicolon = withoutComments.replace(/;+\s*$/, "");
  if (!withoutSemicolon || withoutSemicolon.includes(";")) throw new Error("Only one SELECT statement is supported.");
  return withoutSemicolon;
}

function parseClauses(rest: string) {
  const clauses: { where?: string; groupBy?: string; orderBy?: string; limit?: string } = {};
  let remaining = rest.trim();

  while (remaining) {
    const match = remaining.match(CLAUSE_PATTERN);
    if (!match?.index && match?.index !== 0) break;

    const clauseName = match[1].toLowerCase().replace(/\s+/g, " ");
    const start = match.index + match[0].length;
    const after = remaining.slice(start).trim();
    const next = after.search(CLAUSE_PATTERN);
    const value = (next >= 0 ? after.slice(0, next) : after).trim();
    remaining = next >= 0 ? after.slice(next).trim() : "";

    if (clauseName === "where") clauses.where = value;
    if (clauseName === "group by") clauses.groupBy = value;
    if (clauseName === "order by") clauses.orderBy = value;
    if (clauseName === "limit") clauses.limit = value.match(/^\d+/)?.[0];
  }

  return clauses;
}

function parseSelectItem(rawItem: string): SelectItem {
  const item = rawItem.trim();
  const aliasMatch = item.match(/\s+as\s+([a-zA-Z0-9_]+)$/i) ?? item.match(/\s+([a-zA-Z0-9_]+)$/i);
  if (aliasMatch && aliasMatch.index && aliasMatch.index > 0 && !AGG_PATTERN.test(item)) {
    const expression = item.slice(0, aliasMatch.index).trim();
    return { expression, alias: aliasMatch[1] };
  }

  const expression = aliasMatch && /\s+as\s+/i.test(item) ? item.slice(0, aliasMatch.index).trim() : item;
  return { expression, alias: aliasMatch && /\s+as\s+/i.test(item) ? aliasMatch[1] : defaultAlias(expression) };
}

function projectRow(row: Row, items: SelectItem[]): Row {
  return Object.fromEntries(items.map((item) => [item.alias, valueForExpression(row, item.expression)])) as Row;
}

function aggregateRows(rows: Row[], items: SelectItem[], groupKeys: string[]): Row[] {
  const groups = new Map<string, Row[]>();
  rows.forEach((row) => {
    const key = groupKeys.map((groupKey) => String(row[groupKey] ?? "")).join("\u001f");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  if (!groups.size && !groupKeys.length) groups.set("", []);

  return Array.from(groups.values()).map((groupRows) => {
    const first = groupRows[0] ?? {};
    return Object.fromEntries(
      items.map((item) => {
        const aggregateMatch = item.expression.match(AGG_PATTERN);
        if (aggregateMatch) return [item.alias, aggregateValue(groupRows, aggregateMatch[1].toLowerCase(), aggregateMatch[2])];
        return [item.alias, valueForExpression(first, item.expression)];
      }),
    ) as Row;
  });
}

function aggregateValue(rows: Row[], op: string, column: string) {
  if (op === "count") return column === "*" ? rows.length : rows.filter((row) => row[column] != null).length;
  const values = rows.map((row) => Number(row[column] ?? 0)).filter(Number.isFinite);
  if (!values.length) return 0;
  if (op === "sum") return roundNumber(values.reduce((total, value) => total + value, 0));
  if (op === "avg") return roundNumber(values.reduce((total, value) => total + value, 0) / values.length);
  if (op === "min") return Math.min(...values);
  if (op === "max") return Math.max(...values);
  return 0;
}

function matchesWhere(row: Row, where: string) {
  return where
    .split(/\s+and\s+/i)
    .map((condition) => condition.trim())
    .filter(Boolean)
    .every((condition) => matchesCondition(row, condition));
}

function matchesCondition(row: Row, condition: string) {
  const inMatch = condition.match(/^([a-zA-Z0-9_]+)\s+in\s+\((.+)\)$/i);
  if (inMatch) {
    const values = splitTopLevel(inMatch[2]).map(parseLiteral);
    return values.some((value) => value === row[inMatch[1]]);
  }

  const match = condition.match(/^([a-zA-Z0-9_]+)\s*(=|!=|<>|>=|<=|>|<)\s*(.+)$/);
  if (!match) throw new Error(`Unsupported WHERE condition: ${condition}`);
  const left = row[match[1]];
  const right = parseLiteral(match[3]);
  const operator = match[2];

  if (operator === "=") return left === right;
  if (operator === "!=" || operator === "<>") return left !== right;

  const leftComparable = comparable(left);
  const rightComparable = comparable(right);
  if (operator === ">=") return leftComparable >= rightComparable;
  if (operator === "<=") return leftComparable <= rightComparable;
  if (operator === ">") return leftComparable > rightComparable;
  if (operator === "<") return leftComparable < rightComparable;
  return false;
}

function valueForExpression(row: Row, expression: string) {
  const column = expression.trim();
  if (column === "*") return JSON.stringify(row);
  if (!(column in row)) throw new Error(`Unknown column: ${column}`);
  return row[column];
}

function parseOrder(orderBy: string): OrderClause {
  const [key, direction] = orderBy.trim().split(/\s+/);
  return { key, direction: direction?.toLowerCase() === "desc" ? "desc" : "asc" };
}

function compareValues(left: unknown, right: unknown, direction: "asc" | "desc") {
  const result = comparable(left) > comparable(right) ? 1 : comparable(left) < comparable(right) ? -1 : 0;
  return direction === "desc" ? -result : result;
}

function comparable(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return String(value ?? "");
}

function parseLiteral(raw: string): string | number | boolean {
  const value = raw.trim().replace(/^['"]|['"]$/g, "");
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  if (Number.isFinite(Number(value)) && value !== "") return Number(value);
  return value;
}

function splitTopLevel(input: string) {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of input) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function defaultAlias(expression: string) {
  const aggregateMatch = expression.match(AGG_PATTERN);
  if (aggregateMatch) return `${aggregateMatch[1].toLowerCase()}_${aggregateMatch[2] === "*" ? "rows" : aggregateMatch[2]}`;
  return expression.replace(/[^a-zA-Z0-9_]+/g, "_");
}

function roundNumber(value: number) {
  return Number(value.toFixed(2));
}
