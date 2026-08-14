"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMushaf, fetchRecitation } from "@/lib/quran/api";
import type { Verse } from "@/lib/quran/types";
import { useChapters } from "@/lib/store/chapters";
import { THEMES, useSettings } from "@/lib/store/settings";
import { useLibrary } from "@/lib/store/library";
import { usePlayer } from "@/lib/audio/player";
import { useToast } from "@/components/Toast";
import { arabicNumber, plainText } from "@/lib/text";
import { ARABIC_FONTS } from "@/lib/quran/resources";
import styles from "./MushafReader.module.css";

const SIZES = [30, 36, 42, 48, 56, 64];

/** One shared empty list, so "not loaded yet" is the same reference every render. */
const NO_VERSES: Verse[] = [];

/**
 * The muṣḥaf: the surah as one continuous body of Arabic, the way it is read
 * from a printed copy.
 *
 * This is a *view*, not a settings state. Reaching it must not mean turning off
 * translation, then transliteration, then word meanings, and then turning all
 * three back on afterwards — so it has its own route, its own type controls,
 * and it leaves the study reader's preferences exactly as they were.
 *
 * It fetches only `text_uthmani`, which is a fraction of the study payload:
 * al-Baqarah is about 100 KB here against 1.6 MB in the reader.
 */
