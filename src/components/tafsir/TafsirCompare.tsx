"use client";

import { useEffect, useState } from "react";
import { TAFSIR_LIBRARY, type TafsirWork } from "@/lib/quran/tafsir";
import { measureTafsir, type Measure } from "@/lib/quran/tafsirMap";
import { fetchAyahXrefs, type XrefLink } from "@/lib/quran/xref";
import { useLocale } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { useNarrow, useSwipe } from "@/lib/useSwipe";
import { TafsirReading } from "./TafsirReading";
import { useTafsirSay } from "./useTafsirSay";
import styles from "./TafsirCompare.module.css";

/** How many works are set side by side at once. Four columns is a page's width. */
export const MAX_COMPARED = 4;

/** How many of the ayat the commentators reach for are set out as columns of marks. */
const MEETING = 5;

/** Below this the works are a pile of cards rather than columns. */
const DECK_BELOW = 760;

type Measured = { status: "loading" } | { status: "failed" } | { status: "ready"; measure: Measure | null };

interface Props {
  verseKey: string;
  /** The works being compared, in order: the first is the one read. */
  works: TafsirWork[];
  onChange: (ids: string[]) => void;
  /** Read one work on its own. */
  onRead: (id: string) => void;
  /** Move to another ayah, keeping the works. */
  onGo: (verseKey: string) => void;
}

/**
 * The works of the library set against each other on one ayah.
 *
 * Scholars differ, and the site's rule is that they are shown differing — set
 * side by side under their own names, never averaged into one voice. So this
 * does not summarise what anyone said. It does two things a reader comparing
 * works needs and cannot easily do for themselves.
 *
 * **It maps the library on the ayah.** Every work, and how much it says here:
 * which have nothing, which a line, which forty paragraphs; which take this
 * ayah together with its neighbours. Then, from the cross-references the
 * commentators' own quotations make (lib/quran/xref.ts), the other ayat they
 * reach for in explaining this one, and which of them reached for each —
 * which is where the works can be seen meeting, and parting, without anyone's
 * words being put into anyone's mouth. Every mark is a quotation that stands
 * in the work's own passage.
 *
 * **It sets the chosen works side by side** — up to four, in columns, each
 * under its own heading and folded to its opening paragraphs, so that four
 * passages can be looked down together. On a phone there is no room for
 * columns, and they become a pile of cards, the one on top read and the next
 * a stroke of the thumb away.
 */
