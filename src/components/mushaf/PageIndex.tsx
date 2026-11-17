"use client";

import { useEffect, useRef, useState } from "react";
import { PAGES, placeOf, rubPage, surahPage } from "@/lib/quran/pages";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import { useClosedByBack } from "@/lib/back";
import { useLocale } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import styles from "./PageView.module.css";

/**
 * The way to a page: by the surah, by the juzʾ, or by the number.
 *
 * These are the three things a reader of a printed muṣḥaf knows a place by.
 * The juzʾ is given with its parts, because that is how a portion is set and
 * how a teacher names one: each of the thirty has two ḥizbs, and each ḥizb
 * its quarter, half and three quarters — eight places to open at, the marks
 * a printed page carries in its margin.
 */

type Tab = "surah" | "juz" | "page";
const TABS: Tab[] = ["surah", "juz", "page"];
const PARTS = ["", "¼", "½", "¾"];

interface Props {
  open: boolean;
  /** The page on the screen, which each list marks its own place by. */
  page: number;
  onClose: () => void;
  onGo: (page: number) => void;
}

export function PageIndex({ open, page, onClose, onGo }: Props) {
  const { t, n } = useLocale();
  const names = useSurahNames();
  const [tab, setTab] = useState<Tab>("surah");
  const [typed, setTyped] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const place = placeOf(page);

  // What was typed is for one opening of the index: left behind, it would be
  // offered again as the page to go to after the reader had gone elsewhere.
  const shut = () => {
    setTyped(null);
    onClose();
  };
  const goTo = (to: number) => {
    setTyped(null);
    onGo(to);
  };

  useClosedByBack(open, onClose);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Each list opens on where the reader is in it.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector("[aria-current]")?.scrollIntoView({ block: "center" });
  }, [open, tab]);

  const wanted = typed === null ? page : Number(typed);
  const sound = Number.isInteger(wanted) && wanted >= 1 && wanted <= PAGES;
  const wantedPlace = sound ? placeOf(wanted) : null;

  return (
    <div className={styles.index} data-open={open ? "" : undefined} inert={!open}>
      <button type="button" className={styles.scrim} onClick={shut} aria-label={t("common.close")} tabIndex={-1} />
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label={t("pages.index")}>
        <header className={styles.panelHead}>
          <div className={styles.tabs} role="tablist" aria-label={t("pages.index")}>
            {TABS.map((id) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={styles.tab} onClick={() => setTab(id)}>
                {t(`pages.tab.${id}`)}
              </button>
            ))}
          </div>
          <button type="button" className={styles.close} onClick={shut} aria-label={t("common.close")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M2 2l10 10M12 2L2 12" />
            </svg>
          </button>
        </header>

        <div className={styles.list} ref={listRef}>
          {tab === "surah" && (
            <ul className={styles.surahs}>
              {SURAH_NAMES.map((_, i) => {
                const surah = i + 1;
                const at = surahPage(surah);
                return (
                  <li key={surah}>
                    <button type="button" className={styles.row} onClick={() => goTo(at)} aria-current={place.surahs[0] === surah ? "true" : undefined}>
                      <small>{n(surah)}</small>
                      <span className={names.arabic ? "surah-ar" : undefined}>{names.name(surah)}</span>
                      <em>{t("pages.pageN", { n: n(at) })}</em>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {tab === "juz" && (
            <ul className={styles.juzs}>
              {Array.from({ length: 30 }, (_, i) => {
                const juz = i + 1;
                const first = i * 8 + 1;
                return (
                  <li key={juz} className={styles.juz} aria-current={place.juz === juz ? "true" : undefined}>
                    <button type="button" className={styles.juzHead} onClick={() => goTo(rubPage(first))}>
                      <span>{t("common.juzN", { n: n(juz) })}</span>
                      <em>{t("pages.pageN", { n: n(rubPage(first)) })}</em>
                    </button>
                    <div className={styles.quarters}>
                      {Array.from({ length: 8 }, (_, k) => {
                        const rub = first + k;
                        const hizb = Math.ceil(rub / 4);
                        const part = k % 4;
                        const here = place.hizb === hizb && place.quarter === part + 1;
                        return (
                          <button
                            key={rub}
                            type="button"
                            className={styles.quarter}
                            data-head={part === 0 || undefined}
                            data-here={here || undefined}
                            onClick={() => goTo(rubPage(rub))}
                            aria-label={`${t("pages.hizbN", { n: n(hizb) })} ${PARTS[part]} · ${t("pages.pageN", { n: n(rubPage(rub)) })}`}
                          >
                            {part === 0 ? t("pages.hizbN", { n: n(hizb) }) : PARTS[part]}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {tab === "page" && (
            <form
              className={styles.byNumber}
              onSubmit={(e) => {
                e.preventDefault();
                if (sound) goTo(wanted);
              }}
            >
              <label className={styles.number}>
                <span>{t("pages.tab.page")}</span>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={PAGES}
                  value={typed ?? String(page)}
                  onChange={(e) => setTyped(e.target.value)}
                />
                <em>{t("pages.ofTotal", { total: n(PAGES) })}</em>
              </label>
              {/* The muṣḥaf runs right to left, and so does the way through it. */}
              <input
                className={styles.slider}
                type="range"
                dir="rtl"
                min={1}
                max={PAGES}
                value={sound ? wanted : page}
                onChange={(e) => setTyped(e.target.value)}
                aria-label={t("pages.tab.page")}
              />
              <p className={styles.numberPlace} aria-live="polite">
                {wantedPlace ? (
                  <>
                    <span className={names.arabic ? "surah-ar" : undefined}>{wantedPlace.surahs.map((s) => names.name(s)).join(" · ")}</span>
                    <small>
                      {t("common.juzN", { n: n(wantedPlace.juz) })} · {t("pages.hizbN", { n: n(wantedPlace.hizb) })} {PARTS[wantedPlace.quarter - 1]}
                    </small>
                  </>
                ) : (
                  <small>{t("pages.bad", { total: n(PAGES) })}</small>
                )}
              </p>
              <button type="submit" className="btn btn-primary" disabled={!sound}>
                {t("pages.go")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
