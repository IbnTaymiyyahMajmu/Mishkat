"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import type { Verse } from "@/lib/quran/types";
import { fetchVerse } from "@/lib/quran/api";
import { tafsirWork } from "@/lib/quran/tafsir";
import {
  fetchAyahXrefs,
  fetchXrefExcerpt,
  type AyahXrefs,
  type XrefCitation,
  type XrefExcerpt,
  type XrefLink,
} from "@/lib/quran/xref";
import { useTafsirSay } from "@/components/tafsir/useTafsirSay";
import { useTafsirShelf } from "@/components/tafsir/useTafsirShelf";
import { useSettings } from "@/lib/store/settings";
import { useLocale } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { plainText } from "@/lib/text";
import panels from "./Panels.module.css";
import styles from "./XrefPanel.module.css";

interface Props {
  verse: Verse | undefined;
  verseKey: string;
  ayahCount: number;
  onMove: (verseKey: string) => void;
  /** Turn the panel to the tafsir, which will be open on the work just picked. */
  onShowTafsir: () => void;
}

/** How many links are laid out before the reader asks for more. */
const FIRST = 8;
const MORE = 12;

/** The work quoted for what he relates and nothing else; see the introductions. */
const REPORTS_ONLY = new Set(["qurtubi"]);

/**
 * The Qurʾān explained by the Qurʾān, beside the ayah.
 *
 * The oldest rule of tafsir is that the Qurʾān is first explained by the
 * Qurʾān: what one ayah leaves general, another makes particular; what one
 * tells in brief, another tells at length. The commentators do it on every
 * page, quoting the other ayah where they explain this one. This panel is
 * those quotations gathered — each ayah they reached for, how many of them
 * reached for it, and, a press away, the very sentence each did it in.
 *
 * It reads both ways. Under the ayat brought in to explain this one are the
 * ayat whose commentators brought *this* one in, which is often the more
 * surprising list.
 */
export function XrefPanel({ verse, verseKey, ayahCount, onMove, onShowTafsir }: Props) {
  const { t, n } = useLocale();
  const { pick } = useTafsirShelf();
  const onReadTafsir = (workId: string) => {
    pick(workId);
    onShowTafsir();
  };
  const [state, setState] = useState<{ key: string; xrefs: AyahXrefs | null; failed: boolean } | null>(null);
  const [shown, setShown] = useState<{ key: string; count: number }>({ key: verseKey, count: FIRST });

  const [surah, ayahText] = verseKey.split(":");
  const ayah = Number(ayahText);
  const total = Math.max(ayahCount, ayah);

  useEffect(() => {
    let live = true;
    fetchAyahXrefs(verseKey)
      .then((xrefs) => live && setState({ key: verseKey, xrefs, failed: false }))
      .catch(() => live && setState({ key: verseKey, xrefs: null, failed: true }));
    return () => {
      live = false;
    };
  }, [verseKey]);

  const here = state?.key === verseKey ? state : null;
  const brought = here?.xrefs?.brought ?? [];
  const bringing = here?.xrefs?.bringing ?? [];
  const count = shown.key === verseKey ? shown.count : FIRST;

  return (
    <>
      {verse && (
        <div dir="rtl" lang="ar" translate="no" className={panels.tafsirVerse}>
          {verse.text_uthmani}
        </div>
      )}

      <div className={panels.tafsirBar}>
        <div className={panels.stepper} style={{ marginTop: 0 }}>
          <button
            className={panels.step}
            onClick={() => onMove(`${surah}:${ayah - 1}`)}
            disabled={ayah <= 1}
            aria-label={t("panel.prev", { n: ayah - 1 })}
          >
            ‹ {ayah > 1 ? ayah - 1 : ""}
          </button>
          <span className={panels.stepHere}>{t("common.ayahOf", { n: ayah, total })}</span>
          <button
            className={panels.step}
            onClick={() => onMove(`${surah}:${ayah + 1}`)}
            disabled={ayah >= total}
            aria-label={t("panel.next", { n: ayah + 1 })}
          >
            {ayah < total ? ayah + 1 : ""} ›
          </button>
        </div>
      </div>

      {!here && <p className={panels.empty}>{t("common.loading")}</p>}
      {here?.failed && <p className={panels.empty}>{t("xref.failed")}</p>}

      {here?.xrefs && (
        <>
          <p className={styles.lead}>
            {brought.length
              ? t("xref.lead", { count: brought.length })
              : t("xref.none")}
          </p>

          <ol className={styles.links}>
            {brought.slice(0, count).map((link, i) => (
              <LinkCard
                key={link.key}
                link={link}
                index={i}
                direction="brought"
                onReadTafsir={onReadTafsir}
              />
            ))}
          </ol>

          {brought.length > count && (
            <button
              className={`btn btn-secondary ${styles.more}`}
              onClick={() => setShown({ key: verseKey, count: count + MORE })}
            >
              {t("xref.more", { count: Math.min(MORE, brought.length - count) })}
            </button>
          )}

          {bringing.length > 0 && (
            <section className={styles.reverse}>
              <h3 className={styles.reverseTitle}>{t("xref.bringingTitle")}</h3>
              <p className={styles.reverseLead}>{t("xref.bringingLead", { count: bringing.length })}</p>
              <ul className={styles.reverseList}>
                {bringing.map((link) => (
                  <ReverseRow key={link.key} link={link} />
                ))}
              </ul>
            </section>
          )}

          <p className={panels.footnote}>{t("xref.method", { works: n(11) })}</p>
        </>
      )}
    </>
  );
}

