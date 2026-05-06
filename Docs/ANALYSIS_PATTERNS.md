# ANALYSIS_PATTERNS

A catalog of the analytical patterns the AnalysisPlanner (Agent 2) decomposes questions into. Each pattern has a name, a "when to use," structural shape, and an example. The Planner uses this as grounding for its decompositions.

This file is loaded into Agent 2's system prompt at runtime.

---

## kpi_lookup

**When to use**: User wants a single number or small set of numbers as a headline answer. "What's our FY26 revenue?" "How much are we paying above market for Glyphosate?"

**Shape**:
- 1 row × 1-3 columns
- No grouping dimensions
- One or more aggregate measures with filters

**Specification**:
```
{
  "type": "kpi_lookup",
  "tables_needed": [...],
  "filters": {...},
  "measures": ["sum(...)", "avg(...)"],
  "dimensions": [],
  "expected_output_shape": "single row with N columns"
}
```

**Example**: Total Q2 FY26 EBITDA variance.
```sql
SELECT SUM(ebitda_variance_inr)/1e7 AS variance_cr
FROM fact_finance_pl
WHERE fiscal_year='FY26' AND fiscal_quarter='Q2'
```

---

## trend

**When to use**: User wants a time series. "Show monthly revenue across FY26", "How has Glyphosate market price moved?"

**Shape**:
- 6+ rows ordered by time
- Two columns minimum: time dimension, measure
- Optionally a categorical dimension for multiple lines

**Specification**:
```
{
  "type": "trend",
  "tables_needed": [...],
  "filters": {...},
  "measures": ["sum(...)"],
  "dimensions": ["time_grain (month/quarter/week)"],
  "expected_output_shape": "12-24 rows ordered by time"
}
```

**Example**: Monthly revenue trend FY26.
```sql
SELECT month, SUM(revenue_inr)/1e7 AS revenue_cr
FROM fact_finance_pl
WHERE fiscal_year='FY26'
GROUP BY month
ORDER BY month
```

---

## breakdown

**When to use**: User wants a measure split by one or two categorical dimensions. "Revenue by region", "Sales by category × quarter."

**Shape**:
- N rows = N distinct dimension values (or N × M for two dimensions)
- 1 measure column
- 1-2 dimension columns

**Specification**:
```
{
  "type": "breakdown",
  "tables_needed": [...],
  "filters": {...},
  "measures": ["sum(...)"],
  "dimensions": ["region", "category"],
  "expected_output_shape": "5 regions × 4 categories = 20 rows"
}
```

**Example**: FY26 revenue by region × category.
```sql
SELECT d.region, p.category, SUM(s.net_value_inr)/1e7 AS revenue_cr
FROM fact_primary_sales s
JOIN dim_distributor d ON s.distributor_id=d.distributor_id
JOIN dim_product p ON s.sku=p.sku
WHERE s.fiscal_year='FY26'
GROUP BY d.region, p.category
ORDER BY d.region, p.category
```

---

## ranking

**When to use**: User wants top-N or bottom-N on some measure. "Top 10 distributors by revenue", "Worst-performing SKUs."

**Shape**:
- N rows (5-20 typically)
- Ordered by the ranking measure
- Includes the entity ID/name plus 1-3 supporting columns

**Specification**:
```
{
  "type": "ranking",
  "tables_needed": [...],
  "filters": {...},
  "measures": ["sum(...) AS revenue_cr"],
  "dimensions": ["distributor_id", "distributor_name"],
  "expected_output_shape": "top 10 rows ordered DESC"
}
```

**Example**: Top 10 distributors by FY26 revenue.
```sql
SELECT d.distributor_id, d.distributor_name, d.tier,
       SUM(s.net_value_inr)/1e7 AS revenue_cr
FROM fact_primary_sales s
JOIN dim_distributor d ON s.distributor_id=d.distributor_id
WHERE s.fiscal_year='FY26'
GROUP BY 1,2,3
ORDER BY revenue_cr DESC
LIMIT 10
```

---

## comparison

**When to use**: User wants a measure compared across two periods or two cohorts. "FY25 vs FY26 revenue", "Performance of new launches vs legacy products."

