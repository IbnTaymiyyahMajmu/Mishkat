"use client";

import { useEffect, useRef, useState } from "react";
import type { LexiconEntry, LexiconText, RootProfile, Segment, Verse, Word } from "@/lib/quran/types";
import { fetchOccurrences } from "@/lib/quran/api";
import {
  MORPHOLOGY_SOURCE,
  fetchAyahMorphology,
  fetchLexicon,
  fetchLexiconText,
  fetchRoot,
  scanUrl,
} from "@/lib/quran/lexicon";
import { readGrammar, romanizeRoot } from "@/lib/quran/morphology";
import { stripDiacritics } from "@/lib/text";
import { useGoToVerse } from "@/lib/useGoToVerse";
import styles from "./Panels.module.css";

/**
 * What one word is made of, and where to go and read about it.
 *
 * The panel is built in the order a person actually studies a word: what it is
 * made of, what it grows from, what the lexicographers said about that, and
 * where else it turns up. Every one of those layers arrives from a named
 * source and is labelled with that name on screen.
 *
 * The rule the panel holds to is the one the rest of the site holds to: it
 * repeats what a source recorded and it does not add to it. The corpus behind
 * the grammar also serves machine-written glosses, and none of them are
 * requested — see the note in `lexicon.ts`. Where the lexicons have nothing for
 * a root, the panel says they have nothing and offers the scans instead. An
 * empty answer from a real source beats a full one from no source.
 */

interface Props {
  verse: Verse | undefined;
  word: Word | undefined;
  surahName: string;
  onOpenTafsir: () => void;
}

/** Absent means still in flight; `null` means asked and answered with nothing. */
type Slot<T> = { key: string; value: T } | undefined;