/** One ayah brought in: its text, who brought it, and — opened — how. */
function LinkCard({
  link,
  index,
  direction,
  onReadTafsir,
}: {
  link: XrefLink;
  index: number;
  direction: "brought" | "bringing";
  onReadTafsir: (workId: string) => void;
}) {
  const { t, arrows } = useLocale();
  const names = useSurahNames();
  const say = useTafsirSay();
  const { settings } = useSettings();
  const [open, setOpen] = useState<string | null>(null);
  const text = useAyahText(link.key, settings.translationId);

  const works = link.works.map((id) => tafsirWork(`app:${id}`)).filter((w) => !!w);
  const opened = open ? link.citations.find((c) => c.work === open) : undefined;

  return (
    <li className={styles.card} style={{ "--i": Math.min(index, 8) } as CSSProperties}>
      <div className={styles.cardHead}>
        <Link href={`/read/${link.surah}/#${link.key}`} className={styles.key}>
          <span className={styles.keyNumber}>{link.key}</span>
          <span className={names.arabic ? "surah-ar" : undefined}>{names.name(link.surah)}</span>
        </Link>
        <span className={styles.strength} title={t("xref.byWorks", { count: link.works.length })}>
          <span className={styles.pips} aria-hidden="true">
            {link.works.slice(0, 7).map((w) => (
              <span key={w} className={styles.pip} />
            ))}
          </span>
          <span className={styles.strengthText}>{t("xref.byWorks", { count: link.works.length })}</span>
        </span>
      </div>

      {text === null ? (
        <p className={styles.waiting}>{t("common.loading")}</p>
      ) : (
        text && (
          <>
            <p lang="ar" dir="rtl" translate="no" className={styles.arabic}>
              {text.arabic}
            </p>
            {text.translation && (
              <p dir="auto" className={styles.translation}>
                {text.translation}
              </p>
            )}
          </>
        )
      )}

      <div className={styles.who} role="group" aria-label={t("xref.who")}>
        {works.map((work) => {
          const id = work!.id.replace(/^app:/, "");
          const on = open === id;
          return (
            <button
              key={id}
              className={`${styles.chip} ${on ? styles.chipOn : ""}`}
              aria-expanded={on}
              onClick={() => setOpen(on ? null : id)}
            >
              {say.short(work!)}
            </button>
          );
        })}
      </div>

      {opened && (
        <Excerpt
          citation={opened}
          direction={direction}
          onRead={() => onReadTafsir(`app:${opened.work}`)}
          readLabel={`${t("xref.readHere", { name: say.short(tafsirWork(`app:${opened.work}`)!) })} ${arrows.next}`}
        />
      )}
    </li>
  );
}

