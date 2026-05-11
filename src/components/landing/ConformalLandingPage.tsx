import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, Code, Cpu, History, Lock, ShieldCheck, Target, ToolCase, Users } from "lucide-react";
import { ConformalMark } from "@/components/brand/ConformalMark";
import { formatPostDate, posts } from "@/lib/journal";
import { sectionTargetFromHref } from "@/lib/section-scroll";
import { SelectedWork } from "./SelectedWork";
import { PendingSectionScroll, SectionScrollButton } from "./SectionScrollButton";
import { StatsStrip } from "./StatsStrip";

const pillars = [
  {
    icon: Target,
    title: "Pick one decision that matters",
    body: "Not a transformation programme. A single executive question that an entire org currently struggles to answer in a week, made answerable in seconds.",
  },
  {
    icon: ToolCase,
    title: "Ship a working product",
    body: "Not a wireframe. Not a pilot in a sandbox. A real agent in production, querying your real data, in front of real executives. Six to twelve weeks.",
  },
  {
    icon: Users,
    title: "Hand it back, fluent",
    body: "Your engineers ship alongside ours from day one. By the time we leave, your team owns the code, the prompt, and the next ten decisions.",
  },
] as const;

const steps = [
  {
    number: "01",
    week: "Week 1",
    title: "Find the one question worth answering",
    body: "Eight to twelve conversations with operators, not slide reviews with leadership. The question chooses itself.",
  },
  {
    number: "02",
    week: "Weeks 2 to 4",
    title: "Build the agent end-to-end",
    body: "A working product on real data. Reviewed weekly by the executive who will use it. Your engineers paired with ours.",
  },
  {
    number: "03",
    week: "Weeks 5 to 6",
    title: "Ship to production",
    body: "Real users, your infrastructure, your domain. Every agent call logged, every chart pinnable, every prompt diff-able.",
  },
  {
    number: "04",
    week: "Week 7 onward",
    title: "Walk away, or expand",
    body: "A clean handoff to your team, or a follow-on engagement on the next decision. Never an indefinite retainer.",
  },
] as const;

const beliefs = [
  {
    label: "Belief one",
    headline: "Agents are the new application, not the new feature.",
    body: "For thirty years, software was built around forms: fields, screens, click paths. Agents collapse that into a single conversation that writes its own queries, composes its own interfaces, and ends with a decision. The companies that internalize this will run on a different operating model in five years. Most are still bolting chatbots onto Salesforce.",
  },
  {
    label: "Belief two",
    headline: "The bottleneck is data shape, not model intelligence.",
    body: "A frontier model with the wrong schema returns confident nonsense. A mid-tier model with a clean, well-described schema and four good few-shots returns CFO-grade answers. Almost every \"AI doesn't work for our company\" story is, on closer inspection, a data-shape problem dressed up as a model problem.",
  },
  {
    label: "Belief three",
    headline: "Trust is built by showing the reasoning.",
    body: "Every agent we ship streams its reasoning in plain view: the tools it called, the SQL it wrote, the time each step took. Executives don't trust black boxes; they trust working things they can audit. The trace rail is the most important UI in the product, not the answer.",
  },
  {
    label: "Belief four",
    headline: "The deliverable is your team's fluency.",
    body: "A working agent is the artefact. Your engineers being able to ship the next one without us is the deliverable. We measure every engagement by what your team can do on the Monday after we leave, and we structure the contract so that the faster you become independent, the more value you get.",
  },
] as const;

const trustCards = [
  { icon: ShieldCheck, title: "Deploys inside your VPC", body: "AWS, Azure, GCP, or on-prem. No data egress except to the LLM provider you choose." },
  { icon: Lock, title: "SOC 2 Type II in progress", body: "Security controls are being formalized now, with a Q3 2026 Type II target. Current controls shared under NDA." },
  { icon: History, title: "Full audit trail", body: "Every prompt, tool call, SQL query, and answer logged with timestamps, cost, and trace IDs." },
  { icon: BadgeCheck, title: "DPIA & DPA ready", body: "Standard data processing agreements and impact assessments, signed within a week, not a quarter." },
  { icon: Code, title: "Source code escrow", body: "All code is your code from day one. Repo in your GitHub org, commits attributed to your engineers." },
  { icon: Cpu, title: "Model-provider neutral", body: "Anthropic, OpenAI, Azure OpenAI, open-weight. You pick, you pay the provider, you switch when you want." },
] as const;

