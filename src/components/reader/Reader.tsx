"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/lib/store/settings";
import { useChapters } from "@/lib/store/chapters";
import { useLibrary } from "@/lib/store/library";
import { usePlayerControls, usePlayerStatus } from "@/lib/audio/player";
import { useSurah } from "@/lib/quran/useSurah";
import { NO_RENDERINGS, useSurahTranslations } from "@/lib/quran/useSurahTranslations";
import { translationName } from "@/lib/quran/translations";
import { highlight, parseWordDomId } from "@/lib/highlight";
import { isValidVerseKey, plainText } from "@/lib/text";
import { SCROLL_TO_VERSE, type ScrollToVerseDetail } from "@/lib/useGoToVerse";
import { useToast } from "@/components/Toast";
import { Navigator } from "@/components/navigator/Navigator";
import { Verse, type VerseHandlers } from "./Verse";
import { MarkRail } from "./MarkRail";
import { SurahHeader } from "./SurahHeader";
import { SidePanel, type PanelMode, type PanelState } from "./SidePanel";
import { WordStudyPanel } from "./WordStudyPanel";
import { TafsirPanel } from "./TafsirPanel";
import { TranslationsPanel } from "./TranslationsPanel";
import { NotesPanel } from "./NotesPanel";
import { useTranslationShelf } from "@/components/translations/useTranslationShelf";
import type { Verse as VerseModel } from "@/lib/quran/types";
import styles from "./Reader.module.css";

/** How many ayat are added to the DOM at a time. */
const CHUNK = 12;

