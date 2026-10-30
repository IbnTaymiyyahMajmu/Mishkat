"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchVerse } from "@/lib/quran/api";
import { tafsirWork, type TafsirWork } from "@/lib/quran/tafsir";
import { translationName } from "@/lib/quran/translations";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import type { Verse } from "@/lib/quran/types";
import { useChapters } from "@/lib/store/chapters";
import { useSettings } from "@/lib/store/settings";
import { isValidVerseKey, plainText } from "@/lib/text";
import { useSwipe } from "@/lib/useSwipe";
import { Navigator } from "@/components/navigator/Navigator";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { TafsirCompare, MAX_COMPARED } from "./TafsirCompare";
import { TafsirLibraryView } from "./TafsirLibraryView";
import { TafsirReading } from "./TafsirReading";
import { TafsirLanguages, TafsirTabs, useShelfLanguage } from "./TafsirShelf";
import { useTafsirSay } from "./useTafsirSay";
import { useTafsirShelf } from "./useTafsirShelf";
import styles from "./TafsirPage.module.css";

/**
 * Tafsir, given a page.
 *
 * The panel beside the text answers "what does this ayah mean" without taking
 * the reader out of the surah, and it is a few hundred pixels wide. Fifty
 * paragraphs of al-Rāzī do not belong in a column that width. This is where
 * that reading happens: the ayah at the head, the passage in a measure a
 * person can sit with, at a size they choose, and the library down the side,
 * a language at a time.
 *
 * And it is where the works are set against each other, which is the site's
 * whole promise about tafsir: works are set side by side and never merged. So
 * under the ayah the page offers three ways of going about it, and no more —
 *
 *   Read      one work, at length;
 *   Compare   the whole library on this ayah at a glance — who speaks on it,
 *             at what length, and which other ayat they reach for — and up to
 *             four works side by side;
 *   Library   the works themselves: when each author lived, what kind of
 *             tafsir each wrote, how much of the Qurʾan it covers, and what
 *             the author said he set out to do.
 *
 * The ayah, the works and the view are in the address —
 * `/tafsir/?v=2:255&w=app:tabari&c=app:qurtubi,app:alrazi&view=compare` — so a
 * comparison can be linked to, bookmarked by the browser, and come back to. It
 * is one exported page, not 6,236: the ayah is a query rather than a path.
 */

export type TafsirView = "read" | "compare" | "library";

const VIEWS: { id: TafsirView; label: MessageKey }[] = [
  { id: "read", label: "tafsir.view.read" },
  { id: "compare", label: "tafsir.view.compare" },
  { id: "library", label: "tafsir.view.library" },
];

