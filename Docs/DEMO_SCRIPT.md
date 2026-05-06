# DEMO_SCRIPT

The five demo questions, with expected agent outputs at each stage. Used as:
1. Test cases during development (`backend/tests/test_demo_e2e.py`)
2. Reference for prompt engineering iterations
3. Pre-cache plans to ensure demo-day reliability (see "Demo robustness" below)

For each question: the user input, the expected interpretation, the expected plan, the expected presentation outline, and the expected narrative content.

---

## Demo Q1 — Performance against plan

**User input**: "How is FY26 closing? Where are we vs plan?"

**Expected Interpreter output**:
```json
{
  "intent_understood": true,
  "interpreted_question": "Show FY26 revenue performance against targets, with assessment of where SFS stands relative to plan and the FY28 ambition.",
  "implicit_assumptions": [
    "Performance = net revenue primarily",
    "vs plan = vs FY26 quarterly/annual targets, plus FY28 ambition for context",
    "'Closing' = full FY26 view including most recent quarter (Q4)"
  ],
  "clarifying_question": null,
  "options_for_user": null
}
```

**Expected Plan**:
- a1: kpi_lookup — FY26 revenue and YoY growth
- a2: comparison — FY25 vs FY26 vs FY28 ambition
- a3: breakdown — quarterly achievement vs target for FY26

**Expected presentation**:
- KPI card: "FY26 Revenue ₹1,554 Cr (+10% YoY)"
- Bar chart: "Revenue trajectory — FY25, FY26, FY28 ambition" (3 bars)
- Bar chart: "FY26 quarterly achievement vs target" (4 bars per quarter)

**Expected narrative tone**:
- Lead with FY26 close (~₹1,554 Cr, ~10% YoY growth)
- Note that FY28 ambition (₹2,400 Cr) requires ~24% CAGR — significant gap
- Mention any quarterly under-achievement
- ~150 words

---

## Demo Q2 — Distributor health

**User input**: "Show me distributors who are buying less, paying late, and selling slow"

**Expected Interpreter output**:
```json
{
  "intent_understood": true,
  "interpreted_question": "Identify distributors who are simultaneously declining in FY26 revenue vs FY25, paying invoices late (high DSO), and showing weak sell-through (inventory not moving), ranked by FY25 revenue at risk.",
  "implicit_assumptions": [
    "'Buying less' = FY26 revenue below FY25",
    "'Paying late' = avg DSO > 60 days",
    "'Selling slow' = sell-thru ratio < 85%",
    "Rank by FY25 revenue (the revenue at risk if these distributors fail)"
  ],
  "clarifying_question": null,
  "options_for_user": null
}
```

**Expected Plan**:
- a1: composite_score — distributor health combining 3 metrics
- a2: breakdown — geographic concentration of unhealthy distributors

**Expected presentation**:
- Table: "Distributors at risk" (top 10 unhealthy, with 4 columns: name, YoY%, DSO, sell-thru)
- Bar chart or stacked bar: "Where are at-risk distributors concentrated?" (by agri_belt)

**Expected narrative tone**:
- Headline: "10-12 distributors flagged across all three risk dimensions, ~₹X Cr revenue at risk"
- Highlight Vidarbha cotton belt concentration
- Note these distributors pay ~25 days slower than healthy peers
- ~150 words

---

## Demo Q3 — Procurement market premium

**User input**: "Are we paying above market on any raw material?"

**Expected Interpreter output**:
```json
{
  "intent_understood": true,
  "interpreted_question": "Compare contracted procurement prices to market spot prices across raw materials, identify where SFS is paying a material premium over market, and quantify the annualized opportunity.",
  "implicit_assumptions": [
    "Material = raw materials with a market reference price (Technical Actives — exclude packaging/tolling)",
    "'Above market' = contracted price > spot price",
    "Quantify opportunity = total value at risk if premium were eliminated"
  ],
  "clarifying_question": null,
  "options_for_user": null
}
```