**Shape**:
- 2 columns at minimum: cohort_a value, cohort_b value, with optional delta and pct_change columns
- Often pivoted into wide format for side-by-side display

**Specification**:
```
{
  "type": "comparison",
  "tables_needed": [...],
  "filters": {...},
  "measures": [
    "sum(case when fy='FY25' then ... end) AS fy25_revenue_cr",
    "sum(case when fy='FY26' then ... end) AS fy26_revenue_cr",
    "fy26 - fy25 AS delta_cr",
    "(fy26/fy25 - 1)*100 AS yoy_pct"
  ],
  "dimensions": ["category"],
  "expected_output_shape": "4 rows (one per BU) with 4 columns"
}
```

**Example**: YoY revenue by category.
```sql
SELECT
  p.category,
  SUM(CASE WHEN s.fiscal_year='FY25' THEN s.net_value_inr ELSE 0 END)/1e7 AS fy25_revenue_cr,
  SUM(CASE WHEN s.fiscal_year='FY26' THEN s.net_value_inr ELSE 0 END)/1e7 AS fy26_revenue_cr,
  (SUM(CASE WHEN s.fiscal_year='FY26' THEN s.net_value_inr ELSE 0 END) /
   SUM(CASE WHEN s.fiscal_year='FY25' THEN s.net_value_inr ELSE 0 END) - 1)*100 AS yoy_pct
FROM fact_primary_sales s
JOIN dim_product p ON s.sku=p.sku
GROUP BY p.category
```

---

## decomposition

**When to use**: User wants a variance or aggregate broken into component drivers. "Why did EBITDA miss budget?" "What's driving the inventory buildup?"

**Shape**:
- 3-6 rows, one per driver component
- Each row has the component name and its contribution amount
- Sum of contributions reconciles to the headline number

**Specification**:
```
{
  "type": "decomposition",
  "tables_needed": [...],
  "filters": {...},
  "measures": [
    "(actual_revenue - budget_revenue) AS revenue_effect_cr",
    "(actual_gm_pct - budget_gm_pct) * budget_revenue AS gm_effect_cr",
    "(budget_opex - actual_opex) AS opex_effect_cr"
  ],
  "dimensions": [],
  "expected_output_shape": "1-row wide table OR 3-row long-format table with effect_name, amount_cr"
}
```

**Example**: Q2 FY26 EBITDA variance bridge.
```sql
WITH agg AS (
  SELECT
    SUM(revenue_inr) AS revenue_actual,
    SUM(revenue_budget_inr) AS revenue_budget,
    SUM(gross_margin_inr) AS gm_actual,
    SUM(opex_inr) AS opex_actual,
    SUM(opex_budget_inr) AS opex_budget
  FROM fact_finance_pl
  WHERE fiscal_year='FY26' AND fiscal_quarter='Q2'
)
SELECT 'Revenue effect' AS effect_name,
       (revenue_actual - revenue_budget)/1e7 AS amount_cr FROM agg
UNION ALL
SELECT 'GM effect',
       ((gm_actual - revenue_actual * (revenue_budget - revenue_actual)/revenue_budget))/1e7 FROM agg
UNION ALL
SELECT 'Opex effect',
       (opex_budget - opex_actual)/1e7 FROM agg
```

---

## correlation

**When to use**: User wants to see relationship between two measures across one dimension. "DSO vs revenue per distributor — who's at risk?", "Discount % vs sell-thru per SKU."

**Shape**:
- 1 categorical dimension (point label) + 2 numeric measures (x and y axes)
- 20-150 rows typically (one point per entity)

**Specification**:
```
{
  "type": "correlation",
  "tables_needed": [...],
  "filters": {...},
  "measures": [
    "sum(...) AS measure_x_cr",
    "avg(...) AS measure_y_days"
  ],
  "dimensions": ["distributor_id", "distributor_name"],
  "expected_output_shape": "150 rows with 3 columns"
}
```

