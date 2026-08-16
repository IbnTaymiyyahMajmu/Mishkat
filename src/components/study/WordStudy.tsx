"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  LexiconEntry,
  LexiconText,
  RootProfile,
  RootVerse,
  Segment,
  Verse,
} from "@/lib/quran/types";
import { fetchOccurrences, fetchVerseWithWords } from "@/lib/quran/api";
import {
  MORPHOLOGY_SOURCE,
  fetchAyahMorphology,
  fetchLexicon,
  fetchLexiconText,
  fetchRoot,
  fetchRootVerses,
  scanUrl,
} from "@/lib/quran/lexicon";
import { isCompound, readGrammar, romanizeRoot, type Grammar } from "@/lib/quran/morphology";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import { useChapters } from "@/lib/store/chapters";
import { useSettings } from "@/lib/store/settings";
import { stripDiacritics } from "@/lib/text";
import styles from "./WordStudy.module.css";

/**
 * One word of the Qur'an, given a whole page.
 *
 * The side panel in the reader answers "what is this word" beside the text
 * without taking the reader out of the ayah. It is deliberately narrow, and a
 * lexicon entry running to several thousand words of Ibn Manẓūr does not belong
 * in a column that width. This is where that reading happens instead: one
 * screen, a rail to move around it by, and every layer set at a size a person
 * can sit with.
 *
 * It holds to the same rule the panel does, and the rule is the reason the page
 * is worth having: everything on it comes from a named source and is shown
 * under that name. The grammar is the Quranic Arabic Corpus. Each lexicon entry
 * is printed in the Arabic its author wrote, with the translation under it and
 * a link out to read it somewhere that is not this site. The counts are counts.
 * The colour coding marks what the corpus already states — which segment is a
 * prefix, which is the stem — and marks nothing that had to be worked out. No
 * sentence on this page was written by a machine about the language.
 */

/** A slot answers only for the thing it was fetched for. */
type Slot<T> = { key: string; value: T } | undefined;

function stamped<T>(s: Slot<T>, key: string): T | undefined {
  return s && s.key === key ? s.value : undefined;
}

interface Loaded {
  verses: RootVerse[];
  total: number;
}

/** A place in the page the rail can send you, and say you are at. */
interface Stop {
  id: string;
  label: string;
  /** A lexicon under the heading that gathers them, indented in the rail. */
  sub?: boolean;
}

