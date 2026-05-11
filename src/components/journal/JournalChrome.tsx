import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ConformalMark } from "@/components/brand/ConformalMark";
import { SectionScrollButton } from "@/components/landing/SectionScrollButton";
import { sectionTargetFromHref } from "@/lib/section-scroll";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function BrandMark() {
  return <ConformalMark className="conformal-brand-mark shrink-0" size={20} />;
}

function buttonClassName(className?: string) {
  return cx(
    "conformal-button conformal-button-primary inline-flex items-center gap-1.5 rounded-full bg-[#B8232E] px-4 py-2 text-[13px] font-medium text-white no-underline transition duration-200 hover:bg-[#991C26]",
    className,
  );
}

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

export function Divider({ children }: { children: ReactNode }) {
  return (
    <p className="conformal-divider mb-6 flex items-center gap-3.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--muted)]">
      <span>{children}</span>
      <span className="h-px flex-1 bg-[color:var(--line)]" />
    </p>
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

export function JournalChrome({ children }: { children: ReactNode }) {
  return (
    <main className="conformal-landing min-h-screen bg-[color:var(--background)] px-0 py-0 text-[color:var(--foreground)] md:px-8 md:py-8">
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
              <Link className="conformal-nav-link text-[13px] text-[color:var(--foreground)] no-underline hover:text-[#B8232E]" href="/journal">Journal</Link>
            </div>
          </div>
          <SectionScrollButton className={buttonClassName("hidden md:inline-flex")} targetId="conversation">
            Start a conversation <ArrowRight size={14} aria-hidden="true" />
          </SectionScrollButton>
        </nav>
        {children}
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
