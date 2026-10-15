"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useToast } from "../Toast";
import { ENOUGH, dayOffset, finishCycle, setPlan, standing, usePlan } from "@/lib/store/plan";
import { dayKey, useReadingLog } from "@/lib/store/reading";
import { useLocale } from "@/lib/i18n";

const noSubscription = () => () => {};

/**
 * Keeps the plan while the reader reads, wherever they are on the site.
 *
 * When a day's portion is finished it says so, once, there and then — in the
 * reader, under the ayah that finished it. When the whole reading is
 * finished it is counted, and the next one is set for tomorrow if the reader
 * asked for one. Nothing is said about anything finished before this visit:
 * only what the reader has just done.
 */
export function PlanKeeper() {
  const { plan } = usePlan();
  const log = useReadingLog();
  const toast = useToast();
  const { t, n } = useLocale();
  const seen = useRef<{ cycle: string; finished: number } | null>(null);
  // The page is first drawn with what the server knew, which is nothing read
  // and no plan; that is not the reader's state, and is not looked at.
  const ready = useSyncExternalStore(noSubscription, () => true, () => false);

  useEffect(() => {
    if (!ready) return;
    if (!plan || plan.closed) {
      seen.current = null;
      return;
    }
    const now = dayKey();
    const s = standing(plan, log, now);
    if (s.today < 0) return; // the next reading has not begun
    const cycle = `${plan.cycle.start}:${plan.cycle.from}:${plan.cycle.days}`;

    if (s.complete) {
      const next = finishCycle(plan, now);
      setPlan(next);
      toast(t("plan.toast.khatm", { n: n(next.done.length) }), 8000);
      seen.current = null;
      return;
    }

    const before = seen.current;
    seen.current = { cycle, finished: s.finished };
    if (!before || before.cycle !== cycle || s.finished <= before.finished) return;
    // The portion just finished is the latest one read through.
    let day = -1;
    for (let i = s.portions.length - 1; i >= 0; i--) {
      if (s.read[i] >= ENOUGH) {
        day = i;
        break;
      }
    }
    if (day >= 0) toast(t("plan.toast.day", { n: n(dayOffset(plan) + day + 1) }), 4200);
  }, [ready, plan, log, toast, t, n]);

  return null;
}
