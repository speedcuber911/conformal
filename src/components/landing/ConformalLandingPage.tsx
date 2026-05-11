"use client";

import type { ComponentProps, ReactNode } from "react";
import { ArrowRight, Target, ToolCase, Users } from "lucide-react";
import { motion } from "motion/react";
import { SelectedWork } from "./SelectedWork";
import { StatsStrip } from "./StatsStrip";

const pillars = [
  {
    icon: Target,
    title: "Pick one decision that matters",
    body: "Not a transformation programme. A single executive question that an entire org currently struggles to answer in a week — and we make answerable in seconds.",
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
    week: "Weeks 2–4",
    title: "Build the agent end-to-end",
    body: "A working product on real data. Reviewed weekly by the executive who will use it. Your engineers paired with ours.",
  },
  {
    number: "03",
    week: "Weeks 5–6",
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

const footerColumns = [
  ["Work", "Executive cockpits", "Agentic workflows", "Data product audits"],
  ["Company", "Approach", "Journal", "Careers"],
  ["Contact", "hello@conformal.live", "Gurugram · San Francisco"],
] as const;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Reveal({ children, className, ...props }: ComponentProps<typeof motion.div>) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0.98, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: [0.19, 1, 0.22, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

function BrandMark() {
  return (
    <div className="conformal-brand-mark flex h-5 w-5 items-center justify-center rounded-[5px] bg-[#0E0E0E]" aria-hidden="true">
      <div className="h-[9px] w-[9px] rounded-full bg-white" />
    </div>
  );
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

function Button({ children, variant = "primary", className, href = "#conversation" }: { children: ReactNode; variant?: "primary" | "ghost"; className?: string; href?: string }) {
  return (
    <a
      className={buttonClassName(variant, className)}
      href={href}
    >
      {children}
    </a>
  );
}

function Divider({ children }: { children: ReactNode }) {
  return (
    <p className="conformal-divider mb-6 flex items-center gap-3.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--muted)]">
      <span>{children}</span>
      <span className="h-px flex-1 bg-[color:var(--line)]" />
    </p>
  );
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

export function ConformalLandingPage() {
  return (
    <main className="conformal-landing min-h-screen bg-[color:var(--background)] px-0 py-0 text-[color:var(--foreground)] md:px-8 md:py-8">
      <div className="conformal-frame overflow-hidden border-y border-[color:var(--line)] bg-[color:var(--panel)] md:rounded-lg md:border">
        <nav className="conformal-nav flex items-center justify-between gap-6 border-b border-[color:var(--line)] px-5 py-4 md:px-9" aria-label="Primary">
          <div className="flex items-center gap-8">
            <a className="conformal-brand flex items-center gap-[9px] text-sm font-medium tracking-normal text-[color:var(--foreground)] no-underline" href="#top">
              <BrandMark />
              <span>conformal</span>
            </a>
            <div className="hidden items-center gap-8 md:flex">
              <a className="conformal-nav-link text-[13px] text-[color:var(--muted)] no-underline hover:text-[color:var(--foreground)]" href="#approach">Approach</a>
              <a className="conformal-nav-link text-[13px] text-[color:var(--muted)] no-underline hover:text-[color:var(--foreground)]" href="#selected-work">Work</a>
              <a className="conformal-nav-link text-[13px] text-[color:var(--muted)] no-underline hover:text-[color:var(--foreground)]" href="mailto:hello@conformal.live?subject=Conformal%20journal">Journal</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button className="hidden md:inline-flex">
              Start a conversation <ArrowRight size={14} aria-hidden="true" />
            </Button>
          </div>
        </nav>

        <section id="top" className="conformal-hero max-w-[1100px] px-6 py-14 md:px-9 md:py-24">
          <motion.p className="conformal-eyebrow mb-[22px] text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--muted)]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            AI transformation for enterprise leaders
          </motion.p>
          <motion.h1
            className="conformal-display mb-7 max-w-[920px] font-serif text-[44px] font-normal leading-[1.08] tracking-normal text-[color:var(--foreground)] md:text-[68px]"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: [0.19, 1, 0.22, 1] }}
          >
            We&apos;ve spent four years making the second-oldest companies act <em className="italic text-[#B8232E]">like the youngest.</em>
          </motion.h1>
          <motion.p className="mb-9 max-w-2xl text-lg leading-[1.65] text-[color:var(--muted)]" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}>
            Conformal builds the AI products that legacy enterprises actually ship — replacing slide decks with working software, six weeks at a time. We work with boards, CEOs, and the operators who answer to them.
          </motion.p>
          <motion.div className="flex flex-wrap items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.25 }}>
            <Button className="px-[18px] py-[11px]">
              Start a conversation <ArrowRight size={14} aria-hidden="true" />
            </Button>
            <Button variant="ghost" className="px-[18px] py-[11px]" href="#approach">
              How we work
            </Button>
          </motion.div>
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
            <p className="mx-auto mb-9 max-w-[520px] text-base leading-[1.7] text-[color:var(--muted)]">{"If you're an operator inside a large enterprise and you think one decision in your company is broken — write us. Forty-five minutes, no commitment."}</p>
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
              {footerColumns.map(([title, ...items]) => (
                <div key={title}>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--muted)]">{title}</p>
                  {items.map((item) => (
                    <p key={item} className="mb-1.5 text-[13px] text-[color:var(--muted)] last:mb-0">
                      {item}
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
              <span className="text-[11px] text-[color:var(--muted)]">Security</span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
