"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { fetchTajweedPage } from "@/lib/quran/api";
import { FAMILIES, RULES, RULE_ORDER, WAQF_ORDER, rulesIn, type Family, type Rule, type Stop } from "@/lib/quran/tajweed";
import { useSettings } from "@/lib/store/settings";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { Beats, RuleCard, WaqfCard } from "./Cards";
import { spotlight } from "./TajweedLegend";
import { TajweedWord, toneClass } from "./TajweedWord";
import tj from "./Tajweed.module.css";
import styles from "./TajweedGuide.module.css";

/**
 * The guide to the colours: `/tajweed/`.
 *
 * Every rule is shown with the words it is met in, and those words are asked
 * of the corpus as the page opens — from al-Fātiḥah and the short surahs a
 * reader is likeliest to know by heart, then al-Baqarah — so the examples are
 * the text itself, marked as the reader will see it marked, and nothing here
 * is a copy of it.
 */

/** Where examples are looked for, in order: the familiar first. */
const SOURCES: [number, number][] = [
  [1, 1],
  [112, 1],
  [113, 1],
  [114, 1],
  [111, 1],
  [110, 1],
  [108, 1],
  [105, 1],
  [103, 1],
  [97, 1],
  [99, 1],
  [101, 1],
  [77, 1],
  [2, 1],
  [2, 6],
];

interface Example {
  key: string;
  markup: string;
}

const STOPS: Stop[] = ["sukun", "an", "ah", "madd", "long", "shadda", "qalqalah"];

interface Found {
  examples: Map<Rule, Example[]>;
  /** The ayah the page opens on: a short one, from the familiar, that shows the most families. */
  sample: { key: string; words: string[] } | null;
}

function useExamples(): Found | null {
  const [held, setHeld] = useState<Found | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all(SOURCES.map(([s, p]) => fetchTajweedPage(s, p).catch(() => null))).then((pages) => {
      if (!alive) return;
      const examples = new Map<Rule, Example[]>();
      let sample: Found["sample"] = null;
      let best = 0;
      for (const page of pages) {
        for (const v of page?.verses ?? []) {
          const words = v.words.filter((w) => w.char_type_name === "word" && w.text_uthmani_tajweed);
          const marked = words.map((w) => w.text_uthmani_tajweed as string);
          const families = new Set(marked.flatMap((m) => rulesIn(m).map((r) => RULES[r].family))).size;
          if (marked.length <= 12 && families > best) {
            best = families;
            sample = { key: v.verse_key, words: marked };
          }
          for (const w of words) {
            const markup = w.text_uthmani_tajweed as string;
            for (const r of rulesIn(markup)) {
              const list = examples.get(r) ?? [];
              if (list.length < 4 && !list.some((e) => e.markup === markup)) list.push({ key: v.verse_key, markup });
              examples.set(r, list);
            }
          }
        }
      }
      setHeld({ examples, sample });
    });
    return () => {
      alive = false;
    };
  }, []);
  return held;
}

/** A family's colour, for its heading: its first rule's. */
const FAMILY_RULE: Record<Family, Rule> = {
  hold: "madda_obligatory_mottasel",
  nasal: "ghunnah",
  bounce: "qalaqah",
  merge: "idgham_wo_ghunnah",
  silent: "ham_wasl",
};