const founderEng = {
  role: "Engineering",
  tags: ["BITS Pilani", "Amazon", "Microsoft App Store"],
  characterization: "Built and scaled the platforms. The kind of engineer who ships *agentic systems* in production, not in slide decks.",
  paragraphs: [
    "Currently VP Engineering at an AI-native education company, architecting **multimodal LLM systems**: speech-to-text, reasoning, and voice synthesis stitched together at sub-second latency across distributed US-India teams.",
    "Before that, Principal Engineer at an enterprise SaaS company, where he **scaled the flagship product from 10,000 to over 600,000 users** across the largest global IT services firms, and shipped an agentic AI assistant published on the Microsoft Teams App Store. The platform he built now runs production workloads for roughly a fifth of the Indian IT services market.",
    "Earlier, senior engineer at //Amazon//, where he built core payment experiences, including Scan & Pay and the Amazon Pay merchant ecosystem. Co-founded two startups along the way, one of which processed **100,000+ monthly orders** at peak.",
  ],
};

const founderStrat = {
  role: "Strategy",
  tags: ["Wharton MBA", "Accel", "General Catalyst", "BCG", "30 Under 30"],
  characterization: "Funded and shipped the bets. The kind of operator who has sat *on both sides* of the table.",
  paragraphs: [
    "Currently heads market insights at a high-growth AI company, leading **GTM, product strategy, and M&A**, the kind of role where decisions get made in a Slack thread and shipped that week.",
    "Spent two years investing at //General Catalyst, Accel, and WestBridge Capital// across **GenAI, software, cybersecurity, and consumer.** Sourced and led diligence on companies now valued in the billions. Before that, two years at //Boston Consulting Group// driving large-scale transformation programs across BFSI, IT, consumer, and healthcare.",
    "Wharton MBA. Named a **30 Under 30 Global Business Leader.** Has also published peer-reviewed research on AI in drug discovery, back when \"AI in drug discovery\" wasn't a pitch.",
  ],
};

const combinedFounderStats = [
  { value: "600K+", label: "Users on platforms they've shipped" },
  { value: "4", label: "Companies founded between them" },
  { value: "3", label: "Venture funds invested across" },
  { value: "10+ yrs", label: "Building and funding software" },
] as const;

const faqs = [
  {
    q: "How is this different from hiring McKinsey or Bain?",
    a: "They write the roadmap. We build the thing the roadmap calls for. Both have a place, but the bottleneck inside most enterprises today is execution, not strategy. We don't compete with them; we ship what they recommend.",
  },
  {
    q: "Do you work with a specific LLM provider?",
    a: "We're model-neutral. Anthropic Claude, OpenAI GPT, Azure OpenAI, open-weight models on your own GPUs can all work. We'll deploy what fits your security envelope and your budget. The provider contract is between you and them; we don't take a margin on inference.",
  },
  {
    q: "What does an engagement cost?",
    a: "A standard six-week engagement runs ₹40 to 80 lakh fixed-fee, with a small completion bonus tied to whether the agent is in production by the end. Pricing happens in conversation, not on a page, but we never charge by the slide deck and never offer a retainer.",
  },
  {
    q: "What if our data isn't ready?",
    a: "It rarely is. The first week of every engagement is a data-shape diagnostic. We look at what exists, what's reachable, and what would block an agent from working. If the gap is large, we say so and the engagement waits until the foundation is right. We don't sell engagements that won't ship.",
  },
  {
    q: "Who owns the code?",
    a: "You do. From the first commit. The repository lives in your GitHub org or self-hosted Git, with your engineers as co-committers from week one. We don't have a \"platform\" we license back to you. There is no Conformal SaaS.",
  },
  {
    q: "Will you talk to our board?",
    a: "Yes, but only after week three, when there's a working product to show. We don't present unbuilt ideas to audit committees or AI steering groups. Demo-driven governance is part of how we keep engagements honest.",
  },
] as const;

