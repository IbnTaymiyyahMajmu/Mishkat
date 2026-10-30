"use client";

import { book, credit } from "@/lib/ulum/books";
import { MORPHOLOGY_SOURCE } from "@/lib/quran/lexicon";
import { TAFSIR_APP } from "@/lib/quran/tafsirApp";
import { useLocale } from "@/lib/i18n";
import { Chapter } from "./Chapter";
import { useCitations, type Citations, type StudyCtx } from "./study";
import styles from "./AyahStudy.module.css";

/**
 * 12 · Sources — every work this study cited, and the places it was opened,
 * built from what the chapters above actually showed. Then what the page stands
 * on that is not a book: the corpus, tafsir.app, and where the rest was read.
 */
export function Sources({ ctx, cited }: { ctx: StudyCtx; cited: Citations }) {
  const { t } = useLocale();
  const list = useCitations(cited)
    .map(({ id, places }) => ({ id, places, b: book(id) }))
    .filter((x) => x.b)
    .sort((a, b) => (a.b!.died ?? 1500) - (b.b!.died ?? 1500));

  return (
    <Chapter
      id="sources"
      num="12"
      kicker={t("ulum.k.sources", { count: list.length })}
      title={t("ulum.ch.sources")}
      sub={t("ulum.s.sources")}
      arabic="المصادر"
      ctx={ctx}
    >
      <div className={styles.ledger}>
        {list.map(({ id, places, b }, k) => (
          <div key={id} className={styles.ledgerRow}>
            <span className={styles.ledgerNum}>{String(k + 1).padStart(2, "0")}</span>
            <div className={styles.ledgerBody}>
              <div className={styles.ledgerHead}>
                <i>{b!.name}</i>
                <span lang="ar" className={styles.ledgerAr}>
                  {b!.titleArabic ?? b!.nameArabic}
                </span>
              </div>
              <div className={styles.ledgerBy}>{credit(b!)}</div>
              <div className={styles.ledgerPlaces}>{places.join(" · ")}</div>
            </div>
          </div>
        ))}
      </div>
      <p className={styles.colophon}>
        {t("ulum.colophon", { corpus: MORPHOLOGY_SOURCE.name, site: TAFSIR_APP.name, shamela: "Shamela", openiti: "OpenITI" })}{" "}
        <a href={MORPHOLOGY_SOURCE.href} target="_blank" rel="noopener noreferrer">
          {MORPHOLOGY_SOURCE.name}
        </a>{" "}
        ·{" "}
        <a href={TAFSIR_APP.href} target="_blank" rel="noopener noreferrer">
          {TAFSIR_APP.name} — {TAFSIR_APP.nameArabic}
        </a>{" "}
        ·{" "}
        <a href="https://github.com/fawazahmed0/hadith-api" target="_blank" rel="noopener noreferrer">
          hadith-api
        </a>{" "}
        ·{" "}
        <a href="https://shamela.ws" target="_blank" rel="noopener noreferrer">
          Shamela
        </a>{" "}
        ·{" "}
        <a href="https://doi.org/10.5281/zenodo.3082463" target="_blank" rel="noopener noreferrer">
          OpenITI
        </a>{" "}
        <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">
          (CC BY-NC-SA 4.0)
        </a>
      </p>
    </Chapter>
  );
}
