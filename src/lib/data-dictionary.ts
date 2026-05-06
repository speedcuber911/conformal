export type ColumnMeta = {
  name: string;
  type: string;
  description: string;
};

export type TableMeta = {
  name: string;
  description: string;
  grain: string;
  row_count: number;
  columns: ColumnMeta[];
};

export const dataDictionary: TableMeta[] = [
  {
    name: "secondary_sales",
    description: "Daily secondary sales by region and product.",
    grain: "day x region x product",
    row_count: 8760,
    columns: [
      { name: "date", type: "DATE", description: "Sales date" },
      { name: "region", type: "TEXT", description: "Commercial region" },
      { name: "product", type: "TEXT", description: "Seed, fertilizer, and crop-care product" },
      { name: "units", type: "INTEGER", description: "Units sold" },
      { name: "revenue_inr", type: "DOUBLE", description: "Revenue in Indian rupees" },
    ],
  },
  {
    name: "financial_performance",
    description: "Monthly SFS P&L time series for revenue, EBITDA, budget, and margin questions.",
    grain: "month",
    row_count: 24,
    columns: [
      { name: "month", type: "DATE", description: "Financial month" },
      { name: "revenue_cr", type: "DOUBLE", description: "Net revenue in INR crore" },
      { name: "budget_revenue_cr", type: "DOUBLE", description: "Budgeted net revenue in INR crore" },
      { name: "ebitda_cr", type: "DOUBLE", description: "EBITDA in INR crore" },
      { name: "budget_ebitda_cr", type: "DOUBLE", description: "Budgeted EBITDA in INR crore" },
      { name: "ebitda_margin_pct", type: "DOUBLE", description: "EBITDA as a percentage of net revenue" },
    ],
  },
  {
    name: "field_force_activity",
    description: "Daily MGO activity, dealer coverage, and booked orders.",
    grain: "day x MGO",
    row_count: 14600,
    columns: [
      { name: "date", type: "DATE", description: "Activity date" },
      { name: "mgo_id", type: "TEXT", description: "Market growth officer id" },
      { name: "region", type: "TEXT", description: "Assigned region" },
      { name: "visits_planned", type: "INTEGER", description: "Planned dealer visits" },
      { name: "visits_done", type: "INTEGER", description: "Completed dealer visits" },
      { name: "dealers_covered", type: "INTEGER", description: "Unique dealers covered" },
      { name: "orders_booked", type: "INTEGER", description: "Orders booked during visits" },
    ],
  },
  {
    name: "channel_partners",
    description: "Dealer profile, sales, DSO, scheme attachment, and churn risk.",
    grain: "dealer",
    row_count: 320,
    columns: [
      { name: "dealer_id", type: "TEXT", description: "Dealer id" },
      { name: "region", type: "TEXT", description: "Region" },
      { name: "tier", type: "TEXT", description: "Dealer tier" },
      { name: "ytd_sales", type: "DOUBLE", description: "Year-to-date sales" },
      { name: "payment_dso", type: "INTEGER", description: "Days sales outstanding" },
      { name: "scheme_attached", type: "BOOLEAN", description: "Whether active scheme is attached" },
      { name: "churn_risk", type: "DOUBLE", description: "Predicted churn risk from 0 to 1" },
    ],
  },
  {
    name: "farmer_engagement",
    description: "Weekly digital and call-center engagement by region.",
    grain: "week x region",
    row_count: 520,
    columns: [
      { name: "week", type: "DATE", description: "Week start" },
      { name: "region", type: "TEXT", description: "Region" },
      { name: "app_dau", type: "INTEGER", description: "Average daily active users" },
      { name: "calls_handled", type: "INTEGER", description: "Farmer support calls handled" },
      { name: "nps", type: "DOUBLE", description: "Weekly interaction NPS" },
      { name: "top_query_topic", type: "TEXT", description: "Most common support topic" },
    ],
  },
  {
    name: "procurement_spend",
    description: "Monthly procurement spend, savings, and supplier breadth.",
    grain: "month x category",
    row_count: 144,
    columns: [
      { name: "month", type: "DATE", description: "Month" },
      { name: "category", type: "TEXT", description: "Procurement category" },
      { name: "spend", type: "DOUBLE", description: "Monthly spend" },
      { name: "savings_vs_baseline", type: "DOUBLE", description: "Savings versus baseline" },
      { name: "supplier_count", type: "INTEGER", description: "Active suppliers" },
    ],
  },
  {
    name: "wave1_microbattles",
    description: "Wave 1 transformation micro-battle status.",
    grain: "battle",
    row_count: 9,
    columns: [
      { name: "name", type: "TEXT", description: "Micro-battle name" },
      { name: "owner_function", type: "TEXT", description: "Accountable function" },
      { name: "status", type: "TEXT", description: "On track, Watch, or Blocked" },
      { name: "percent_complete", type: "DOUBLE", description: "Completion percent" },
      { name: "target_date", type: "DATE", description: "Target date" },
      { name: "blockers", type: "TEXT", description: "Current blocker if any" },
    ],
  },
  {
    name: "commodity_prices",
    description: "Daily commodity prices used by procurement and sales teams.",
    grain: "day x commodity",
    row_count: 2880,
    columns: [
      { name: "date", type: "DATE", description: "Trading date" },
      { name: "commodity", type: "TEXT", description: "Commodity" },
      { name: "price_inr", type: "DOUBLE", description: "Price in INR" },
      { name: "dod_change_pct", type: "DOUBLE", description: "Day-over-day percent change" },
    ],
  },
  {
    name: "farmer_nps",
    description: "Quarterly farmer NPS by region.",
    grain: "quarter x region",
    row_count: 40,
    columns: [
      { name: "quarter", type: "TEXT", description: "Fiscal quarter" },
      { name: "region", type: "TEXT", description: "Region" },
      { name: "nps", type: "DOUBLE", description: "Net promoter score" },
      { name: "sample_size", type: "INTEGER", description: "Survey responses" },
    ],
  },
];

export function getTableMeta(name: string) {
  return dataDictionary.find((table) => table.name === name);
}
