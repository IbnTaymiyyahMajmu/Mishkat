"use client";

import type { ReactNode } from "react";
import styles from "./Plan.module.css";

/** The head of the plan page, lit like the other frontispieces: words on one side, the ring on the other. */
export function PlanHero({
  kicker,
  title,
  children,
  ring,
}: {
  kicker: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  ring: ReactNode;
}) {
  return (
    <section className={styles.hero}>
      <div aria-hidden="true" className={styles.motes} />
      <div className={styles.heroInner}>
        <div className={styles.heroText}>
          <span className={styles.kicker}>{kicker}</span>
          <h1 className={`${styles.title} mk-shine`} data-text={title}>
            {title}
          </h1>
          {children}
        </div>
        <div className={styles.heroRing}>{ring}</div>
      </div>
    </section>
  );
}