**Expected Plan**:
- a1: ranking — average premium % by material category in FY26
- a2: trend — for the highest-premium material, premium over time (to confirm it's structural, not a one-off)
- a3: kpi_lookup — annualized spend on the top offender + opportunity size

**Expected presentation**:
- Bar chart: "Procurement premium vs market by material" (6-8 bars, sorted DESC)
- KPI card: "Glyphosate Tech opportunity: ~₹X Cr at full pass-through"
- Optional line chart: "Glyphosate premium over time"

**Expected narrative tone**:
- Lead: Glyphosate Technical at ~9% above market vs ~3% benchmark for other Technical Actives
- Note: structural (consistent across the year), not a spike
- Quantify: ~₹X Cr annualized
- Suggest: renegotiation lever
- ~150 words

---

## Demo Q4 — Regulatory pipeline

**User input**: "What's in our regulatory pipeline?"

**Expected Interpreter output**:
```json
{
  "intent_understood": true,
  "interpreted_question": "Summarize the active regulatory pipeline — molecules in registration across countries — including total revenue uplift in flight, status distribution, and key markets.",
  "implicit_assumptions": [
    "'Pipeline' = registrations not yet commercial (Filed, Under Review)",
    "Already-approved registrations excluded from headline pipeline metric",
    "Highlight Brazil (MAPA) given strategic importance per Bain Project Leap"
  ],
  "clarifying_question": null,
  "options_for_user": null
}
```

**Expected Plan**:
- a1: kpi_lookup — total Y1 revenue uplift in pipeline (Filed + Under Review)
- a2: stacked_bar or breakdown — pipeline by country × status
- a3: ranking — top 5 molecules by Y1 uplift

**Expected presentation**:
- KPI card: "Pipeline value: ₹X Cr Y1 uplift across N molecules"
- Stacked bar: "Pipeline by country and status"
- Table: "Top molecules by potential" (top 5 with country, regulator, status, Y1 uplift)

**Expected narrative tone**:
- Headline: total pipeline Y1 uplift in flight (Filed + Under Review only) ≈ ₹388 Cr across 16 entries; 8 already approved adding ~₹79 Cr
- Brazil/MAPA emphasis: Brazil pipeline (Filed + Under Review) ≈ ₹221 Cr — the single largest country, with seven molecules at MAPA across Approved / Under Review / Filed
- Note: aligns with Project Leap strategic priority
- ~150 words

---

## Demo Q5 — EBITDA variance (the closer)

**User input**: "Why did Q2 FY26 EBITDA miss budget?"

**Expected Interpreter output**:
```json
{
  "intent_understood": true,
  "interpreted_question": "Decompose the Q2 FY26 EBITDA shortfall vs budget into its component drivers (revenue effect, gross margin effect, opex effect) and identify which BU contributed most.",
  "implicit_assumptions": [
    "Q2 = Q2 FY26 (Jul–Sep 2025)",
    "Miss = actual EBITDA below budgeted EBITDA",
    "User wants a variance bridge (decomposition), not just the headline"
  ],
  "clarifying_question": null,
  "options_for_user": null
}
```

**Expected Plan**:
- a1: kpi_lookup — headline EBITDA actual, budget, variance
- a2: decomposition — variance bridge into revenue/GM/opex effects
- a3: breakdown — variance by BU

**Expected presentation**:
- KPI card: "Q2 FY26 EBITDA Variance: -₹36 Cr"
- Bar chart: "Variance bridge — components of the miss"
- Table: "Variance by BU" (4 rows, highlight CCC)

**Expected narrative tone**:
- Lead: "₹16 Cr actual vs ₹52 Cr budget — ₹36 Cr miss"
- Decompose: revenue (~-₹59 Cr) + opex (~-₹12 Cr) - partially offset by COGS savings (~+₹35 Cr); net to GM ~-₹24 Cr (revenue volume effect dominates)
- Identify: CCC drove ~70% of the miss (~-₹25 Cr of the -₹36 Cr); SPN ~-₹9 Cr; Seeds and BulkFert <₹1 Cr each
- Connect: opex bloat at 32% of revenue vs 27% budget; revenue softness possibly linked to channel stuffing in CCC
- ~180 words

---

## End-to-end test cases

Each demo question should have a corresponding pytest case:

```python
# backend/tests/test_demo_e2e.py

import pytest
from backend.pipeline import run_pipeline

DEMO_QUESTIONS = [
    {
        "id": "Q1_fy26_close",
        "question": "How is FY26 closing? Where are we vs plan?",
        "expected_intent_understood": True,
        "min_analyses": 2,
        "max_analyses": 4,
        "must_mention_in_narrative": ["FY26", "₹"],
        "must_have_visual_types": ["kpi_card"],
    },
    # ... etc
]

@pytest.mark.parametrize("case", DEMO_QUESTIONS, ids=lambda c: c["id"])
def test_demo_question(case):
    result = run_pipeline(case["question"])
    assert result.interpretation.intent_understood == case["expected_intent_understood"]
    assert case["min_analyses"] <= len(result.plan.analyses) <= case["max_analyses"]
    for needle in case["must_mention_in_narrative"]:
        assert needle in result.presentation.narrative
    visual_types = {el.type for el in result.presentation.layout}
    for required_type in case["must_have_visual_types"]:
        assert required_type in visual_types
```

These are smoke tests, not exact-match. The narrative wording will vary; the structure should not.

---

## Demo robustness — the pre-cache strategy

For demo day, optionally pre-run each of the 5 questions through Agent 1 and Agent 2 several times beforehand, pick the cleanest interpretation + plan, and hardcode them in a `demo_cache.json` file.

Pipeline logic:
```python
def run_pipeline(question: str) -> WorkflowState:
    cached = lookup_demo_cache(question)
    if cached:
        # Use cached interpretation + plan; still run agents 3 and 4 live
        state.interpretation = cached.interpretation
        state.plan = cached.plan
    else:
        state.interpretation = await interpreter(question)
        state.plan = await analysis_planner(state.interpretation)
    # ... continue with agents 3 and 4 normally
```

Benefits:
- No risk of Agent 2 producing weird plans during the demo
- Latency drops by 3-4 seconds (planner is the heaviest call)
- Off-script questions still work normally

This is **optional**. Only do it after the system works end-to-end on live agents and you're hardening for demo day.

---

## Off-script questions to be ready for

Anand will probably ask follow-ups. Be prepared for these patterns:

1. **Filter / drill-down**: "Now show me just CCC", "Just Q4 instead"
   - Should re-plan from scratch with new filter; conversation history keeps context.

2. **Ranking**: "Who are our best distributors?", "Top SKUs"
   - Should produce a `ranking` analysis with table or bar chart.

3. **Time series**: "How has Glyphosate market price moved?"
   - Should produce a `trend` analysis with line chart.

4. **Comparison**: "How does Vidarbha compare to other belts?"
   - Should produce `comparison` and/or `breakdown` analyses.

5. **Schema-level questions**: "What data do you have on suppliers?"
   - Interpreter should handle these specially — may not need full pipeline, can be answered from schema directly.

6. **Out-of-scope**: "What's the weather in Mumbai?" or "Who is our CEO?"
   - Interpreter should recognize and politely decline. Don't pretend to answer.

The 5 scripted questions cover the analytical patterns; off-script tests breadth. Aim for graceful degradation, not 100% coverage.
