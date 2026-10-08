"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { tafsirWork, type TafsirLang, type TafsirWork } from "@/lib/quran/tafsir";
import { useT } from "@/lib/i18n";
import { useTafsirSay } from "./useTafsirSay";
import styles from "./Tafsir.module.css";

/**
 * The works the reader keeps to hand, as tabs.
 *
 * A tab is a work they have opened and not put away, which is the thing a tab
 * means everywhere else. Reading another is one press, and what that press
 * does not do is make them scroll past a hundred paragraphs of al-Ṭabarī to
 * reach al-Qurṭubī underneath, which is what a stack of works did.
 */
export function TafsirTabs({
  works,
  active,
  onPick,
  choosing,
  onChoose,
}: {
  works: TafsirWork[];
  active: string;
  onPick: (id: string) => void;
  /** Whether the library is open, and the way to open or shut it. */
  choosing: boolean;
  onChoose: () => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const t = useT();
  const say = useTafsirSay();

  // The tab being read is kept in sight: on a phone the strip scrolls, and a
  // work chosen from the library may be off its far end. Measured on screen
  // rather than by offsets, so that it holds whichever way the strip runs: a
  // strip read right to left scrolls in negative numbers, and the offsets this
  // used to be worked out from assumed it never did.
  useEffect(() => {
    const strip = stripRef.current;
    const tab = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!strip || !tab) return;
    const box = strip.getBoundingClientRect();
    const at = tab.getBoundingClientRect();
    // …and clear of the fade the strip ends in, not only of its edge. The
    // fade is at the far end, which is the left one on a page read that way.
    const rtl = getComputedStyle(strip).direction === "rtl";
    const left = at.left - (rtl ? 30 : 12) - box.left;
    const right = at.right + (rtl ? 12 : 30) - box.right;
    if (left < 0) strip.scrollLeft += left;
    else if (right > 0) strip.scrollLeft += right;
  }, [active, works.length]);

  return (
    <div className={styles.tabsRow}>
      <div className={styles.tabs} role="tablist" aria-label={t("tafsir.works")} ref={stripRef}>
        {works.map((w) => (
          <button
            key={w.id}
            role="tab"
            aria-selected={!choosing && active === w.id}
            className={`${styles.tab} ${!choosing && active === w.id ? styles.tabOn : ""}`}
            onClick={() => onPick(w.id)}
            title={`${say.name(w)} — ${say.credit(w)}`}
          >
            {say.short(w)}
            <span className={styles.tabLang}>{say.badge(w.lang)}</span>
          </button>
        ))}
      </div>
      <button
        className={`${styles.choose} ${choosing ? styles.chooseOn : ""}`}
        onClick={onChoose}
        aria-expanded={choosing}
        title={t("tafsir.everyWork")}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        {choosing ? t("tafsir.done") : t("tafsir.allWorks")}
      </button>
    </div>
  );
}

/**
 * Which language's shelf is open.
 *
 * It follows the work being read — open al-Ṭabarī and the Arabic shelf is the
 * one in front of you — until the reader turns to the other, and that choice
 * stands for as long as the same work is being read.
 */
export function useShelfLanguage(active: TafsirWork | undefined) {
  const { shelves } = useTafsirSay();
  const anchor = active?.id ?? "";
  const [chosen, setChosen] = useState<{ for: string; lang: TafsirLang } | null>(null);
  const lang: TafsirLang = chosen?.for === anchor ? chosen.lang : (active?.lang ?? shelves[0]?.lang ?? "en");
  const choose = useCallback((next: TafsirLang) => setChosen({ for: anchor, lang: next }), [anchor]);
  return [lang, choose] as const;
}

/**
 * The first question the library asks: which language do you read tafsir in?
 * Everything under it is one shelf, which is a list short enough to take in.
 */
