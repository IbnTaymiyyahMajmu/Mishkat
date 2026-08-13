"use client";

import { useEffect, useRef, useState } from "react";
import { fetchTafsir } from "@/lib/quran/api";
import { TAFSIRS } from "@/lib/quran/resources";
import type { Para, Verse } from "@/lib/quran/types";
import { useSettings } from "@/lib/store/settings";
import styles from "./Panels.module.css";

/** A passage is absent from the map until it has arrived; absent means loading. */
interface Passage {
  paras: Para[];
  failed: boolean;
}

interface Props {
  verse: Verse | undefined;
  verseKey: string;
}

export function TafsirPanel({ verse, verseKey }: Props) {
  const { settings, update } = useSettings();
  const selected = settings.tafsirIds;
  const [passages, setPassages] = useState<Record<string, Passage>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  /** Slots already requested, so a re-render never re-fetches a passage. */
  const requested = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    for (const id of selected) {
      const slot = `${verseKey}:${id}`;
      if (requested.current.has(slot)) continue;
      requested.current.add(slot);

      fetchTafsir(verseKey, id)
        .then((paras) => {
          if (alive) setPassages((p) => ({ ...p, [slot]: { paras, failed: false } }));
        })
        .catch(() => {
          if (alive) setPassages((p) => ({ ...p, [slot]: { paras: [], failed: true } }));
        });
    }
    return () => {
      alive = false;
    };
  }, [selected, verseKey]);

  const toggleSource = (id: number) => {
    const on = selected.includes(id);
    // Never leave the panel with nothing selected — an empty comparison is not
    // a state anyone chose to be in.
    const next = on ? selected.filter((x) => x !== id) : [...selected, id];
    update({ tafsirIds: next.length ? next : selected });
  };

  return (
    <>
      {verse && (
        <div dir="rtl" className={styles.tafsirVerse}>
          {verse.text_uthmani}
        </div>
      )}

      <div className={styles.section}>
        <div className="kicker kicker-sm" style={{ marginBottom: 10 }}>
          Works to compare · {selected.length} selected
        </div>
        <div className={styles.chips}>
          {TAFSIRS.map((t) => {
            const on = selected.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleSource(t.id)}
                aria-pressed={on}
                className={`${styles.chip} ${on ? styles.chipOn : ""}`}
              >
                {t.name}
                {t.lang === "ar" ? " · ع" : ""}
              </button>
            );
          })}
        </div>
      </div>

      {selected.map((id) => {
        const meta = TAFSIRS.find((t) => t.id === id);
        const slot = `${verseKey}:${id}`;
        const data = passages[slot];
        const loading = !data;
        const isExpanded = !!expanded[slot];
        const paras = data?.paras ?? [];
        const shown = isExpanded ? paras : paras.slice(0, 6);

        return (
          <section key={id} className={styles.work}>
            <header className={styles.workHead}>
              <div className={styles.workName}>{meta?.name ?? "Tafsir"}</div>
              <div className={styles.workAuthor}>
                {meta?.author}
                {meta ? ` · ${meta.lang === "ar" ? "Arabic" : "English"}` : ""}
              </div>
            </header>

            <div className={styles.workBody}>
              {loading && <p className={styles.quiet}>Fetching the passage…</p>}
              {!loading && data.failed && (
                <p className={styles.quiet}>That passage could not be reached.</p>
              )}
              {!loading && !data.failed && paras.length === 0 && (
                <p className={styles.quiet}>This work has no passage indexed for this ayah.</p>
              )}

              {shown.map((p, i) => (
                <p
                  key={i}
                  dir={p.rtl ? "rtl" : "ltr"}
                  className={[
                    styles.tafsirPara,
                    p.rtl ? styles.tafsirArabic : "",
                    p.heading ? styles.tafsirHeading : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {p.text}
                </p>
              ))}
            </div>

            <footer className={styles.workFoot}>
              {paras.length > 6 && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12 }}
                  onClick={() => setExpanded((e) => ({ ...e, [slot]: !e[slot] }))}
                >
                  {isExpanded ? "Show less" : `Show the full passage (${paras.length} paragraphs)`}
                </button>
              )}
              <div style={{ flex: 1 }} />
              <a
                href={`https://quran.com/${verseKey}/tafsirs`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.sourceLink}
              >
                View source ↗
              </a>
            </footer>
          </section>
        );
      })}

      <p className={styles.footnote}>
        Passages are reproduced as published, each under its own book and author. Where two works
        differ, both readings are shown; nothing is merged into a single answer.
      </p>
    </>
  );
}
