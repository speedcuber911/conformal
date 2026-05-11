# Documentation Index

This repository now contains two distinct surfaces:

- the public Conformal marketing site and journal,
- the older SFS analytics cockpit/demo runtime.

For public-site work, start with:

1. **`Docs/LANDING_PAGE.md`** — Conformal landing page, journal, metadata, RSS, sitemap, and verification notes
2. **`amplify.yml`** — AWS Amplify Hosting build spec for the public site
3. **`.github/workflows/deploy.yml`** — GitHub Actions validation for pushes and pull requests
4. **`README.md`** — local setup and hosting notes

For the analytics cockpit/demo runtime, the legacy documentation below still applies.

---

# SFS Enterprise Chatbot — Demo MVP

AI-powered natural language analytics for Shriram Farm Solutions. Built as a demo for DCM Shriram leadership.

## Quickstart

### Prerequisites

- Python 3.11+
- Node 20+
- AWS credentials with Bedrock Claude access, or an Anthropic API key with
  access to Claude Sonnet 4.6

### Setup

```bash
# 1. Clone and enter
git clone <repo> && cd sfs-chatbot

# 2. Place the dataset
# The synthetic dataset ships as a single workbook with one sheet per table.
# Keep it at:   docs/sfs_demo_dataset.xlsx   (already in the repo)
# The backend loads each sheet into DuckDB at startup; no unzip needed.

# 3. Backend setup
cp .env.example .env
# Default: Bedrock Claude. Edit BEDROCK_MODEL_ID/AWS_REGION for your account.
# Fallback: set LLM_PROVIDER=anthropic and ANTHROPIC_API_KEY=sk-ant-...
pip install -e .

# 4. Frontend setup
cd frontend && npm install && cd ..

# 5. Run
# Terminal 1:
uvicorn backend.main:app --reload --port 8000
# Terminal 2:
cd frontend && npm run dev
# Browser: http://localhost:5173
```

### Quick smoke test

```bash
# Test the pipeline via CLI before involving the frontend
python -m backend.cli "How is FY26 closing?"
```

Should print: interpretation, plan, each analysis result, and final presentation.

## Project structure

See `docs/ARCHITECTURE.md` for the full file layout and design.

```
sfs-chatbot/
├── docs/                       # Architecture, prompts, schema, dataset
│   └── sfs_demo_dataset.xlsx   # 17 tables in one workbook
├── backend/                    # FastAPI + agents + DuckDB
├── frontend/                   # React + Recharts chat UI
└── README.md                   # this file
```

## Documentation

Read in this order:

1. **`docs/PRD.md`** — what we're building and why
2. **`docs/ARCHITECTURE.md`** — system design, agent contracts, file structure
3. **`docs/SCHEMA.md`** — the data model (also injected into agents at runtime)
4. **`docs/AGENT_PROMPTS.md`** — the four agent prompts in detail
5. **`docs/ANALYSIS_PATTERNS.md`** — analysis types Agent 2 picks from
6. **`docs/CHART_RULES.yaml`** — visualization decision rubric
7. **`docs/DEMO_SCRIPT.md`** — the 5 demo questions and expected behavior
8. **`CLAUDE.md`** — meta-instructions for Claude Code (read first if you're using it)

## Status

This is a **demo build**. Hard cap on scope:

- 5 scripted demo questions must work flawlessly
- Reasonable handling of follow-ups and off-script probes
- No production concerns: no auth, no deployment, no observability, no persistence

See `docs/PRD.md` for the full "won't have" list.

## License

Internal. Do not distribute.