export function WordStudyPanel({ verse, word, surahName, onOpenTafsir }: Props) {
  const goToVerse = useGoToVerse();
  const verseKey = verse?.verse_key ?? "";
  const form = word ? stripDiacritics(word.text_uthmani || word.text || "") : "";

  const [segments, setSegments] = useState<Slot<Segment[] | null>>();
  const [root, setRoot] = useState<Slot<RootProfile | null>>();
  const [lexicon, setLexicon] = useState<Slot<LexiconEntry[]>>();
  const [texts, setTexts] = useState<Record<number, LexiconText | null>>({});
  /* Entry ids are unique per work *and* root, so which entries stand open needs
     no clearing when the reader moves on — a new root cannot collide with it.
     Whether the cognates are open does collide, so it is held as the root they
     were opened for and falls shut on its own when that changes. */
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [cognatesFor, setCognatesFor] = useState("");
  /** Entries already requested, so re-rendering never re-fetches one. */
  const asked = useRef(new Set<number>());

  // Stamped with the word it belongs to, so the panel is never showing one
  // word's occurrences under another word's heading while a fetch is in flight.
  const [found, setFound] = useState<{ form: string; rows: { key: string; text: string }[] }>({
    form: "",
    rows: [],
  });

  const parts = stamped(segments, `${verseKey}:${word?.position ?? 0}`);
  const stem = parts?.find((s) => s.rootKey);
  const rootKey = stem?.rootKey ?? "";

  useEffect(() => {
    if (!verseKey || !word) return;
    let alive = true;
    fetchAyahMorphology(verseKey)
      .then((words) => {
        if (!alive) return;
        const w = words.find((x) => x.position === word.position);
        setSegments({ key: `${verseKey}:${word.position}`, value: w?.segments ?? null });
      })
      .catch(() => alive && setSegments({ key: `${verseKey}:${word.position}`, value: null }));
    return () => {
      alive = false;
    };
  }, [verseKey, word]);

  useEffect(() => {
    if (!rootKey) return;
    let alive = true;
    fetchRoot(rootKey)
      .then((r) => alive && setRoot({ key: rootKey, value: r }))
      .catch(() => alive && setRoot({ key: rootKey, value: null }));
    fetchLexicon(rootKey)
      .then((rows) => alive && setLexicon({ key: rootKey, value: rows }))
      .catch(() => alive && setLexicon({ key: rootKey, value: [] }));
    return () => {
      alive = false;
    };
  }, [rootKey]);

  useEffect(() => {
    if (!form) return;
    let alive = true;
    fetchOccurrences(form)
      .then((rows) => alive && setFound({ form, rows }))
      .catch(() => alive && setFound({ form, rows: [] }));
    return () => {
      alive = false;
    };
  }, [form]);

  const openEntry = (id: number) => {
    setOpen((o) => ({ ...o, [id]: !o[id] }));
    if (asked.current.has(id)) return;
    asked.current.add(id);
    fetchLexiconText(id)
      .then((t) => setTexts((m) => ({ ...m, [id]: t })))
      .catch(() => setTexts((m) => ({ ...m, [id]: null })));
  };

  if (!verse || !word) {
    return <p className={styles.empty}>Select a word in the text to study it.</p>;
  }

  const wordCount = verse.words.filter((w) => w.char_type_name === "word").length;
  const profile = stamped(root, rootKey);
  const works = stamped(lexicon, rootKey);
  const loadingParts = parts === undefined;

  return (
    <>
      <div className={styles.wordHead}>
        <div className={styles.wordArabic}>{word.text_uthmani || word.text}</div>
        <div className={styles.wordTranslit}>{word.transliteration?.text || ""}</div>
        <div className={styles.wordGloss}>{word.translation?.text || ""}</div>
      </div>

      {/* ── what the word is made of ───────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className="kicker kicker-sm">The word, part by part</div>
          {parts && parts.length > 1 && (
            <div className={styles.count}>{parts.length} segments</div>
          )}
        </div>

        {loadingParts && <p className={styles.quiet}>Reading the grammar…</p>}
        {parts === null && (
          <p className={styles.quiet}>
            The morphology for this ayah could not be reached. Nothing is inferred in its place.
          </p>
        )}

        {parts?.map((s, i) => {
          const g = readGrammar(s.raw, s.pos);
          return (
            <div key={i} className={styles.segment}>
              <div className={styles.segmentForm} dir="rtl">
                {s.form}
              </div>
              <div className={styles.segmentBody}>
                <div className={styles.segmentPos}>{s.pos}</div>
                {(g.root || g.lemma) && (
                  <div className={styles.segmentStem}>
                    {s.rootSpaced && (
                      <span>
                        root <b dir="rtl">{s.rootSpaced}</b>
                      </span>
                    )}
                    {s.lemma && (
                      <span>
                        lemma <b dir="rtl">{s.lemma}</b>
                      </span>
                    )}
                  </div>
                )}
                {g.traits.length > 0 && (
                  <div className={styles.traits}>
                    {g.traits.map((t) => (
                      <span key={t} className={styles.trait}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <dl className={styles.definitions}>
        <dt>Location</dt>
        <dd className={styles.numeric}>{word.location || `${verse.verse_key}:${word.position}`}</dd>
        <dt>Ayah</dt>
        <dd>{`${surahName} ${verse.verse_key}`}</dd>
        <dt>Position</dt>
        <dd className={styles.numeric}>{`Word ${word.position} of ${wordCount}`}</dd>
        <dt>Page</dt>
        <dd className={styles.numeric}>{verse.page_number}</dd>
        <dt>Juz</dt>
        <dd className={styles.numeric}>{verse.juz_number}</dd>
      </dl>

      {/* ── the root ───────────────────────────────────────────────────── */}
      {rootKey && (
        <section className={styles.section}>
          <div className="kicker kicker-sm" style={{ marginBottom: 10 }}>
            The root
          </div>
          <div className={styles.rootCard}>
            <div className={styles.rootArabic} dir="rtl">
              {stem?.rootSpaced}
            </div>
            <div className={styles.rootMeta}>
              <span className={styles.rootRoman}>{profile?.romanized || romanizeRoot(rootKey)}</span>
              {profile && (
                <span>
                  {profile.occurrences.toLocaleString()} occurrences in the Qur&rsquo;an
                  {profile.lemmas.length > 0 &&
                    ` · ${profile.lemmas.length} ${profile.lemmas.length === 1 ? "lemma" : "lemmas"}`}
                </span>
              )}
            </div>
            {profile && profile.lemmas.length > 0 && (
              <div className={styles.lemmas} dir="rtl">
                {profile.lemmas.map((l) => (
                  <span key={l} className={styles.lemma}>
                    {l}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── the lexicons ───────────────────────────────────────────────── */}
      {rootKey && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div className="kicker kicker-sm">In the lexicons</div>
            {works && works.length > 0 && (
              <div className={styles.count}>
                {works.length} {works.length === 1 ? "work" : "works"}
              </div>
            )}
          </div>

          {works === undefined && <p className={styles.quiet}>Opening the lexicons…</p>}
          {works?.length === 0 && (
            <p className={styles.quiet}>
              No lexicon in the connected library carries an entry for this root yet. The scanned
              pages below are unaffected.
            </p>
          )}

          {works?.map((w) => {
            const isOpen = !!open[w.id];
            const text = texts[w.id];
            const teaser = w.summary.replace(/\s+/g, " ").slice(0, 150);

            return (
              <section key={w.id} className={styles.work}>
                <header className={styles.workHead}>
                  <button className={styles.workToggle} onClick={() => openEntry(w.id)} aria-expanded={isOpen}>
                    <span className={styles.workNames}>
                      <span className={styles.workName}>{w.name}</span>
                      {w.nameArabic && (
                        <span className={styles.workNameAr} dir="rtl">
                          {w.nameArabic}
                        </span>
                      )}
                    </span>
                    <span className={styles.workAuthor}>
                      {w.author}
                      {w.died !== null && ` · d. ${w.died}`}
                      {w.quranic && <span className={styles.tag}>of the Qur&rsquo;an</span>}
                    </span>
                    {!isOpen && teaser && <span className={styles.teaser}>{teaser}…</span>}
                  </button>
                </header>

                {isOpen && (
                  <>
                    <div className={styles.workBody}>
                      {/* The Arabic first: the translation is the part that can
                          be wrong, and it should be read against something. */}
                      {text === undefined && <p className={styles.quiet}>Fetching the entry…</p>}
                      {text?.arabic && (
                        <p dir="rtl" className={`${styles.tafsirPara} ${styles.tafsirArabic}`}>
                          {text.arabic}
                        </p>
                      )}
                      {text?.english && (
                        <>
                          <div className="kicker kicker-sm" style={{ margin: "16px 0 8px" }}>
                            Translated
                          </div>
                          {paragraphs(text.english).map((p, i) => (
                            <p key={i} className={styles.tafsirPara}>
                              {p}
                            </p>
                          ))}
                        </>
                      )}
                      {w.summary && (
                        <>
                          <div className="kicker kicker-sm" style={{ margin: "16px 0 8px" }}>
                            In summary
                          </div>
                          {paragraphs(w.summary).map((p, i) => (
                            <p key={i} className={styles.tafsirPara}>
                              {p}
                            </p>
                          ))}
                        </>
                      )}
                    </div>

                    <footer className={styles.workFoot}>
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => openEntry(w.id)}>
                        Close
                      </button>
                      <div style={{ flex: 1 }} />
                      {text?.sourceUrl && (
                        <a
                          href={text.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.sourceLink}
                        >
                          Read it there ↗
                        </a>
                      )}
                    </footer>
                  </>
                )}
              </section>
            );
          })}

          <div className={styles.workFoot} style={{ borderTop: 0, paddingLeft: 0, paddingRight: 0 }}>
            <a
              href={scanUrl(rootKey)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sourceLink}
            >
              Scanned pages · Lane, Hava, Wehr ↗
            </a>
          </div>
        </section>
      )}

      {/* ── the sister languages ───────────────────────────────────────── */}
      {profile && profile.cognates.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div className="kicker kicker-sm">In the sister languages</div>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12 }}
              onClick={() => setCognatesFor((r) => (r === rootKey ? "" : rootKey))}
              aria-expanded={cognatesFor === rootKey}
            >
              {cognatesFor === rootKey ? "Hide" : `Show ${profile.cognates.length}`}
            </button>
          </div>
          {cognatesFor === rootKey && (
            <>
              {profile.cognates.map((c, i) => (
                <div key={i} className={styles.cognate}>
                  <span className={styles.cognateWord}>{c.word}</span>
                  <span className={styles.cognateLang}>
                    {c.language}
                    <span className={styles.cognateFamily}>{c.family}</span>
                  </span>
                  <span className={styles.cognateSense}>{c.meaning}</span>
                </div>
              ))}
              <p className={styles.footnote}>
                Comparative philology, not Arabic lexicography — a cognate shows how a root was used
                in a related language, which is a different question from what the word means here.
                The lexicons above answer that one.
              </p>
            </>
          )}
        </section>
      )}

      {/* ── elsewhere ──────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className="kicker kicker-sm">Elsewhere in the Qur&rsquo;an</div>
          {found.form === form && found.rows.length > 0 && (
            <div className={styles.count}>{found.rows.length} shown</div>
          )}
        </div>

        {!!form && found.form !== form && <p className={styles.quiet}>Searching the muṣḥaf…</p>}
        {found.form === form && found.rows.length === 0 && (
          <p className={styles.quiet}>No other exact matches for this form.</p>
        )}

        {(found.form === form ? found.rows : []).map((o) => (
          <button key={o.key} className={styles.occurrence} onClick={() => goToVerse(o.key)}>
            <span dir="rtl" className={styles.occurrenceText}>
              {o.text}
            </span>
            <span className={styles.occurrenceKey}>{o.key}</span>
          </button>
        ))}
        <p className={styles.footnote}>Exact-form matches from the corpus search index.</p>
      </section>

      <button onClick={onOpenTafsir} className="btn btn-primary btn-block" style={{ marginTop: 22 }}>
        Read tafsir for {verse.verse_key}
      </button>

      <p className={styles.footnote}>
        Grammar, root and lemma from{" "}
        <a href={MORPHOLOGY_SOURCE.href} target="_blank" rel="noopener noreferrer">
          {MORPHOLOGY_SOURCE.name}
        </a>
        . Lexicon entries are reproduced under each author&rsquo;s own name and death date, Arabic
        first; both are served by{" "}
        <a href={MORPHOLOGY_SOURCE.servedHref} target="_blank" rel="noopener noreferrer">
          {MORPHOLOGY_SOURCE.served}
        </a>
        . Nothing on this panel is generated — where a source is silent, so is the screen.
      </p>
    </>
  );
}

/**
 * A slot answers only for the word or root it was fetched for. Anything else
 * reads as still loading, so the panel never shows one word's grammar or one
 * root's lexicon under another word's heading while a fetch is in flight.
 */
function stamped<T>(s: Slot<T>, key: string): T | undefined {
  return s && s.key === key ? s.value : undefined;
}

/** Lexicon prose arrives as plain text with its points separated by blank lines. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}
