"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  FAMILIES,
  PARTICLES,
  PARTICLE_ARABIC,
  QUESTIONS,
  QUESTIONS_SOURCE,
  familyOf,
  loadSurahText,
  nationOf,
  questionSpan,
  whoKey,
  type AyahText,
  type Family,
  type Particle,
  type Question,
} from "@/lib/quran/questions";
import { SURAH_NAMES } from "@/lib/quran/surahNames";
import { useSettings } from "@/lib/store/settings";
import { useLocale, type MessageKey } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import styles from "./QuestionsPage.module.css";

/**
 * The questions of the Qurʾān.
 *
 * The Qurʾān asks a thousand questions, and a reader meets them one at a time,
 * a few to a page, without ever seeing them together. Together they are a
 * portrait: of who is spoken to and how — that most are Allah's own, and most
 * of those are put to the people who deny Him rather than to the people who
 * believe; that the prophets' are put to their peoples, and their peoples'
 * back to them; that some are asked on the Day, of people who can no longer
 * answer. This page is that portrait, and every question in it is a way back
 * to its ayah.
 *
 * Who asks each question, and of whom, is a judgement made line by line for
 * this site (`src/content/questions/who.txt`). Where the commentators differ
 * on the speaker, the page says so beside the question.
 */

type SceneFilter = "" | "world" | "day" | "death";

const PAGE = 24;
const SCENE_KEY: Record<Exclude<SceneFilter, "">, MessageKey> = {
  world: "q.scene.world",
  day: "q.scene.day",
  death: "q.scene.death",
};

interface Filters {
  surah: number;
  family: Family | "";
  asker: string;
  asked: string;
  particle: Particle | "";
  scene: SceneFilter;
  within: boolean;
}

const NONE: Filters = { surah: 0, family: "", asker: "", asked: "", particle: "", scene: "", within: false };

/** Which filters a question passes, leaving out the one being counted for. */
function passes(q: Question, f: Filters, except?: keyof Filters): boolean {
  if (!f.within && q.within) return false;
  if (except !== "surah" && f.surah && q.surah !== f.surah) return false;
  if (except !== "family" && f.family && (q.within || familyOf(q.asker) !== f.family)) return false;
  if (except !== "asker" && f.asker && q.asker !== f.asker) return false;
  if (except !== "asked" && f.asked && q.asked !== f.asked) return false;
  if (except !== "particle" && f.particle && q.particle !== f.particle) return false;
  if (except !== "scene" && f.scene) {
    const scene = q.scene || "world";
    if (scene !== f.scene) return false;
  }
  return true;
}

function countBy<K extends string | number>(list: Question[], key: (q: Question) => K): Map<K, number> {
  const out = new Map<K, number>();
  for (const q of list) out.set(key(q), (out.get(key(q)) ?? 0) + 1);
  return out;
}

/** The day, read in the browser and never while prerendering. */
const noSubscription = () => () => {};
const today = () => Math.floor(Date.now() / 86_400_000);

/** The questions Allah asks in His own voice, short enough to stand alone: one a day heads the page. */
const OPENERS = QUESTIONS.filter((q) => q.asker === "allah" && !q.within && q.refrain === 0 && q.particle !== "am");

