"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { setPlan, standing, usePlan } from "@/lib/store/plan";
import { dayKey, useReadingLog } from "@/lib/store/reading";
import { useLocale } from "@/lib/i18n";
import { KhatmRing } from "./KhatmRing";
import { PlanActive } from "./PlanActive";
import { PlanHero } from "./PlanHero";
import { Planner } from "./Planner";
import styles from "./Plan.module.css";

const noSubscription = () => () => {};

/**
 * The khatm plan: `/plan/`.
 *
 * With no plan, or one that is finished or stopped, the page makes one. With
 * a plan under way it is the plan. The plan lives in this browser, so the
 * exported page cannot know which to show; until the browser has said, it
 * shows the head of the page and nothing under it, rather than a planner that
 * turns into a plan a moment later.
 */
export function PlanPage() {
  const ready = useSyncExternalStore(noSubscription, () => true, () => false);
  const { plan } = usePlan();
  const log = useReadingLog();
  const { t } = useLocale();
  const [changing, setChanging] = useState(false);

  const here = useMemo(
    () => (plan && !plan.closed && changing ? standing(plan, log, dayKey()).next || undefined : undefined),
    [plan, log, changing],
  );

  let content;
  if (!ready) {
    content = (
      <PlanHero
        kicker={t("plan.kicker")}
        title={t("plan.title")}
        ring={<KhatmRing portions={[]} label={t("plan.ring.label")} />}
      />
    );
  } else if (!plan || plan.closed || changing) {
    content = (
      <Planner
        previous={plan}
        here={here}
        onBegin={(next) => {
          setPlan(next);
          setChanging(false);
        }}
        onCancel={changing ? () => setChanging(false) : undefined}
      />
    );
  } else {
    content = <PlanActive plan={plan} log={log} onPlan={setPlan} onChange={() => setChanging(true)} />;
  }

  return <div className={`page-shell ${styles.shell}`}>{content}</div>;
}
