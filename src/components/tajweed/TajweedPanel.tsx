"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RULES, rulesIn, stopping, waqfIn, type Rule } from "@/lib/quran/tajweed";
import type { Verse } from "@/lib/quran/types";
import { useLocale } from "@/lib/i18n";
import { RuleCard, StopCard, WaqfCard } from "./Cards";
import { QariVoice } from "./QariVoice";
import { TajweedWord } from "./TajweedWord";
import tj from "./Tajweed.module.css";
import styles from "./TajweedPanel.module.css";

/**
 * Tajweed beside the reader: the word that was tapped, large and in colour,
 * with every rule in it explained and counted out, and the sound of the word
 * to copy. Under it, what to do on stopping if the word ends the ayah, and
 * every other word of the ayah a rule applies to, to go on to.
 *
 * Opened from a coloured letter, it begins with that letter's rule.
 */
export function TajweedPanel({
  verse,
  markup,
  wordPosition,
  rule,
  onPickWord,
}: {
  verse: Verse | undefined;
  /** The ayah's words' marking, by position; undefined while it is on its way. */
  markup: string[] | undefined;
  wordPosition?: number;
  rule?: Rule;
  onPickWord: (position: number) => void;
}) {
  const { t } = useLocale();
  const words = useMemo(() => verse?.words.filter((w) => w.char_type_name === "word") ?? [], [verse]);
  const last = words[words.length - 1]?.position;
  const position = wordPosition ?? last;
  const word = words.find((w) => w.position === position);
  const marked = position ? markup?.[position] : undefined;

  const rules = useMemo(() => {
    const list = marked ? rulesIn(marked) : [];
    return rule && list.includes(rule) ? [rule, ...list.filter((r) => r !== rule)] : list;
  }, [marked, rule]);
  const signs = useMemo(() => (marked ? waqfIn(marked) : []), [marked]);
  const stops = useMemo(() => (marked && position === last ? stopping(marked) : []), [marked, position, last]);

  if (!verse) return null;
  if (!markup) return <p className={styles.quiet}>{t("common.loadingText")}</p>;

  const others = words.filter((w) => w.position !== position && markup[w.position] && rulesIn(markup[w.position]).length);

  return (
    <div className={styles.panel}>
      {word && marked && (
        <section className={styles.word}>
          <p lang="ar" dir="rtl" className={styles.big}>
            <TajweedWord markup={marked} picked={rule ?? null} />
          </p>
          {word.transliteration?.text && <p className={styles.translit}>{word.transliteration.text}</p>}
          {verse && <QariVoice verseKey={verse.verse_key} position={word.position} />}
        </section>
      )}

      <section className={styles.cards}>
        {rules.length === 0 && signs.length === 0 && <p className={styles.quiet}>{t("tj.panel.none")}</p>}
        {rules.map((r) => (
          <RuleCard key={r} rule={r} picked={r === rule} />
        ))}
        {signs.map((w, i) => (
          <WaqfCard key={`${w}${i}`} waqf={w} />
        ))}
        <StopCard stops={stops} />
      </section>

      {others.length > 0 && (
        <section>
          <h3 className={styles.heading}>{t("tj.panel.ayah")}</h3>
          <div dir="rtl" className={styles.others}>
            {others.map((w) => (
              <button key={w.position} type="button" className={styles.other} onClick={() => onPickWord(w.position)}>
                <span lang="ar" className={styles.otherWord}>
                  <TajweedWord markup={markup[w.position]} />
                </span>
                <span className={styles.otherDots} aria-hidden="true">
                  {rulesIn(markup[w.position]).map((r) => (
                    <span key={r} className={`${tj.swatch} ${tj[RULES[r].tone]}`} />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <Link href="/tajweed/" className={styles.guide}>
        {t("tj.guide")}
      </Link>
    </div>
  );
}