**Example**: Distributor DSO vs revenue.
```sql
SELECT d.distributor_name, d.tier,
       SUM(s.net_value_inr)/1e7 AS revenue_cr,
       AVG(c.actual_payment_days) AS avg_dso_days
FROM fact_primary_sales s
JOIN fact_collections c ON s.transaction_id=c.transaction_id
JOIN dim_distributor d ON s.distributor_id=d.distributor_id
WHERE c.status='Paid'
GROUP BY d.distributor_name, d.tier
```

---

## composite_score

**When to use**: User wants multiple metrics combined per entity to surface multi-dimensional issues. "Which distributors are struggling?" (combines sales, payments, sell-thru). "Best-performing MGOs" (combines visit count, conversion rate, revenue impact).

**Shape**:
- One row per entity
- Multiple metric columns + a derived score or flag

**Specification**:
```
{
  "type": "composite_score",
  "tables_needed": [multiple],
  "filters": {...},
  "measures": [
    "metric_1 AS revenue_yoy_pct",
    "metric_2 AS avg_dso_days",
    "metric_3 AS sell_thru_ratio",
    "CASE WHEN ... AND ... AND ... THEN 'unhealthy' ELSE 'healthy' END AS health_flag"
  ],
  "dimensions": ["distributor_id", "distributor_name"],
  "expected_output_shape": "150 rows; downstream analyses may filter to 'unhealthy' subset"
}
```

**Example**: Distributor health score.
```sql
WITH yoy AS (
  SELECT distributor_id,
         SUM(CASE WHEN fiscal_year='FY25' THEN net_value_inr END) AS fy25_rev,
         SUM(CASE WHEN fiscal_year='FY26' THEN net_value_inr END) AS fy26_rev
  FROM fact_primary_sales
  GROUP BY distributor_id
),
dso AS (
  SELECT distributor_id, AVG(actual_payment_days) AS avg_dso_days
  FROM fact_collections WHERE status='Paid'
  GROUP BY distributor_id
),
sellthru AS (
  SELECT p.distributor_id,
         SUM(s.qty_sold_out) * 1.0 / NULLIF(SUM(p.qty_units), 0) AS sell_thru_ratio
  FROM fact_primary_sales p
  LEFT JOIN fact_secondary_sales s
    ON p.distributor_id=s.distributor_id AND p.sku=s.sku
  WHERE p.fiscal_year='FY26'
  GROUP BY p.distributor_id
)
SELECT
  d.distributor_id, d.distributor_name, d.agri_belt,
  (yoy.fy26_rev/yoy.fy25_rev - 1)*100 AS yoy_pct,
  dso.avg_dso_days,
  sellthru.sell_thru_ratio,
  yoy.fy25_rev/1e7 AS revenue_at_risk_cr,
  CASE
    WHEN (yoy.fy26_rev/yoy.fy25_rev - 1) < -0.10
     AND dso.avg_dso_days > 60
     AND sellthru.sell_thru_ratio < 0.85
    THEN 'unhealthy'
    ELSE 'healthy'
  END AS health_flag
FROM dim_distributor d
LEFT JOIN yoy USING (distributor_id)
LEFT JOIN dso USING (distributor_id)
LEFT JOIN sellthru USING (distributor_id)
ORDER BY revenue_at_risk_cr DESC
```

---

## Pattern selection guide

The Planner should pick the pattern matching the question shape:

| Question shape | Pattern |
|---|---|
| "What is X?" / "How much is X?" | `kpi_lookup` |
| "How has X changed over time?" | `trend` |
| "X by Y" / "X split across Y" | `breakdown` |
| "Top/bottom N" / "Best/worst" | `ranking` |
| "X vs Y" / "this period vs last" | `comparison` |
| "Why did X happen?" / "What drove the variance?" | `decomposition` |
| "Is X correlated with Y?" / "X plotted against Y" | `correlation` |
| "Who's struggling on multiple fronts?" | `composite_score` |

When questions combine multiple shapes (very common), the plan should use multiple patterns. "Which distributors are unhealthy and where are they geographically concentrated?" = `composite_score` + `breakdown`. "Why did EBITDA miss and which BU was worst?" = `kpi_lookup` + `decomposition` + `breakdown`.
