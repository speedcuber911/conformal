"use client";

import { useState } from "react";
import styles from "./ConformalHomePage.module.css";

const pillars = [
  {
    index: "01",
    title: "Platforms",
    body: "Enterprise software and AI platforms built to sit inside existing workflows - not replace the teams that run them.",
  },
  {
    index: "02",
    title: "Models & Data",
    body: "Proprietary model development and data licensing, tuned to the language and signals of each domain we serve.",
  },
  {
    index: "03",
    title: "Research",
    body: "Applied R&D and original IP - the long-horizon work that keeps deployed systems ahead of the field.",
  },
  {
    index: "04",
    title: "Consulting",
    body: "Forward-deployed engineering and transformation work, embedded alongside the enterprises adopting it.",
  },
] as const;

export function ConformalHomePageClient({ fontClassName }: { fontClassName: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  return (
    <main className={`${styles.page} ${fontClassName}`} data-theme={theme}>
      <div className={styles.gridBg} />
      <div className={styles.halo} />

      <div className={styles.wrap}>
        <nav className={`${styles.nav} ${styles.reveal} ${styles.d1}`} aria-label="Primary">
          <a className={styles.mark} href="#">
            Conformal
          </a>
          <button
            className={styles.toggle}
            type="button"
            aria-label="Toggle theme"
            aria-pressed={theme === "dark"}
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          />
        </nav>

        <header className={styles.hero}>
          <span className={`${styles.eyebrow} ${styles.reveal} ${styles.d2}`}>
            Enterprise AI
          </span>
          <h1 className={`${styles.headline} ${styles.reveal} ${styles.d2}`}>
            Intelligence that <em>maps</em> to how your enterprise already works.
          </h1>
          <p className={`${styles.lede} ${styles.reveal} ${styles.d3}`}>
            Conformal builds AI platforms, models, and deployment systems for the
            enterprise - engineered to preserve the structure of your business while
            transforming what it can do.
          </p>
        </header>
      </div>

      <div className={styles.wrap}>
        <section className={styles.pillars} id="pillars">
          <div className={`${styles.sectionHead} ${styles.reveal} ${styles.d2}`}>
            What we build
          </div>
          <div className={`${styles.grid} ${styles.reveal} ${styles.d3}`}>
            {pillars.map((pillar) => (
              <article className={styles.cell} key={pillar.index}>
                <span className={styles.idx}>{pillar.index}</span>
                <h2>{pillar.title}</h2>
                <p>{pillar.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className={styles.wrap}>
        <section className={styles.closer} id="contact">
          <h2 className={`${styles.closerTitle} ${styles.reveal} ${styles.d2}`}>
            Creating change. Without distortion.
          </h2>
          <p className={`${styles.sub} ${styles.reveal} ${styles.d3}`}>
            Built for the enterprises defining what comes next.
          </p>
        </section>
      </div>

      <div className={styles.wrap}>
        <footer className={styles.footer}>
          <div className={styles.footInner}>
            <span>© 2026 Conformal AI Technologies</span>
            <span>Enterprise AI</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
