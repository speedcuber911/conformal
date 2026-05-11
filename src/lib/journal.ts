export type JournalCategory =
  | "Engineering"
  | "Architecture"
  | "Strategy"
  | "Evaluations"
  | "Field notes"
  | "Hiring";

export type JournalPost = {
  slug: string;
  category: JournalCategory;
  title: string;
  dek: string;
  readTime: string;
  publishedAt: string;
  sections: Array<{
    heading?: string;
    paragraphs: string[];
  }>;
};

export const journalCategories = [
  "All",
  "Engineering",
  "Architecture",
  "Strategy",
  "Evaluations",
  "Field notes",
  "Hiring",
] as const;

export const posts: JournalPost[] = [
  {
    slug: "why-enterprise-ai-roadmaps-die-at-slide-19",
    category: "Engineering",
    title: "Why most enterprise AI roadmaps die at slide 19",
    dek: "The 47-slide deck specifies an \"Enterprise CEO Chatbot\" on slide 19. Then nothing happens for two years. Here's what we've learned about the gap between strategy and shipping, and the small structural changes that close it.",
    readTime: "7 min",
    publishedAt: "2026-04-12",
    sections: [
      {
        paragraphs: [
          "The AI roadmap usually dies in a very specific place. Not at the strategy offsite, where the room is energized. Not in procurement, where everyone expects delay. It dies after the deck has identified a real executive problem, named an ambitious product, and then handed the next step to a committee that is structurally unable to ship software.",
          "Slide 19 is the common shape of that moment. The problem is right. The proposed agent is right. The operating model around it is wrong. The company treats the idea like an IT program, a data-governance program, a change-management program, and a procurement event all at once. By the time each function has added its concern, the useful thing has become too heavy to move.",
        ],
      },
      {
        heading: "The roadmap is not the work",
        paragraphs: [
          "A roadmap is useful when it changes sequencing. It is dangerous when it becomes a substitute for contact with reality. Enterprise AI work has too many unknowns for a two-year plan to be more than a hypothesis. You do not know which system has the useful grain of truth. You do not know which executive question is narrow enough to answer. You do not know whether the model will fail because of reasoning, retrieval, permissions, stale data, or the way one column is named in an old ERP export.",
          "Those are not strategy questions. They are discovery questions that only working software can answer. A team has to connect to real systems, write the first bad queries, watch the agent misunderstand the business vocabulary, and then tighten the loop. The organizations that win treat the first six weeks as instrumentation, not implementation theater.",
        ],
      },
      {
        heading: "The smallest production path wins",
        paragraphs: [
          "The fix is not a bigger transformation office. The fix is a smaller delivery surface. Pick one decision with an accountable owner, one data domain, one production environment, and one weekly review. If the CFO owns working-capital variance, build for that. If procurement owns a should-cost view for a specific category, build for that. Do not begin with an enterprise assistant that promises to answer everything. That assistant will answer nothing well enough to matter.",
          "The first product should be embarrassingly concrete. It should have a named user, a recurring decision, and a before-and-after time cost. It should be reviewed by the person who will use it, not by a steering committee reading screenshots. Every week should end with a live demo against live data. If the demo cannot run, the problem is not communications. The product is not ready.",
        ],
      },
      {
        heading: "Governance needs evidence",
        paragraphs: [
          "Large companies are right to be cautious. The mistake is trying to resolve caution through policy before the system exists. Security, legal, finance, and technology leaders need evidence: what data leaves the network, what the model sees, which tools the agent can call, how permissions are enforced, what gets logged, and how bad answers are detected. A deck can describe those controls. A trace can prove them.",
          "This is why the first agent should ship with auditability as a product feature, not a compliance afterthought. The trace rail, SQL preview, tool-call history, cost ledger, and answer provenance are what turn a clever demo into something a serious buyer can defend. When those artifacts exist, governance meetings become specific. Without them, every meeting reverts to abstract anxiety.",
        ],
      },
      {
        heading: "Close the gap by changing the unit",
        paragraphs: [
          "The unit of progress in enterprise AI should not be the roadmap milestone. It should be the production decision replaced. One decision shipped creates a new organizational memory: legal learns the contract shape, security learns the deployment pattern, engineering learns the data interface, and leadership learns what real AI work feels like. The second decision is faster because the first one created muscle.",
          "That is the structural change that closes the gap. Stop funding AI as a portfolio of ideas. Fund it as a sequence of shipped decisions. Keep the team small enough to move, senior enough to decide, and close enough to the user that the product cannot hide behind ceremony. Slide 19 does not have to die. It just has to become a backlog item by Monday morning.",
          "The companies that make this shift tend to look less ambitious from a distance and more dangerous up close. They stop announcing generic AI programs and start retiring specific old rituals: the manual variance bridge, the weekly exception email, the analyst who reconciles three systems before every review. That is what progress looks like when it is real. Fewer slogans, fewer committees, more decisions that no longer depend on institutional heroics.",
        ],
      },
    ],
  },
  {
    slug: "the-agent-writes-the-sql-the-system-around-it-does-the-hard-work",
    category: "Architecture",
    title: "The agent writes the SQL. The system around it does the hard work.",
    dek: "Composable schema documentation, deterministic retries, the right way to stream tool-use traces. A field guide to the supporting cast around every production agent, and why getting it right matters more than which model you choose.",
    readTime: "11 min",
    publishedAt: "2026-03-28",
    sections: [
      {
        paragraphs: [
          "The demo version of an analytics agent is simple. The user asks a question, the model writes SQL, the database returns rows, and a chart appears. The production version is not simple. The production version survives bad column names, ambiguous business terms, stale extracts, partial permissions, slow warehouses, malformed dates, retries, timeouts, and the CFO asking the same question three different ways in the same meeting.",
          "The model is visible, so it gets the credit. The system around it does most of the work. Good agent architecture is the discipline of making the model's job small, observable, and recoverable. When that discipline is missing, even a frontier model produces expensive nonsense.",
        ],
      },
      {
        heading: "Schema documentation is an interface",
        paragraphs: [
          "Most companies treat schema documentation as a compliance artifact. For an agent, it is executable context. The agent does not need a data dictionary that says `cust_cd` means customer code. It needs a composable description of which table represents active customers, which date defines revenue recognition, why one sales table excludes returns, and when the finance team prefers management geography over statutory geography.",
          "We write schema documentation like product copy for a very literal user. Each table gets purpose, grain, joins, traps, examples, and allowed questions. Each metric gets a business definition and a few shots that show the expected shape of the query. This is not glamorous work. It is the difference between a system that sounds confident and a system that can be trusted.",
        ],
      },
      {
        heading: "Retries should be boring",
        paragraphs: [
          "Agents fail in predictable ways. A generated query references a column that exists in a different environment. A join multiplies revenue by customer count. A date parser treats fiscal year as calendar year. A warehouse times out because the model forgot a filter. The wrong response is to ask the model to try again with no structure. That turns failures into improvisation.",
          "Production agents need deterministic repair loops. Validate SQL before execution. Parse database errors into typed failure reasons. Give the model the smallest useful correction, not the entire transcript. Cap retries. Preserve failed attempts in the trace. If a query returns an impossible row count or a metric outside an expected range, force a second pass before showing the answer. The model should be creative in composition, not in error handling.",
        ],
      },
      {
        heading: "The trace is the product",
        paragraphs: [
          "Executives do not need to read every query, but they need to know the query exists. The system should stream what it is doing: reading schema, selecting tables, writing SQL, executing, validating, summarizing, rendering. Each step should have time, cost, inputs, and outputs. A user should be able to expand the trace after a surprising answer and see the path from question to result.",
          "This changes the psychology of the product. The answer is no longer a black box presented with theatrical confidence. It is a working object with a trail. The user can disagree with the SQL, correct the business definition, or pin the output to a board pack with evidence attached. Trust comes from auditability, not from anthropomorphic polish.",
        ],
      },
      {
        heading: "Model choice matters less than the contract",
        paragraphs: [
          "There are real differences between model providers. Some reason better over long schemas. Some are cheaper for high-volume background work. Some fit a company's security posture more cleanly. But the largest quality gains usually come before model selection: narrowing the tool contract, shaping the schema context, adding evals, streaming traces, and defining what the agent must refuse to answer.",
          "A good architecture lets the model be replaced. The prompts, schemas, evals, tools, and traces should survive a provider switch. That is what model neutrality means in practice. You are not neutral because you put four logos on a slide. You are neutral because the system's center of gravity is the business contract, not the vendor API.",
        ],
      },
      {
        heading: "Build the boring parts first",
        paragraphs: [
          "The safest order is backward from the boardroom. Start with the answer format and audit trail a senior reader would accept. Then define the eval cases that would make the answer defensible. Then shape the tools and schema context that can produce that answer. Only then ask the model to write SQL.",
          "This makes the agent less magical and more useful. It also makes it easier to operate. When something goes wrong, the team can see whether the failure came from intent parsing, table selection, query generation, execution, validation, or summarization. Production AI is not won by making the model feel smarter. It is won by making the surrounding system impossible to fool casually.",
        ],
      },
    ],
  },
  {
    slug: "ai-strategy-is-an-oxymoron-pick-a-decision-instead",
    category: "Strategy",
    title: "\"AI strategy\" is an oxymoron. Pick a decision instead.",
    dek: "The thirty most successful enterprise AI rollouts of the last eighteen months have one thing in common: they replaced a specific human decision, not a generic workflow. How to find the decision worth attacking, and the four signs you've picked the wrong one.",
    readTime: "9 min",
    publishedAt: "2026-03-15",
    sections: [
      {
        paragraphs: [
          "AI strategy sounds responsible. It is usually a way to avoid choosing. The phrase lets a company discuss capability, governance, vendors, architecture, literacy, and risk without naming the decision that will be different after the money is spent. That is why so many programs feel busy and produce so little operational change.",
          "A useful AI program starts with a sentence a human currently has to own: approve this credit exception, explain this margin variance, decide whether to renegotiate this supplier, prioritize these regulatory alerts, recommend which plant constraint to attack next. The narrower the decision, the more likely the agent can be made real.",
        ],
      },
      {
        heading: "Workflows are too soft",
        paragraphs: [
          "Enterprises love the word workflow because it feels operational. For AI work, it is often too soft. A workflow contains many decisions, handoffs, exceptions, and political compromises. If you try to automate the workflow, you inherit all of that ambiguity at once. The agent becomes responsible for everything and accountable for nothing.",
          "A decision has a sharper edge. It has an owner, an input set, a cadence, a cost of delay, and a standard for a good answer. You can evaluate whether the agent improved it. You can tell whether the human would have acted differently. You can decide whether production use is justified. That clarity is why decision-first AI moves faster.",
        ],
      },
      {
        heading: "How to find the right decision",
        paragraphs: [
          "Start with meetings, not systems. Ask senior operators where they spend time reconciling facts before they can exercise judgment. Listen for phrases like \"we wait for finance,\" \"only one person knows,\" \"we pull this manually,\" \"the board asks this every quarter,\" or \"by the time we know, it is too late.\" Those phrases point to decisions with latency.",
          "Then test for repeatability. The decision should recur often enough to matter, but not so often that it is already solved by a transactional system. It should require synthesis across sources, not just retrieval from one table. It should have a senior owner who is annoyed enough to review a rough product weekly. Most importantly, it should be possible to answer with the data that exists or can be made reachable within days.",
        ],
      },
      {
        heading: "Four signs you picked wrong",
        paragraphs: [
          "The first sign is that nobody can say what a better decision would change. If the proposed agent saves time but does not affect money, risk, speed, or accountability, it is probably internal theater. The second sign is that the user is a committee. Committees can sponsor an agent, but they cannot shape one. You need a person with taste, urgency, and authority.",
          "The third sign is that the data problem is actually a master-data program in disguise. Some cleanup is normal. A twelve-month foundation project is not a six-week agent. The fourth sign is that the agent needs to be universally correct on day one. Good first agents have a useful failure envelope. They can refuse, flag uncertainty, or route to a human without breaking the business.",
        ],
      },
      {
        heading: "Strategy emerges after use",
        paragraphs: [
          "Once the first decision ships, the real strategy becomes visible. The company learns which controls procurement accepts, which data contracts are reusable, which model provider fits the security envelope, which engineering team can own the next product, and which executives will actually use an agent when the novelty fades. That evidence is more valuable than any outside-in maturity model.",
          "This is not anti-strategy. It is anti-premature abstraction. Pick a decision, ship an agent, instrument the result, and let the roadmap earn its shape. The companies that do this will look less strategic in the first month and much more capable by the second quarter.",
          "The same logic applies to funding. A decision-first program can be financed in short, accountable increments because each release has a business owner and a measurable operating change. The budget conversation moves from \"how much should we spend on AI\" to \"what is it worth to improve this decision by Friday.\" That framing is uncomfortable because it removes the romance from transformation. It is also why it works. It forces leadership to price the pain, name the user, and accept that strategy without shipped judgment is only corporate literature.",
          "Once that habit forms, the enterprise stops asking for AI ideas and starts asking for decisions with owners. That is the culture change people were trying to buy with the original strategy.",
        ],
      },
    ],
  },
  {
    slug: "building-evals-youd-actually-show-a-board",
    category: "Evaluations",
    title: "Building evals you'd actually show a board",
    dek: "\"Accuracy\" is the wrong metric for an executive agent. We walk through the evaluation harness we use for production CFO and procurement agents, the gold-set methodology behind it, and the kinds of failure modes generic benchmarks completely miss.",
    readTime: "14 min",
    publishedAt: "2026-03-02",
    sections: [
      {
        paragraphs: [
          "A board does not care that your agent scored 87 percent on a generic benchmark. It cares whether the system can answer the ten questions that change a meeting. It cares whether a wrong answer is detectable. It cares whether the product knows when to stop. That makes evaluation less like an exam and more like a control system.",
          "The word accuracy hides too much. An executive agent can retrieve the correct number and still be wrong because it used the wrong fiscal period. It can write valid SQL and still be wrong because the business definition changed after a reorg. It can summarize correctly and still be dangerous because it omits the caveat that should have changed the decision.",
        ],
      },
      {
        heading: "Gold sets need owners",
        paragraphs: [
          "The first mistake is letting engineers invent the test set alone. Engineers are good at edge cases in code. Business owners are good at edge cases in meaning. A useful gold set is built with the person who owns the decision. For a finance agent, that means actual variance questions from recent reviews, including the awkward ones. For procurement, it means the supplier and commodity questions that expose whether the system understands category logic.",
          "Each case needs an expected answer, the reasoning path a good analyst would take, acceptable variance, required caveats, and known traps. We also record the source systems and the date of extraction. Without that, teams argue about whether the agent failed or whether the ground truth moved. Evaluation data is production data with a chain of custody.",
        ],
      },
      {
        heading: "Grade the trace, not just the answer",
        paragraphs: [
          "The trace reveals failures the final answer conceals. Did the agent choose the right tables? Did it filter the right period? Did it join at the right grain? Did it call the retrieval tool before summarizing a policy? Did it notice that a region changed names? A final-number comparison will miss many of these errors until the one time they matter.",
          "We grade answers in layers: intent, source selection, tool use, query validity, business definition, numerical result, narrative quality, and refusal behavior. This looks heavier than a single score, but it makes improvement faster. If source selection is weak, prompt tuning the final summary is wasted effort. If refusal behavior is weak, higher answer accuracy can make the system more dangerous.",
        ],
      },
      {
        heading: "Use adversarial normal questions",
        paragraphs: [
          "The best eval cases are not trick prompts. They are normal executive questions with hidden ambiguity. \"Why is EBITDA down in the north region?\" might require excluding one-time freight costs, mapping two legacy region names, and comparing against budget rather than last year. A generic model benchmark will not contain that failure mode. Your company will.",
          "We include stale-data cases, permission-boundary cases, missing-source cases, and cases where the right response is a clarifying question. We also include repeated questions phrased differently, because production users do not preserve prompt templates. The agent has to be robust to human language, not just to the one sentence used in a demo.",
        ],
      },
      {
        heading: "A board-ready eval is explainable",
        paragraphs: [
          "The final artifact should be legible to a non-technical governance audience. It should show the case set, pass criteria, failure examples, severity bands, unresolved risks, and the human fallback. It should include traces for representative passes and failures. It should say where the system is allowed to operate and where it is not.",
          "This creates a healthier conversation. Instead of asking whether AI is accurate, leaders can ask whether the product is accurate enough for a defined decision under defined controls. That is the standard real software has always had to meet. Agents do not deserve a looser one because they speak in complete sentences.",
          "A good eval report also creates a maintenance contract. It says which cases must be rerun after schema changes, prompt changes, model upgrades, permission changes, and new data sources. Without that contract, quality silently decays. The board should not be shown a one-time score; it should be shown the machinery that keeps the score meaningful. In production, evaluation is not a launch artifact. It is the product's immune system.",
          "This is why evals belong in the operating rhythm, not in a research appendix. Every serious release should carry its own evidence packet. If the packet is thin, the release is not serious yet.",
          "Boards understand that language because it looks like control, not optimism or theater.",
        ],
      },
    ],
  },
  {
    slug: "what-60-hours-of-cfo-interviews-taught-us-about-variance-bridges",
    category: "Field notes",
    title: "What 60 hours of CFO interviews taught us about variance bridges",
    dek: "Before building a finance agent, we spent two months in the seats of the people who'd use it. The themes that emerged, and the ways they shaped the eventual product, are the most repeatable part of our process.",
    readTime: "6 min",
    publishedAt: "2026-02-19",
    sections: [
      {
        paragraphs: [
          "Variance bridges look like reporting. They are actually organizational memory. A CFO asks why margin moved, and the answer may pass through sales mix, plant utilization, freight, rebates, raw-material indices, channel inventory, one large customer, and a spreadsheet maintained by somebody who has been in the company for seventeen years. The bridge is not a chart. It is a negotiation over causality.",
          "We spent 60 hours interviewing finance leaders, business controllers, sales heads, planning teams, and analysts before writing the first production agent. The surprising part was not that the data was messy. It was that the mess had structure. The same five themes appeared in nearly every conversation.",
        ],
      },
      {
        heading: "The first answer is rarely the useful answer",
        paragraphs: [
          "Most systems can tell you that revenue is down or gross margin is lower. The useful question is why, and the useful answer is almost always a decomposition. Price, volume, mix, currency, freight, discounting, and one-offs need to be separated before a leader can act. A single generated paragraph is not enough. The product has to help the user walk the bridge.",
          "That shaped the interface. We stopped treating the agent answer as a final summary and started treating it as an interactive path. The agent produces the first bridge, then lets the CFO open a driver, inspect the query, change the comparison period, or exclude a one-time item. The conversation is the control surface for analysis.",
        ],
      },
      {
        heading: "People trust familiar imperfections",
        paragraphs: [
          "Finance teams did not expect perfect data. They expected the system to understand the imperfections they already manage. They wanted to know whether the agent used provisional numbers, whether a plant had posted late, whether intercompany eliminations were included, and whether the sales hierarchy matched the latest management view. These caveats were not clutter. They were credibility.",
          "So the agent learned to surface caveats early. If data was incomplete, the answer said so before the conclusion. If two sources disagreed, the trace showed both and identified the system of record chosen for the answer. This made the product feel less magical and more finance-native.",
        ],
      },
      {
        heading: "The real user is the meeting",
        paragraphs: [
          "A CFO rarely uses a variance bridge alone. The answer travels into a review, a board pack, a WhatsApp thread, or a call with a business head. That means the product has to produce durable artifacts, not just chat responses. Users wanted a chart they could pin, a paragraph they could paste, and a trace they could defend if challenged.",
          "We added saved views, timestamped traces, and short executive summaries because the meeting demanded them. The best agent interfaces understand where the answer goes next. If the product ends at the chat bubble, it stops one step before the work is done.",
        ],
      },
      {
        heading: "Interviews are architecture",
        paragraphs: [
          "The interviews changed table selection, metric definitions, evaluation cases, and UI hierarchy. They also changed the contract. We narrowed the first release to a smaller set of variance questions because those were the ones with a clear owner and recurring pain. That narrowing made the system more valuable, not less.",
          "This is the repeatable lesson. Before building an executive agent, sit in the decision long enough to hear the vocabulary, shortcuts, and anxieties. The software architecture will be better because the product team will know which imperfections matter and which can wait.",
          "The most useful interview question was rarely technical. It was: \"What would make you not trust this answer in a meeting?\" That question surfaced stale snapshots, management overrides, unofficial product groupings, plants that posted late, and one-off adjustments that never appeared in clean documentation. Those details became product requirements. They told us where the agent needed to caveat, where the trace needed to be visible, and where a human review step was not negotiable. The interviews did not delay engineering. They prevented us from engineering the wrong certainty.",
          "It also changed who needed to be in the room. The obvious users were finance leaders. The hidden users were the analysts who knew which spreadsheet was unofficially authoritative, the plant controller who understood late postings, and the sales operator who could explain why one customer should be excluded from a comparison. Without them, the agent would have reproduced the official process and missed the working process. Variance bridges are built from numbers, but they are trusted because the organization recognizes its own judgment inside them.",
          "That recognition is the difference between adoption and polite applause.",
        ],
      },
    ],
  },
  {
    slug: "duckdb-wasm-in-the-browser-is-an-underrated-production-pattern",
    category: "Engineering",
    title: "DuckDB-WASM in the browser is an underrated production pattern",
    dek: "Why we run analytics in the user's tab instead of on a backend, when this pattern fails, and the specific class of executive-agent UI it unlocks.",
    readTime: "8 min",
    publishedAt: "2026-02-05",
    sections: [
      {
        paragraphs: [
          "Running analytics in the browser sounds like a demo trick until you put it in front of an executive team with sensitive data, unpredictable questions, and a strong dislike of waiting. DuckDB-WASM changes the shape of that conversation. It lets the product ship a compact analytical model to the user's tab, execute real SQL locally, and keep many interactions off the backend path entirely.",
          "This is not a universal pattern. It is a very good pattern for a specific class of executive-agent UI: small to medium analytical datasets, repeated slicing, high sensitivity, low tolerance for latency, and a need for explainable transformations. Used there, it makes the product feel faster and safer at the same time.",
        ],
      },
      {
        heading: "Latency changes behavior",
        paragraphs: [
          "Executives ask better questions when the product answers quickly. If every follow-up has to cross an API boundary, hit a warehouse, wait behind other jobs, and return a new payload, the interaction becomes formal. The user asks one big question and waits. Local analytical execution encourages smaller moves: change the period, exclude one segment, split by channel, test a driver, compare against budget.",
          "That rhythm matters for agents. The model can propose a view, but the human needs to interrogate it. DuckDB-WASM lets the interface support that interrogation without turning every click into a backend event. The system feels less like a report generator and more like a working desk.",
        ],
      },
      {
        heading: "Privacy is simpler when data does not move",
        paragraphs: [
          "Browser-side analytics does not remove the need for security review. It does reduce the number of moving parts. If a curated dataset is already authorized for a user, the tab can perform many transformations without sending additional granular queries to an application server. The backend can focus on packaging, permissions, lineage, and refresh rather than being the execution point for every slice.",
          "This is especially useful when the model is not allowed to see raw rows. The agent can generate a plan or SQL over a constrained local model, the browser can execute, and the trace can record the transformation. Sensitive details remain inside the user's session boundary. The architecture is easier to explain than a chain of opaque services.",
        ],
      },
      {
        heading: "Where the pattern fails",
        paragraphs: [
          "DuckDB-WASM is not a warehouse replacement. It fails when the dataset is too large, when freshness must be real-time, when permissions require row-level checks on every query, or when the transformation depends on private backend systems. It also fails if the team treats local execution as an excuse to skip lineage. A fast wrong answer is still wrong.",
          "The right split is deliberate. Use the backend to prepare governed extracts, sign access, enforce entitlement, and record durable events. Use the browser for local exploration over the authorized analytical slice. If a question exceeds the slice, the agent should say so and escalate to a backend tool rather than pretending the local model contains the world.",
        ],
      },
      {
        heading: "The UI it unlocks",
        paragraphs: [
          "The best use case is an executive cockpit where the first answer is generated, but the next ten interactions are human-driven. The user can pivot, filter, group, and inspect without waiting. The agent can write SQL that is visible and editable. The chart can update immediately. The trace can show which transformations happened locally and which required a remote tool.",
          "That combination is more credible than a pure chat interface. It gives the senior user agency. It also gives engineering a clean contract: curated data in, local analytical model, visible SQL, pinned artifacts out. Sometimes the most serious AI product decision is not which model to call. It is where the query should run.",
          "The pattern also changes cost behavior. Many executive sessions involve repeated slicing of the same authorized dataset. Sending every small follow-up through a remote analytical service wastes latency and infrastructure. Local execution lets the expensive parts happen once: permissioning, extract preparation, lineage, and delivery. After that, the user's tab can support fast exploration while the backend records the durable moments that matter. It is not cheaper because it is clever. It is cheaper because the architecture matches the shape of the work.",
          "That fit is the whole argument. Browser analytics should not be used to show off. It should be used when the product needs fast, governed, inspectable movement over a bounded slice of enterprise truth.",
          "When the slice is wrong, do not force the pattern.",
        ],
      },
    ],
  },
  {
    slug: "we-do-live-engineering-interviews-heres-the-prompt",
    category: "Hiring",
    title: "We do live engineering interviews. Here's the prompt.",
    dek: "No take-homes, no whiteboard puzzles. The 90-minute exercise we run with every engineering candidate, and what we're actually looking for inside it.",
    readTime: "5 min",
    publishedAt: "2026-01-22",
    sections: [
      {
        paragraphs: [
          "We do not use take-home projects. They select for free time, tolerance for ambiguity without feedback, and willingness to perform unpaid labor. We do not use whiteboard puzzles either. They select for a kind of rehearsed cleverness that has very little to do with building enterprise AI products under messy constraints.",
          "Our engineering interview is live, practical, and intentionally small. The candidate gets 90 minutes, a tiny codebase, a failing agent workflow, and a senior engineer in the room. The goal is not to finish everything. The goal is to see how the person thinks when the problem is real enough to have texture.",
        ],
      },
      {
        heading: "The prompt",
        paragraphs: [
          "The exercise starts with a simple product: a user asks a business question, an agent chooses a tool, a query runs against a local dataset, and the UI shows an answer with a trace. One part is broken. The schema docs are incomplete, the query fails on a fiscal-year edge case, the trace hides the useful error, or the UI makes an unsafe answer look definitive.",
          "We ask the candidate to make the workflow production-friendlier. They can improve the prompt, change the tool contract, add validation, adjust the UI, or write a test. We deliberately avoid a single correct path. In real work, the hard part is not knowing that a bug exists. It is deciding which layer should own the fix.",
        ],
      },
      {
        heading: "What we look for",
        paragraphs: [
          "The strongest candidates slow down for the right reasons. They inspect the trace before editing. They ask what the user is trying to decide. They make the smallest change that improves the system. They name the residual risk. They do not hide uncertainty behind confident code. They can explain why a fix belongs in schema context rather than in the final answer prompt.",
          "We also watch how they use the person in the room. Good pair engineers narrate trade-offs without turning the interview into a monologue. They are comfortable saying, \"I think the product risk is here,\" or \"I can patch this, but I would rather move the boundary.\" That judgment matters more than typing speed.",
        ],
      },
      {
        heading: "What we do not reward",
        paragraphs: [
          "We do not reward framework trivia. We do not reward building a large abstraction in a small exercise. We do not reward silently rewriting the app because the existing code is not how the candidate would have started. Client work often begins inside systems you would not have designed. Taste includes knowing when to leave a working thing alone.",
          "We also do not reward fake certainty about AI. A candidate who says the model will handle it is usually less useful than one who adds a guardrail. Production agents need people who respect failure modes. The model is part of the system, not an excuse to stop engineering.",
        ],
      },
      {
        heading: "Why live is fairer",
        paragraphs: [
          "A live interview lets us help when the setup is confusing, clarify the business context, and see how someone responds to new information. It is closer to the work. Our projects happen in small senior teams, with clients asking sharper questions every week. The interview should resemble that environment enough to be predictive.",
          "The best hires leave the exercise with code that is not perfect and a conversation that is excellent. They have improved the product, explained the next step, and shown that they can operate in ambiguity without making the system more complex than the problem deserves. That is the job.",
          "We tell candidates the same thing we tell ourselves on client work: the goal is not to look smart in isolation. The goal is to make the system better while other people can still understand it. That means naming trade-offs, leaving a useful test or trace, and resisting the urge to make a local fix that creates a global mess. In ninety minutes, you can see whether someone has that instinct. You can also see whether they enjoy the kind of precise, unglamorous work that makes agents reliable.",
          "The prompt keeps us honest as interviewers too. If we cannot explain why a change matters to a user, it is not a good interview signal. If the exercise rewards theatrics, the prompt is wrong. Hiring for this work should look like the work itself.",
          "That standard makes the interview calmer, harder, and more predictive than performance alone in practice.",
        ],
      },
    ],
  },
  {
    slug: "the-ceo-chatbot-is-a-category-not-a-feature",
    category: "Strategy",
    title: "The CEO chatbot is a category, not a feature",
    dek: "Every large enterprise will have one in three years. The question isn't whether. It is who owns it inside the company, and what shape it takes. A framework.",
    readTime: "10 min",
    publishedAt: "2026-01-08",
    sections: [
      {
        paragraphs: [
          "Every large enterprise will have a CEO chatbot. The name will vary. It may be called an executive cockpit, decision agent, enterprise brain, command center, or something more tasteful. The category is the same: a natural-language product that lets the senior team ask cross-functional questions and receive answers grounded in the company's operating data.",
          "This is not a feature inside business intelligence. It is not a chatbot bolted onto the intranet. It is a new executive application category. The companies that understand that will build ownership, controls, and product muscle around it. The companies that treat it as a demo will end up with another search box nobody trusts.",
        ],
      },
      {
        heading: "Why it becomes inevitable",
        paragraphs: [
          "The CEO's questions do not respect system boundaries. Why did margin move? Which customers are slowing orders? Which plants are capacity constrained? Which suppliers create risk if a port closes? Which hiring plan is now inconsistent with demand? These questions cut across ERP, CRM, planning tools, spreadsheets, documents, and human memory.",
          "Traditional dashboards answer the questions a team predicted in advance. Executive agents answer the question that emerged in the meeting. That does not make dashboards obsolete. It changes their role. Dashboards become stable operating surfaces. Agents become the investigative layer that composes the next view when the dashboard is not enough.",
        ],
      },
      {
        heading: "Ownership is the hard question",
        paragraphs: [
          "If technology owns the product alone, it risks becoming a platform exercise. If strategy owns it alone, it risks becoming a theater piece. If finance owns it alone, it may answer only financial questions. The right owner is usually a small cross-functional group with one executive sponsor, one technical owner, and one business owner for the first decision domain.",
          "The first version should not attempt to represent the whole company. It should earn trust in one executive loop, then expand. A CEO chatbot that begins with everything creates an impossible permission model and an impossible eval set. A CEO chatbot that begins with working-capital variance, dealer risk, regulatory exposure, or procurement should-cost can become real.",
        ],
      },
      {
        heading: "Shape matters",
        paragraphs: [
          "The product should not be a naked chat window. Senior users need artifacts: charts, tables, pinned answers, board-pack snippets, source links, and traces. They need to see what the agent did and save the result when it matters. The interface should make the answer inspectable, not merely conversational.",
          "The system also needs memory, but not the theatrical kind. It should remember definitions, pinned views, recurring questions, and user corrections. It should not pretend to have human intimacy with the CEO. Enterprise memory is a governance object. It needs versioning, permissions, and rollback.",
        ],
      },
      {
        heading: "A framework for the first build",
        paragraphs: [
          "Start with one executive question that recurs in a meeting with money attached. Identify the source systems, the system of record for each metric, the caveats a good analyst would include, and the failure modes that would embarrass the sponsor. Build the agent around that. Ship it with trace visibility, query inspection, eval cases, and a human fallback.",
          "Then expand by adjacency. If the first agent explains sales variance, the next might decompose channel inventory. If it spots supplier risk, the next might recommend negotiation posture. Each expansion should reuse the same controls while adding a new decision. That is how the category becomes infrastructure instead of a novelty.",
        ],
      },
      {
        heading: "The category will be judged by trust",
        paragraphs: [
          "The winning products will not be the ones with the friendliest voice. They will be the ones leaders can challenge. They will show sources, expose reasoning, admit uncertainty, and make it easy for a human to correct the business definition. The CEO chatbot is a category because the executive operating model is changing. It deserves software built with that seriousness.",
          "In three years, asking whether a company should have one will sound like asking whether it should have a data warehouse. The better question is whether the product will be owned by people who understand both the decision and the system. That choice starts now.",
          "The mistake will be to let the category be defined by generic assistants. A serious executive agent is closer to an operating system for judgment than a convenience layer for search. It carries definitions, permissions, lineage, evaluation, and the memory of prior decisions. That is why ownership matters so much. Whoever owns the first credible version will shape how the enterprise learns to ask questions of itself.",
          "That lesson compounds.",
        ],
      },
    ],
  },
];

export function getPost(slug: string) {
  return posts.find((post) => post.slug === slug);
}

export function formatPostDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function getRelatedPosts(slug: string, limit = 3) {
  const current = getPost(slug);
  const sameCategory = current
    ? posts.filter((post) => post.slug !== slug && post.category === current.category)
    : [];
  const others = posts.filter((post) => post.slug !== slug && post.category !== current?.category);

  return [...sameCategory, ...others].slice(0, limit);
}

export function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}