export function TafsirPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { settings, lastRead } = useSettings();
  const { byId } = useChapters();
  const { t, arrows } = useLocale();
  const names = useSurahNames();
  const say = useTafsirSay();
  const { shelf, works, active, pick, toggle, scale, resize } = useTafsirShelf();

  // ── which ayah ────────────────────────────────────────────────────────────
  // Arriving with no ayah named — from a bare link — opens on wherever the
  // reader last was, which is the ayah they are likeliest to mean.
  const asked = params.get("v") ?? "";
  const verseKey = isValidVerseKey(asked)
    ? asked
    : (lastRead?.verseKey ?? (lastRead ? `${lastRead.surah}:1` : "1:1"));
  const [surah, ayah] = verseKey.split(":").map(Number);

  const ayatIn = useCallback(
    (n: number) => byId(n)?.verses_count ?? SURAH_NAMES[n - 1]?.ayat ?? 0,
    [byId],
  );
  const surahName = names.name(surah);
  const total = ayatIn(surah);
  const placeLabel = total ? t("common.ayahOf", { n: ayah, total }) : t("common.ayahN", { n: ayah });

  // ── which works, and how they are read ────────────────────────────────────
  const primary = tafsirWork(params.get("w")) ?? active;
  // The works set beside it, in the order they were set: up to three more.
  const besideList = params.get("c") ?? "";
  const primaryId = primary?.id;
  const beside = useMemo(
    () =>
      [...new Set(besideList.split(",").filter(Boolean))]
        .map((id) => tafsirWork(id))
        .filter((w): w is TafsirWork => !!w && w.id !== primaryId)
        .slice(0, MAX_COMPARED - 1),
    [besideList, primaryId],
  );
  const compared = useMemo(() => (primary ? [primary, ...beside] : beside), [primary, beside]);

  // A link from before there were views, with a second work in it, asked for
  // two works side by side: that is the comparison now.
  const viewAsked = params.get("view");
  const view: TafsirView =
    viewAsked === "library" || viewAsked === "compare" || viewAsked === "read"
      ? viewAsked
      : beside.length
        ? "compare"
        : "read";

  const [navigating, setNavigating] = useState(false);
  const [railLang, setRailLang] = useShelfLanguage(primary);
  const railShelf = say.shelves.find((s) => s.lang === railLang) ?? say.shelves[0];
  const [range, setRange] = useState<{ key: string; from: number; to: number } | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  /** Rewrite the address. Everything on the page is read back out of it. */
  const go = useCallback(
    (next: { v?: string; w?: string; c?: string[]; view?: TafsirView }) => {
      const v = next.v ?? verseKey;
      const w = next.w ?? primary?.id;
      const c = (next.c ?? beside.map((b) => b.id)).filter((id) => id !== w);
      const shown = next.view ?? view;
      // Read is what a bare address means, so it is written out only where the
      // address would otherwise be read as a comparison.
      const named = shown === "read" ? (c.length ? "read" : "") : shown;
      const query = [
        `v=${v}`,
        w ? `w=${encodeURIComponent(w)}` : "",
        c.length ? `c=${c.map(encodeURIComponent).join(",")}` : "",
        named ? `view=${named}` : "",
      ]
        .filter(Boolean)
        .join("&");
      router.replace(`/tafsir/?${query}`, { scroll: false });
    },
    [router, verseKey, primary?.id, beside, view],
  );

  /** Read this work, on its own, here. */
  const read = useCallback(
    (id: string) => {
      pick(id);
      go({ w: id, view: "read" });
    },
    [pick, go],
  );

  /** The works compared, from now on, in this order. The first is the one read. */
  const compare = useCallback(
    (ids: string[]) => {
      const [first, ...rest] = ids;
      if (!first) return;
      go({ w: first, c: rest, view: "compare" });
    },
    [go],
  );

  // ── the ayah itself ───────────────────────────────────────────────────────
  const [verse, setVerse] = useState<{ key: string; verse: Verse | null } | null>(null);
  const verseStamp = `${verseKey}|${settings.translationId}`;
  useEffect(() => {
    let alive = true;
    fetchVerse(verseKey, settings.translationId).then(
      (v) => alive && setVerse({ key: verseStamp, verse: v }),
    );
    return () => {
      alive = false;
    };
  }, [verseKey, settings.translationId, verseStamp]);
  const shownVerse = verse?.key === verseStamp ? verse.verse : undefined;
  const translation = shownVerse?.translations?.[0];

  // The reader came for the tafsir. A long ayah — the Throne Verse, the ayah of
  // debt — set out in full above it puts the tafsir a screen and a half away
  // on a phone, so a long one opens folded to its first lines, and unfolds.
  const [unfolded, setUnfolded] = useState("");
  const long = (shownVerse?.text_uthmani.length ?? 0) > 170;
  const folded = long && unfolded !== verseKey;

  // A new ayah is read from the top.
  useEffect(() => {
    shellRef.current?.scrollTo({ top: 0 });
  }, [verseKey]);

  // The work being read is kept in sight in the rail, which is longer than
  // most screens are tall. By arithmetic: `scrollIntoView` would move the page.
  useEffect(() => {
    const rail = railRef.current;
    const row = rail?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!rail || !row) return;
    const top = row.offsetTop;
    if (top < rail.scrollTop || top + row.offsetHeight > rail.scrollTop + rail.clientHeight) {
      rail.scrollTop = top - (rail.clientHeight - row.offsetHeight) / 2;
    }
  }, [primaryId, view]);

  // ── moving ────────────────────────────────────────────────────────────────
  // A passage on ayat 1–14 is stepped past as one, while one work is being
  // read. Past the end of a surah is the head of the next, and before its head
  // is the foot of the one before. Comparing, works take different runs of
  // ayat, and the step is one ayah.
  const slot = `${primary?.id}|${verseKey}`;
  const covered = view === "read" && range?.key === slot ? range : null;
  const onRange = useCallback(
    (r: { from: number; to: number } | null) =>
      setRange((held) => {
        if (!r) return held?.key === slot ? null : held;
        return held?.key === slot && held.from === r.from && held.to === r.to ? held : { key: slot, ...r };
      }),
    [slot],
  );

  const after = (covered?.to ?? ayah) + 1;
  const before = (covered?.from ?? ayah) - 1;
  const nextKey = after <= total ? `${surah}:${after}` : surah < 114 ? `${surah + 1}:1` : null;
  const prevKey = before >= 1 ? `${surah}:${before}` : surah > 1 ? `${surah - 1}:${ayatIn(surah - 1) || 1}` : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.key === "g") {
        e.preventDefault();
        setNavigating(true);
      } else if (e.key === "n" && nextKey) {
        go({ v: nextKey });
      } else if (e.key === "p" && prevKey) {
        go({ v: prevKey });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, nextKey, prevKey]);

  const closeNavigator = useCallback(() => setNavigating(false), []);

  // The tabs are the works kept to hand — and the one being read, if it was
  // arrived at by a link and is not among them.
  const tabs = useMemo(
    () => (primary && !works.some((w) => w.id === primary.id) ? [...works, primary] : works),
    [works, primary],
  );

  // On a phone the next work is a stroke across the passage away, as the next
  // card in a pile would be; it comes in from the side it was fetched from.
  const [arrival, setArrival] = useState<{ id: string; from: "next" | "prev" } | null>(null);
  const turn = useCallback(
    (to: "next" | "prev") => {
      if (tabs.length < 2 || !primary) return;
      const at = tabs.findIndex((w) => w.id === primary.id);
      const next = tabs[(at + (to === "next" ? 1 : tabs.length - 1)) % tabs.length];
      setArrival({ id: next.id, from: to });
      read(next.id);
    },
    [tabs, primary, read],
  );
  const swipeRef = useSwipe(turn, view === "read" && tabs.length > 1);

  const translator =
    translation?.resource_name ?? translationName(settings.translationId);

  return (
    <div className="page-shell" ref={shellRef} style={{ "--tafsir-scale": scale } as React.CSSProperties}>
      {/* ── where this is, and the way to anywhere else ────────────────── */}
      <div className={styles.bar}>
        <Link href={`/read/${surah}/#${verseKey}`} className={styles.back}>
          {arrows.prev} <span className={styles.backLabel}>{t("tafsir.back")}</span>
        </Link>

        <button
          className={styles.place}
          onClick={() => setNavigating(true)}
          aria-haspopup="dialog"
          aria-label={`${surahName}, ${placeLabel}. ${t("goto.open")}`}
          title={t("goto.title")}
        >
          <span className={styles.placeSurah}>
            <span className={styles.placeNumber}>{surah}</span>
            {surahName}
          </span>
          <span className={styles.placeAyah}>{placeLabel}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        <div className={styles.barTools}>
          <button
            className={styles.step}
            onClick={() => prevKey && go({ v: prevKey })}
            disabled={!prevKey}
            title={t("tafsir.before")}
          >
            ‹ <span className={styles.stepLabel}>{prevKey ?? ""}</span>
          </button>
          <button
            className={styles.step}
            onClick={() => nextKey && go({ v: nextKey })}
            disabled={!nextKey}
            title={t("tafsir.after")}
          >
            <span className={styles.stepLabel}>{nextKey ?? ""}</span> ›
          </button>
          <span className={styles.sizer} role="group" aria-label={t("tafsir.textSize")}>
            <button onClick={() => resize(-1)} disabled={scale <= 0.86} aria-label={t("tafsir.smaller")}>
              A−
            </button>
            <button onClick={() => resize(1)} disabled={scale >= 1.59} aria-label={t("tafsir.larger")}>
              A+
            </button>
          </span>
        </div>
      </div>

      <div className={`${styles.layout} ${view === "read" ? "" : styles.layoutWide}`}>
        {/* ── the library, down the side, while one work is read ─────── */}
        {view === "read" && (
          <nav className={styles.rail} aria-label={t("tafsir.works")}>
            <div className={styles.railInner} ref={railRef}>
              <TafsirLanguages lang={railLang} onLang={setRailLang} />
              {railShelf?.sections.map((section) => (
                <div key={section.id} className={styles.railSection}>
                  <div className={styles.railHeading}>{say.section(section)}</div>
                  {section.works.map((w) => {
                    const also = w.lang === "ar" ? say.counterpart(w) : undefined;
                    return (
                      <button
                        key={w.id}
                        className={`${styles.railRow} ${primary?.id === w.id ? styles.railOn : ""}`}
                        onClick={() => read(w.id)}
                        aria-current={primary?.id === w.id ? "true" : undefined}
                        title={`${say.name(w)}${say.title(w) ? ` — ${say.title(w)}` : ""}. ${say.credit(w)}. ${say.about(w)}`}
                      >
                        {/* Where a section is one work of each kind, the kind
                            leads: it is the reason the work is on the list. */}
                        {section.lead === "kind" && <span className={styles.railLead}>{say.kind(w)}</span>}
                        <span className={styles.railShort}>
                          {say.short(w)}
                          {also && (
                            <span className={styles.railAlso}>
                              {t("tafsir.also", { language: say.language(also.work.lang) })}
                            </span>
                          )}
                        </span>
                        {section.lead === "by" && <span className={styles.railBy}>{say.by(w)}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </nav>
        )}

        <div className={styles.body}>
          {/* ── the ayah ─────────────────────────────────────────────── */}
          <header className={styles.ayah}>
            <div className={styles.ayahKey}>
              {surahName} · {verseKey}
            </div>
            {shownVerse === undefined && <p className={styles.ayahPending}>…</p>}
            {shownVerse && (
              <>
                <p className={`${styles.ayahArabic} ${folded ? styles.ayahFolded : ""}`} dir="rtl" lang="ar">
                  {shownVerse.text_uthmani}
                </p>
                {translation?.text && (
                  <>
                    <p className={`${styles.ayahEnglish} ${folded ? styles.ayahFolded : ""}`} dir="auto">
                      {plainText(translation.text)}
                    </p>
                    <div className={styles.ayahCredit}>{t("common.translationOf", { name: translator })}</div>
                  </>
                )}
                {long && (
                  <button
                    className={styles.ayahUnfold}
                    onClick={() => setUnfolded(folded ? verseKey : "")}
                    aria-expanded={!folded}
                  >
                    {folded ? t("tafsir.unfold") : t("tafsir.fold")}
                  </button>
                )}
              </>
            )}
            {shownVerse === null && (
              <p className={styles.ayahPending}>{t("tafsir.ayahUnreached")}</p>
            )}
          </header>

          {/* ── the three ways of going about it ─────────────────────── */}
          <div className={styles.views} role="tablist" aria-label={t("tafsir.views")}>
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={view === v.id}
                className={`${styles.viewTab} ${view === v.id ? styles.viewOn : ""}`}
                onClick={() => go({ view: v.id })}
              >
                {t(v.label)}
                {v.id === "compare" && compared.length > 1 && (
                  <span className={styles.viewCount}>{compared.length}</span>
                )}
              </button>
            ))}
          </div>

          {view === "read" && (
            <>
              {/* On a narrow screen there is no room for the rail, so the
                  works are tabs, as they are in the panel, with the library
                  a view away. */}
              <div className={styles.tabs}>
                <TafsirTabs
                  works={tabs}
                  active={primary?.id ?? ""}
                  onPick={(id) => {
                    setArrival(null);
                    read(id);
                  }}
                  choosing={false}
                  onChoose={() => go({ view: "library" })}
                />
              </div>

              <div className={styles.columns} ref={swipeRef}>
                {primary && (
                  <div
                    key={primary.id}
                    className={`${styles.column} ${arrival?.id === primary.id ? styles[arrival.from === "next" ? "inNext" : "inPrev"] : ""}`}
                  >
                    <TafsirReading
                      work={primary}
                      verseKey={verseKey}
                      onRange={onRange}
                      alternatives={works.filter((w) => w.id !== primary.id)}
                      onPick={read}
                      // Both of a work's languages, side by side, is a
                      // comparison of two.
                      onBeside={(id) => compare([primary.id, id])}
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {view === "compare" && (
            <TafsirCompare
              verseKey={verseKey}
              works={compared}
              onChange={compare}
              onRead={read}
              onGo={(v) => go({ v })}
            />
          )}

          {view === "library" && (
            <TafsirLibraryView
              verseKey={verseKey}
              active={primary?.id}
              kept={shelf}
              compared={compared.map((w) => w.id)}
              onRead={read}
              onCompare={(id) =>
                compare(
                  compared.some((w) => w.id === id)
                    ? compared.map((w) => w.id)
                    : [...compared.map((w) => w.id), id].slice(-MAX_COMPARED),
                )
              }
              onToggle={toggle}
            />
          )}

          {view !== "library" && (
            <footer className={`${styles.foot} ${view === "compare" ? styles.footWide : ""}`}>
              <button className="btn btn-secondary" onClick={() => prevKey && go({ v: prevKey })} disabled={!prevKey}>
                {arrows.prev} {prevKey ?? t("tafsir.beginning")}
              </button>
              <Link href={`/read/${surah}/#${verseKey}`} className="btn btn-ghost">
                {t("tafsir.back")}
              </Link>
              <button className="btn btn-primary" onClick={() => nextKey && go({ v: nextKey })} disabled={!nextKey}>
                {nextKey ?? t("tafsir.end")} {arrows.next}
              </button>
            </footer>
          )}
        </div>
      </div>

      {navigating && (
        <Navigator
          surah={surah}
          ayah={ayah}
          onGo={(s, a) => {
            setNavigating(false);
            go({ v: `${s}:${a ?? 1}` });
          }}
          onClose={closeNavigator}
        />
      )}
    </div>
  );
}
