"use client";

import { useEffect, useState } from "react";
import type { Para } from "@/lib/quran/types";
import type { TafsirWork } from "@/lib/quran/tafsir";
import { fetchTafsirAppAbout } from "@/lib/quran/tafsirApp";
import { useSettings } from "@/lib/store/settings";
import { useT } from "@/lib/i18n";
import { TafsirText, countEditorNotes } from "./TafsirText";
import { useTafsirPassage } from "./useTafsirPassage";
import { useTafsirSay } from "./useTafsirSay";
import styles from "./Tafsir.module.css";

interface Props {
  work: TafsirWork;
  verseKey: string;
  /**
   * How many paragraphs to open on. Beside the text, a long passage is opened
   * a screenful at a time; on its own page it is simply all there.
   */
  opening?: number;
  /** Told which ayat the passage covers, once it is known, so "next" can step past them. */
  onRange?: (range: { from: number; to: number } | null) => void;
  /** Other works to offer when this one has nothing on the ayah. */
  alternatives?: TafsirWork[];
  onPick?: (id: string) => void;
  /** Set another work beside this one, where there is somewhere to set it. */
  onBeside?: (id: string) => void;
  /** Whatever else the place this is shown in has to offer about the work. */
  tools?: React.ReactNode;
}

/**
 * One work, on one ayah: who wrote it, what it is, and the passage.
 *
 * Everything a reader needs in order to trust what they are reading is in the
 * heading — the book, the author and when he died, the kind of work it is —
 * and the way back to the source is at the foot. Under the heading is one line
 * of things that can be done with the work, and it is one line: on a phone the
 * heading is all that stands between the reader and the passage they came for.
 */