export function TafsirLanguages({ lang, onLang }: { lang: TafsirLang; onLang: (lang: TafsirLang) => void }) {
  const t = useT();
  const say = useTafsirSay();
  return (
    <div className={styles.langs} role="tablist" aria-label={t("tafsir.languages")}>
      {say.shelves.map((s) => (
        <button
          key={s.id}
          role="tab"
          aria-selected={s.lang === lang}
          className={`${styles.lang} ${s.lang === lang ? styles.langOn : ""}`}
          onClick={() => onLang(s.lang)}
        >
          {say.language(s.lang)}
          <span className={styles.langCount}>{s.works.length}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * The library, set out so that a work can be chosen by someone who has never
 * heard of it.
 *
 * A list of transliterated titles is a list of riddles to most readers. So it
 * is divided the way a reader would ask — first by the language they read,
 * then by how much they want — and each work says three things and no more:
 * whose it is and when he lived, what the book is called and what that means,
 * and what to expect of it.
 *
 * Pressing a work reads it. The pin at the end of a row keeps it among the
 * tabs or puts it away, without opening it.
 */
export function TafsirLibrary({
  shelf,
  active,
  onPick,
  onToggle,
}: {
  /** The ids kept as tabs. */
  shelf: string[];
  /** The work being read, if the library is being used to choose one. */
  active?: string;
  /** Read this work. Left out where the library only manages the tabs. */
  onPick?: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const t = useT();
  const say = useTafsirSay();
  const [lang, setLang] = useShelfLanguage(tafsirWork(active));
  const group = say.shelves.find((s) => s.lang === lang) ?? say.shelves[0];
  if (!group) return null;

  return (
    <div className={styles.library}>
      <TafsirLanguages lang={group.lang} onLang={setLang} />
      <p className={styles.groupNote}>{say.shelfNote(group)}</p>

      {group.sections.map((section) => (
        <section key={section.id} className={styles.section}>
          <h3 className={styles.sectionTitle}>
            {say.section(section)}
            {section.titleArabic && (
              <span className={styles.sectionArabic} dir="rtl" lang="ar">
                {section.titleArabic}
              </span>
            )}
          </h3>

          {section.works.map((w) => {
            const kept = shelf.includes(w.id);
            const other = w.lang === "ar" ? say.counterpart(w) : undefined;
            const arabic = say.arabic(w);
            const title = say.title(w);
            return (
              <div key={w.id} className={`${styles.entry} ${active === w.id ? styles.entryOn : ""}`}>
                <button
                  className={styles.entryMain}
                  onClick={() => (onPick ? onPick(w.id) : onToggle(w.id))}
                  aria-current={active === w.id ? "true" : undefined}
                  title={say.credit(w)}
                >
                  {/* Where a section is one work of each kind, the kind leads:
                      it is the reason the work is on the list. */}
                  {section.lead === "kind" && <span className={styles.entryKind}>{say.kind(w)}</span>}
                  <span className={styles.entryTop}>
                    <span className={styles.entryShort}>{say.short(w)}</span>
                    {say.era(w) && <span className={styles.entryEra}>{say.era(w)}</span>}
                    {arabic && (
                      <span className={styles.entryArabic} dir="rtl" lang="ar">
                        {arabic}
                      </span>
                    )}
                  </span>
                  <span className={styles.entryName}>
                    {say.name(w)}
                    {title && <span className={styles.entryEnglish}> — {title}</span>}
                  </span>
                  <span className={styles.entryAbout}>{say.about(w)}</span>
                  {other && (
                    <span className={styles.entryAlso}>
                      {t("tafsir.alsoHere", { language: say.language(other.work.lang) })}
                    </span>
                  )}
                </button>
                <button
                  className={`${styles.keep} ${kept ? styles.keepOn : ""}`}
                  onClick={() => onToggle(w.id)}
                  aria-pressed={kept}
                  aria-label={t(kept ? "tafsir.remove" : "tafsir.keep", { work: say.short(w) })}
                  title={t(kept ? "tafsir.keptTitle" : "tafsir.keepTitle")}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={kept ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 17v5" />
                    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                  </svg>
                </button>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