export function MushafReader({ surah }: { surah: number }) {
  const router = useRouter();
  const toast = useToast();
  const { byId } = useChapters();
  const { settings, update } = useSettings();
  const { isBookmarked, toggleBookmark } = useLibrary();
  const player = usePlayer();

  const [selected, setSelected] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // One state object stamped with the request it answers, so the previous
  // surah's text is never on screen under this surah's heading.
  const request = `${surah}:${nonce}`;
  const [data, setData] = useState<{ request: string; verses: Verse[]; failed: boolean }>({
    request: "",
    verses: [],
    failed: false,
  });
  const fresh = data.request === request;
  const verses = fresh ? data.verses : NO_VERSES;
  const failed = fresh && data.failed;
  const loading = !fresh;

  const chapter = byId(surah);
  const chapterName = chapter?.name_simple ?? `Surah ${surah}`;

  useEffect(() => {
    let alive = true;
    fetchMushaf(surah)
      .then((rows) => alive && setData({ request, verses: rows, failed: false }))
      .catch(() => alive && setData({ request, verses: [], failed: true }));
    return () => {
      alive = false;
    };
  }, [request, surah]);

  // The muṣḥaf keeps its own type size: comfortable continuous reading wants
  // larger type than a reader with three rows and a translation under it.
  const [size, setSize] = useState(() => {
    if (typeof localStorage === "undefined") return 48;
    try {
      const stored = Number(localStorage.getItem("mishkat.mushaf.size"));
      return SIZES.includes(stored) ? stored : 48;
    } catch {
      return 48;
    }
  });
  const changeSize = useCallback((next: number) => {
    setSize(next);
    try {
      localStorage.setItem("mishkat.mushaf.size", String(next));
    } catch {
      /* ignore */
    }
  }, []);

  const selectedVerse = useMemo(
    () => verses.find((v) => v.verse_key === selected),
    [verses, selected],
  );

  // Audio metadata is fetched only when the reader asks to hear something, so
  // reading the page costs nothing extra.
  const [preparingAudio, setPreparingAudio] = useState(false);
  const playFrom = useCallback(
    async (verseKey: string) => {
      setPreparingAudio(true);
      try {
        const withAudio = await fetchRecitation(surah, settings.reciterId);
        player.setQueue({ surah, verses: withAudio });
        player.play(verseKey);
      } catch {
        toast("That recitation could not be loaded.");
      } finally {
        setPreparingAudio(false);
      }
    },
    [surah, settings.reciterId, player, toast],
  );

  const prev = byId(surah - 1);
  const next = byId(surah + 1);

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <Link href={`/read/${surah}/`} className="btn btn-secondary" style={{ fontSize: 12, padding: "5px 12px" }}>
          ← Study view
        </Link>

        <div className={styles.barCentre}>
          <div className={styles.sizes} role="group" aria-label="Arabic size">
            <button
              className="btn btn-icon"
              style={{ width: 28, height: 28 }}
              onClick={() => changeSize(SIZES[Math.max(0, SIZES.indexOf(size) - 1)])}
              disabled={size === SIZES[0]}
              aria-label="Smaller Arabic"
            >
              −
            </button>
            <span className={styles.sizeLabel}>{size}px</span>
            <button
              className="btn btn-icon"
              style={{ width: 28, height: 28 }}
              onClick={() => changeSize(SIZES[Math.min(SIZES.length - 1, SIZES.indexOf(size) + 1)])}
              disabled={size === SIZES[SIZES.length - 1]}
              aria-label="Larger Arabic"
            >
              +
            </button>
          </div>

          <div className={styles.fonts} role="group" aria-label="Arabic typeface">
            {ARABIC_FONTS.map((f) => (
              <button
                key={f.id}
                onClick={() => update({ arabicFont: f.id })}
                className={`${styles.fontBtn} ${settings.arabicFont === f.id ? styles.fontBtnOn : ""}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* The muṣḥaf bar has no room for three lamps, so here the light is a
              cycle: pressing it names the light it is about to move to. */}
          <button
            onClick={() =>
              update({ theme: THEMES[(THEMES.indexOf(settings.theme) + 1) % THEMES.length] })
            }
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: "5px 12px", textTransform: "capitalize" }}
          >
            {THEMES[(THEMES.indexOf(settings.theme) + 1) % THEMES.length]}
          </button>
        </div>

        <button
          onClick={() => router.push(`/read/${surah + 1}/mushaf/`)}
          className="btn btn-ghost"
          style={{ fontSize: 13 }}
          disabled={surah >= 114}
        >
          {next?.name_simple ?? ""} →
        </button>
      </div>

      <div className={styles.page}>
        <header className={styles.head}>
          <div className={styles.headArabic}>{chapter?.name_arabic ?? ""}</div>
          <div className={styles.headName}>
            {chapterName} · {chapter?.verses_count ?? verses.length} ayat
          </div>
        </header>

        {chapter?.bismillah_pre && !loading && (
          <div className={styles.bismillah}>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</div>
        )}

        {loading && <p className={styles.state}>Loading the text…</p>}

        {failed && (
          <div className={styles.state}>
            <p>The text could not be reached.</p>
            <button className="btn btn-primary" onClick={() => setNonce((n) => n + 1)}>
              Try again
            </button>
          </div>
        )}

        {/* One continuous block, justified, with the ayah marker set inline —
            the shape of a printed page rather than a list of rows. */}
        {!loading && !failed && (
          <div
            className={styles.body}
            dir="rtl"
            lang="ar"
            style={{ fontSize: `${size}px` }}
            onClick={(e) => {
              const el = (e.target as HTMLElement).closest("[data-key]");
              const key = el?.getAttribute("data-key");
              setSelected((current) => (key && key !== current ? key : null));
            }}
          >
            {verses.map((v) => (
              <span
                key={v.verse_key}
                data-key={v.verse_key}
                className={`${styles.ayah} ${selected === v.verse_key ? styles.ayahOn : ""}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected((c) => (c === v.verse_key ? null : v.verse_key));
                  }
                }}
                aria-label={`Ayah ${v.verse_key}`}
              >
                {v.text_uthmani}
                <span className={styles.marker} aria-hidden="true">
                  {arabicNumber(v.verse_number)}
                </span>{" "}
              </span>
            ))}
          </div>
        )}

        {!loading && !failed && verses.length > 0 && (
          <footer className={styles.foot}>
            <span className={styles.footMark}>۞</span>
            <div className={styles.footText}>End of {chapterName}</div>
            <div className={styles.footNav}>
              <button
                className="btn btn-secondary"
                onClick={() => router.push(`/read/${surah - 1}/mushaf/`)}
                disabled={surah <= 1}
              >
                ← {prev?.name_simple ?? ""}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => router.push(`/read/${surah + 1}/mushaf/`)}
                disabled={surah >= 114}
              >
                {next?.name_simple ?? ""} →
              </button>
            </div>
          </footer>
        )}
      </div>

      {/* Tapping an ayah does not break the page apart; it raises a small bar
          with the things you would want at that moment. */}
      {selectedVerse && (
        <div className={styles.selection}>
          <span className={styles.selectionKey}>{selectedVerse.verse_key}</span>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
            onClick={() => void playFrom(selectedVerse.verse_key)}
            disabled={preparingAudio}
          >
            {preparingAudio ? "Loading…" : "Play"}
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
            onClick={() => {
              const added = toggleBookmark({
                verseKey: selectedVerse.verse_key,
                surah,
                arabic: selectedVerse.text_uthmani,
                translation: plainText(selectedVerse.translations?.[0]?.text),
                translator: "",
              });
              toast(added ? `Ayah ${selectedVerse.verse_key} bookmarked` : "Bookmark removed");
            }}
          >
            {isBookmarked(selectedVerse.verse_key) ? "Bookmarked" : "Bookmark"}
          </button>
          <Link href={`/read/${surah}/#${selectedVerse.verse_key}`} className="btn btn-ghost" style={{ fontSize: 12 }}>
            Open in study view
          </Link>
          <button className={styles.selectionClose} onClick={() => setSelected(null)} aria-label="Clear selection">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