export function TafsirReading({ work, verseKey, opening, onRange, alternatives, onPick, onBeside, tools }: Props) {
  const { settings, update } = useSettings();
  const t = useT();
  const say = useTafsirSay();
  const state = useTafsirPassage(work, verseKey);
  const passage = state.status === "ready" ? state.passage : null;

  // What the work is, as against what it says here. Fetched when asked for.
  const [about, setAbout] = useState<{ id: string; paras: Para[] } | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  // Which passage has been opened out in full; another passage starts folded.
  const [unfolded, setUnfolded] = useState("");
  const slot = `${work.id}|${verseKey}`;

  const from = passage?.from ?? null;
  const to = passage?.to ?? null;
  useEffect(() => {
    onRange?.(from !== null && to !== null ? { from, to } : null);
  }, [from, to, onRange]);

  const toggleAbout = () => {
    setAboutOpen((open) => !open);
    if (!work.aboutId || about?.id === work.aboutId) return;
    const id = work.aboutId;
    fetchTafsirAppAbout(id)
      .then((paras) => setAbout({ id, paras }))
      .catch(() => setAbout({ id, paras: [] }));
  };

  const paras = passage?.paras ?? [];
  const folded = opening !== undefined && paras.length > opening + 2 && unfolded !== slot;
  const shown = folded ? paras.slice(0, opening) : paras;
  const said = about && about.id === work.aboutId ? about.paras : undefined;
  const ayah = Number(verseKey.split(":")[1]);
  const noteCount = countEditorNotes(paras);

  // The same work in the other language, where the library holds both.
  const other = onPick ? say.counterpart(work) : undefined;
  const hasTools = !!other || !!work.aboutId || noteCount > 0 || !!tools;
  const arabic = say.arabic(work);
  const title = say.title(work);

  return (
    <article className={styles.reading} lang={work.lang === "ar" ? undefined : "en"}>
      <header className={styles.workHead}>
        <div className={styles.workNames}>
          <h2 className={styles.workName}>{say.name(work)}</h2>
          {arabic && (
            <span className={styles.workNameArabic} dir="rtl" lang="ar">
              {arabic}
            </span>
          )}
        </div>
        {title && <div className={styles.workEnglish}>{title}</div>}
        <div className={styles.workCredit}>
          <span className={styles.workKind}>{say.kind(work)}</span>
          {say.credit(work)}
        </div>

        {hasTools && (
          <div className={styles.workTools}>
            {/* A work held in two languages is switched between them as a
                language is switched anywhere: the one being read is lit, the
                other is a press away. The Arabic comes first: it is the work. */}
            {other && onPick && (
              <span
                className={styles.langSwitch}
                role="group"
                aria-label={t("tafsir.langSwitch")}
                title={
                  other.partial ? t(work.lang === "ar" ? "tafsir.partial.arabic" : "tafsir.partial.translation") : undefined
                }
              >
                {(work.lang === "ar" ? [work, other.work] : [other.work, work]).map((version) => (
                  <button
                    key={version.id}
                    aria-pressed={version.id === work.id}
                    onClick={version.id === work.id ? undefined : () => onPick(version.id)}
                  >
                    {say.language(version.lang)}
                  </button>
                ))}
              </span>
            )}
            {other && onBeside && (
              <button className={styles.tool} onClick={() => onBeside(other.work.id)}>
                {t("tafsir.both")}
              </button>
            )}
            {work.aboutId && (
              <button className={styles.tool} onClick={toggleAbout} aria-expanded={aboutOpen}>
                {t("tafsir.aboutWork")}
              </button>
            )}
            {noteCount > 0 && (
              <button
                className={styles.tool}
                onClick={() => update({ tafsirNotes: !settings.tafsirNotes })}
                aria-pressed={settings.tafsirNotes}
                title={t("tafsir.editorTitle")}
              >
                {settings.tafsirNotes ? t("tafsir.foldNotes") : t("tafsir.showNotes", { count: noteCount })}
              </button>
            )}
            {tools && <span className={styles.toolsEnd}>{tools}</span>}
          </div>
        )}
      </header>

      {/* The author on what he set out to do, and others on what he did. It
          belongs to the work rather than to the ayah, so it opens above the
          passage and stays shut until asked for. */}
      {aboutOpen && (
        <div className={styles.about}>
          <p className={styles.aboutLead}>{say.about(work)}</p>
          {said === undefined && <p className={styles.quiet}>{t("common.fetching")}</p>}
          {said && <TafsirText paras={said} />}
        </div>
      )}

      <div className={styles.passage}>
        {state.status === "loading" && (
          <div className={styles.skeleton} aria-label={t("tafsir.fetchingPassage")}>
            <span />
            <span />
            <span />
            <span />
          </div>
        )}

        {state.status === "failed" && (
          <div className={styles.state}>
            <p>{t("tafsir.unreached")}</p>
            <button className="btn btn-secondary" onClick={state.retry}>
              {t("common.tryAgain")}
            </button>
          </div>
        )}

        {passage && paras.length === 0 && (
          <div className={styles.state}>
            <p>{t("tafsir.nothingOn", { work: say.short(work), ayah })}</p>
            {alternatives && alternatives.length > 0 && onPick && (
              <div className={styles.alternatives}>
                <span>{t("tafsir.readInstead")}</span>
                {alternatives.slice(0, 4).map((alt) => (
                  <button key={alt.id} className="btn btn-secondary" onClick={() => onPick(alt.id)}>
                    {say.short(alt)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {passage && paras.length > 0 && passage.from !== passage.to && (
          <p className={styles.rangeNote}>{t("tafsir.together", { from: passage.from, to: passage.to })}</p>
        )}

        <TafsirText key={slot} paras={shown} foldNotes={!settings.tafsirNotes} />

        {folded && (
          <button className={`btn btn-secondary btn-block ${styles.more}`} onClick={() => setUnfolded(slot)}>
            {t("tafsir.continue", { count: paras.length - shown.length })}
          </button>
        )}
      </div>

      {passage && paras.length > 0 && (
        <footer className={styles.workFoot}>
          <span className={styles.footNote}>
            {noteCount > 0 && t(settings.tafsirNotes ? "tafsir.legendShown" : "tafsir.legendFolded")}
          </span>
          <span className={styles.footGap} />
          <a href={work.origin.href(verseKey)} target="_blank" rel="noopener noreferrer" className={styles.source}>
            {work.origin.name} ↗
          </a>
        </footer>
      )}
    </article>
  );
}