const footerColumns = [
  {
    title: "Work",
    links: [
      { label: "Executive cockpits", targetId: "selected-work" },
      { label: "Agentic workflows", targetId: "selected-work" },
      { label: "Data product audits", targetId: "selected-work" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Approach", targetId: "approach" },
      { label: "Journal", href: "/journal" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Trust & security", targetId: "trust" },
      { label: "FAQ", targetId: "faq" },
      { label: "RSS", href: "/journal/rss.xml" },
    ],
  },
  {
    title: "Contact",
    links: [
      { label: "hello@conformal.live", href: "mailto:hello@conformal.live" },
      { label: "Gurugram · San Francisco", targetId: "conversation" },
    ],
  },
] as const;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Reveal({ children, className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cx("conformal-reveal", className)} {...props}>
      {children}
    </div>
  );
}

function BrandMark() {
  return <ConformalMark className="conformal-brand-mark shrink-0" size={20} />;
}

function buttonClassName(variant: "primary" | "ghost", className?: string) {
  return cx(
    "conformal-button inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium no-underline transition duration-200",
    variant === "primary"
      ? "conformal-button-primary bg-[#B8232E] text-white hover:bg-[#991C26]"
      : "conformal-button-ghost border border-[color:var(--line)] bg-transparent text-[color:var(--foreground)] hover:border-[#B8232E]/40 hover:text-[#B8232E]",
    className,
  );
}

function Button({ children, variant = "primary", className, href, targetId }: { children: ReactNode; variant?: "primary" | "ghost"; className?: string; href?: string; targetId?: string }) {
  const sectionTarget = targetId ?? (href ? sectionTargetFromHref(href) : "conversation");

  if (sectionTarget) {
    return (
      <SectionScrollButton className={buttonClassName(variant, className)} targetId={sectionTarget}>
        {children}
      </SectionScrollButton>
    );
  }

  return (
    <a
      className={buttonClassName(variant, className)}
      href={href ?? "/"}
    >
      {children}
    </a>
  );
}

function SmartLink({ children, className, href, targetId }: { children: ReactNode; className?: string; href?: string; targetId?: string }) {
  const sectionTarget = targetId || (href ? sectionTargetFromHref(href) : null);

  if (sectionTarget) {
    return <SectionScrollButton className={className} targetId={sectionTarget}>{children}</SectionScrollButton>;
  }

  if (href && href.startsWith("/") && !href.endsWith(".xml")) {
    return <Link className={className} href={href}>{children}</Link>;
  }

  return <a className={className} href={href ?? "/"}>{children}</a>;
}

function Divider({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("conformal-divider mb-6 flex items-center gap-3.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--muted)]", className)}>
      <span>{children}</span>
      <span className="h-px flex-1 bg-[color:var(--line)]" />
    </p>
  );
}

function renderInline(value: string) {
  return value.split(/(\*\*[^*]+\*\*|\/\/[^/]+\/\/|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} className="font-medium text-[color:var(--foreground)]">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("//") && part.endsWith("//")) {
      return (
        <em key={`${part}-${index}`} className="not-italic text-[color:var(--muted)] opacity-70">
          {part.slice(2, -2)}
        </em>
      );
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={`${part}-${index}`} className="italic text-[#B8232E]">
          {part.slice(1, -1)}
        </em>
      );
    }

    return part;
  });
}

function Section({ children, muted = false, className, ...props }: ComponentProps<"section"> & { muted?: boolean }) {
  return (
    <section
      className={cx("conformal-section border-t border-[color:var(--line)] px-6 py-16 md:px-9 md:py-20", muted && "bg-[color:var(--panel-soft)]", className)}
      {...props}
    >
      {children}
    </section>
  );
}