export function TajweedGuide() {
  const { t } = useLocale();
  const names = useSurahNames();
  const { settings, update } = useSettings();
  const found = useExamples();
  const [focus, setFocus] = useState<Family[]>([]);
  const toggle = (f: Family) => {
    const next = focus.includes(f) ? focus.filter((x) => x !== f) : [...focus, f];
    setFocus(next.length === FAMILIES.length ? [] : FAMILIES.filter((x) => next.includes(x)));
  };
  const byFamily = useMemo(
    () => FAMILIES.map((f) => ({ family: f, rules: RULE_ORDER.filter((r) => RULES[r].family === f) })),
    [],
  );

  return (
    <div className={`page-shell ${styles.shell}`}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.kicker}>{t("tjg.kicker")}</span>
          <h1 className={styles.title}>{t("tjg.title")}</h1>
          <p className={styles.lede}>{t("tjg.lede")}</p>

          <figure className={styles.sample}>
            <p lang="ar" dir="rtl" className={`${styles.sampleText} ${tj.spot}`} {...spotlight(focus)}>
              {found?.sample
                ? found.sample.words.map((m, i) => (
                    <Fragment key={i}>
                      {i > 0 && " "}
                      <TajweedWord markup={m} />
                    </Fragment>
                  ))
                : " "}
            </p>
            <figcaption className={styles.sampleCaption}>
              {found?.sample ? t("tjg.sample", { ref: `${names.name(Number(found.sample.key.split(":")[0]))} ${found.sample.key}` }) : " "}
            </figcaption>
            <div className={styles.families} role="group" aria-label={t("tj.legend.label")}>
              {FAMILIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={focus.includes(f)}
                  className={`${styles.family} ${focus.includes(f) ? styles.familyOn : ""}`}
                  onClick={() => toggle(f)}
                >
                  <span className={`${tj.swatch} ${toneClass(FAMILY_RULE[f])}`} aria-hidden="true" />
                  <span className={styles.familyName}>{t(`tj.family.${f}` as MessageKey)}</span>
                  <span className={styles.familyDo}>{t(`tj.familyDo.${f}` as MessageKey)}</span>
                </button>
              ))}
            </div>
          </figure>
        </div>
      </section>

      <div className={styles.body}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("tjg.families.title")}</h2>
          <p className={styles.sectionLede}>{t("tjg.families.lede")}</p>

          {byFamily.map(({ family, rules }) => (
            <div key={family} className={styles.familyBlock}>
              <h3 className={styles.familyTitle}>
                <span className={`${tj.swatch} ${toneClass(FAMILY_RULE[family])}`} aria-hidden="true" />
                {t(`tj.family.${family}` as MessageKey)}
                <span className={styles.familyTitleDo}>{t(`tj.familyDo.${family}` as MessageKey)}</span>
              </h3>
              <div className={styles.rules}>
                {rules.map((rule) => {
                  const examples = found?.examples.get(rule) ?? [];
                  return (
                    <div key={rule} className={styles.rule}>
                      <RuleCard rule={rule} />
                      {examples.length > 0 && (
                        <div className={styles.examples}>
                          <span className={styles.examplesLabel}>{t("tjg.examples")}</span>
                          <div dir="rtl" className={styles.exampleList}>
                            {examples.map((e) => (
                              <Link key={`${e.key}${e.markup}`} href={`/read/${e.key.split(":")[0]}/#${e.key}`} className={styles.example}>
                                <span lang="ar" className={styles.exampleWord}>
                                  <TajweedWord markup={e.markup} picked={rule} />
                                </span>
                                <span dir="ltr" className={styles.exampleKey}>
                                  {e.key}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("tjg.count.title")}</h2>
          <p className={styles.sectionLede}>{t("tjg.count.text")}</p>
          <div className={styles.metronome}>
            <Beats counts={[2, 4, 5, 6]} />
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("tjg.stop.title")}</h2>
          <p className={styles.sectionLede}>{t("tjg.stop.text")}</p>
          <div className={styles.waqfs}>
            {WAQF_ORDER.map((w) => (
              <WaqfCard key={w} waqf={w} />
            ))}
          </div>
          <h3 className={styles.subTitle}>{t("tjg.stop.endsTitle")}</h3>
          <ul className={styles.ends}>
            {STOPS.map((s) => (
              <li key={s}>{t(`tj.stop.${s}` as MessageKey)}</li>
            ))}
          </ul>
        </section>

        <section className={`${styles.section} ${styles.reader}`}>
          <h2 className={styles.sectionTitle}>{t("tjg.reader.title")}</h2>
          <p className={styles.sectionLede}>{t("tjg.reader.text")}</p>
          <button
            type="button"
            className={`btn ${settings.tajweed ? "btn-secondary" : "btn-primary"}`}
            aria-pressed={settings.tajweed}
            onClick={() => update({ tajweed: !settings.tajweed })}
          >
            {settings.tajweed ? t("tjg.reader.off") : t("tjg.reader.on")}
          </button>
          {settings.tajweed && <span className={styles.isOn}>{t("tjg.reader.isOn")}</span>}
        </section>

        <p className={styles.source}>{t("tjg.source")}</p>
      </div>
    </div>
  );
}
