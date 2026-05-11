import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Engagement } from "./Engagement";

const engagements = [
  {
    sector: "Industrial conglomerate",
    context: "₹12,000+ Cr revenue\n130 years old",
    status: "CEO decision cockpit · live",
    headline: "A natural-language agent for the executive committee",
    body: "A top-three strategy consultancy wrote a 27-slide digital transformation roadmap. Slide 19 specified an \"Enterprise CEO Chatbot.\" We built it: an agent that writes its own SQL across eight business systems, composes a fresh visualization per question, and answers cross-functional leadership queries in under seven seconds. Now in production for the executive committee and the office of the CFO.",
    tags: ["Agentic SQL", "8 data sources", "11 weeks to production"],
  },
  {
    sector: "Pharmaceutical manufacturer",
    context: "Top 10 in India\nAPI exporter",
    status: "Regulatory intelligence agent · in production",
    headline: "Watching 14 regulators across four continents",
    body: "A regulatory affairs team was tracking USFDA, EMA, CDSCO, ANVISA, and 10 other authorities by hand. We built an agent that monitors regulator websites, ingests filings, classifies relevance against the company's product pipeline, and drafts an executive brief every Monday. Saved an estimated 60 person-hours per week in the first quarter.",
    tags: ["Multi-source ingest", "14 regulators", "9 weeks"],
  },
  {
    sector: "Specialty chemicals",
    context: "₹4,500 Cr revenue\nListed on NSE",
    status: "Procurement copilot · live",
    headline: "Should-cost modeling for 320 raw materials",
    body: "A category team was negotiating quarterly contracts on intuition. We built a should-cost engine that combines commodity indices, historical purchases, supplier financial filings, and shipping data into a per-SKU recommended price. The first month of contract renegotiations recovered the engagement fee.",
    tags: ["Should-cost modeling", "320 materials", "7 weeks"],
  },
  {
    sector: "Mid-sized NBFC",
    context: "SME lending\nAUM ₹8,000 Cr",
    status: "Early-warning credit agent · live",
    headline: "Spotting deterioration before the EMI",
    body: "A credit team was identifying risky accounts only after a missed payment. We built an agent that monitors GST filings, bank statement patterns, payroll behavior, and customer-side signals to surface SME borrowers showing early stress, typically eight weeks before the first default. Currently flagging 11 to 14% of the book monthly for relationship-manager review.",
    tags: ["Multi-signal ingest", "Production scoring", "8 weeks"],
  },
  {
    sector: "Family office",
    context: "Multi-generation\n$2B+ AUM",
    status: "Investment memo copilot · in production",
    headline: "Cutting deal-screening from days to hours",
    body: "An IC was rejecting 80% of deals after a multi-day diligence sprint. We built an agent that drafts the first cut of every investment memo: sector context, comparable transactions, public-domain financial diligence, and red-flag detection. The IC now reaches a no-go decision in under three hours on rejects, freeing analyst time for the deals worth pursuing.",
    tags: ["Document drafting", "Public-data diligence", "6 weeks"],
  },
] as const;

function buttonClassName(className?: string) {
  return [
    "conformal-button conformal-button-ghost inline-flex items-center gap-1.5 rounded-full border border-[color:var(--line)] bg-transparent px-4 py-2 text-[13px] font-medium text-[color:var(--foreground)] no-underline transition duration-200 hover:border-[#B8232E]/40 hover:text-[#B8232E]",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

function Divider({ children }: { children: ReactNode }) {
  return (
    <p className="conformal-divider mb-6 flex items-center gap-3.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--muted)]">
      <span>{children}</span>
      <span className="h-px flex-1 bg-[color:var(--line)]" />
    </p>
  );
}

export function SelectedWork() {
  return (
    <section id="selected-work" className="conformal-section border-t border-[color:var(--line)] px-6 py-16 md:px-9 md:py-20">
      <Divider>Selected work</Divider>
      <p className="-mt-3 mb-8 max-w-[580px] text-sm leading-relaxed text-[color:var(--muted)]">
        Most of our engagements are under NDA. The descriptions below are accurate but anonymized. We are happy to share named references in private conversation.
      </p>

      <div className="flex flex-col">
        {engagements.map((engagement, index) => (
          <Engagement key={engagement.sector} {...engagement} isLast={index === engagements.length - 1} />
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <a className={buttonClassName("px-4 py-[9px]")} href="mailto:hello@conformal.live?subject=Request%20a%20private%20Conformal%20demo">
          Request a private demo <Lock size={13} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
