"use client";

import Link from "next/link";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ayahAudio } from "@/lib/audio/qari";
import { fetchMushaf } from "@/lib/quran/api";
import { firstLetter, recitedWords } from "@/lib/quran/recited";
import { STRONGEST, depth, grade, useHifz, waitAfter, type Grade } from "@/lib/store/hifz";
import { ayahKey, noteReadKey } from "@/lib/store/reading";
import { useSettings } from "@/lib/store/settings";
import { arabicNumber } from "@/lib/text";
import { useLocale } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import { Flame } from "./HifzPage";
import styles from "./Hifz.module.css";

/**
 * A sitting: the ayat one at a time, each covered, recited, and uncovered.
 *
 * It works the way a reciter is tested by a teacher holding the muṣḥaf, with
 * the page doing the holding. The ayah is on the screen behind glass, each
 * word its own pane and each pane as wide as its word, so the shape of the
 * ayah is there to be recited into. The reader recites, and then uncovers it
 * a word at a time to check what they said against what is written. A word
 * they got wrong they tap, which marks it as a teacher's pencil marks a
 * muṣḥaf — and the mark is there, as a dot on the glass, the next time. Then
 * they say how it went, and that decides when the ayah comes back.
 *
 * An ayah met for the first time is not covered to begin with: it is there to
 * be read and heard, and covered when the reader says they have it.
 *
 * Nothing is listened to and nothing is judged by the page. The microphone is
 * not asked for: a recitation of the Qur'an is not something to send to a
 * server to be marked, and a reader's own ear, checked against the text, is
 * what a muṣḥaf has always offered.
 */

interface Props {
  /** The ayat to go over, by their place among the 6,236, in order. */
  queue: number[];
  /** Those not kept before this sitting: shown first, covered after. */
  fresh: ReadonlySet<number>;
  /** How many more were due than one sitting takes. */
  more: number;
  /** Whether this is the day's due rather than a passage that was asked for. */
  today: boolean;
}

type Words = Map<number, string[]>;

/** An ayah forgotten is asked again before the sitting ends — twice at most, and then left for tomorrow. */
const ASKED_AGAIN = 2;

