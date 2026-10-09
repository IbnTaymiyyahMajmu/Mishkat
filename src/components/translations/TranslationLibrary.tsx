"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { fetchRenderings, fetchVerse } from "@/lib/quran/api";
import { DEFAULT_TRANSLATION, MAX_TRANSLATIONS } from "@/lib/quran/resources";
import { shelvesFor, translationName } from "@/lib/quran/translations";
import { TRANSLATION_FILES } from "@/lib/quran/translationFiles";
import { TranslationText } from "./TranslationText";
import { useTranslationShelf } from "./useTranslationShelf";
import { useLocale } from "@/lib/i18n";
import styles from "./Translation.module.css";

interface Props {
  /** The ayah every translation is shown rendering. */
  verseKey: string;
  /**
   * Set the ayah's Arabic above the renderings. Beside the text it is already
   * in front of the reader; on the settings page it is not, and a rendering of
   * an ayah nobody can see is a sentence out of nowhere.
   */
  showAyah?: boolean;
}

/**
 * The library of translations, chosen from by reading them.
 *
 * A list of translators' names is a list of riddles to anyone who has not
 * already made up their mind: nothing about "Pickthall" or "Taisirul Quran"
 * says what it is like to read. What does is the translation itself. So the
 * library is one ayah — the one the reader is on — as every translator in a
 * language rendered it, each under his name. Reading down the list is the
 * comparison, and the pin beside one sets it under every ayah from then on.
 *
 * The same thing answers the other question a translation raises, which is
 * what the Arabic allows: where eight translators agree the meaning is plain,
 * and where they part is where the tafsir is worth opening.
 *
 * The catalogue is the corpus's own, read when the library is opened — some
 * 125 translations in seventy languages — so one that is added appears here
 * and one that is withdrawn is gone, without this site being rebuilt.
 */
