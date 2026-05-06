export const sfsModelContext = `
SFS demo data context for the model

Business and time rules
- Company: Shriram Farm Solutions. All money is INR unless the answer explicitly says otherwise.
- Fiscal year is Apr-Mar. FY25 = Apr 2024-Mar 2025; FY26 = Apr 2025-Mar 2026.
- The workbook covers 24 months from Apr 2024 through Mar 2026.
- Treat FY25 net revenue as about Rs 1,410 Cr and FY26 net revenue as about Rs 1,554 Cr.
- Category mix: CCC about 54%, SPN about 25%, Seeds about 13%, BulkFert about 7%.
- FY28 ambition target row is Rs 2,400 Cr.

Schema map
- dim_calendar: day dimension with fiscal year, fiscal quarter, fiscal month, and season.
- dim_geography: district dimension; agri_belt is the useful cluster key.
- dim_employee: ZBM/RBM/TBM/MGO hierarchy; manager_id is self-referencing.
- dim_product: SKU dimension; category is one of CCC, SPN, Seeds, BulkFert.
- dim_distributor: distributor profile with state, region, district, agri_belt, tier, crop context, and assigned TBM/RBM.
- dim_supplier: supplier profile with category, country, and SAP Ariba status.
- dim_competitor: reference table for competitive context only.
- fact_primary_sales: invoice-line primary sales; net_value_inr is booked revenue.
- fact_secondary_sales: monthly distributor x SKU sell-out from Growth Book.
- fact_inventory: monthly distributor x SKU inventory snapshot with FIFO-derived aging.
- fact_targets: fiscal_year x fiscal_quarter x region x category targets, including one FY28 ambition row.
- fact_collections: invoice collections, 1:1 with primary_sales via transaction_id.
- financial_performance: demo monthly SFS P&L table for revenue, EBITDA, budget, and margin time-series questions.
- fact_field_visits: MGO distributor visit events and outcomes.
- fact_commodity_prices: weekly commodity prices, Monday grain.
- fact_procurement: PO-level procurement with contracted price, market spot, premium, and supplier.
- fact_finance_pl: BU x month finance P&L with actual, budget, and variance columns.
- fact_regulatory_pipeline: molecule/country registration pipeline and expected Y1 uplift.

Join rules
- distributor_id connects primary sales, secondary sales, inventory, collections, and visits to dim_distributor.
- sku connects sales and inventory to dim_product.
- mgo_id, assigned_tbm_id, and assigned_rbm_id connect to dim_employee.employee_id.
- dim_employee.manager_id points back to dim_employee.employee_id.
- supplier_id connects fact_procurement to dim_supplier.
- commodity_link in fact_procurement connects to commodity in fact_commodity_prices when commodity_link is not 'N/A'.
- transaction_id joins fact_primary_sales to fact_collections 1:1.
- dim_geography joins through dim_distributor state and district when district-level clusters are needed.

Data quirks and guardrails
- Revenue is not exactly unit price times quantity. Use net_value_inr directly for revenue questions.
- For demo revenue, EBITDA, PBDIT, margin, and budget time-series questions, prefer financial_performance over secondary_sales unless the user explicitly asks for product, region, channel, or dealer sales cuts.
- Outstanding invoices have payment_date = NULL. For closed-loop DSO, filter status = 'Paid'. For aging exposure, use days_overdue.
- The FY28 target row has actual_net_value_inr = NULL. Do not divide by NULL or zero when calculating achievement.
- fact_secondary_sales is monthly, not daily. Do not join it to primary sales at day grain.
- Inventory aging is FIFO-derived. days_aging is age of the oldest unconsumed inflow lot, not today minus snapshot_date.
- Commodity prices are weekly. For PO-level matching, use the week containing the PO date or a monthly average, not exact-day equality.
- Demo data is deterministic. Random seeds are 42 for sales and 7 for the Vidarbha churn sample.
- Not modeled: returns, damages, batch traceability, detailed scheme structure, GST, inter-warehouse transfers, employee attrition, and seed traits.
`;

export const responseContract = `
Response contract
- Be slightly detailed, but still executive-readable.
- Always include two parts:
  1. Insight: the main business implication in 2-4 sentences, with the most important numbers.
  2. Chart observations: 2-3 concise observations describing what the rendered chart(s) show.
- If there is a material risk, anomaly, or management action, close with one direct watch-out or next action.
- Do not narrate tool usage unless the user asks for trace details.
- Do not include demo use-case examples in the prompt context; use them only for QA/golden testing outside the always-on prompt.
`;