export function Sitting({ queue, fresh, more, today }: Props) {
  const { t, n, arrows } = useLocale();
  const names = useSurahNames();
  const { settings } = useSettings();
  const hifz = useHifz();

  const [order, setOrder] = useState(queue);
  const [at, setAt] = useState(0);
  const [covered, setCovered] = useState(() => !fresh.has(queue[0]));
  const [shown, setShown] = useState(0);
  const [slips, setSlips] = useState<ReadonlySet<number>>(() => new Set());
  const [hint, setHint] = useState(false);
  const [went, setWent] = useState<ReadonlyMap<number, Grade>>(() => new Map());
  const [again, setAgain] = useState<ReadonlyMap<number, number>>(() => new Map());

  const index = order[at];
  const done = at >= order.length;
  const [surah, ayah] = done ? [0, 0] : ayahKey(index).split(":").map(Number);

  // ── the text ──────────────────────────────────────────────────────────────
  // A surah is asked for when the sitting reaches it, and held: the day's due
  // can run across a dozen surahs, and most sittings never leave one.
  const [texts, setTexts] = useState<ReadonlyMap<number, Words>>(() => new Map());
  const [failed, setFailed] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!surah || texts.has(surah)) return;
    let alive = true;
    fetchMushaf(surah).then(
      (verses) => {
        if (!alive) return;
        const words: Words = new Map(verses.map((v) => [v.verse_number, recitedWords(v.text_uthmani)]));
        setTexts((held) => new Map(held).set(surah, words));
        setFailed(null);
      },
      () => alive && setFailed(surah),
    );
    return () => {
      alive = false;
    };
  }, [surah, texts, attempt]);

  const words = texts.get(surah)?.get(ayah) ?? null;
  const cue = useMemo(() => {
    const before = ayah > 1 ? texts.get(surah)?.get(ayah - 1) : null;
    return before ? before.slice(-3).join(" ") : "";
  }, [texts, surah, ayah]);

  const total = words?.length ?? 0;
  const open = !covered || shown >= total;
  const before = done ? undefined : hifz.get(index);

  // ── the recitation, to listen to ──────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [sounding, setSounding] = useState(false);

  const hush = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSounding(false);
  }, []);
  useEffect(() => hush, [hush]);

  const listen = () => {
    if (sounding) return hush();
    const audio = new Audio(ayahAudio(settings.qari, surah, ayah));
    audioRef.current = audio;
    const over = () => audioRef.current === audio && hush();
    audio.addEventListener("ended", over);
    audio.addEventListener("error", over);
    setSounding(true);
    void audio.play().catch(over);
  };

  // ── uncovering, marking, judging ──────────────────────────────────────────
  const uncover = () => setShown((s) => Math.min(total, s + 1));

  const mark = (position: number) =>
    setSlips((held) => {
      const next = new Set(held);
      if (!next.delete(position)) next.add(position);
      return next;
    });

  const judge = (how: Grade) => {
    hush();
    grade(index, how, [...slips]);
    noteReadKey(ayahKey(index));
    setWent((held) => new Map(held).set(index, how));
    let next = order;
    const asked = again.get(index) ?? 0;
    if (how === "forgot" && asked < ASKED_AGAIN) {
      setAgain((held) => new Map(held).set(index, asked + 1));
      next = [...order, index];
      setOrder(next);
    }
    setAt(at + 1);
    // What comes back in the same sitting has been seen: it comes back covered.
    setCovered(at + 1 < queue.length ? !fresh.has(next[at + 1]) : true);
    setShown(0);
    setSlips(new Set());
  };

  // A keyboard has the same three things to say: the next word, all of it, and how it went.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (done || !words) return;
    const target = e.target as HTMLElement | null;
    if (e.metaKey || e.ctrlKey || e.altKey || target?.closest("button, a, input, select, textarea")) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!covered) setCovered(true);
      else if (!open) uncover();
    } else if (open && covered && (e.key === "1" || e.key === "2" || e.key === "3")) {
      judge((["forgot", "faltered", "knew"] as const)[Number(e.key) - 1]);
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── the sitting, over ─────────────────────────────────────────────────────
  if (done) {
    const knew = [...went.values()].filter((g) => g === "knew").length;
    const first = queue.length ? ayahKey(queue[0]).split(":").map(Number) : [1, 1];
    const last = queue.length ? ayahKey(queue[queue.length - 1]).split(":").map(Number) : first;
    const onePassage = !today && first[0] === last[0];
    return (
      <div className={`page-shell ${styles.shell}`}>
        <section className={`${styles.hero} ${styles.heroTall}`}>
          <div aria-hidden="true" className={styles.motes} />
          <div className={styles.heroInner}>
            <span className={styles.kicker}>{t("hifz.title")}</span>
            <h1 className={`${styles.title} mk-shine`} data-text={queue.length ? t("hifz.done.title") : t("hifz.done.none")}>
              {queue.length ? t("hifz.done.title") : t("hifz.done.none")}
            </h1>
            {queue.length > 0 && (
              <>
                <p className={styles.status}>{more > 0 ? t("hifz.done.more", { count: more, countText: n(more) }) : t("hifz.done.text")}</p>
                <dl className={styles.stats}>
                  <div>
                    <dt>{t("hifz.done.recited")}</dt>
                    <dd>{n(went.size)}</dd>
                  </div>
                  <div>
                    <dt>{t("hifz.done.knew")}</dt>
                    <dd>{n(knew)}</dd>
                  </div>
                  <div>
                    <dt>{t("hifz.done.again")}</dt>
                    <dd>{n(went.size - knew)}</dd>
                  </div>
                </dl>
              </>
            )}
            <div className={styles.doneDoors}>
              {more > 0 && (
                // The address is already the day's due; read afresh, it is the rest of it.
                <button type="button" className={styles.go} onClick={() => window.location.reload()}>
                  <Flame />
                  {t("hifz.done.carryOn")}
                </button>
              )}
              <Link href="/hifz/" className={more > 0 ? "btn btn-secondary" : styles.go}>
                {t("hifz.head.some")} <span aria-hidden="true">{arrows.next}</span>
              </Link>
              {onePassage && (
                <Link href={`/read/${first[0]}/#${first[0]}:${first[1]}`} className="btn btn-secondary">
                  {t("hifz.done.read", { surah: names.name(first[0]) })}
                </Link>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const strength = before?.strength ?? 0;
  const was = new Set(before?.slips ?? []);
  const say = (how: Grade) => {
    const wait = waitAfter(before, how);
    return wait === 0 ? t("hifz.s.againToday") : wait === 1 ? t("hifz.s.tomorrow") : t("hifz.s.inDays", { count: wait, countText: n(wait) });
  };

  return (
    <div className={`page-shell ${styles.shell} ${styles.sitting}`}>
      <div className={styles.bar}>
        <Link href="/hifz/" className={styles.leave}>
          <span aria-hidden="true">{arrows.prev}</span> {t("hifz.s.leave")}
        </Link>
        <span className={styles.count} aria-live="polite">
          {t("hifz.s.progress", { n: n(at + 1), total: n(order.length) })}
        </span>
        <span className={styles.fill} style={{ transform: `scaleX(${at / order.length})` }} aria-hidden="true" />
      </div>

      <article className={styles.leaf} key={`${index}:${at}`}>
        <header className={styles.leafHead}>
          <div>
            <span className={`${styles.leafSurah} ${names.arabic ? "surah-ar" : ""}`}>{names.name(surah)}</span>
            <span className={styles.leafAyah}>{t("common.ayahN", { n: n(ayah) })}</span>
          </div>
          <span
            className={styles.held}
            role="img"
            aria-label={t("hifz.s.strength", { n: n(strength), of: n(STRONGEST) })}
            title={t("hifz.s.strength", { n: n(strength), of: n(STRONGEST) })}
          >
            {Array.from({ length: STRONGEST }, (_, i) => (
              <i key={i} data-depth={i < strength ? depth(i + 1) : undefined} />
            ))}
          </span>
        </header>

        {cue && covered && (
          <p className={styles.cue}>
            <span>{t("hifz.s.after")}</span>
            <bdi className="quran" lang="ar" dir="rtl">
              … {cue}
            </bdi>
          </p>
        )}

        {failed === surah ? (
          <div className={styles.waiting}>
            <p>{t("hifz.s.failed")}</p>
            <button type="button" className="btn btn-primary" onClick={() => setAttempt((x) => x + 1)}>
              {t("common.tryAgain")}
            </button>
          </div>
        ) : !words ? (
          <p className={styles.waiting}>{t("common.loadingText")}</p>
        ) : (
          <>
            {/* The whole ayah answers a tap while any of it is covered: a
                thumb reciting along does not have to find the next pane. */}
            <p
              className={`quran ${styles.ayah}`}
              lang="ar"
              dir="rtl"
              data-hint={hint || undefined}
              onClick={(e) => {
                if (covered && !open && !(e.target as HTMLElement).closest("button")) uncover();
              }}
            >
              {words.map((word, i) => {
                const position = i + 1;
                const hidden = covered && i >= shown;
                return (
                  <span key={i}>
                    <button
                      type="button"
                      className={styles.word}
                      data-state={hidden ? "covered" : "open"}
                      data-next={(hidden && i === shown) || undefined}
                      data-slip={(!hidden && slips.has(position)) || undefined}
                      aria-label={hidden ? t("hifz.s.covered") : undefined}
                      aria-pressed={!hidden && covered ? slips.has(position) : undefined}
                      onClick={() => {
                        if (hidden) uncover();
                        else if (covered) mark(position);
                      }}
                    >
                      <span className={styles.ink} aria-hidden={hidden || undefined}>
                        {word}
                      </span>
                      {hidden && hint && (
                        <span className={styles.letter} aria-hidden="true">
                          {firstLetter(word)}
                        </span>
                      )}
                      {hidden && was.has(position) && <i className={styles.dot} aria-hidden="true" />}
                    </button>{" "}
                  </span>
                );
              })}
              <span className={styles.marker} data-state={open ? "open" : "covered"} aria-hidden="true">
                {arabicNumber(ayah)}
              </span>
            </p>

            <p className={styles.say} aria-live="polite">
              {!covered
                ? t("hifz.s.learn")
                : !open
                  ? was.size
                    ? t("hifz.s.reciteMarked")
                    : t("hifz.s.recite")
                  : t("hifz.s.mark")}
            </p>
          </>
        )}
      </article>

      {words && (
        <div className={styles.dock}>
          <div className={styles.dockInner}>
            {!covered ? (
              <>
                <button type="button" className="btn btn-secondary" onClick={listen} aria-pressed={sounding}>
                  <Ear on={sounding} />
                  {sounding ? t("hifz.s.stop") : t("hifz.s.listen")}
                </button>
                <button
                  type="button"
                  className={styles.go}
                  onClick={() => {
                    hush();
                    setCovered(true);
                  }}
                >
                  {t("hifz.s.cover")}
                </button>
              </>
            ) : !open ? (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => setHint((h) => !h)} aria-pressed={hint}>
                  {t("hifz.s.hint")}
                </button>
                <button type="button" className="btn btn-secondary" onClick={listen} aria-pressed={sounding}>
                  <Ear on={sounding} />
                  {sounding ? t("hifz.s.stop") : t("hifz.s.listen")}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setShown(total)}>
                  {t("hifz.s.all")}
                </button>
              </>
            ) : (
              <>
                <button type="button" className={styles.grade} data-how="forgot" onClick={() => judge("forgot")}>
                  <b>{t("hifz.s.forgot")}</b>
                  <small>{say("forgot")}</small>
                </button>
                <button type="button" className={styles.grade} data-how="faltered" onClick={() => judge("faltered")}>
                  <b>{t("hifz.s.faltered")}</b>
                  <small>{say("faltered")}</small>
                </button>
                <button type="button" className={styles.grade} data-how="knew" onClick={() => judge("knew")}>
                  <b>{t("hifz.s.knew")}</b>
                  <small>{say("knew")}</small>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Ear({ on }: { on: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {on ? <path d="M4.5 3.5v9M11.5 3.5v9" /> : <path d="M2.5 6v4h2.5l3.5 3V3L5 6zM11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.5a6 6 0 0 1 0 9" />}
    </svg>
  );
}
