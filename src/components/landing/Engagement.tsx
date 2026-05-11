type EngagementProps = {
  sector: string;
  context: string;
  status: string;
  headline: string;
  body: string;
  tags: readonly string[];
  isLast?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Engagement({ sector, context, status, headline, body, tags, isLast = false }: EngagementProps) {
  return (
    <article className={cx("grid gap-5 py-7 md:grid-cols-[180px_minmax(0,1fr)] md:gap-10 md:py-8", !isLast && "border-b border-[color:var(--line)]")}>
      <div>
        <p className="mb-2 inline-flex rounded-full border border-[color:var(--line)] bg-[color:var(--panel-soft)] px-[9px] py-[3px] text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--muted)]">
          Sector
        </p>
        <h3 className="mb-2 text-[13px] font-medium leading-snug text-[color:var(--foreground)]">{sector}</h3>
        <p className="m-0 whitespace-pre-line text-xs leading-[1.45] text-[color:var(--muted)] opacity-80">{context}</p>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#B8232E]">{status}</p>
        <h4 className="mb-3 font-serif text-lg font-normal leading-[1.3] text-[color:var(--foreground)]">{headline}</h4>
        <p className="m-0 max-w-[760px] text-sm leading-[1.7] text-[color:var(--muted)]">{body}</p>
        <div className="mt-5 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-[color:var(--line)] bg-transparent px-[9px] py-[3px] text-[11px] text-[color:var(--muted)]">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
