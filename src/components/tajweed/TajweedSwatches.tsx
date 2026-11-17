"use client";

import { FAMILIES } from "@/lib/quran/tajweed";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { FamilyMark } from "./TajweedLegend";
import styles from "./TajweedLegend.module.css";

/** The five families and their colours, as a key — for the settings page. */
export function TajweedSwatches() {
  const { t } = useLocale();
  return (
    <ul className={styles.swatches}>
      {FAMILIES.map((f) => (
        <li key={f}>
          <FamilyMark family={f} />
          <b>{t(`tj.family.${f}` as MessageKey)}</b> {t(`tj.familyDo.${f}` as MessageKey)}
        </li>
      ))}
    </ul>
  );
}