/** An ayah elsewhere whose commentators bring this one in. Lighter: a line, until opened. */
function ReverseRow({ link }: { link: XrefLink }) {
  const { t, arrows } = useLocale();
  const names = useSurahNames();
  const say = useTafsirSay();
  const [open, setOpen] = useState<string | null>(null);
  const opened = open ? link.citations.find((c) => c.work === open) : undefined;

  return (
    <li className={styles.row}>
      <div className={styles.rowHead}>
        <Link href={`/read/${link.surah}/#${link.key}`} className={styles.key}>
          <span className={styles.keyNumber}>{link.key}</span>
          <span className={names.arabic ? "surah-ar" : undefined}>{names.name(link.surah)}</span>
        </Link>
        <span className={styles.rowWho}>
          {link.works.map((id) => {
            const work = tafsirWork(`app:${id}`);
            if (!work) return null;
            const on = open === id;
            return (
              <button
                key={id}
                className={`${styles.chip} ${styles.chipSmall} ${on ? styles.chipOn : ""}`}
                aria-expanded={on}
                onClick={() => setOpen(on ? null : id)}
              >
                {say.short(work)}
              </button>
            );
          })}
        </span>
      </div>
      {opened && (
        <Excerpt
          citation={opened}
          direction="bringing"
          href={`/tafsir/?v=${opened.surah}:${opened.from}&w=${encodeURIComponent(`app:${opened.work}`)}`}
          readLabel={`${t("xref.readThere", { key: `${opened.surah}:${opened.from}` })} ${arrows.next}`}
        />
      )}
    </li>
  );
}

/** The commentator's own sentence, with the Qurʾān in it set as the Qurʾān. */
function Excerpt({
  citation,
  direction,
  onRead,
  href,
  readLabel,
}: {
  citation: XrefCitation;
  direction: "brought" | "bringing";
  onRead?: () => void;
  href?: string;
  readLabel: string;
}) {
  const { t } = useLocale();
  const say = useTafsirSay();
  const [state, setState] = useState<{ for: XrefCitation; excerpt: XrefExcerpt | null } | null>(null);

  useEffect(() => {
    let live = true;
    fetchXrefExcerpt(citation)
      .then((excerpt) => live && setState({ for: citation, excerpt }))
      .catch(() => live && setState({ for: citation, excerpt: null }));
    return () => {
      live = false;
    };
  }, [citation]);

  const work = tafsirWork(`app:${citation.work}`);
  const ready = state?.for === citation ? state : null;
  const scope =
    citation.from === citation.to
      ? null
      : t("xref.scope", { from: citation.from, to: citation.to });

  return (
    <figure className={styles.excerpt}>
      {!ready ? (
        <p className={styles.waiting}>{t("common.loading")}</p>
      ) : ready.excerpt ? (
        <blockquote lang="ar" dir="rtl" className={styles.excerptText}>
          {ready.excerpt.clippedStart && "… "}
          {ready.excerpt.pieces.map((piece, i) =>
            i % 2 ? (
              <span key={i} className={styles.quran}>
                ﴿{piece}﴾
              </span>
            ) : (
              piece
            ),
          )}
          {ready.excerpt.clippedEnd && " …"}
        </blockquote>
      ) : (
        <p className={styles.waiting}>{t("xref.excerptFailed")}</p>
      )}
      <figcaption className={styles.excerptFoot}>
        {work && <span className={styles.excerptBy}>{say.credit(work)}</span>}
        {work && <span className={styles.excerptWork}>{say.name(work)}</span>}
        {direction === "bringing" && (
          <span className={styles.excerptScope}>{t("xref.onAyah", { key: `${citation.surah}:${citation.from}` })}</span>
        )}
        {direction === "brought" && scope && <span className={styles.excerptScope}>{scope}</span>}
        {REPORTS_ONLY.has(citation.work) && (
          <span className={styles.excerptNote}>{t("intro.evidence.reportsOnly")}</span>
        )}
        {onRead ? (
          <button className={styles.excerptRead} onClick={onRead}>
            {readLabel}
          </button>
        ) : (
          href && (
            <Link href={href} className={styles.excerptRead}>
              {readLabel}
            </Link>
          )
        )}
      </figcaption>
    </figure>
  );
}

/**
 * An ayah's Arabic and the reader's first translation of it, for a card. Null
 * while it is on its way, false where it could not be had.
 */
function useAyahText(key: string, translationId: number): { arabic: string; translation: string } | false | null {
  const [state, setState] = useState<{ for: string; text: { arabic: string; translation: string } | false } | null>(null);
  const slot = `${key}|${translationId}`;

  useEffect(() => {
    let live = true;
    fetchVerse(key, translationId)
      .then((v) => {
        if (!live) return;
        setState({
          for: slot,
          text: v ? { arabic: v.text_uthmani, translation: plainText(v.translations?.[0]?.text) } : false,
        });
      })
      .catch(() => live && setState({ for: slot, text: false }));
    return () => {
      live = false;
    };
  }, [key, translationId, slot]);

  return state?.for === slot ? state.text : null;
}
