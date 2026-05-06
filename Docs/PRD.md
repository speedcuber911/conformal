# PRD — SFS Enterprise Chatbot (Demo MVP)

## What this is

An AI-powered natural language analytics interface for SFS (Shriram Farm Solutions). Executives type business questions in plain English; the system plans the necessary analyses, queries an internal data warehouse, and returns a multi-modal response combining narrative text, data tables, and charts.

Built specifically to demo to **Anand at DCM Shriram** (owner's son, oversees SFS). Maps to the "Enterprise Chatbot / CEO Cockpit" priority on page 19 of the Bain Project Leap deck (Phase 1 Build).

## Why this matters

Today, answering cross-functional business questions at SFS requires multiple analysts pulling from SAP, Growth Book, the Ariba portal, regulatory trackers, and Excel files — coordinated by the CEO's office over hours or days. This system collapses that loop to seconds. The pitch is not "better dashboards" — it's "an analyst that has read every table and never sleeps."

## Users (for the demo)

One user: **Anand**. Wharton MBA, owner-operator-in-training, analytically literate, will probe the system. Expects:
- Specific answers, not generic ones
- Quantified opportunities, not vague directions
- Clear reasoning, not black-box magic
- Polish — this is being demoed *to* him as a potential mandate

## What "done" looks like for the demo

**The five demo questions in `DEMO_SCRIPT.md` all return**:
1. A coherent narrative (≤ 200 words) with the headline finding up top
2. Appropriately chosen visuals (KPI cards, tables, or charts) that support the narrative
3. Within 15 seconds end-to-end (with progressive UI updates throughout)
4. Without hallucinated numbers — every figure in the response traces to actual SQL output

**Beyond those five**, the system must gracefully handle:
- Off-script questions Anand might ask (it should attempt them; if the data doesn't support an answer, say so honestly)
- Follow-up questions that reference earlier turns ("now break that out by region")
- Ambiguous questions (it should ask for clarification rather than guess wrong)

**Demo-day success criteria:**
- 5/5 scripted questions land cleanly
- ≥ 3/5 unscripted probe questions produce sensible answers
- 0 visible errors, hallucinations, or "I don't know" responses on scripted questions
- The visible reasoning ("Planning 3 analyses…") draws a positive comment from Anand

## Functional requirements

### Must have
- Natural language input via chat UI
- Four-agent plan-then-execute architecture (see ARCHITECTURE.md)
- Multi-chart responses (up to 4 visualizations per answer)
- Streaming narrative output (token-by-token)
- Progressive disclosure UI: shows the plan, then each analysis result, then the final synthesis
- Conversational follow-ups within a session
- Clarification flow when intent is ambiguous

### Nice to have (only if Phase 1-4 finishes early)
- "Why did you pick this chart?" hover tooltips
- Export the response as a shareable HTML snippet
- Dark mode toggle

### Won't have (out of scope for demo)
- User accounts, authentication, multi-tenancy
- Persistent conversation history across sessions
- Production deployment / hosting
- Live data connection (uses static CSVs from `data/` folder)
- Edit / refine queries from the UI
- Save / favorite queries
- Custom dashboards, scheduled reports, alerts
- Email / Slack / Teams integrations
- Mobile responsive layout (desktop only is fine)

## Non-functional requirements

### Performance
- End-to-end latency: 8–15 seconds acceptable for demo (with progressive UI masking the wait)
- First UI update (showing the plan) within 3 seconds
- Streaming narrative starts within 8 seconds

### Reliability
- 100% reliability on the 5 scripted demo questions (validated via end-to-end tests)
- Graceful degradation on novel questions (worst case: clear "I can't answer that" with reason)
- SQL retry on failure (one retry, with the error message fed back to Agent 3)

### Quality
- No hallucinated numbers (every figure in narrative must come from a result row)
- Charts must always render — no blank chart components on screen
- Tables must be readable (paginate if > 20 rows)

### Security / Privacy
- No real customer data — synthetic dataset only
- API keys in `.env`, never committed to repo
- No outbound calls except to Anthropic API and the local DuckDB

## Acceptance criteria — the 5 scripted questions

Each must produce the indicated response shape. See `DEMO_SCRIPT.md` for full expected outputs.

| # | Question | Expected response shape |
|---|---|---|
| 1 | "How is FY26 closing? Where are we vs plan?" | KPI card (FY26 revenue) + bar chart (FY25 vs FY26 vs FY28 ambition) + narrative on the gap |
| 2 | "Show me distributors who are buying less, paying late, and selling slow" | Table of bottom-N distributors with 3 metric columns + narrative highlighting Vidarbha cluster |
| 3 | "Are we paying above market on any raw material?" | Bar chart (premium vs market by material) + narrative quantifying the Glyphosate opportunity |
| 4 | "What's in our regulatory pipeline?" | KPI card (total Y1 uplift) + stacked bar (country × status) + narrative on Brazil/MAPA |
| 5 | "Why did Q2 FY26 EBITDA miss budget?" | KPI card (variance) + bar chart (variance bridge) + table (BU breakdown) + narrative decomposing the miss |

## Build plan

Five phases (see `CLAUDE.md` for ordering). Estimated 40-60 hours total. Solo developer or pair.

After Phase 1 (skeleton): demo can show "the app starts and reads data."
After Phase 3 (CLI integration): demo can show "the agents work end-to-end" via terminal.
After Phase 5 (polish): demo can show "the full experience" to Anand.

If time-constrained, cut from Phase 5 first (polish), then Phase 4 (frontend can be Streamlit instead of React). Phases 1-3 are the real work and cannot be cut.
