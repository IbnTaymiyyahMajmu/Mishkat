"use client";

import Link from "next/link";
import { useLocale, type MessageKey } from "@/lib/i18n";
import styles from "./PrivacyPage.module.css";

/**
 * What Mishkāt keeps, and what it tells anyone: `/privacy/`.
 *
 * It is the site's and the Android app's alike — the app carries this page
 * inside it, and Google Play links to it here — so each sentence has to be
 * true of both. It is a description of what the code does, not a promise
 * beside it: a change to what the site stores or whom it asks for something
 * is a change to this page, and to `UPDATED`.
 */

/** The day this page last changed what it says. */
const UPDATED = Date.UTC(2026, 9, 30);

/** Where a reader can write with a question about it. Google Play's listing gives the same address. */
const EMAIL = "MishkatQuran@outlook.com";

/** Whom the site asks for what, in the order a reader meets them. */
const ASKED: MessageKey[] = [
  "privacy.fetched.corpus",
  "privacy.fetched.audio",
  "privacy.fetched.tafsir",
  "privacy.fetched.lexicons",
  "privacy.fetched.clear",
  "privacy.fetched.books",
];

/** A host named in a sentence: isolated, so an address keeps its own direction in a Persian or Pashto line. */
function Host(words: string) {
  return (
    <bdi dir="ltr" className={styles.host}>
      {words}
    </bdi>
  );
}

export function PrivacyPage() {
  const { t, rich, date } = useLocale();

  return (
    <div className="page-shell">
      <article className={styles.body}>
        <header className={styles.head}>
          <div className="kicker">{t("privacy.kicker")}</div>
          <h1 className={styles.title}>{t("privacy.title")}</h1>
          <p className={styles.lede}>{t("privacy.lede")}</p>
        </header>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("privacy.kept.title")}</h2>
          <p>
            {rich("privacy.kept.text", {
              link: (words) => <Link href="/settings/">{words}</Link>,
            })}
          </p>
          <p>{t("privacy.kept.cache")}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("privacy.fetched.title")}</h2>
          <p>{t("privacy.fetched.text")}</p>
          <ul className={styles.hosts}>
            {ASKED.map((key) => (
              <li key={key}>{rich(key, { b: Host })}</li>
            ))}
          </ul>
          <p>{t("privacy.fetched.search")}</p>
          <p>{t("privacy.fetched.links")}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("privacy.served.title")}</h2>
          <p>{t("privacy.served.text")}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("privacy.app.title")}</h2>
          <p>{t("privacy.app.text")}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t("privacy.questions.title")}</h2>
          <p>
            {rich(
              "privacy.questions.text",
              {
                link: (words) => (
                  <a href={`mailto:${EMAIL}`}>
                    <bdi dir="ltr">{words}</bdi>
                  </a>
                ),
              },
              { email: EMAIL },
            )}
          </p>
          <p className={styles.updated}>{t("privacy.updated", { date: date(UPDATED) })}</p>
        </section>
      </article>
    </div>
  );
}
