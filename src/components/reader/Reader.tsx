"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/lib/store/settings";
import { useChapters } from "@/lib/store/chapters";
import { useLibrary } from "@/lib/store/library";
import { usePlayer } from "@/lib/audio/player";
import { useSurah } from "@/lib/quran/useSurah";
import { highlight, parseWordDomId } from "@/lib/highlight";
import { plainText } from "@/lib/text";
import { TRANSLATIONS } from "@/lib/quran/resources";
import { SCROLL_TO_VERSE, type ScrollToVerseDetail } from "@/lib/useGoToVerse";
import { useToast } from "@/components/Toast";
import { Verse, type VerseHandlers } from "./Verse";
import { MarkRail } from "./MarkRail";
import { SurahHeader } from "./SurahHeader";
import { SidePanel, type PanelMode, type PanelState } from "./SidePanel";
import { WordStudyPanel } from "./WordStudyPanel";
import { TafsirPanel } from "./TafsirPanel";
import { NotesPanel } from "./NotesPanel";
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
  const player = usePlayer();

  const { verses, loading, loadingMore, error, info, reload } = useSurah(
    surah,
    settings.translationId,
    settings.reciterId,
  );

  const [limit, setLimit] = useState(CHUNK);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [composeOnOpen, setComposeOnOpen] = useState(false);
  const [flashKey, setFlashKey] = useState<string | null>(null);

  const [, setScrollNonce] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<{ key: string; flash: boolean } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A deep link — /read/2/#2:255 — from a search result, a bookmark or a share.
  // Read once, on the first client render; the component is keyed on the surah,
  // so "once" is once per surah.
  const [initialHash] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const hash = window.location.hash.replace("#", "");
    return /^\d{1,3}:\d{1,3}$/.test(hash) ? hash : null;
  });
  const claimedHash = useRef(false);

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

  // ── chunked rendering ─────────────────────────────────────────────────────
  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 900) return;
    setLimit((l) => l + CHUNK);
  }, []);

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
    if (!claimedHash.current) {
      claimedHash.current = true;
      if (initialHash) pendingScroll.current = { key: initialHash, flash: true };
    }

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
    const top = Math.max(0, el.offsetTop - 24);
    // Gliding smoothly across a hundred thousand pixels is not a journey anyone
    // asked for; a jump is what "take me to 2:255" means.
    const far = Math.abs(scroller.scrollTop - top) > 2400;
    scroller.scrollTo({ top, behavior: far ? "auto" : "smooth" });

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

  // ── the place the reader left off ─────────────────────────────────────────
  useEffect(() => {
    if (loading || !verses.length) return;
    setLastRead({ surah, verseKey: null });
  }, [loading, verses.length, surah, setLastRead]);

  const onScrollEnd = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    // Remember the topmost ayah on screen, so "continue reading" returns here.
    const articles = scroller.querySelectorAll<HTMLElement>("[data-verse]");
    for (const el of articles) {
      if (el.offsetTop + el.offsetHeight > scroller.scrollTop + 80) {
        const key = el.getAttribute("data-verse");
        if (key) setLastRead({ surah, verseKey: key });
        return;
      }
    }
  }, [surah, setLastRead]);

  // ── the transport's queue ─────────────────────────────────────────────────
  useEffect(() => {
    player.setQueue({ surah, verses });
  }, [surah, verses, player]);

  // ── ayah actions ──────────────────────────────────────────────────────────
  const translatorName =
    TRANSLATIONS.find((t) => t.id === settings.translationId)?.label ?? "Translation";

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
      onPlay: (key) => {
        if (player.currentKey === key) player.toggle();
        else player.play(key);
      },
      onRepeat: (key) => {
        update({ repeat: "ayah" });
        player.play(key);
        toast(`Repeating ${key}`);
      },
      onBookmark: (verse) => {
        const added = toggleBookmark({
          verseKey: verse.verse_key,
          surah,
          arabic: verse.text_uthmani,
          translation: plainText(verse.translations?.[0]?.text),
          translator: verse.translations?.[0]?.resource_name ?? translatorName,
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
      onCopyArabic: (verse) => void copy(verse.text_uthmani, "Arabic copied"),
      onCopyTranslation: (verse) =>
        void copy(
          `${plainText(verse.translations?.[0]?.text)}\n— ${verse.translations?.[0]?.resource_name ?? translatorName}, ${verse.verse_key}`,
          "Translation copied",
        ),
      onShare: (key) =>
        void copy(`${location.origin}${location.pathname}#${key}`, `Link to ${key} copied`),
    }),
    [player, update, toast, toggleBookmark, surah, translatorName, copy],
  );

  // ── panel contents ────────────────────────────────────────────────────────
  const panelVerse: VerseModel | undefined = panel
    ? verses.find((v) => v.verse_key === panel.verseKey)
    : undefined;
  const panelWord =
    panel?.wordPosition != null
      ? panelVerse?.words.find((w) => w.position === panel.wordPosition)
      : undefined;

  const switchPanel = useCallback((mode: PanelMode) => {
    setComposeOnOpen(false);
    setPanel((p) => (p ? { ...p, mode } : p));
  }, []);

  const panelTitle = panel
    ? panel.mode === "word"
      ? panelWord?.translation?.text || panel.verseKey
      : `${chapterName} ${panel.verseKey}`
    : "";

  const prev = byId(surah - 1);
  const next = byId(surah + 1);

  return (
    <div className={styles.layout}>
      {!loading && (
        <MarkRail
          surah={surah}
          verses={verses}
          total={chapter?.verses_count ?? verses.length}
          scrollerRef={scrollerRef}
          onJump={(ayah) => scrollToVerse(`${surah}:${ayah}`, false)}
        />
      )}

      <div
        ref={scrollerRef}
        className={styles.scroller}
        onScroll={(e) => {
          onScroll(e);
          onScrollEnd();
        }}
        onMouseOver={onPointerOver}
        onMouseOut={onPointerOut}
        onFocus={onFocusIn}
        onClick={onWordClick}
      >
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

          {shown.map((verse) => (
            <Verse
              key={verse.verse_key}
              verse={verse}
              words={verse.words.filter((w) => w.char_type_name === "word")}
              translation={plainText(verse.translations?.[0]?.text)}
              translator={verse.translations?.[0]?.resource_name ?? translatorName}
              layout={settings.layout}
              showTranslit={settings.showTranslit}
              showWbw={settings.showWbw}
              showTranslation={settings.showTranslation}
              playing={player.currentKey === verse.verse_key}
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
          {panel.mode === "tafsir" && <TafsirPanel verse={panelVerse} verseKey={panel.verseKey} />}
          {panel.mode === "notes" && (
            <NotesPanel
              key={`${panel.verseKey}:${composeOnOpen}`}
              surah={surah}
              surahName={chapterName}
              verseKey={panel.verseKey}
              loadedVerses={verses}
              composeOnOpen={composeOnOpen}
            />
          )}
        </SidePanel>
      )}
    </div>
  );
}
