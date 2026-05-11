const stats = [
  { value: "17", label: "Production agents shipped since 2022" },
  { value: "₹38,000 Cr", label: "Combined revenue of enterprises we've worked with" },
  { value: "7 weeks", label: "Median time from kickoff to production" },
  { value: "9 / 11", label: "First engagements that led to a second" },
] as const;

function StatValue({ value }: { value: string }) {
  const match = value.match(/^(.+?)(\s(?:Cr|weeks))$/);

  if (!match) {
    return <>{value}</>;
  }

  return (
    <>
      {match[1]}
      <span className="text-[18px] font-normal">{match[2]}</span>
    </>
  );
}

export function StatsStrip() {
  return (
    <section className="conformal-stats-strip border-y border-[color:var(--line)] px-6 py-9 md:px-9">
      <div className="grid gap-7 md:grid-cols-4 md:gap-8">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="m-0 font-serif text-[42px] font-medium leading-none text-[color:var(--foreground)]">
              <StatValue value={stat.value} />
            </p>
            <p className="mt-3 max-w-[210px] text-[13px] leading-[1.4] text-[color:var(--muted)]">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
