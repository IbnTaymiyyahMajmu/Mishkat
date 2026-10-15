"use client";

import { FAMILIES, type Family, type Rule } from "@/lib/quran/tajweed";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { toneClass } from "./TajweedWord";
import tj from "./Tajweed.module.css";
import styles from "./TajweedLegend.module.css";

const FAMILY_RULE: Record<Family, Rule> = {
  hold: "madda_obligatory_mottasel",
  nasal: "ghunnah",
  bounce: "qalaqah",
  merge: "idgham_wo_ghunnah",
  silent: "ham_wasl",
};

/** The five families and their colours, as a key — for the settings page. */
export function TajweedSwatches() {
  const { t } = useLocale();
  return (
    <ul className={styles.swatches}>
      {FAMILIES.map((f) => (
        <li key={f}>
          <span className={`${tj.swatch} ${toneClass(FAMILY_RULE[f])}`} aria-hidden="true" />
          <b>{t(`tj.family.${f}` as MessageKey)}</b> {t(`tj.familyDo.${f}` as MessageKey)}
        </li>
      ))}
    </ul>
  );
}