export function TafsirCompare({ verseKey, works, onChange, onRead, onGo }: Props) {
  const { t, n } = useLocale();
  const say = useTafsirSay();
  const names = useSurahNames();
  const narrow = useNarrow(DECK_BELOW - 1);
  const ids = works.map((w) => w.id);

  // ── how much each work says here ──────────────────────────────────────────
  const [measured, setMeasured] = useState<{ key: string; by: Record<string, Measured> }>({ key: "", by: {} });
  useEffect(() => {
    let alive = true;
    for (const work of TAFSIR_LIBRARY) {
      measureTafsir(work, verseKey).then(
        (measure) =>
          alive &&
          setMeasured((held) => ({
            key: verseKey,
            by: { ...(held.key === verseKey ? held.by : {}), [work.id]: { status: "ready", measure } },
          })),
        () =>
          alive &&
          setMeasured((held) => ({
            key: verseKey,
            by: { ...(held.key === verseKey ? held.by : {}), [work.id]: { status: "failed" } },
          })),
      );
    }
    return () => {
      alive = false;
    };
  }, [verseKey]);
  const measureOf = (id: string): Measured => (measured.key === verseKey && measured.by[id]) || { status: "loading" };

  const ready = TAFSIR_LIBRARY.map((w) => measureOf(w.id));
  const settled = ready.every((m) => m.status !== "loading");
  const speaking = ready.filter((m) => m.status === "ready" && m.measure).length;
  const longest = Math.max(1, ...ready.map((m) => (m.status === "ready" && m.measure ? m.measure.words : 0)));

  // ── where they meet ───────────────────────────────────────────────────────
  const [xrefs, setXrefs] = useState<{ key: string; links: XrefLink[] } | null>(null);
  useEffect(() => {
    let alive = true;
    fetchAyahXrefs(verseKey)
      .then((x) => alive && setXrefs({ key: verseKey, links: x.brought }))
      .catch(() => alive && setXrefs({ key: verseKey, links: [] }));
    return () => {
      alive = false;
    };
  }, [verseKey]);
  // The ayat reached for by more than one of them first; that is the meeting.
  const meeting = (xrefs?.key === verseKey ? xrefs.links : []).slice(0, MEETING);
  const quotes = (work: TafsirWork, link: XrefLink) => work.id.startsWith("app:") && link.works.includes(work.id.slice(4));

  // ── choosing ──────────────────────────────────────────────────────────────
  // The map is open while there is a choice to make, and folded to a line once
  // there are works side by side to read; the reader can open it again.
  const [mapOpen, setMapOpen] = useState(works.length < 2);
  const full = works.length >= MAX_COMPARED;

  const toggle = (id: string) => {
    if (ids.includes(id)) {
      if (ids.length > 1) onChange(ids.filter((x) => x !== id));
    } else if (!full) {
      onChange([...ids, id]);
    }
  };
  /** One work turned into its other language, where it stands. */
  const replace = (from: string, to: string) =>
    onChange(ids.includes(to) ? ids.filter((x) => x !== from) : ids.map((x) => (x === from ? to : x)));

  // ── the pile, on a phone ──────────────────────────────────────────────────
  // A work just added is the card put on top; one taken away leaves the next.
  const idsKey = ids.join(",");
  const [deck, setDeck] = useState<{ ids: string; at: number }>({ ids: idsKey, at: 0 });
  if (deck.ids !== idsKey) {
    const before = deck.ids.split(",").filter(Boolean);
    const added = ids.findIndex((id) => !before.includes(id));
    setDeck({ ids: idsKey, at: added >= 0 ? added : Math.min(deck.at, ids.length - 1) });
  }
  const at = Math.max(0, Math.min(deck.at, works.length - 1));
  const [arrival, setArrival] = useState<"next" | "prev" | null>(null);
  const turn = (to: "next" | "prev") => {
    const next = to === "next" ? at + 1 : at - 1;
    if (next < 0 || next >= works.length) return;
    setArrival(to);
    setDeck((held) => ({ ...held, at: next }));
  };
  const swipeRef = useSwipe(turn, narrow && works.length > 1);

  const ref = (link: XrefLink) => `${link.surah}:${link.ayah}`;

  const column = (work: TafsirWork, i: number) => {
    const other = say.counterpart(work);
    return (
      <>
        <div className={styles.colHead}>
          <span className={styles.colN}>{n(i + 1)}</span>
          <button className={styles.colTool} onClick={() => onRead(work.id)} title={t("compare.readAloneTitle", { work: say.short(work) })}>
            {t("compare.readAlone")}
          </button>
          {works.length > 1 && (
            <button
              className={styles.colTool}
              onClick={() => toggle(work.id)}
              aria-label={t("compare.remove", { work: say.short(work) })}
              title={t("compare.remove", { work: say.short(work) })}
            >
              ✕
            </button>
          )}
        </div>
        <TafsirReading
          work={work}
          verseKey={verseKey}
          opening={5}
          onPick={(id) => replace(work.id, id)}
          onBeside={other && !ids.includes(other.work.id) && !full ? (id) => onChange([...ids, id]) : undefined}
        />
      </>
    );
  };

  return (
    <section className={styles.compare} aria-label={t("tafsir.view.compare")}>
      {/* ── the map ─────────────────────────────────────────────────── */}
      <div className={styles.summary}>
        <p className={styles.speak}>
          {settled
            ? t("compare.speak", { count: speaking, countText: n(speaking), total: n(TAFSIR_LIBRARY.length) })
            : t("compare.measuring")}
        </p>
        <button className={styles.mapToggle} onClick={() => setMapOpen((o) => !o)} aria-expanded={mapOpen}>
          {mapOpen ? t("compare.foldMap") : t("compare.openMap")}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={mapOpen ? styles.chevronUp : ""}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {mapOpen && (
        <div className={styles.map}>
          <p className={styles.lead}>{t(full ? "compare.leadFull" : "compare.lead", { max: MAX_COMPARED })}</p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.thWork}>
                  {t("compare.col.work")}
                </th>
                <th scope="col" className={styles.thExtent}>
                  {t("compare.col.extent")}
                </th>
                {meeting.map((link) => (
                  <th key={link.key} scope="col" className={styles.thMeet}>
                    <button
                      className={styles.meetRef}
                      onClick={() => onGo(ref(link))}
                      title={t("compare.meetTitle", {
                        ref: `${names.name(link.surah)} ${ref(link)}`,
                        count: link.works.length,
                      })}
                    >
                      {ref(link)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            {say.shelves.map((shelf) => (
              <tbody key={shelf.id}>
                <tr className={styles.groupRow}>
                  <th scope="rowgroup" colSpan={2 + meeting.length}>
                    {t("tafsir.in", { language: say.language(shelf.lang) })}
                  </th>
                </tr>
                {/* Each language's shelf under its own headings, as the
                    library sets it out: the Arabic one as tafsir.app does. */}
                {shelf.sections.flatMap((section) => [
                  <tr key={section.id} className={styles.sectionRow}>
                    <th scope="rowgroup" colSpan={2 + meeting.length}>
                      {say.section(section)}
                      {section.titleArabic && (
                        <span className={styles.sectionArabic} dir="rtl" lang="ar">
                          {section.titleArabic}
                        </span>
                      )}
                    </th>
                  </tr>,
                  ...section.works.map((work) => {
                    const m = measureOf(work.id);
                    const on = ids.includes(work.id);
                    const empty = m.status === "ready" && !m.measure;
                    const blocked = !on && (full || empty);
                    const extent = m.status === "ready" && m.measure ? m.measure : null;
                    return (
                      <tr key={work.id} className={`${styles.row} ${on ? styles.rowOn : ""} ${empty ? styles.rowEmpty : ""}`}>
                        <th scope="row" className={styles.tdWork}>
                          <button
                            className={styles.pick}
                            onClick={() => toggle(work.id)}
                            aria-pressed={on}
                            disabled={blocked || (on && works.length === 1)}
                            title={
                              on
                                ? t("compare.remove", { work: say.short(work) })
                                : empty
                                  ? t("compare.nothingTitle", { work: say.short(work) })
                                  : full
                                    ? t("compare.fullTitle", { max: MAX_COMPARED })
                                    : t("compare.add", { work: say.short(work) })
                            }
                          >
                            <span className={styles.mark} aria-hidden="true" />
                            <span className={styles.pickNames}>
                              <span className={styles.pickShort}>{say.short(work)}</span>
                              <span className={styles.pickEra}>{say.era(work) || say.kind(work)}</span>
                            </span>
                          </button>
                        </th>
                        <td className={styles.tdExtent}>
                          {m.status === "loading" && <span className={styles.barPending} />}
                          {m.status === "failed" && <span className={styles.quiet}>{t("compare.unreached")}</span>}
                          {empty && <span className={styles.quiet}>{t("compare.nothing")}</span>}
                          {extent && (
                            <span className={styles.extent}>
                              <span className={styles.bar} aria-hidden="true">
                                <span
                                  className={styles.barFill}
                                  style={{ width: `${Math.max(2, Math.sqrt(extent.words / longest) * 100)}%` }}
                                />
                              </span>
                              <span className={styles.words}>
                                {t("compare.words", { count: extent.words, countText: n(extent.words) })}
                                {extent.from !== extent.to && (
                                  <>
                                    <span className={styles.sep}> · </span>
                                    <span className={styles.together}>
                                      {t("compare.together", { from: n(extent.from), to: n(extent.to) })}
                                    </span>
                                  </>
                                )}
                              </span>
                            </span>
                          )}
                        </td>
                        {meeting.map((link) => (
                          <td key={link.key} className={styles.tdMeet}>
                            {quotes(work, link) && (
                              <span
                                className={styles.dot}
                                role="img"
                                aria-label={t("compare.quotes", { work: say.short(work), ref: ref(link) })}
                                title={t("compare.quotes", { work: say.short(work), ref: ref(link) })}
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  }),
                ])}
              </tbody>
            ))}
          </table>

          {meeting.length > 0 && (
            <>
              <p className={styles.legend}>
                <span className={styles.dot} aria-hidden="true" /> {t("compare.meetNote")}
              </p>
              {/* On a phone the marks have no room as columns, and are said
                  as a list instead: each ayah, and who reached for it. */}
              <div className={styles.meetList}>
                <h3 className={styles.meetHeading}>{t("compare.meet")}</h3>
                {meeting.map((link) => (
                  <button key={link.key} className={styles.meetItem} onClick={() => onGo(ref(link))}>
                    <span className={styles.meetKey}>
                      {names.name(link.surah)} {ref(link)}
                    </span>
                    <span className={styles.meetWho}>
                      {TAFSIR_LIBRARY.filter((w) => quotes(w, link))
                        .map((w) => say.short(w))
                        .join(" · ")}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── the works side by side ──────────────────────────────────── */}
      {works.length === 1 && <p className={styles.alone}>{t("compare.alone")}</p>}

      {narrow ? (
        works[at] && (
          <div className={styles.deck}>
            {works.length > 1 && (
              <div className={styles.deckBar}>
                <button className={styles.deckStep} onClick={() => turn("prev")} disabled={at === 0} aria-label={t("compare.prev")}>
                  ‹
                </button>
                <span className={styles.deckPlace}>
                  {t("compare.place", { n: n(at + 1), total: n(works.length) })}
                </span>
                <button
                  className={styles.deckStep}
                  onClick={() => turn("next")}
                  disabled={at === works.length - 1}
                  aria-label={t("compare.next")}
                >
                  ›
                </button>
              </div>
            )}
            <div className={styles.pile} ref={swipeRef} data-depth={Math.min(2, works.length - 1 - at)}>
              <div
                key={works[at].id}
                className={`${styles.card} ${arrival === "next" ? styles.inNext : arrival === "prev" ? styles.inPrev : ""}`}
              >
                {column(works[at], at)}
              </div>
            </div>
            {works.length > 1 && (
              <p className={styles.deckHint}>
                {at < works.length - 1
                  ? t("compare.swipeNext", { work: say.short(works[at + 1]) })
                  : t("compare.swipeBack", { work: say.short(works[at - 1]) })}
              </p>
            )}
          </div>
        )
      ) : (
        <div className={styles.columns} data-count={works.length}>
          {works.map((work, i) => (
            <div key={work.id} className={styles.column}>
              {column(work, i)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