export function QuestionsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { t, n, rich } = useLocale();
  const names = useSurahNames();
  const { settings } = useSettings();

  const fromAddress = Number(params.get("s"));
  const [filters, setFilters] = useState<Filters>(() => ({
    ...NONE,
    surah: Number.isInteger(fromAddress) && fromAddress >= 1 && fromAddress <= 114 ? fromAddress : 0,
  }));
  const [together, setTogether] = useState(true);
  const [shown, setShown] = useState(PAGE);

  const set = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setShown(PAGE);
  };

  // The surah is in the address, so a filtered page can be shared and the
  // introductions can link to their own surah's questions.
  useEffect(() => {
    const want = filters.surah ? `?s=${filters.surah}` : "";
    if (window.location.search !== want) router.replace(`/questions/${want}`, { scroll: false });
  }, [filters.surah, router]);

  const all = useMemo(() => QUESTIONS.filter((q) => !q.within), []);
  const visible = useMemo(() => QUESTIONS.filter((q) => passes(q, filters)), [filters]);

  const familyCounts = useMemo(
    () => countBy(QUESTIONS.filter((q) => !q.within && passes(q, filters, "family")), (q) => familyOf(q.asker)),
    [filters],
  );
  const particleCounts = useMemo(
    () => countBy(QUESTIONS.filter((q) => passes(q, filters, "particle")), (q) => q.particle),
    [filters],
  );
  const sceneCounts = useMemo(
    () => countBy(QUESTIONS.filter((q) => passes(q, filters, "scene")), (q) => q.scene || "world"),
    [filters],
  );
  const surahCounts = useMemo(
    () => countBy(QUESTIONS.filter((q) => passes(q, filters, "surah")), (q) => q.surah),
    [filters],
  );
  // Within a family, the askers in it; and whatever the askers, whom they ask.
  const askerCounts = useMemo(
    () =>
      filters.family
        ? countBy(QUESTIONS.filter((q) => !q.within && passes(q, filters, "asker")), (q) => q.asker)
        : new Map<string, number>(),
    [filters],
  );
  const askedCounts = useMemo(
    () => countBy(QUESTIONS.filter((q) => !q.within && passes(q, filters, "asked")), (q) => q.asked),
    [filters],
  );

  // A question asked over and over is one card that says how often, unless
  // the reader asks to see each time.
  const items = useMemo(() => {
    if (!together) return visible.map((q) => ({ q, also: [] as Question[] }));
    const out: { q: Question; also: Question[] }[] = [];
    const at = new Map<number, number>();
    for (const q of visible) {
      if (q.refrain) {
        const i = at.get(q.refrain);
        if (i !== undefined) {
          out[i].also.push(q);
          continue;
        }
        at.set(q.refrain, out.length);
      }
      out.push({ q, also: [] });
    }
    return out;
  }, [visible, together]);

  const day = useSyncExternalStore(noSubscription, today, () => -1);
  const opener = day >= 0 ? OPENERS[day % OPENERS.length] : null;

  const family = (id: Family) => t(`q.family.${id}` as MessageKey);
  const total = visible.filter((q) => !q.within).length;
  const filtered = filters !== NONE && JSON.stringify(filters) !== JSON.stringify(NONE);

  return (
    <div className={`page-shell ${styles.shell}`}>
      {/* ── the frontispiece ─────────────────────────────────────────── */}
      <header className={styles.hero}>
        <div className={styles.motes} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <div className={styles.kicker}>{t("q.kicker")}</div>
            <h1 className={styles.title}>{t("q.title")}</h1>
            <p className={styles.lede}>{t("q.lede", { count: all.length, countText: n(all.length) })}</p>
          </div>
          <figure className={styles.opener} aria-live="polite">
            {opener ? <Opener q={opener} /> : <div className={styles.openerBlank} />}
          </figure>
        </div>
      </header>

      <div className={styles.body}>
        {/* ── who asks ─────────────────────────────────────────────────── */}
        <section className={styles.overview}>
          <div className={styles.who}>
            <h2 className={styles.sectionTitle}>{t("q.whoAsks")}</h2>
            <ul className={styles.bars}>
              {FAMILIES.map((id) => {
                const count = familyCounts.get(id) ?? 0;
                const max = Math.max(1, ...familyCounts.values());
                const on = filters.family === id;
                return (
                  <li key={id}>
                    <button
                      className={`${styles.bar} ${on ? styles.barOn : ""}`}
                      onClick={() => set({ family: on ? "" : id, asker: "" })}
                      aria-pressed={on}
                      disabled={!count && !on}
                    >
                      <span className={styles.barName}>{family(id)}</span>
                      <span className={styles.barTrack} aria-hidden="true">
                        <span className={styles.barFill} style={{ "--w": `${(count / max) * 100}%` } as CSSProperties} />
                      </span>
                      <span className={styles.barCount}>{n(count)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <SurahStrip
            counts={surahCounts}
            selected={filters.surah}
            onPick={(s) => set({ surah: filters.surah === s ? 0 : s })}
          />
        </section>

        {/* ── the filters ──────────────────────────────────────────────── */}
        <div className={styles.filters}>
          {filters.family && askerCounts.size > 1 && (
            <div className={styles.filterRow} role="group" aria-label={t("q.askers")}>
              <span className={styles.filterLabel}>{t("q.askers")}</span>
              <div className={styles.chips}>
                {[...askerCounts].sort((a, b) => b[1] - a[1]).map(([id, count]) => (
                  <button
                    key={id}
                    className={`${styles.chip} ${filters.asker === id ? styles.chipOn : ""}`}
                    aria-pressed={filters.asker === id}
                    onClick={() => set({ asker: filters.asker === id ? "" : id })}
                  >
                    {t(whoKey(id))} <span className={styles.chipCount}>{n(count)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.filterRow}>
            <label className={styles.filterLabel} htmlFor="q-asked">
              {t("q.askedOf")}
            </label>
            <select
              id="q-asked"
              className={styles.select}
              value={filters.asked}
              onChange={(e) => set({ asked: e.target.value })}
            >
              <option value="">{t("q.anyone")}</option>
              {[...askedCounts].sort((a, b) => b[1] - a[1]).map(([id, count]) => (
                <option key={id} value={id}>
                  {t(whoKey(id))} ({n(count)})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterRow} role="group" aria-label={t("q.word")}>
            <span className={styles.filterLabel}>{t("q.word")}</span>
            <div className={styles.chips}>
              {PARTICLES.filter((p) => particleCounts.get(p) || filters.particle === p).map((p) => (
                <button
                  key={p}
                  className={`${styles.chip} ${styles.wordChip} ${filters.particle === p ? styles.chipOn : ""}`}
                  aria-pressed={filters.particle === p}
                  onClick={() => set({ particle: filters.particle === p ? "" : p })}
                  title={t(`qword.${p}` as MessageKey)}
                >
                  <span lang="ar" dir="rtl" className={styles.wordArabic}>
                    {PARTICLE_ARABIC[p]}
                  </span>
                  <span className={styles.wordGloss}>{t(`qword.${p}` as MessageKey)}</span>
                  <span className={styles.chipCount}>{n(particleCounts.get(p) ?? 0)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterRow} role="group" aria-label={t("q.when")}>
            <span className={styles.filterLabel}>{t("q.when")}</span>
            <div className={styles.chips}>
              {(Object.keys(SCENE_KEY) as Exclude<SceneFilter, "">[]).map((s) => (
                <button
                  key={s}
                  className={`${styles.chip} ${filters.scene === s ? styles.chipOn : ""}`}
                  aria-pressed={filters.scene === s}
                  onClick={() => set({ scene: filters.scene === s ? "" : s })}
                  disabled={!sceneCounts.get(s) && filters.scene !== s}
                >
                  {t(SCENE_KEY[s])} <span className={styles.chipCount}>{n(sceneCounts.get(s) ?? 0)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.toggles}>
            <label className={styles.toggle}>
              <input type="checkbox" checked={together} onChange={(e) => setTogether(e.target.checked)} />
              {t("q.together")}
            </label>
            <label className={styles.toggle}>
              <input type="checkbox" checked={filters.within} onChange={(e) => set({ within: e.target.checked })} />
              {t("q.within")}
            </label>
          </div>
        </div>

        {/* ── what is shown ────────────────────────────────────────────── */}
        <div className={styles.status} aria-live="polite">
          <span>
            {filters.surah
              ? rich(
                  "q.showingIn",
                  { b: (s) => <b>{s}</b> },
                  { count: total, countText: n(total), surah: names.name(filters.surah) },
                )
              : rich("q.showing", { b: (s) => <b>{s}</b> }, { count: total, countText: n(total) })}
          </span>
          {filtered && (
            <button className={styles.clear} onClick={() => set(NONE)}>
              {t("q.clear")}
            </button>
          )}
        </div>

        <ol className={styles.list}>
          {items.slice(0, shown).map(({ q, also }, i) => (
            <QuestionCard key={`${q.key}:${q.word}`} q={q} also={also} index={i} translationId={settings.translationId} />
          ))}
        </ol>

        {items.length > shown && (
          <MoreOnScroll onMore={() => setShown((s) => s + PAGE)}>
            <button className={`btn btn-secondary ${styles.more}`} onClick={() => setShown((s) => s + PAGE)}>
              {t("q.more", { count: Math.min(PAGE, items.length - shown) })}
            </button>
          </MoreOnScroll>
        )}

        {!items.length && <p className={styles.empty}>{t("q.none")}</p>}

        <footer className={styles.method}>
          <h2 className={styles.sectionTitle}>{t("q.methodTitle")}</h2>
          <p>{t("q.method")}</p>
          <p>{t("q.methodWho")}</p>
          <p className={styles.source}>{QUESTIONS_SOURCE}</p>
        </footer>
      </div>
    </div>
  );
}

// ── the pieces ──────────────────────────────────────────────────────────────

/** Who asks, and of whom: names, with "his people" said as whose they are. */
function useWho() {
  const { t } = useLocale();
  return (q: Question, side: "asker" | "asked") => {
    const id = q[side];
    if (id === "nation") {
      const prophet = nationOf(q);
      if (prophet) return t("who.nationOf", { name: t(whoKey(prophet)) });
    }
    return t(whoKey(id));
  };
}

/** The question of the day, set in gold at the head of the page. */
function Opener({ q }: { q: Question }) {
  const { t, arrows } = useLocale();
  const names = useSurahNames();
  const { settings } = useSettings();
  const text = useAyahText(q.surah, q.ayah, settings.translationId);
  const span = text ? questionSpan(text, q.word, nextIn(q)) : null;
  const who = useWho();

  return (
    <>
      <figcaption className={styles.openerKicker}>{t("q.today")}</figcaption>
      {text && span && span[0] >= 0 ? (
        <>
          <blockquote lang="ar" dir="rtl" className={styles.openerArabic}>
            {text.tokens.slice(span[0], span[1] + 1).join(" ")}
          </blockquote>
          <p className={styles.openerWho}>
            {who(q, "asker")} <span aria-hidden="true">{arrows.next}</span> {who(q, "asked")}
          </p>
          <Link href={`/read/${q.surah}/#${q.key}`} className={styles.openerLink}>
            {names.name(q.surah)} {q.key} {arrows.next}
          </Link>
        </>
      ) : (
        <div className={styles.openerBlank} />
      )}
    </>
  );
}

/** The next question in the same ayah, where this one stops at the latest. */
function nextIn(q: Question): number | undefined {
  let next: number | undefined;
  for (const other of QUESTIONS) {
    if (other.key === q.key && other.word > q.word && (next === undefined || other.word < next)) next = other.word;
  }
  return next;
}

function QuestionCard({
  q,
  also,
  index,
  translationId,
}: {
  q: Question;
  also: Question[];
  index: number;
  translationId: number;
}) {
  const { t, n, arrows } = useLocale();
  const names = useSurahNames();
  const who = useWho();
  const text = useAyahText(q.surah, q.ayah, translationId);
  const [open, setOpen] = useState(false);
  const span = text ? questionSpan(text, q.word, nextIn(q)) : null;

  return (
    <li className={styles.card} style={{ "--i": index % PAGE } as CSSProperties}>
      <div className={styles.cardHead}>
        {q.within ? (
          <span className={styles.withinLabel}>{t("q.withinLabel")}</span>
        ) : (
          <span className={styles.pair}>
            <span className={styles.asker}>{who(q, "asker")}</span>
            <span className={styles.arrow} aria-label={t("q.asks")}>
              {arrows.next}
            </span>
            <span className={styles.asked}>{who(q, "asked")}</span>
          </span>
        )}
        <Link href={`/read/${q.surah}/#${q.key}`} className={styles.place}>
          <span className={names.arabic ? "surah-ar" : undefined}>{names.name(q.surah)}</span>
          <span className={styles.placeKey}>{q.key}</span>
        </Link>
      </div>

      {text === null ? (
        <p className={styles.waiting}>{t("common.loading")}</p>
      ) : text === false ? (
        <p className={styles.waiting}>{t("q.textFailed")}</p>
      ) : (
        <>
          <p lang="ar" dir="rtl" translate="no" className={styles.arabic}>
            {text.tokens.map((token, i) => (
              <span key={i} className={span && i >= span[0] && i <= span[1] ? styles.lit : undefined}>
                {token}{" "}
              </span>
            ))}
          </p>
          {text.translation && (
            <p dir="auto" className={styles.translation}>
              {text.translation}
            </p>
          )}
        </>
      )}

      <div className={styles.cardFoot}>
        <span className={styles.tag}>
          <span lang="ar" dir="rtl" className={styles.tagArabic}>
            {PARTICLE_ARABIC[q.particle]}
          </span>
          {t(`qword.${q.particle}` as MessageKey)}
        </span>
        {q.scene && <span className={`${styles.tag} ${styles.tagScene}`}>{t(SCENE_KEY[q.scene])}</span>}
        {q.disputed && (
          <span className={styles.doubt} tabIndex={0} role="note" aria-label={t("q.disputed")}>
            <span aria-hidden="true">?</span>
            <span className={styles.doubtWhy} aria-hidden="true">
              {t("q.disputed")}
            </span>
          </span>
        )}
        {also.length > 0 && (
          <button className={styles.again} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {t("q.again", { count: also.length + 1, countText: n(also.length + 1) })}
          </button>
        )}
      </div>

      {open && also.length > 0 && (
        <ul className={styles.places}>
          {[q, ...also].map((x) => (
            <li key={`${x.key}:${x.word}`}>
              <Link href={`/read/${x.surah}/#${x.key}`}>{x.key}</Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** An ayah's text, cut into words, with the reader's translation — null while it comes, false if it could not. */
function useAyahText(surah: number, ayah: number, translationId: number): AyahText | false | null {
  const slot = `${surah}|${translationId}`;
  const [state, setState] = useState<{ slot: string; map: Map<number, AyahText> | null } | null>(null);

  useEffect(() => {
    let live = true;
    loadSurahText(surah, translationId)
      .then((map) => live && setState({ slot, map }))
      .catch(() => live && setState({ slot, map: null }));
    return () => {
      live = false;
    };
  }, [surah, translationId, slot]);

  if (state?.slot !== slot) return null;
  return state.map?.get(ayah) ?? false;
}

/** The 114 surahs, each a bar as tall as its questions are many: press one to see its own. */
function SurahStrip({
  counts,
  selected,
  onPick,
}: {
  counts: Map<number, number>;
  selected: number;
  onPick: (surah: number) => void;
}) {
  const { t, n } = useLocale();
  const names = useSurahNames();
  const [peek, setPeek] = useState(0);
  const max = Math.max(1, ...counts.values());
  const shown = peek || selected;

  return (
    <div className={styles.strip}>
      <h2 className={styles.sectionTitle}>{t("q.where")}</h2>
      <div className={styles.stripBars} onMouseLeave={() => setPeek(0)}>
        {SURAH_NAMES.map((_, i) => {
          const s = i + 1;
          const count = counts.get(s) ?? 0;
          return (
            <button
              key={s}
              className={[styles.stripBar, s === selected ? styles.stripOn : "", count ? "" : styles.stripNone].join(" ")}
              style={{ "--h": `${count ? 8 + 92 * Math.sqrt(count / max) : 3}%` } as CSSProperties}
              onMouseEnter={() => setPeek(s)}
              onFocus={() => setPeek(s)}
              onClick={() => onPick(s)}
              aria-label={`${names.name(s)}: ${t("q.count", { count, countText: n(count) })}`}
              aria-pressed={s === selected}
            />
          );
        })}
      </div>
      <div className={styles.stripEnds} aria-hidden="true">
        <span>{names.name(1)}</span>
        <span>{names.name(114)}</span>
      </div>
      <p className={styles.stripRead} aria-hidden="true">
        {shown ? (
          <>
            <b className={names.arabic ? "surah-ar" : undefined}>{names.name(shown)}</b> ·{" "}
            {t("q.count", { count: counts.get(shown) ?? 0, countText: n(counts.get(shown) ?? 0) })}
          </>
        ) : (
          t("q.stripHint")
        )}
      </p>
    </div>
  );
}

/** Loads the next stretch of the list as the reader nears the end of it. */
function MoreOnScroll({ onMore, children }: { onMore: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const more = useRef(onMore);
  useEffect(() => {
    more.current = onMore;
  }, [onMore]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && more.current(), {
      rootMargin: "600px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={styles.moreWrap}>
      {children}
    </div>
  );
}
