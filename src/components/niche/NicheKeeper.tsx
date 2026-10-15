"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useToast } from "../Toast";
import { ENOUGH, usePlan } from "@/lib/store/plan";
import { dayKey, useReadingLog } from "@/lib/store/reading";
import { lightOf } from "@/lib/store/light";
import { useLocale } from "@/lib/i18n";

const noSubscription = () => () => {};

/**
 * Says, once and as it happens, what the reader's reading just did to their
 * niche: the first ayah of a day lights the lamp for the day and a tile with
 * it, a juzʾ read through gilds a medallion, and the last of the thirty hangs
 * a lamp. Wherever on the site the reader is when it happens.
 *
 * A reader with a plan hears about the juzʾ and the khatm from the plan,
 * which knows the day's portion; the niche says only that the lamp is lit.
 */
export function NicheKeeper() {
  const log = useReadingLog();
  const { plan } = usePlan();
  const toast = useToast();
  const { t, n } = useLocale();
  const seen = useRef<{ day: string; lit: number; done: boolean[]; lamps: number } | null>(null);
  // The page is first drawn with what the server knew, which is nothing read;
  // that is not the reader's state, and is not looked at.
  const ready = useSyncExternalStore(noSubscription, () => true, () => false);

  useEffect(() => {
    if (!ready) return;
    const now = dayKey();
    const light = lightOf(log, now);
    const before = seen.current;
    const done = light.juz.map((r) => r >= ENOUGH);
    seen.current = { day: now, lit: light.lit, done, lamps: light.lamps };
    if (!before || before.day !== now) return;
    const planned = !!plan && !plan.closed;

    if (light.lamps > before.lamps) {
      if (!planned) toast(t("niche.toast.lamp"), 7000);
      return;
    }
    const gilded = done.findIndex((d, j) => d && !before.done[j]);
    if (gilded >= 0 && !planned) {
      toast(t("niche.toast.juz", { n: n(gilded + 1) }), 4200);
      return;
    }
    if (light.lit > before.lit) toast(t("niche.toast.day"), 4200);
  }, [ready, log, plan, toast, t, n]);

  return null;
}