export function Reader({ surah }: { surah: number }) {
  const router = useRouter();
  const toast = useToast();
  const { settings, update, setLastRead } = useSettings();
  const { byId } = useChapters();
  const { isBookmarked, toggleBookmark, noteCount } = useLibrary();
  // The controls and the status, and not the clock: this component is the
  // whole surah, and must not be rendered again for every quarter-second of a
  // recitation it is only sitting beside.
  const controls = usePlayerControls();
  const { currentKey, playing, loop } = usePlayerStatus();

  const { verses, loading, loadingMore, error, info, reload } = useSurah(
    surah,
    settings.reciterId,
    settings.glossLanguage,
  );

  // The translations are laid over the text rather than fetched with it, so
  // choosing another changes what is under the Arabic and leaves the Arabic
  // where it is. The shelf is read through its hook, which is also what takes
  // a withdrawn translation off it and says so.
  const { ids: translationIds } = useTranslationShelf();
  const translations = useSurahTranslations(surah, translationIds);
  const renderings = translations.byVerse;
  // For the handlers below, which are made once and must not be made again —
  // and every ayah re-rendered — each time a translation arrives.
  const renderingsRef = useRef(renderings);
  useEffect(() => {
    renderingsRef.current = renderings;
  }, [renderings]);

  const [limit, setLimit] = useState(CHUNK);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [composeOnOpen, setComposeOnOpen] = useState(false);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  /** The ayah at the top of the screen, for the bar that says where that is. */
  const [placeKey, setPlaceKey] = useState<string | null>(null);
  const placeBarRef = useRef<HTMLDivElement>(null);

  const [, setScrollNonce] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<{ key: string; flash: boolean } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The topmost ayah on screen, as last noted. Where the reader is. */
  const topKeyRef = useRef<string | null>(null);
  const placeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chapter = byId(surah);
  const chapterName = chapter?.name_simple ?? `Surah ${surah}`;

  // ── word highlighting ─────────────────────────────────────────────────────
  useEffect(() => highlight.acquire(), []);
  useEffect(() => highlight.setStyle(settings.wordHighlight), [settings.wordHighlight]);
  useEffect(() => {
    // Leaving the surah must not leave a word lit in the next one.
    return () => highlight.setHover(null);
  }, [surah]);

  const wordIdFrom = (e: React.SyntheticEvent): string | null => {
    const el = (e.target as HTMLElement | null)?.closest?.("[data-w]");
    return el ? el.getAttribute("data-w") : null;
  };

  const onPointerOver = useCallback((e: React.MouseEvent) => {
    const id = wordIdFrom(e);
    if (id) highlight.setHover(id);
  }, []);

  const onPointerOut = useCallback((e: React.MouseEvent) => {
    const id = wordIdFrom(e);
    if (id && id === highlight.hovered) highlight.setHover(null);
  }, []);

  const onFocusIn = useCallback((e: React.FocusEvent) => {
    const id = wordIdFrom(e);
    if (id) highlight.setHover(id);
  }, []);

  // Focus leaving a word puts it out, as the pointer leaving it does: tabbing
  // on out of the text used to leave the last word lit for the rest of the visit.
  const onFocusOut = useCallback((e: React.FocusEvent) => {
    const id = wordIdFrom(e);
    if (id && id === highlight.hovered) highlight.setHover(null);
  }, []);

  const tappedRef = useRef<string | null>(null);

  const onWordClick = useCallback((e: React.MouseEvent) => {
    const id = wordIdFrom(e);
    if (!id) return;
    const parsed = parseWordDomId(id);
    if (!parsed) return;

    highlight.setHover(id);

    // Touch has no hover, so the first tap links the three rows and the second
    // opens the study panel. Ordinary reading on a phone stays possible.
    const touch = typeof window.matchMedia === "function" && !window.matchMedia("(hover: hover)").matches;
    if (touch && tappedRef.current !== id) {
      tappedRef.current = id;
      return;
    }
    tappedRef.current = id;
    setComposeOnOpen(false);
    setPanel({ mode: "word", verseKey: parsed.verseKey, wordPosition: parsed.position });
  }, []);

  // ── the place the reader has got to ───────────────────────────────────────
  //
  // Noted a few times a second while scrolling and written only when it has
  // actually changed. It used to be worked out, written to storage and
  // announced to every screen on each scroll event — sixty times a second,
  // each one re-rendering the surah to record an ayah that had not changed.
  const recordPlace = useCallback(() => {
    placeTimer.current = null;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    for (const el of scroller.querySelectorAll<HTMLElement>("[data-verse]")) {
      if (el.offsetTop + el.offsetHeight > scroller.scrollTop + 80) {
        const key = el.getAttribute("data-verse");
        if (key && key !== topKeyRef.current) {
          topKeyRef.current = key;
          setPlaceKey(key);
          // …so "continue reading" returns here.
          setLastRead({ surah, verseKey: key });
        }
        return;
      }
    }
  }, [surah, setLastRead]);

  useEffect(() => () => void (placeTimer.current && clearTimeout(placeTimer.current)), []);

  // ── chunked rendering ─────────────────────────────────────────────────────
  const count = verses.length;
  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      // Only while there is more to show: at the foot of a surah there is not,
      // and counting on regardless re-rendered the reader for nothing.
      if (el.scrollHeight - el.scrollTop - el.clientHeight <= 900) {
        setLimit((l) => (l < count ? l + CHUNK : l));
      }
      if (!placeTimer.current) placeTimer.current = setTimeout(recordPlace, 200);
    },
    [count, recordPlace],
  );

  const shown = useMemo(() => verses.slice(0, limit), [verses, limit]);

  // ── scrolling to an ayah ──────────────────────────────────────────────────
  //
  // Asking for an ayah and arriving at it are separated by an unknown number of
  // steps: a deep link into al-Baqarah names an ayah that is six network pages
  // away and, once fetched, still outside the rendered window. So a request is
  // recorded and then retried after every commit until it can be honoured,
  // rather than being attempted once and lost.
  const scrollToVerse = useCallback((key: string, flash = true) => {
    pendingScroll.current = { key, flash };
    setScrollNonce((n) => n + 1);
  }, []);

  // Runs after every commit. Cheap — it returns immediately unless a scroll is
  // outstanding — and re-attempting on each commit is what lets a request made
  // before the ayah existed be honoured once it does.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately every commit; see above
  useLayoutEffect(() => {
    const pending = pendingScroll.current;
    const scroller = scrollerRef.current;
    if (!pending || !scroller) return;

    const index = verses.findIndex((v) => v.verse_key === pending.key);
    if (index === -1) {
      // Not fetched yet. If the surah has finished arriving it never will be,
      // so the request is dropped rather than retried for the rest of the visit.
      if (!loading && !loadingMore) pendingScroll.current = null;
      return;
    }
    if (index >= limit) {
      setLimit(index + CHUNK);
      return;
    }
    const el = scroller.querySelector<HTMLElement>(`[data-verse="${CSS.escape(pending.key)}"]`);
    if (!el) return;

    pendingScroll.current = null;
    // Under the bar that is pinned to the top of the text, not behind it.
    const top = Math.max(0, el.offsetTop - 24 - (placeBarRef.current?.offsetHeight ?? 0));
    // Gliding smoothly across a hundred thousand pixels is not a journey anyone
    // asked for; a jump is what "take me to 2:255" means.
    const far = Math.abs(scroller.scrollTop - top) > 2400;
    scroller.scrollTo({ top, behavior: far ? "auto" : "smooth" });
    // The place is noted once the reader has arrived, whether or not the
    // browser reports the move as a scroll — it does not always, for a jump.
    if (placeTimer.current) clearTimeout(placeTimer.current);
    placeTimer.current = setTimeout(recordPlace, far ? 80 : 500);

    if (pending.flash) {
      setFlashKey(pending.key);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashKey(null), 1800);
    }
  });

  // The player and other screens ask for an ayah through an event, so neither
  // needs a handle on this component's scroll container.
  useEffect(() => {
    const onRequest = (e: Event) => {
      const detail = (e as CustomEvent<ScrollToVerseDetail>).detail;
      if (detail?.key) scrollToVerse(detail.key, detail.flash ?? false);
    };
    window.addEventListener(SCROLL_TO_VERSE, onRequest);
    return () => window.removeEventListener(SCROLL_TO_VERSE, onRequest);
  }, [scrollToVerse]);

  useEffect(() => () => void (flashTimer.current && clearTimeout(flashTimer.current)), []);

  // A deep link — /read/2/#2:255 — from a search result, a bookmark, the juz
  // list or a share.
  //
  // Read in an effect, and not while rendering. Arriving from another page of
  // the site, this component is rendered *before* the address bar is moved on,
  // so at render the hash is still the previous page's — usually none — and
  // every link into the middle of a surah opened it at the top. By the time an
  // effect runs the address is the one that was asked for. Opening the page
  // cold happened to work, which is how it went unnoticed.
  useEffect(() => {
    const fromAddress = () => {
      let hash = window.location.hash.slice(1);
      try {
        hash = decodeURIComponent(hash);
      } catch {
        /* not an address this site wrote; the test below will turn it away */
      }
      if (isValidVerseKey(hash) && hash.startsWith(`${surah}:`)) scrollToVerse(hash, true);
    };
    fromAddress();
    window.addEventListener("hashchange", fromAddress);
    return () => window.removeEventListener("hashchange", fromAddress);
  }, [surah, scrollToVerse]);

  // ── the place the reader left off ─────────────────────────────────────────
  //
  // Opening a surah makes it the one to continue — once, and only until the
  // reader has got somewhere in it. This used to run again as each page of a
  // long surah arrived, wiping the ayah they had already scrolled to.
  const arrived = !loading && verses.length > 0;
  useEffect(() => {
    if (arrived && !topKeyRef.current) setLastRead({ surah, verseKey: null });
  }, [arrived, surah, setLastRead]);

  // A new voice, or the word meanings in another language, is the same surah
  // fetched again, and the text is taken down while it is. The reader is put
  // back where they were rather than left at the head of al-Baqarah for having
  // changed a setting.
  const edition = `${settings.reciterId}:${settings.glossLanguage}`;
  const editionRef = useRef(edition);
  useEffect(() => {
    if (editionRef.current === edition) return;
    editionRef.current = edition;
    if (topKeyRef.current) scrollToVerse(topKeyRef.current, false);
  }, [edition, scrollToVerse]);

  // ── the transport's queue ─────────────────────────────────────────────────
  useEffect(() => {
    controls.setQueue({ surah, verses });
  }, [surah, verses, controls]);

  // ── going somewhere else ──────────────────────────────────────────────────
  //
  // An ayah of this surah is a scroll; anywhere else is the other surah's page,
  // opened at the ayah. Either way the address says where the reader now is.
  const goTo = useCallback(
    (toSurah: number, ayah: number | null) => {
      setNavigating(false);
      if (toSurah !== surah) {
        router.push(ayah && ayah > 1 ? `/read/${toSurah}/#${toSurah}:${ayah}` : `/read/${toSurah}/`);
        return;
      }
      if (ayah == null) {
        window.history.replaceState(null, "", window.location.pathname);
        scrollerRef.current?.scrollTo({ top: 0 });
        return;
      }
      const key = `${surah}:${ayah}`;
      window.history.replaceState(null, "", `#${key}`);
      scrollToVerse(key, true);
    },
    [router, surah, scrollToVerse],
  );

  const closeNavigator = useCallback(() => setNavigating(false), []);

  // `g`, as in "go to" — the same reach from a keyboard that the bar gives a thumb.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "g" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      setNavigating(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── ayah actions ──────────────────────────────────────────────────────────
  //
  // An ayah is bookmarked, copied and quoted in the first of the reader's
  // translations: the one they read first is the one they mean.
  const firstRendering = useCallback((key: string) => renderingsRef.current.get(key)?.[0], []);

  const copy = useCallback(
    async (text: string, message: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast(message);
      } catch {
        toast("Your browser refused the clipboard.");
      }
    },
    [toast],
  );

  const handlers = useMemo<VerseHandlers>(
    () => ({
      onPlay: (key) => controls.playOrPause(key),
      onRepeat: (key) => {
        // One ayah over and over is its own request, and takes over from a
        // passage that was being looped.
        controls.endLoop();
        update({ repeat: "ayah" });
        controls.play(key);
        toast(`Repeating ${key}`);
      },
      onBookmark: (verse) => {
        const first = firstRendering(verse.verse_key);
        const added = toggleBookmark({
          verseKey: verse.verse_key,
          surah,
          arabic: verse.text_uthmani,
          translation: plainText(first?.text),
          translator: first?.name ?? "",
        });
        toast(added ? `Ayah ${verse.verse_key} bookmarked` : "Bookmark removed");
      },
      onNote: (key) => {
        setComposeOnOpen(true);
        setPanel({ mode: "notes", verseKey: key });
      },
      onTafsir: (key) => {
        setComposeOnOpen(false);
        setPanel({ mode: "tafsir", verseKey: key });
      },
      onTranslations: (key) => {
        setComposeOnOpen(false);
        setPanel({ mode: "translations", verseKey: key });
      },
      onCopyArabic: (verse) => void copy(verse.text_uthmani, "Arabic copied"),
      onCopyTranslation: (verse) => {
        const first = firstRendering(verse.verse_key);
        if (!first) {
          toast("The translation has not arrived yet.");
          return;
        }
        void copy(`${plainText(first.text)}\n— ${first.name}, ${verse.verse_key}`, "Translation copied");
      },
      onShare: (key) =>
        void copy(`${location.origin}${location.pathname}#${key}`, `Link to ${key} copied`),
    }),
    [controls, update, toast, toggleBookmark, surah, firstRendering, copy],
  );

  // ── panel contents ────────────────────────────────────────────────────────
  const panelVerse: VerseModel | undefined = panel
    ? verses.find((v) => v.verse_key === panel.verseKey)
    : undefined;
  const panelWord =
    panel?.wordPosition != null
      ? panelVerse?.words.find((w) => w.position === panel.wordPosition)
      : undefined;

  // The panel stepping to another ayah takes the text with it: what is being
  // explained and what is on screen stay the same ayah.
  const movePanel = useCallback(
    (key: string) => {
      setPanel((p) => (p ? { mode: p.mode, verseKey: key } : p));
      window.history.replaceState(null, "", `#${key}`);
      scrollToVerse(key, true);
    },
    [scrollToVerse],
  );

  const switchPanel = useCallback((mode: PanelMode) => {
    setComposeOnOpen(false);
    setPanel((p) => (p ? { ...p, mode } : p));
  }, []);

  // The notes panel quotes ayat out of what is already on screen, translation
  // and all. Made only while it is open: it is a copy of the surah.
  const notesOpen = panel?.mode === "notes";
  const quotable = useMemo(
    () =>
      notesOpen
        ? verses.map((v) => {
            const first = renderings.get(v.verse_key)?.[0];
            return first
              ? { ...v, translations: [{ resource_id: first.id, resource_name: first.name, text: first.text }] }
              : v;
          })
        : verses,
    [notesOpen, verses, renderings],
  );

  const panelTitle = panel
    ? panel.mode === "word"
      ? panelWord?.translation?.text || panel.verseKey
      : `${chapterName} ${panel.verseKey}`
    : "";

  const placeAyah = placeKey ? Number(placeKey.split(":")[1]) : 1;
  const ayahCount = chapter?.verses_count ?? verses.length;
  const through = ayahCount > 1 ? ((placeAyah - 1) / (ayahCount - 1)) * 100 : 0;

  const prev = byId(surah - 1);
  const next = byId(surah + 1);

  return (
    <div className={styles.layout}>
      {!loading && (
        <MarkRail
          surah={surah}
          verses={verses}
          total={chapter?.verses_count ?? verses.length}
          loop={loop && loop.surah === surah ? loop : null}
          scrollerRef={scrollerRef}
          onJump={(ayah) => scrollToVerse(`${surah}:${ayah}`, false)}
        />
      )}

      <div
        ref={scrollerRef}
        className={styles.scroller}
        onScroll={onScroll}
        onMouseOver={onPointerOver}
        onMouseOut={onPointerOut}
        onFocus={onFocusIn}
        onBlur={onFocusOut}
        onClick={onWordClick}
      >
        {/* Where the reader is, and the way to anywhere else. Pinned, so it is
            in reach at ayah 200 as it is at ayah 1 — on a phone, where there is
            no rail, this and its hairline are the whole of that. */}
        <div ref={placeBarRef} className={styles.placeBar}>
          <button
            className={styles.place}
            onClick={() => setNavigating(true)}
            aria-haspopup="dialog"
            aria-label={`${chapterName}, ayah ${placeAyah}${ayahCount ? ` of ${ayahCount}` : ""}. Go to another ayah or surah`}
            title="Go to an ayah or another surah (g)"
          >
            <span className={styles.placeSurah}>
              <span className={styles.placeNumber}>{surah}</span>
              {chapterName}
            </span>
            <span className={styles.placeAyah}>
              Ayah {placeAyah}
              {ayahCount ? ` of ${ayahCount}` : ""}
            </span>
            <svg className={styles.placeChevron} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <span className={styles.placeFill} style={{ width: `${through}%` }} aria-hidden="true" />
        </div>

        <div className={styles.column}>
          <div className={styles.topBar}>
            <button
              onClick={() => router.push(`/read/${surah - 1}/`)}
              className="btn btn-ghost"
              style={{ fontSize: 13 }}
              disabled={surah <= 1}
            >
              ← {prev?.name_simple ?? ""}
            </button>

            <div className={styles.topBarCentre}>
              {/* The muṣḥaf is one click away, not five toggles away. */}
              <Link href={`/read/${surah}/mushaf/`} className="btn btn-secondary" style={{ fontSize: 12, padding: "5px 12px" }}>
                Muṣḥaf view
              </Link>
              <button
                onClick={() => {
                  setComposeOnOpen(false);
                  setPanel({ mode: "notes", verseKey: panel?.verseKey ?? `${surah}:1` });
                }}
                className={`btn btn-secondary ${panel?.mode === "notes" ? "btn-on" : ""}`}
                style={{ fontSize: 12, padding: "5px 12px" }}
              >
                Notes
              </button>
            </div>

            <button
              onClick={() => router.push(`/read/${surah + 1}/`)}
              className="btn btn-ghost"
              style={{ fontSize: 13 }}
              disabled={surah >= 114}
            >
              {next?.name_simple ?? ""} →
            </button>
          </div>

          <SurahHeader surah={surah} chapter={chapter} corpusInfo={info} />

          {chapter?.bismillah_pre && !loading && (
            <div className={styles.bismillah}>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</div>
          )}

          {loading && <div className={styles.loading}>Loading the text…</div>}

          {error && (
            <div className={styles.error}>
              <p>{error}</p>
              <button onClick={reload} className="btn btn-primary">
                Try again
              </button>
            </div>
          )}

          {/* A translation that could not be had is said once, here, rather
              than left as a silence under every ayah. */}
          {settings.showTranslation && translations.failed.length > 0 && !loading && (
            <div className={styles.notice} role="status">
              <span>
                {translations.failed.map((id) => translationName(id) || "A translation").join(", ")} could
                not be reached.
              </span>
              <button onClick={translations.retry} className="btn btn-ghost" style={{ fontSize: 13 }}>
                Try again
              </button>
            </div>
          )}

          {shown.map((verse) => (
            <Verse
              key={verse.verse_key}
              verse={verse}
              translations={renderings.get(verse.verse_key) ?? NO_RENDERINGS}
              layout={settings.layout}
              showTranslit={settings.showTranslit}
              showWbw={settings.showWbw}
              glossLanguage={settings.glossLanguage}
              showTranslation={settings.showTranslation}
              current={currentKey === verse.verse_key}
              playing={playing && currentKey === verse.verse_key}
              bookmarked={isBookmarked(verse.verse_key)}
              noteCount={noteCount(verse.verse_key)}
              flash={flashKey === verse.verse_key}
              handlers={handlers}
            />
          ))}

          {limit < verses.length && (
            <div className={styles.more}>
              <span className={styles.moreRule} />
              <button onClick={() => setLimit((l) => l + CHUNK * 2)} className="btn btn-secondary" style={{ fontSize: 13 }}>
                Show the next ayat · {Math.min(limit, verses.length)} of {verses.length} shown
              </button>
              <span className={styles.moreRule} />
            </div>
          )}

          {loadingMore && <div className={styles.loadingMore}>Loading more ayat…</div>}

          {!loading && !loadingMore && verses.length > 0 && limit >= verses.length && (
            <div className={styles.end}>
              <div className={styles.endMark}>۞</div>
              <div className={styles.endText}>End of {chapterName}</div>
              {surah < 114 && (
                <button onClick={() => router.push(`/read/${surah + 1}/`)} className="btn btn-primary" style={{ marginTop: 18 }}>
                  Continue to {next?.name_simple ?? "the next surah"} →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {navigating && (
        <Navigator surah={surah} ayah={placeAyah} onGo={goTo} onClose={closeNavigator} />
      )}

      {panel && (
        <SidePanel state={panel} title={panelTitle} onSwitch={switchPanel} onClose={() => setPanel(null)}>
          {panel.mode === "word" && (
            <WordStudyPanel
              verse={panelVerse}
              word={panelWord}
              surahName={chapterName}
              onOpenTafsir={() => switchPanel("tafsir")}
            />
          )}
          {panel.mode === "tafsir" && (
            <TafsirPanel
              verse={panelVerse}
              verseKey={panel.verseKey}
              ayahCount={ayahCount}
              onMove={movePanel}
            />
          )}
          {panel.mode === "translations" && (
            <TranslationsPanel
              verse={panelVerse}
              verseKey={panel.verseKey}
              ayahCount={ayahCount}
              onMove={movePanel}
            />
          )}
          {panel.mode === "notes" && (
            <NotesPanel
              key={`${panel.verseKey}:${composeOnOpen}`}
              surah={surah}
              surahName={chapterName}
              verseKey={panel.verseKey}
              loadedVerses={quotable}
              composeOnOpen={composeOnOpen}
            />
          )}
        </SidePanel>
      )}
    </div>
  );
}