function PointOfViewSection() {
  return (
    <Section>
      <Divider>Our point of view</Divider>
      <Reveal className="mb-12 grid gap-8 md:grid-cols-[1fr_1.2fr] md:gap-16">
        <h2 className="conformal-section-title m-0 font-serif text-[38px] font-normal leading-[1.12] tracking-normal text-[color:var(--foreground)] md:text-[44px]">
          The thinking <em className="italic text-[#B8232E]">behind the work.</em>
        </h2>
        <div>
          <p className="mb-4 text-[15px] leading-[1.75] text-[color:var(--muted)]">
            We work on a narrow theory: that this AI cycle doesn&apos;t reward strategy decks or pilot programs. It rewards small teams who can put real software in front of real executives in weeks, and then iterate against use rather than slide review.
          </p>
          <p className="m-0 text-[15px] leading-[1.75] text-[color:var(--muted)]">
            The four beliefs below are the ones every Conformal engagement begins from. If you disagree with one of them, the engagement probably isn&apos;t right for either of us.
          </p>
        </div>
      </Reveal>

      <div className="grid gap-0 md:grid-cols-2">
        {beliefs.map((belief, index) => (
          <Reveal
            key={belief.label}
            className={cx(
              "py-8 md:p-8",
              index % 2 === 0 && "md:border-r md:border-[color:var(--line)] md:pl-0",
              index % 2 === 1 && "md:pr-0",
              index < 2 && "border-b border-[color:var(--line)]",
              index >= 2 && "border-b border-[color:var(--line)] md:border-b-0",
            )}
          >
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.1em] text-[#B8232E]">{belief.label}</p>
            <h3 className="mb-3 font-serif text-2xl font-normal leading-[1.25] text-[color:var(--foreground)]">{belief.headline}</h3>
            <p className="m-0 text-sm leading-[1.75] text-[color:var(--muted)]">{belief.body}</p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function JournalPreviewSection() {
  return (
    <Section id="journal">
      <Divider>Journal</Divider>
      <div className="mb-9 grid gap-5 md:grid-cols-[minmax(0,560px)_auto] md:items-end md:justify-between">
        <Reveal>
          <h2 className="conformal-section-title mb-2.5 font-serif text-4xl font-normal leading-[1.15] tracking-normal text-[color:var(--foreground)]">
            Notes on building AI for legacy enterprises.
          </h2>
          <p className="m-0 text-sm leading-[1.65] text-[color:var(--muted)]">
            Field notes from production engagements, anonymized. Written by the partners and engineers actually shipping the code.
          </p>
        </Reveal>
        <Link className="inline-flex items-center gap-1.5 text-[13px] text-[color:var(--muted)] no-underline hover:text-[#B8232E]" href="/journal">
          Browse all 8 entries <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
      <div className="flex flex-col">
        {posts.slice(0, 5).map((post) => (
          <Link
            key={post.slug}
            className="grid gap-4 border-b border-[color:var(--line)] py-7 text-[color:var(--foreground)] no-underline last:border-b-0 md:grid-cols-[120px_minmax(0,1fr)_auto] md:gap-7"
            href={`/journal/${post.slug}`}
          >
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--muted)]">{post.category}</p>
              <p className="m-0 text-[11px] text-[color:var(--muted)] opacity-80">{post.readTime} · {formatPostDate(post.publishedAt)}</p>
            </div>
            <div>
              <h3 className="mb-2 font-serif text-[22px] font-normal leading-[1.3] text-[color:var(--foreground)]">{post.title}</h3>
              <p className="m-0 text-sm leading-[1.7] text-[color:var(--muted)]">{post.dek}</p>
            </div>
            <ArrowUpRight className="hidden text-[color:var(--muted)] md:block" size={18} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </Section>
  );
}

function TrustSecuritySection() {
  return (
    <Section id="trust" muted>
      <div className="grid gap-10 md:grid-cols-[1fr_1.4fr] md:gap-16">
        <Reveal>
          <Divider>Trust &amp; security</Divider>
          <h2 className="conformal-section-title mb-4 font-serif text-4xl font-normal leading-[1.15] tracking-normal text-[color:var(--foreground)]">
            Built for the way enterprises actually buy AI.
          </h2>
          <p className="m-0 text-[15px] leading-[1.75] text-[color:var(--muted)]">
            We deploy inside your VPC. Your data stays where it lives. The agent is auditable end-to-end, and every prompt, tool call, and answer is logged for compliance review. Below is what we routinely sign and what we don&apos;t.
          </p>
        </Reveal>
        <div className="grid gap-3.5 sm:grid-cols-2">
          {trustCards.map(({ icon: Icon, title, body }) => (
            <Reveal key={title} className="rounded-lg border border-[color:var(--line)] bg-[color:var(--panel)] p-5">
              <Icon className="mb-3 text-[#B8232E]" size={20} aria-hidden="true" />
              <h3 className="mb-1 text-sm font-medium text-[color:var(--foreground)]">{title}</h3>
              <p className="m-0 text-xs leading-[1.5] text-[color:var(--muted)]">{body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 mr-1 inline-flex items-center rounded-full border border-[color:var(--line)] bg-[color:var(--panel-soft)] px-2.5 py-1 text-[11px] font-medium tracking-[0.01em] text-[color:var(--foreground)]">
      {children}
    </span>
  );
}

function FounderEntry({ role, tags, characterization, paragraphs }: typeof founderEng) {
  return (
    <Reveal className="grid gap-6 border-b border-[color:var(--line)] py-9 last:border-b-0 md:grid-cols-[200px_1fr] md:gap-12">
      <div>
        <div className="mb-3.5 h-[38px] w-[38px] rounded-full border border-[color:var(--line)] bg-[color:var(--panel-soft)]" aria-hidden="true" />
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.1em] text-[#B8232E]">Co-founder</p>
        <p className="m-0 text-[13px] font-medium text-[color:var(--foreground)]">{role}</p>
        <div className="mt-[18px] flex flex-wrap">
          {tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-[18px] font-serif text-[21px] font-normal leading-[1.4] tracking-normal text-[color:var(--foreground)]">
          {renderInline(characterization)}
        </p>
        {paragraphs.map((paragraph) => (
          <p key={paragraph} className="mb-3.5 text-[14.5px] leading-[1.75] text-[color:var(--muted)] last:mb-0">
            {renderInline(paragraph)}
          </p>
        ))}
      </div>
    </Reveal>
  );
}

function PeopleSection() {
  return (
    <section className="conformal-section border-t border-[color:var(--line)] px-5 py-14 md:px-14 md:py-20">
      <div className="mb-12 grid gap-6 md:grid-cols-[1fr_1.2fr] md:items-end md:gap-16">
        <Reveal>
          <Divider>The people</Divider>
          <h2 className="conformal-section-title m-0 font-serif text-4xl font-normal leading-[1.15] tracking-normal text-[color:var(--foreground)]">
            A small team. <em className="not-italic text-[#B8232E]">Senior on every call.</em>
          </h2>
        </Reveal>
        <Reveal>
          <p className="m-0 text-[15px] leading-[1.75] text-[color:var(--muted)]">
            Conformal is built around two founders and a small group of engineers. Every engagement is staffed by two senior people, full-time, with no analyst layer, no partner who shows up at kickoff and vanishes. You speak with the people writing the code.
          </p>
        </Reveal>
      </div>

      <div className="flex flex-col">
        <FounderEntry {...founderEng} />
        <FounderEntry {...founderStrat} />
      </div>

      <div className="mt-2 border-t border-[color:var(--line)] pt-8">
        <Divider className="mb-[18px]">Between the two founders</Divider>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
          {combinedFounderStats.map((stat) => (
            <Reveal key={stat.label}>
              <p className="m-0 font-serif text-[34px] font-medium leading-none text-[color:var(--foreground)]">{stat.value}</p>
              <p className="mt-2 text-xs leading-[1.5] text-[color:var(--muted)] opacity-80">{stat.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <Section id="faq" muted>
      <div className="grid gap-8 md:grid-cols-[1fr_1.6fr] md:gap-[60px]">
        <Reveal>
          <Divider>Frequently asked</Divider>
          <h2 className="conformal-section-title m-0 font-serif text-4xl font-normal leading-[1.15] tracking-normal text-[color:var(--foreground)]">
            Questions we hear in the first call.
          </h2>
        </Reveal>
        <div>
          {faqs.map((faq) => (
            <Reveal key={faq.q} className="border-b border-[color:var(--line)] py-[22px] first:pt-0 last:border-b-0">
              <h3 className="mb-2 text-base font-medium text-[color:var(--foreground)]">{faq.q}</h3>
              <p className="m-0 text-sm leading-[1.7] text-[color:var(--muted)]">{faq.a}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

export function ConformalLandingPage() {
  return (
    <main className="conformal-landing min-h-screen bg-[color:var(--background)] px-0 py-0 text-[color:var(--foreground)] md:px-8 md:py-8">
      <PendingSectionScroll />
      <div className="conformal-frame overflow-hidden border-y border-[color:var(--line)] bg-[color:var(--panel)] md:rounded-lg md:border">
        <nav className="conformal-nav flex items-center justify-between gap-6 border-b border-[color:var(--line)] px-5 py-4 md:px-9" aria-label="Primary">
          <div className="flex items-center gap-8">
            <SectionScrollButton className="conformal-brand flex items-center gap-[9px] text-sm font-medium tracking-normal text-[color:var(--foreground)] no-underline" targetId="top">
              <BrandMark />
              <span>conformal</span>
            </SectionScrollButton>
            <div className="hidden items-center gap-8 md:flex">
              <SectionScrollButton className="conformal-nav-link text-[13px] text-[color:var(--muted)] no-underline hover:text-[color:var(--foreground)]" targetId="approach">Approach</SectionScrollButton>
              <SectionScrollButton className="conformal-nav-link text-[13px] text-[color:var(--muted)] no-underline hover:text-[color:var(--foreground)]" targetId="selected-work">Work</SectionScrollButton>
              <Link className="conformal-nav-link text-[13px] text-[color:var(--muted)] no-underline hover:text-[color:var(--foreground)]" href="/journal">Journal</Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button className="conformal-nav-cta">
              Start a conversation <ArrowRight size={14} aria-hidden="true" />
            </Button>
          </div>
        </nav>

        <section id="top" className="conformal-hero max-w-[1100px] px-6 py-14 md:px-9 md:py-24">
          <p className="conformal-hero-item mb-[22px] text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--muted)]">
            AI transformation for enterprise leaders
          </p>
          <h1 className="conformal-hero-item conformal-hero-delay-1 conformal-display mb-7 max-w-[920px] font-serif text-[44px] font-normal leading-[1.08] tracking-normal text-[color:var(--foreground)] md:text-[68px]">
            We&apos;ve spent four years making the second-oldest companies act <em className="italic text-[#B8232E]">like the youngest.</em>
          </h1>
          <p className="conformal-hero-item conformal-hero-delay-2 mb-9 max-w-2xl text-lg leading-[1.65] text-[color:var(--muted)]">
            Conformal builds the AI products that legacy enterprises actually ship, replacing slide decks with working software, six weeks at a time. We work with boards, CEOs, and the operators who answer to them.
          </p>
          <div className="conformal-hero-item conformal-hero-delay-3 flex flex-wrap items-center gap-3">
            <Button className="px-[18px] py-[11px]">
              Start a conversation <ArrowRight size={14} aria-hidden="true" />
            </Button>
            <Button variant="ghost" className="px-[18px] py-[11px]" targetId="approach">
              How we work
            </Button>
          </div>
        </section>

        <StatsStrip />

        <Section id="approach">
          <Divider>The problem we keep finding</Divider>
          <Reveal className="grid gap-8 md:grid-cols-[1fr_1.4fr] md:gap-[60px]">
            <h2 className="conformal-section-title m-0 font-serif text-4xl font-normal leading-[1.15] tracking-normal text-[color:var(--foreground)]">Most AI work inside legacy companies dies in PowerPoint.</h2>
            <div className="pt-2">
              <p className="mb-5 text-base leading-[1.75] text-[color:var(--muted)]">A consultancy is hired. A roadmap is written. Workshops happen, capability assessments are scored, a 47-slide deck is delivered. Two years later, the deck is in a shared drive and nothing has shipped.</p>
              <p className="m-0 text-base leading-[1.75] text-[color:var(--muted)]">Meanwhile the executives who commissioned the work still wait three days for a quarterly variance number, still chase WhatsApp messages to find out which dealers are in trouble, still rely on the same five people who know where the data lives. The strategy was right. The system around it failed.</p>
            </div>
          </Reveal>
        </Section>

        <Section muted>
          <Divider>What we do</Divider>
          <Reveal>
            <h2 className="conformal-section-title mb-12 max-w-[780px] font-serif text-4xl font-normal leading-[1.15] tracking-normal text-[color:var(--foreground)]">We build the working product, in the open, with your team.</h2>
          </Reveal>
          <div className="grid gap-8 md:grid-cols-3 md:gap-5">
            {pillars.map(({ icon: Icon, title, body }) => (
              <Reveal key={title} className="conformal-pillar">
                <Icon size={22} className="mb-[18px] text-[#B8232E]" aria-hidden="true" />
                <h3 className="mb-2.5 text-[17px] font-medium leading-[1.3] text-[color:var(--foreground)]">{title}</h3>
                <p className="m-0 text-sm leading-[1.65] text-[color:var(--muted)]">{body}</p>
              </Reveal>
            ))}
          </div>
        </Section>

        <SelectedWork />

        <PointOfViewSection />

        <JournalPreviewSection />

        <TrustSecuritySection />

        <PeopleSection />

        <FAQSection />

        <Section muted>
          <div className="grid gap-10 md:grid-cols-[1fr_1.4fr] md:gap-[60px]">
            <Reveal>
              <Divider>How we work</Divider>
              <h2 className="conformal-section-title mb-4 font-serif text-4xl font-normal leading-[1.15] tracking-normal text-[color:var(--foreground)]">A six-week engagement, not a six-quarter programme.</h2>
              <p className="m-0 text-[15px] leading-[1.75] text-[color:var(--muted)]">Each phase ends with something working. If something stops working, we stop. The contract is built around proof, not retainer.</p>
            </Reveal>
            <div className="flex flex-col">
              {steps.map((step, index) => (
                <Reveal key={step.number} className={cx("conformal-step flex gap-6 py-6", index < steps.length - 1 && "border-b border-[color:var(--line)]")}>
                  <p className="m-0 min-w-12 font-serif text-[32px] font-medium leading-none text-[color:var(--muted)]">{step.number}</p>
                  <div>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--muted)]">{step.week}</p>
                    <h3 className="mb-1.5 text-lg font-medium text-[color:var(--foreground)]">{step.title}</h3>
                    <p className="m-0 text-sm leading-[1.65] text-[color:var(--muted)]">{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Section>

        <Section id="conversation" className="text-center">
          <Reveal>
            <p className="conformal-eyebrow mb-6 text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--muted)]">Where to start</p>
            <h2 className="conformal-display mx-auto mb-[22px] max-w-[780px] font-serif text-5xl font-normal leading-[1.08] tracking-normal text-[color:var(--foreground)] md:text-[54px]">
              One conversation. <em className="italic text-[#B8232E]">No deck.</em>
            </h2>
            <p className="mx-auto mb-9 max-w-[520px] text-base leading-[1.7] text-[color:var(--muted)]">{"If you're an operator inside a large enterprise and you think one decision in your company is broken, write us. Forty-five minutes, no commitment."}</p>
            <form className="conformal-email-capture mx-auto flex w-full max-w-[480px] items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] p-2 pl-[18px]" action="mailto:hello@conformal.live?subject=Conformal%20conversation" method="post" encType="text/plain">
              <label className="sr-only" htmlFor="conformal-email">Email address</label>
              <input id="conformal-email" name="email" className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[color:var(--foreground)] outline-none" placeholder="your@company.com" type="email" required />
              <button className={buttonClassName("primary", "px-[18px] py-[9px]")} type="submit">
                Start a conversation <ArrowRight size={14} aria-hidden="true" />
              </button>
            </form>
            <p className="mt-3.5 text-xs text-[color:var(--muted)]">
              Or <a className="text-[color:var(--foreground)] underline" href="mailto:hello@conformal.live">email a partner directly</a>
            </p>
          </Reveal>
        </Section>

        <footer className="conformal-footer border-t border-[color:var(--line)] px-6 pb-8 pt-12 md:px-9">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div>
              <div className="mb-2 flex items-center gap-[9px]">
                <BrandMark />
                <span className="text-sm font-medium tracking-normal text-[color:var(--foreground)]">conformal</span>
              </div>
              <p className="m-0 text-[11px] text-[color:var(--muted)]">AI transformation, in working code.</p>
            </div>
            <div className="grid gap-8 md:flex md:gap-9">
              {footerColumns.map(({ title, links }) => (
                <div key={title}>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--muted)]">{title}</p>
                  {links.map((item) => (
                    <p key={item.label} className="mb-1.5 text-[13px] text-[color:var(--muted)] last:mb-0">
                      <SmartLink className="text-[color:var(--muted)] no-underline hover:text-[color:var(--foreground)]" href={"href" in item ? item.href : undefined} targetId={"targetId" in item ? item.targetId : undefined}>{item.label}</SmartLink>
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--line)] pt-5">
            <p className="m-0 text-[11px] text-[color:var(--muted)]">© 2026 Conformal</p>
            <div className="flex gap-[18px]">
              <span className="text-[11px] text-[color:var(--muted)]">Privacy</span>
              <span className="text-[11px] text-[color:var(--muted)]">Terms</span>
              <SectionScrollButton className="text-[11px] text-[color:var(--muted)] no-underline hover:text-[color:var(--foreground)]" targetId="trust">Security</SectionScrollButton>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
