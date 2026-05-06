export type Row = Record<string, string | number | boolean | null>;

const regions = ["North", "West", "East", "South", "Central"];
const products = ["Hybrid Paddy", "Bioseed Cotton", "DAP Fertilizer", "Crop Shield", "NutriMix"];
const commodities = ["Urea", "DAP", "Maize", "Mustard", "Cotton", "Natural Gas"];

function hash(input: string) {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) % 9973;
  }
  return value;
}

function day(offset: number) {
  const date = new Date("2026-05-05T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function month(offset: number) {
  const date = new Date("2026-05-01T00:00:00.000Z");
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}

function seasonality(index: number) {
  return 1 + Math.sin(index / 28) * 0.18 + Math.cos(index / 57) * 0.08;
}

const secondarySales = Array.from({ length: 730 }).flatMap((_, dayIndex) =>
  regions.flatMap((region) =>
    products.map((product) => {
      const base = 120 + hash(`${region}-${product}`) % 80;
      const regionalDrag = region === "North" ? 0.82 : region === "East" ? 0.9 : 1;
      const hotProduct = product === "Bioseed Cotton" ? 1.28 : 1;
      const units = Math.round(base * regionalDrag * hotProduct * seasonality(dayIndex));
      return {
        date: day(dayIndex - 729),
        region,
        product,
        units,
        revenue_inr: units * (850 + (hash(product) % 300)),
      };
    }),
  ),
);

const financialPerformance = Array.from({ length: 24 }).map((_, monthIndex) => {
  const monthKey = month(monthIndex - 24);
  const seasonalLift = 1 + Math.sin(monthIndex / 2.8) * 0.09 + Math.cos(monthIndex / 5.4) * 0.05;
  const revenue_cr = Number((104 + monthIndex * 1.85 + seasonalLift * 8.4 + (monthIndex > 14 ? 5.2 : 0)).toFixed(1));
  const budget_revenue_cr = Number((revenue_cr * (monthIndex < 8 ? 1.04 : 0.985)).toFixed(1));
  const ebitda_margin_pct = Number((17.2 + monthIndex * 0.11 + Math.sin(monthIndex / 3.5) * 0.9).toFixed(1));
  const ebitda_cr = Number((revenue_cr * ebitda_margin_pct / 100).toFixed(1));
  const budget_ebitda_cr = Number((budget_revenue_cr * 0.176).toFixed(1));

  return {
    month: monthKey,
    revenue_cr,
    budget_revenue_cr,
    ebitda_cr,
    budget_ebitda_cr,
    ebitda_margin_pct,
  };
});

export const demoTables: Record<string, Row[]> = {
  secondary_sales: secondarySales,
  financial_performance: financialPerformance,
  field_force_activity: Array.from({ length: 365 }).flatMap((_, dayIndex) =>
    regions.flatMap((region, regionIndex) =>
      Array.from({ length: 8 }).map((__, mgoIndex) => {
        const planned = 7 + ((dayIndex + mgoIndex) % 3);
        const drag = region === "North" ? 0.72 : region === "East" ? 0.81 : 0.9 + regionIndex * 0.02;
        const done = Math.max(2, Math.round(planned * drag + Math.sin(dayIndex / 9 + mgoIndex)));
        return {
          date: day(dayIndex - 364),
          mgo_id: `${region.slice(0, 2).toUpperCase()}-${String(mgoIndex + 1).padStart(2, "0")}`,
          region,
          visits_planned: planned,
          visits_done: done,
          dealers_covered: Math.max(1, done - 1),
          orders_booked: Math.round(done * (1.6 + (hash(region) % 5) / 10)),
        };
      }),
    ),
  ),
  channel_partners: regions.flatMap((region) =>
    Array.from({ length: 64 }).map((_, index) => {
      const tier = index % 7 === 0 ? "Platinum" : index % 3 === 0 ? "Gold" : index % 2 === 0 ? "Silver" : "Bronze";
      const riskBase = region === "North" ? 0.48 : region === "East" ? 0.38 : 0.24;
      const churn_risk = Math.min(0.95, riskBase + ((index % 11) / 24));
      return {
        dealer_id: `${region.slice(0, 1)}DLR-${String(index + 1).padStart(3, "0")}`,
        region,
        tier,
        ytd_sales: Math.round((1_800_000 + hash(`${region}-${index}`) * 420) * (tier === "Platinum" ? 2.2 : tier === "Gold" ? 1.45 : 1)),
        payment_dso: Math.round(18 + churn_risk * 70),
        scheme_attached: index % 5 !== 0,
        churn_risk: Number(churn_risk.toFixed(2)),
      };
    }),
  ),
  farmer_engagement: Array.from({ length: 104 }).flatMap((_, weekIndex) =>
    regions.map((region) => ({
      week: day(weekIndex * 7 - 727),
      region,
      app_dau: Math.round((4200 + hash(region) * 2) * (region === "South" ? 1.18 : 1) * (1 + weekIndex / 620)),
      calls_handled: Math.round(780 + hash(`${region}-${weekIndex}`) % 240),
      nps: Math.round(42 + weekIndex * 0.08 + (region === "North" ? -9 : region === "South" ? 7 : 0) + Math.sin(weekIndex / 4) * 4),
      top_query_topic: ["sowing advice", "scheme eligibility", "dealer credit", "commodity price"][weekIndex % 4],
    })),
  ),
  procurement_spend: Array.from({ length: 24 }).flatMap((_, monthIndex) =>
    ["Raw Material", "Packaging", "Logistics", "Media", "Field Ops", "IT"].map((category) => ({
      month: month(monthIndex - 23),
      category,
      spend: Math.round((18_000_000 + hash(category) * 1700) * (1 + Math.sin(monthIndex / 5) * 0.07)),
      savings_vs_baseline: Math.round((1_800_000 + monthIndex * 70000 + hash(category) * 120) * (category === "Logistics" ? 1.26 : 1)),
      supplier_count: 7 + (hash(category) % 8),
    })),
  ),
  wave1_microbattles: [
    ["Enterprise CEO Chatbot", "CEO Office", "On track", 72, "2026-07-15", ""],
    ["Dealer Churn Pod", "Sales", "Watch", 54, "2026-07-30", "North zone adoption lag"],
    ["Procurement Control Tower", "Procurement", "On track", 68, "2026-08-10", ""],
    ["Farmer App Growth", "Digital", "On track", 63, "2026-08-01", ""],
    ["MGO Productivity Sprint", "Field Force", "Watch", 49, "2026-07-20", "Visit discipline variance"],
    ["Commodity War Room", "Strategy", "On track", 81, "2026-06-25", ""],
    ["Scheme Leakage Audit", "Finance", "Blocked", 31, "2026-07-12", "Data quality from two regions"],
    ["North Zone Recovery", "Sales", "Watch", 44, "2026-08-18", "Dealer credit overhang"],
    ["NPS Closed Loop", "Customer", "On track", 59, "2026-08-05", ""],
  ].map(([name, owner_function, status, percent_complete, target_date, blockers]) => ({
    name,
    owner_function,
    status,
    percent_complete,
    target_date,
    blockers,
  })),
  commodity_prices: Array.from({ length: 480 }).flatMap((_, dayIndex) =>
    commodities.map((commodity) => {
      const prev = 100 + hash(commodity) / 70 + Math.sin(dayIndex / 11 + hash(commodity)) * 5;
      const price = prev + dayIndex * 0.045;
      return {
        date: day(dayIndex - 479),
        commodity,
        price_inr: Number(price.toFixed(2)),
        dod_change_pct: Number((Math.sin(dayIndex / 7 + hash(commodity)) * 1.8).toFixed(2)),
      };
    }),
  ),
  farmer_nps: Array.from({ length: 10 }).flatMap((_, quarterIndex) =>
    regions.map((region) => ({
      quarter: `FY${24 + Math.floor(quarterIndex / 4)} Q${(quarterIndex % 4) + 1}`,
      region,
      nps: Math.round(34 + quarterIndex * 2.2 + (region === "North" ? -8 : region === "South" ? 8 : region === "West" ? 4 : 0)),
      sample_size: 240 + (hash(`${region}-${quarterIndex}`) % 180),
    })),
  ),
};

export function cloneRows(rows: Row[]) {
  return rows.map((row) => ({ ...row }));
}