export function WordStudy() {
  const params = useSearchParams();
  const target = params.get("w") ?? "";
  const wantedWork = Number(params.get("work") ?? 0) || 0;

  const [surah, ayah, position] = useMemo(() => {
    const m = /^(\d+):(\d+):(\d+)$/.exec(target.trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
  }, [target]);
  const verseKey = surah ? `${surah}:${ayah}` : "";

  const { settings } = useSettings();
  const { chapters } = useChapters();
  const chapter = chapters.find((c) => c.id === surah);
  const surahName = chapter?.name_simple ?? SURAH_NAMES[surah - 1]?.english ?? `Surah ${surah}`;

  const [verse, setVerse] = useState<Slot<Verse | null>>();
  const [segments, setSegments] = useState<Slot<Segment[] | null>>();
  const [root, setRoot] = useState<Slot<RootProfile | null>>();
  const [works, setWorks] = useState<Slot<LexiconEntry[]>>();
  const [spread, setSpread] = useState<Slot<Loaded>>();
  const [sameForm, setSameForm] = useState<Slot<number>>();
  const [texts, setTexts] = useState<Record<number, LexiconText | null>>({});
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [fetchingMore, setFetchingMore] = useState(false);
  const asked = useRef(new Set<number>());

  const parts = stamped(segments, target);
  const stem = parts?.find((s) => s.rootKey);
  const rootKey = stem?.rootKey ?? "";
  const profile = stamped(root, rootKey);
  const lexicons = stamped(works, rootKey);
  const occurrences = stamped(spread, rootKey);
  const formCount = stamped(sameForm, target);

  const word = stamped(verse, verseKey)?.words.find((w) => w.position === position);
  const grammars: Grammar[] = (parts ?? []).map((s) => readGrammar(s.raw, s.pos));

  // ── loading ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!verseKey) return;
    let alive = true;
    fetchVerseWithWords(verseKey, settings.translationId)
      .then((v) => alive && setVerse({ key: verseKey, value: v }))
      .catch(() => alive && setVerse({ key: verseKey, value: null }));
    return () => {
      alive = false;
    };
  }, [verseKey, settings.translationId]);

  useEffect(() => {
    if (!verseKey || !position) return;
    let alive = true;
    const key = target;
    fetchAyahMorphology(verseKey)
      .then((words) => {
        if (!alive) return;
        setSegments({ key, value: words.find((w) => w.position === position)?.segments ?? null });
      })
      .catch(() => alive && setSegments({ key, value: null }));
    return () => {
      alive = false;
    };
  }, [verseKey, position, target]);

  useEffect(() => {
    if (!rootKey) return;
    let alive = true;
    fetchRoot(rootKey)
      .then((r) => alive && setRoot({ key: rootKey, value: r }))
      .catch(() => alive && setRoot({ key: rootKey, value: null }));
    fetchLexicon(rootKey)
      .then((rows) => alive && setWorks({ key: rootKey, value: rows }))
      .catch(() => alive && setWorks({ key: rootKey, value: [] }));
    fetchRootVerses(rootKey)
      .then((p) => alive && setSpread({ key: rootKey, value: p }))
      .catch(() => alive && setSpread({ key: rootKey, value: { verses: [], total: 0 } }));
    return () => {
      alive = false;
    };
  }, [rootKey]);

  // How often this exact form occurs, as against how often the root does. The
  // two numbers together are the interesting thing: رَبِّ is one shape of a root
  // that takes many, and the gap between the counts is that fact.
  const bare = word ? stripDiacritics(word.text_uthmani || word.text || "") : "";
  useEffect(() => {
    if (!bare) return;
    let alive = true;
    const key = target;
    fetchOccurrences(bare, 1)
      .then((r) => alive && setSameForm({ key, value: r.total }))
      .catch(() => alive && setSameForm({ key, value: 0 }));
    return () => {
      alive = false;
    };
  }, [bare, target]);

  /**
   * Whether an entry stands open. The work named in the address is open from
   * the first paint — arriving from the panel should land on the entry that was
   * pressed, already showing — and `open` records only what the reader has since
   * decided. Deriving it rather than setting it is what keeps the URL and the
   * screen agreeing without an effect that writes state on arrival.
   */
  const isOpen = (id: number) => open[id] ?? id === wantedWork;
  const toggle = (id: number) =>
    setOpen((o) => ({ ...o, [id]: !(o[id] ?? id === wantedWork) }));

  // The text of an entry is fetched once it is open, and once only. `asked`
  // is a ref rather than state because re-rendering must not re-request.
  useEffect(() => {
    if (!lexicons) return;
    for (const w of lexicons) {
      if (!(open[w.id] ?? w.id === wantedWork) || asked.current.has(w.id)) continue;
      asked.current.add(w.id);
      fetchLexiconText(w.id)
        .then((t) => setTexts((m) => ({ ...m, [w.id]: t })))
        .catch(() => setTexts((m) => ({ ...m, [w.id]: null })));
    }
  }, [lexicons, open, wantedWork]);

  /**
   * …and the page goes to it — but only once everything above it has landed.
   *
   * The sections above the lexicons arrive on their own schedules, and the list
   * of ayat carrying the root is thousands of pixels of it. Scrolling before
   * they are in place puts the entry where it is now and then grows the page
   * underneath it, which leaves the reader some distance short of the thing
   * they followed a link to. So this waits for the ayat and for the entry's own
   * text, and then moves once.
   *
   * Whether all that has landed is worked out here and handed to the effect as
   * one boolean. Passing the pieces themselves — an array of entries and two
   * values that begin undefined — gave React a dependency list it read as
   * changing length, and an effect it then declined to run at all.
   */
  const readyToJump =
    !!wantedWork &&
    !!lexicons?.some((w) => w.id === wantedWork) &&
    occurrences !== undefined &&
    texts[wantedWork] !== undefined;

  const jumped = useRef(0);
  useEffect(() => {
    if (!readyToJump || jumped.current === wantedWork) return;
    jumped.current = wantedWork;

    // Straight away rather than on an animation frame: everything this waited
    // for has rendered, so the layout is already settled — and a tab opened in
    // the background is never painted, which means a frame that never comes and
    // a reader who arrives at the top of the page instead of at their entry.
    // The second pass catches a late web font moving the target under it.
    const go = () =>
      document.getElementById(`work-${wantedWork}`)?.scrollIntoView({ block: "start" });
    go();
    const settle = setTimeout(go, 80);
    return () => clearTimeout(settle);
  }, [readyToJump, wantedWork]);

  const loadMore = () => {
    if (!occurrences || fetchingMore) return;
    setFetchingMore(true);
    fetchRootVerses(rootKey, occurrences.verses.length)
      .then((p) =>
        setSpread({
          key: rootKey,
          value: { verses: [...occurrences.verses, ...p.verses], total: p.total },
        }),
      )
      .catch(() => undefined)
      .finally(() => setFetchingMore(false));
  };

  // ── the rail ──────────────────────────────────────────────────────────────

  const stops: Stop[] = [
    { id: "word", label: "The word" },
    { id: "breakdown", label: "Part by part" },
    ...(rootKey
      ? [
          { id: "root", label: "The root" },
          { id: "occurrences", label: "Where it occurs" },
        ]
      : []),
    ...(lexicons?.length
      ? [
          { id: "lexicons", label: "The lexicons" },
          ...lexicons.map((w) => ({ id: `work-${w.id}`, label: w.name, sub: true })),
        ]
      : []),
    ...(profile?.cognates.length ? [{ id: "cognates", label: "Sister languages" }] : []),
    { id: "sources", label: "Sources" },
  ];

  const here = useHere(stops.map((s) => s.id));

  if (!surah) {
    return (
      <div className="page-shell">
        <div className="page-body">
          <div className="kicker">Study</div>
          <h1 className={styles.missingTitle}>No word chosen</h1>
          <p className={styles.missingBody}>
            This page opens on one word of the Qur&rsquo;an. Open a surah, press a word in the text,
            and follow <em>Study this word in full</em> from the panel that appears.
          </p>
          <Link href="/surahs/" className="btn btn-primary" style={{ marginTop: 20 }}>
            Choose a surah
          </Link>
        </div>
      </div>
    );
  }

  const compound = grammars.length > 1 && isCompound(grammars);
  const ayahText = stamped(verse, verseKey)?.text_uthmani ?? "";
  const ayahTranslation = stamped(verse, verseKey)?.translations?.[0];

  return (
    <div className="page-shell">
      <div className={styles.layout}>
        {/* ── the rail ───────────────────────────────────────────────── */}
        <nav className={styles.rail} aria-label="On this page">
          <div className={styles.railInner}>
            <div className="kicker kicker-sm" style={{ marginBottom: 10 }}>
              On this page
            </div>
            {stops.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={[
                  styles.railLink,
                  s.sub ? styles.railSub : "",
                  here === s.id ? styles.railOn : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        <article className={styles.body}>
          {/* ── the word ─────────────────────────────────────────────── */}
          <header id="word" className={styles.head}>
            <Link href={`/read/${surah}/#${verseKey}`} className={styles.back}>
              ← {surahName} {verseKey}
            </Link>

            <div className={styles.headword} dir="rtl">
              {word?.text_uthmani || word?.text || parts?.map((p) => p.form).join("") || "…"}
            </div>
            {word?.transliteration?.text && (
              <div className={styles.headTranslit}>{word.transliteration.text}</div>
            )}
            {word?.translation?.text && (
              <div className={styles.headGloss}>{word.translation.text}</div>
            )}
            <div className={styles.headWhere}>
              Word {position} of {verseKey} · page {stamped(verse, verseKey)?.page_number ?? "—"} ·
              juz&rsquo; {stamped(verse, verseKey)?.juz_number ?? "—"}
            </div>
          </header>

          {ayahText && (
            <section className={styles.context}>
              <div className="kicker kicker-sm">The ayah it stands in</div>
              <p className={styles.contextArabic} dir="rtl">
                {mark(ayahText, [position], styles.here)}
              </p>
              {ayahTranslation && (
                <>
                  <p className={styles.contextEnglish}>{plain(ayahTranslation.text)}</p>
                  <div className={styles.credit}>
                    Translation of the meaning · {ayahTranslation.resource_name}
                  </div>
                </>
              )}
            </section>
          )}

          {/* ── part by part ─────────────────────────────────────────── */}
          <section id="breakdown" className={styles.section}>
            <h2 className={styles.h2}>Part by part</h2>

            {parts === undefined && <p className={styles.quiet}>Reading the grammar…</p>}
            {parts === null && (
              <p className={styles.quiet}>
                The morphology for this ayah could not be reached. Nothing is inferred in its place.
              </p>
            )}

            {parts && compound && (
              <>
                <p className={styles.lede}>
                  The corpus tags this word in {parts.length} pieces. They are set apart here, and
                  keyed by colour throughout the page — a prefix, the stem that carries the root,
                  and what is attached at the end. Arabic letters do not join across the gaps, so
                  the pieces are shown separated rather than as the word is written.
                </p>
                <div className={styles.split} dir="rtl">
                  {parts.map((s, i) => (
                    <span key={i} className={`${styles.piece} ${styles[grammars[i].role]}`}>
                      {s.form}
                    </span>
                  ))}
                </div>
                <div className={styles.legend}>
                  {(["prefix", "stem", "suffix"] as const)
                    .filter((r) => grammars.some((g) => g.role === r))
                    .map((r) => (
                      <span key={r} className={styles.legendItem}>
                        <span className={`${styles.swatch} ${styles[r]}`} />
                        {r === "stem" ? "stem — carries the root" : r}
                      </span>
                    ))}
                </div>
              </>
            )}

            {parts?.map((s, i) => {
              const g = grammars[i];
              return (
                <div key={i} className={`${styles.seg} ${styles[`edge_${g.role}`]}`}>
                  <div className={styles.segForm} dir="rtl">
                    <span className={styles[g.role]}>{s.form}</span>
                  </div>
                  <div className={styles.segBody}>
                    <div className={styles.segTop}>
                      <span className={styles.segPos}>{s.pos}</span>
                      <span className={`${styles.segRole} ${styles[`chip_${g.role}`]}`}>{g.role}</span>
                    </div>

                    {(s.rootSpaced || s.lemma) && (
                      <dl className={styles.segStem}>
                        {s.rootSpaced && (
                          <>
                            <dt>Root</dt>
                            <dd dir="rtl" className={styles.segRoot}>
                              {s.rootSpaced}
                            </dd>
                          </>
                        )}
                        {s.lemma && (
                          <>
                            <dt>Lemma</dt>
                            <dd dir="rtl" className={styles.segLemma}>
                              {s.lemma}
                            </dd>
                          </>
                        )}
                      </dl>
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

          {/* ── the root ─────────────────────────────────────────────── */}
          {rootKey && (
            <section id="root" className={styles.section}>
              <h2 className={styles.h2}>The root</h2>
              <div className={styles.rootBlock}>
                <div className={styles.rootArabic} dir="rtl">
                  {stem?.rootSpaced}
                </div>
                {/* Romanised here rather than upstream: the corpus's own
                    transliteration is written for the Semitic comparison and
                    uses its notation — s¹ for the sibilant — which is the right
                    answer in the cognate table below and a puzzle above a
                    root. */}
                <div className={styles.rootRoman}>{romanizeRoot(rootKey)}</div>
              </div>

              {/* Three counts and no fourth. The corpus reports how many ayat
                  carry a root, not how many words do, and the difference is
                  real — a root can occur twice in one line. Rather than dress
                  the same number up twice under two labels, the page says the
                  one thing it actually knows. */}
              <div className={styles.figures}>
                <Figure
                  n={profile ? profile.ayat.toLocaleString() : "—"}
                  label="ayat carry this root"
                />
                <Figure n={profile ? String(profile.lemmas.length) : "—"} label="lemmas grown from it" />
                <Figure
                  n={formCount === undefined ? "—" : formCount.toLocaleString()}
                  label="ayat with this exact form"
                />
                <Figure
                  n={lexicons === undefined ? "—" : String(lexicons.length)}
                  label="lexicons with an entry"
                />
              </div>

              {profile && profile.lemmas.length > 0 && (
                <>
                  <div className="kicker kicker-sm" style={{ margin: "26px 0 10px" }}>
                    Every lemma the corpus grows from it
                  </div>
                  <div className={styles.lemmas} dir="rtl">
                    {profile.lemmas.map((l) => (
                      <span
                        key={l}
                        className={`${styles.lemmaChip} ${l === stem?.lemma ? styles.lemmaOn : ""}`}
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                  <p className={styles.footnote}>
                    The lemma of the word on this page is marked. A lemma is a dictionary form, not
                    a meaning: two lemmas of one root can sit some distance apart.
                  </p>
                </>
              )}
            </section>
          )}

          {/* ── where it occurs ──────────────────────────────────────── */}
          {rootKey && (
            <section id="occurrences" className={styles.section}>
              <h2 className={styles.h2}>Where it occurs</h2>
              {occurrences === undefined && <p className={styles.quiet}>Counting…</p>}
              {occurrences && (
                <>
                  <p className={styles.lede}>
                    Every ayah carrying this root, in the order of the muṣḥaf, with the words that
                    carry it marked. {occurrences.verses.length.toLocaleString()} of{" "}
                    {occurrences.total.toLocaleString()} shown.
                    {formCount !== undefined && formCount > 0 && (
                      <>
                        {" "}
                        The search index finds {formCount.toLocaleString()} of them carrying this
                        exact form; the rest are other shapes grown from the same root.
                      </>
                    )}
                  </p>
                  {occurrences.verses.map((v) => (
                    <Link key={v.key} href={`/read/${v.key.split(":")[0]}/#${v.key}`} className={styles.occ}>
                      <span className={styles.occKey}>{v.key}</span>
                      <span className={styles.occArabic} dir="rtl">
                        {mark(v.arabic, v.matched, styles.here)}
                      </span>
                      {v.translation && <span className={styles.occEnglish}>{v.translation}</span>}
                    </Link>
                  ))}
                  {occurrences.verses.length < occurrences.total && (
                    <button className="btn btn-secondary btn-block" onClick={loadMore} disabled={fetchingMore}>
                      {fetchingMore
                        ? "Fetching…"
                        : `Show fifty more of ${(occurrences.total - occurrences.verses.length).toLocaleString()} left`}
                    </button>
                  )}
                </>
              )}
            </section>
          )}

          {/* ── the lexicons ─────────────────────────────────────────── */}
          {rootKey && (
            <section id="lexicons" className={styles.section}>
              <h2 className={styles.h2}>The lexicons</h2>
              {lexicons === undefined && <p className={styles.quiet}>Opening the lexicons…</p>}
              {lexicons?.length === 0 && (
                <p className={styles.quiet}>
                  No lexicon in the connected library carries an entry for this root yet. The
                  scanned pages under Sources are unaffected.
                </p>
              )}
              {lexicons && lexicons.length > 0 && (
                <p className={styles.lede}>
                  {lexicons.length} works, the earliest author first. Each entry is printed in the
                  Arabic its author wrote, with a translation of that Arabic beneath it — the Arabic
                  first, because the translation is the part that can be wrong.
                </p>
              )}

              {lexicons?.map((w) => (
                <LexiconSection
                  key={w.id}
                  work={w}
                  text={texts[w.id]}
                  open={isOpen(w.id)}
                  onToggle={() => toggle(w.id)}
                  scan={scanUrl(rootKey)}
                />
              ))}
            </section>
          )}

          {/* ── cognates ─────────────────────────────────────────────── */}
          {profile && profile.cognates.length > 0 && (
            <section id="cognates" className={styles.section}>
              <h2 className={styles.h2}>In the sister languages</h2>
              <p className={styles.lede}>
                Comparative philology, not Arabic lexicography. A cognate records how a root was
                used in a related language, which is a different question from what the word means
                here — the lexicons above answer that one. Oldest attestation first.
              </p>
              <div className={styles.cognates}>
                {profile.cognates.map((c, i) => (
                  <div key={i} className={styles.cog}>
                    <div className={styles.cogWord}>{c.word}</div>
                    <div className={styles.cogLang}>
                      {c.language}
                      <span className={styles.cogFamily}>{c.family}</span>
                    </div>
                    <div className={styles.cogWhen}>{era(c.from, c.to)}</div>
                    <div className={styles.cogSense}>{c.meaning}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── sources ──────────────────────────────────────────────── */}
          <section id="sources" className={styles.section}>
            <h2 className={styles.h2}>Sources</h2>
            <dl className={styles.sources}>
              <dt>Text and translation</dt>
              <dd>Uthmānī muṣḥaf and word gloss, Quran.com corpus</dd>
              <dt>Grammar, root, lemma</dt>
              <dd>
                <a href={MORPHOLOGY_SOURCE.href} target="_blank" rel="noopener noreferrer">
                  {MORPHOLOGY_SOURCE.name}
                </a>{" "}
                — Kais Dukes, Language Research Group, University of Leeds
              </dd>
              <dt>Lexicons and cognates</dt>
              <dd>
                Served by{" "}
                <a href={MORPHOLOGY_SOURCE.servedHref} target="_blank" rel="noopener noreferrer">
                  {MORPHOLOGY_SOURCE.served}
                </a>
                , each entry under its own author&rsquo;s name
              </dd>
              {rootKey && (
                <>
                  <dt>Scanned pages</dt>
                  <dd>
                    <a href={scanUrl(rootKey)} target="_blank" rel="noopener noreferrer">
                      Arabic Almanac — Lane, Hava, Wehr, Steingass on {stem?.rootSpaced}
                    </a>
                  </dd>
                </>
              )}
            </dl>
            <p className={styles.footnote}>
              Nothing on this page is generated. Where a source is silent, so is the screen: a root
              the lexicons have not reached says so rather than being filled in, and a grammatical
              code the corpus uses that this site cannot name is shown as the corpus wrote it.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────────

function Figure({ n, label }: { n: string; label: string }) {
  return (
    <div className={styles.figure}>
      <div className={styles.figureN}>{n}</div>
      <div className={styles.figureLabel}>{label}</div>
    </div>
  );
}

function LexiconSection({
  work,
  text,
  open,
  onToggle,
  scan,
}: {
  work: LexiconEntry;
  text: LexiconText | null | undefined;
  open: boolean;
  onToggle: () => void;
  scan: string;
}) {
  return (
    <section id={`work-${work.id}`} className={styles.work}>
      <button className={styles.workHead} onClick={onToggle} aria-expanded={open}>
        <span className={styles.workNames}>
          <span className={styles.workName}>{work.name}</span>
          {work.nameArabic && (
            <span className={styles.workNameAr} dir="rtl">
              {work.nameArabic}
            </span>
          )}
        </span>
        <span className={styles.workBy}>
          {work.author}
          {work.died !== null && ` · d. ${work.died}`}
          {work.quranic && <span className={styles.tag}>a lexicon of the Qur&rsquo;an</span>}
        </span>
        <span className={styles.workState}>{open ? "Close" : "Read the entry"}</span>
      </button>

      {open && (
        <div className={styles.workBody}>
          {text === undefined && <p className={styles.quiet}>Fetching the entry…</p>}
          {text === null && (
            <p className={styles.quiet}>This entry could not be reached just now.</p>
          )}

          {text?.arabic && (
            <>
              <div className="kicker kicker-sm">As its author wrote it</div>
              <p className={styles.entryArabic} dir="rtl">
                {text.arabic}
              </p>
            </>
          )}

          {text?.english && (
            <>
              <div className="kicker kicker-sm" style={{ marginTop: 30 }}>
                Translated
              </div>
              {senses(text.english).map((s, i) => (
                <Sense key={i} sense={s} />
              ))}
            </>
          )}

          {work.summary && (
            <>
              <div className="kicker kicker-sm" style={{ marginTop: 30 }}>
                The entry in brief
              </div>
              {senses(work.summary).map((s, i) => (
                <Sense key={i} sense={s} />
              ))}
            </>
          )}

          <div className={styles.workFoot}>
            {text?.sourceUrl && (
              <a href={text.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.out}>
                Verify at the source ↗
              </a>
            )}
            <a href={scan} target="_blank" rel="noopener noreferrer" className={styles.out}>
              Scanned pages ↗
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

function Sense({ sense }: { sense: { n: number | null; text: string } }) {
  if (sense.n === null) {
    return (
      <p className={styles.entryPara}>
        <Rich text={sense.text} />
      </p>
    );
  }
  return (
    <div className={styles.sense}>
      <div className={styles.senseN}>{sense.n}</div>
      <p className={styles.entryPara}>
        <Rich text={sense.text} />
      </p>
    </div>
  );
}

// ── plain helpers ───────────────────────────────────────────────────────────

/**
 * Lexicon prose arrives as plain text whose senses the author numbered. Those
 * numbers are the source's own structure, so they are given a gutter rather
 * than left to run into the paragraph.
 */
function senses(text: string): { n: number | null; text: string }[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = /^(\d{1,2})\.\s+([\s\S]*)$/.exec(p);
      return m ? { n: Number(m[1]), text: m[2] } : { n: null, text: p };
    });
}

/** The only markup the entries carry is `**bold**`, used to head a sense. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p,
      )}
    </>
  );
}

/**
 * Mark the words at these positions in an ayah. The corpus counts words the
 * same way a space does, so this is counting rather than matching letters —
 * which is why it can be trusted to mark the right word and no other.
 */
function mark(arabic: string, positions: number[], cls: string) {
  const at = new Set(positions);
  return arabic.split(/\s+/).map((w, i) => (
    <span key={i} className={at.has(i + 1) ? cls : undefined}>
      {w}
      {" "}
    </span>
  ));
}

/** `-1400`, `-1180` → `"14th–12th c. BC"`; kept short enough for a table cell. */
function era(from: number | null, to: number | null): string {
  if (from === null && to === null) return "";
  const one = (y: number) => (y < 0 ? `${Math.ceil(-y / 100)}c BC` : `${Math.ceil((y || 1) / 100)}c AD`);
  if (from === null) return one(to as number);
  if (to === null) return one(from);
  const a = one(from);
  const b = one(to);
  return a === b ? a : `${a} – ${b}`;
}

/** Translations come through with footnote markup the study page has no use for. */
function plain(html: string): string {
  return html
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Which section the reader is in, so the rail can say so. Watching a band
 * across the upper part of the screen rather than the whole of it means the
 * answer changes when a heading reaches reading height, not when the previous
 * section's last line finally leaves the bottom.
 */
function useHere(ids: string[]): string {
  const [here, setHere] = useState("");
  const key = ids.join("|");

  useEffect(() => {
    const targets = key
      .split("|")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (!targets.length) return;

    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = targets.find((t) => seen.get(t.id));
        if (first) setHere(first.id);
      },
      { rootMargin: "-72px 0px -55% 0px", threshold: 0 },
    );
    for (const t of targets) io.observe(t);
    return () => io.disconnect();
  }, [key]);

  return here;
}
