"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { dayKey, useReadingLog } from "@/lib/store/reading";
import { lightOf } from "@/lib/store/light";
import { useLocale } from "@/lib/i18n";
import { NicheScene } from "./NicheScene";
import { STAGE } from "./NichePage";
import styles from "./NicheCard.module.css";

const noSubscription = () => () => {};

/** The reader's niche on the landing page, small, as a way in to it. */
export function NicheCard() {
  const ready = useSyncExternalStore(noSubscription, () => true, () => false);
  const log = useReadingLog();
  const now = dayKey();
  const light = useMemo(() => lightOf(log, now), [log, now]);
  const { t, n, arrows } = useLocale();
  if (!ready) return null;

  return (
    <Link href="/niche/" className={styles.card}>
      <span className={styles.scene} aria-hidden="true">
        <NicheScene light={light} label="" />
      </span>
      <span className={styles.text}>
        <span className={styles.kicker}>{t("niche.home.kicker")}</span>
        <span className={styles.title}>
          {light.lit ? t(STAGE[light.stage]) : t("niche.home.unlit")} <span aria-hidden="true">{arrows.next}</span>
        </span>
        <span className={styles.line}>
          {light.lit
            ? [
                t("niche.days", { count: light.lit, countText: n(light.lit) }),
                t("niche.gildedOf", { n: n(light.gilded) }),
                light.since === 0 ? t("niche.status.today") : "",
              ]
                .filter(Boolean)
                .join(" · ")
            : t("niche.home.unlitText")}
        </span>
      </span>
    </Link>
  );
}