export function TranslationLibrary({ verseKey, showAyah = false }: Props) {
  const { ids, catalogue, failed, retry, toggle, lead, full } = useTranslationShelf();
  const [chosen, setChosen] = useState<string | null>(null);
  const pickId = useId();
  const { t, rich } = useLocale();

  // The Arabic is the corpus's, asked for rather than typed in here: the text
  // of the Qur'an is not something to be set down from memory in a component.
  const [arabic, setArabic] = useState<{ key: string; text: string } | null>(null);
  useEffect(() => {
    if (!showAyah) return;
    let alive = true;
    fetchVerse(verseKey, DEFAULT_TRANSLATION).then(
      (v) => alive && v && setArabic({ key: verseKey, text: v.text_uthmani }),
    );
    return () => {
      alive = false;
    };
  }, [showAyah, verseKey]);

  const shelves = useMemo(
    () =>
      catalogue
        ? shelvesFor(catalogue, ids, typeof navigator === "undefined" ? [] : (navigator.languages ?? []))
        : [],
    [catalogue, ids],
  );

  // The shelf in front is the language being read in, until the reader turns
  // to another.
  const reading = catalogue?.byId.get(ids[0])?.language ?? "english";
  const shelf = shelves.find((s) => s.key === (chosen ?? reading)) ?? shelves[0];

  // ── the ayah, in every translation on the shelf ───────────────────────────
  const stamp = shelf ? `${verseKey}|${shelf.key}` : "";
  const [answer, setAnswer] = useState<{ stamp: string; texts: Map<number, string> | null } | null>(null);
  useEffect(() => {
    if (!shelf) return;
    let alive = true;
    fetchRenderings(
      verseKey,
      shelf.editions.map((e) => e.id),
    ).then(
      (texts) => alive && setAnswer({ stamp, texts }),
      () => alive && setAnswer({ stamp, texts: null }),
    );
    return () => {
      alive = false;
    };
  }, [verseKey, shelf, stamp]);
  /** `undefined` while on its way, `null` if it could not be had. */
  const texts = answer?.stamp === stamp ? answer.texts : undefined;

  /** Where a translation stands under the ayah: read first, or set second, third… */
  const placeLabel = (place: number) =>
    place === 0
      ? t("translations.readFirst")
      : place === 1
        ? t("translations.place.2")
        : place === 2
          ? t("translations.place.3")
          : place === 3
            ? t("translations.place.4")
            : t("translations.place.n", { n: place + 1 });

  if (!catalogue) {
    return failed ? (
      <div className={styles.unreached}>
        <p>{t("translations.unreached")}</p>
        <button className="btn btn-primary" onClick={retry}>
          {t("common.tryAgain")}
        </button>
      </div>
    ) : (
      <p className={styles.waiting}>{t("translations.opening")}</p>
    );
  }

  return (
    <div className={styles.library}>
      {/* What is already chosen, and in what order. The first is the one a
          bookmark is saved in and a search looks through. */}
      <section className={styles.kept} aria-label={t("translations.keptLabel")}>
        <h3 className={styles.keptTitle}>
          {t("translations.under")}
          <span className={styles.keptCount}>{t("translations.countOf", { count: ids.length, max: MAX_TRANSLATIONS })}</span>
        </h3>
        <ol className={styles.keptList}>
          {ids.map((id, i) => {
            const edition = catalogue.byId.get(id);
            const home = edition && catalogue.shelves.find((s) => s.key === edition.language);
            return (
              <li key={id} className={styles.keptRow}>
                <span className={styles.keptOrder} aria-hidden="true">
                  {i + 1}
                </span>
                <span className={styles.keptName}>
                  {edition?.name || translationName(id) || t("translations.unnamed", { id })}
                  {home && home.key !== "english" && <span className={styles.keptLang}>{home.label}</span>}
                </span>
                {i > 0 && (
                  <button className={styles.keptAct} onClick={() => lead(id)} title={t("translations.firstTitle")}>
                    {t("translations.first")}
                  </button>
                )}
                <button
                  className={styles.keptAct}
                  onClick={() => toggle(id)}
                  disabled={ids.length < 2}
                  aria-label={t("translations.putAway", { name: edition?.name ?? t("translations.this") })}
                  title={t(ids.length < 2 ? "translations.oneStays" : "translations.putAwayTitle")}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <div className={styles.pick}>
        <label className={styles.pickLabel} htmlFor={pickId}>
          {t("translations.language")}
        </label>
        <div className={styles.selectWrap}>
          <select
            id={pickId}
            className={styles.select}
            value={shelf?.key ?? ""}
            onChange={(e) => setChosen(e.target.value)}
          >
            {shelves.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
                {s.native ? ` · ${s.native}` : ""} ({s.editions.length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {showAyah && arabic?.key === verseKey && (
        <p className={styles.ayah} dir="rtl" lang="ar" translate="no">
          {arabic.text}
        </p>
      )}

      <p className={styles.hint}>
        {t(full ? "translations.hintFull" : "translations.hint", { key: verseKey })}
      </p>

      {shelf?.editions.map((edition) => {
        const place = ids.indexOf(edition.id);
        const kept = place !== -1;
        const text = texts?.get(edition.id);
        return (
          <article key={edition.id} className={`${styles.entry} ${kept ? styles.entryOn : ""}`}>
            <div className={styles.entryBody}>
              <header className={styles.entryHead}>
                <h4 className={styles.entryName}>{edition.name}</h4>
                {edition.author && <span className={styles.entryAuthor}>{edition.author}</span>}
                {kept && (
                  <span className={styles.entryPlace}>
                    {placeLabel(place)}
                  </span>
                )}
              </header>

              {text ? (
                <TranslationText text={text} lang={edition.iso} className={styles.entryText} />
              ) : (
                <p className={styles.absent}>
                  {texts === undefined
                    ? "…"
                    : texts === null
                      ? t("translations.entryUnreached")
                      : t("translations.entryNothing")}
                </p>
              )}

              {/* Where it is not the corpus's, it says whose copy it is: the
                  reader is owed the source of what they are reading. */}
              {edition.filed && (
                <p className={styles.entrySource}>
                  {rich(
                    "translations.filed",
                    {
                      link: (words) => (
                        <a href={TRANSLATION_FILES.href} target="_blank" rel="noopener noreferrer">
                          {words}
                        </a>
                      ),
                    },
                    { name: TRANSLATION_FILES.name },
                  )}
                </p>
              )}

              {kept && place > 0 && (
                <button className={styles.entryLead} onClick={() => lead(edition.id)}>
                  {t("translations.readThisFirst")}
                </button>
              )}
            </div>

            <button
              className={`${styles.keep} ${kept ? styles.keepOn : ""}`}
              onClick={() => toggle(edition.id)}
              aria-pressed={kept}
              aria-label={
                t(kept ? "translations.take" : "translations.set", { name: edition.name })
              }
              title={t(kept ? "translations.setTitleOn" : "translations.setTitle")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill={kept ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 17v5" />
                <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
              </svg>
            </button>
          </article>
        );
      })}

      <p className={styles.credit}>
        {t("translations.credit")}
      </p>
    </div>
  );
}

