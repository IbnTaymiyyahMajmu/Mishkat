"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchVerse } from "@/lib/quran/api";
import { fetchAyahXrefs, type XrefLink } from "@/lib/quran/xref";
import { useSettings } from "@/lib/store/settings";
import { book } from "@/lib/ulum/books";
import { fetchSahih, type SahihItem } from "@/lib/ulum/corpus";
import { weakOf } from "@/lib/ulum/grades";
import { readDurr, readReports, readTabari, type Report } from "@/lib/ulum/read";
import { useLocale } from "@/lib/i18n";
import { BookText, Chapter, Cite, Fold, Line, Silent } from "./Chapter";
import { ar, local, useBook, useNear, type Read, type StudyCtx } from "./study";
import { WeakNote } from "./Views";
import styles from "./AyahStudy.module.css";

/**
 * 07 · Bil-maʾthūr — what the Qurʾān, the Prophet ﷺ, the Companions and the
 * Followers said of it, in that order.
 *
 *   The Qurʾān     the ayat the commentators on the shelf brought in to
 *                  explain this one, each under the names of those who did
 *                  (the cross-references the tafsir page reads);
 *   The Sunnah     only reports Ibn Kathīr quotes on this ayah that his
 *                  editor finds in Ṣaḥīḥ al-Bukhārī or Ṣaḥīḥ Muslim, by
 *                  number. Every other report attributed to the Prophet ﷺ is
 *                  left in the books it stands in; this tier carries nothing
 *                  that would need a grading the page cannot give;
 *   Companions     Ibn Abī Ḥātim's reports, with their chains, ending at a
 *   Followers      Companion or at a Follower, under the phrase of the ayah
 *                  he gives them under. Tafsir.app's copy of him has only
 *                  surahs 1–13 and 23–29, so where it has none on an ayah the
 *                  tiers are al-Ṭabarī's, also with chains, and where he has
 *                  none either, al-Durr al-manthūr's, which gives no chains.
 *                  A report said to be weak says so plainly, with why and by
 *                  whom (`src/lib/ulum/grades.ts`). The rest are not graded
 *                  here, and each says that.
 */

const GENERATIONS = new Set(["sahabah", "tabiun", "atba"]);

export function Mathur({ ctx }: { ctx: StudyCtx }) {
  const { t, n: num } = useLocale();
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const { sentence } = ctx;
  const n = ctx.words.length;
  const lit = ctx.seen("mathur");
  const [whole, setWhole] = useState(false);
  const translationId = useSettings().settings.translationId;

  const speaks = (list: Report[], read: Read) => list.some((r) => GENERATIONS.has(r.tier) && local(r.at, read, n));

  // The first of the three books with a report of these generations on this ayah.
  const hatim = useBook("ibn-abi-hatim", ctx, near);
  const hatimReports = useMemo(() => (hatim.p ? readReports(hatim.p.text, hatim.words) : []), [hatim]);
  const needTabari = !hatim.loading && !speaks(hatimReports, hatim);
  const tabari = useBook("tabari", ctx, near && needTabari);
  const tabariReports = useMemo(() => (tabari.p ? readTabari(tabari.p.text, tabari.words) : []), [tabari]);
  const needDurr = needTabari && !tabari.loading && !speaks(tabariReports, tabari);
  const durr = useBook("aldur-almanthoor", ctx, near && needDurr);
  const durrReports = useMemo(() => (durr.p ? readDurr(durr.p.text, durr.words) : []), [durr]);
  const [bookId, read, reports] = needDurr
    ? (["aldur-almanthoor", durr, durrReports] as const)
    : needTabari
      ? (["tabari", tabari, tabariReports] as const)
      : (["ibn-abi-hatim", hatim, hatimReports] as const);
  const reading = hatim.loading || (needTabari && tabari.loading) || (needDurr && durr.loading);
  const found = speaks(reports, read);

  const kathir = useBook("ibn-katheer", ctx, near);
  const qatada = useBook("qatada", ctx, near && ctx.scholar);

  const [links, setLinks] = useState<{ key: string; list: XrefLink[]; texts: Record<string, string> } | null>(null);
  useEffect(() => {
    if (!near) return;
    let alive = true;
    fetchAyahXrefs(ctx.key)
      .then(async ({ brought }) => {
        const top = brought.slice(0, 6);
        const texts: Record<string, string> = {};
        await Promise.all(
          top.map(async (l) => {
            const v = await fetchVerse(l.key, translationId).catch(() => null);
            if (v) texts[l.key] = v.text_uthmani;
          }),
        );
        if (alive) setLinks({ key: ctx.key, list: brought, texts });
      })
      .catch(() => alive && setLinks({ key: ctx.key, list: [], texts: {} }));
    return () => {
      alive = false;
    };
  }, [near, ctx.key, translationId]);
  const xref = links?.key === ctx.key ? links : null;

  const [hadith, setHadith] = useState<{ surah: number; items: SahihItem[] } | null>(null);
  useEffect(() => {
    if (!near) return;
    let alive = true;
    fetchSahih(ctx.surah)
      .then((f) => alive && setHadith({ surah: ctx.surah, items: f.items }))
      .catch(() => alive && setHadith({ surah: ctx.surah, items: [] }));
    return () => {
      alive = false;
    };
  }, [near, ctx.surah]);
  const sahih = (hadith?.surah === ctx.surah ? hadith.items : []).filter(([from, to]) => from <= ctx.ayah && ctx.ayah <= to);
  const [allSunnah, setAllSunnah] = useState(false);

  /** Reports in this ayah, on the sentence being studied unless the whole ayah is asked for. */
  const scoped = (r: Report, from: Read = read) => {
    const l = local(r.at, from, n);
    if (!l) return false;
    return whole || (l.from <= sentence.to && l.to >= sentence.from);
  };
  const sahabah = reports.filter((r) => r.tier === "sahabah" && scoped(r));
  const tabiun = reports.filter((r) => (r.tier === "tabiun" || r.tier === "atba") && scoped(r));
  const unknown = reports.filter((r) => r.tier === "unknown" && scoped(r));
  // Ibn Abī Ḥātim's reports the page could not place stay, whoever fills the tiers.
  const hatimUnknown = needTabari ? hatimReports.filter((r) => r.tier === "unknown" && scoped(r, hatim)) : [];
  const inAyah = reports.filter((r) => local(r.at, read, n) && r.tier !== "marfu").length + hatimUnknown.length;

  const moreReports = (count: number) => t("ulum.moreReports", { count });
  const card = (r: Report, k: number, from: Read = read, id: string = bookId) => {
    const weak = weakOf(r.text);
    return (
    <div key={r.n + k} className={`${styles.tierItem} ${lit ? styles.risen : ""}`} style={{ transitionDelay: `${400 + k * 90}ms` }}>
      <div className={styles.tierItemHead}>
        <span className={styles.tierWho} lang="ar">
          {r.who || "—"}
        </span>
        <span className={styles.tierScope}>
          {(() => {
            const l = local(r.at, from, n);
            return l && l.from <= sentence.from && l.to >= sentence.to && sentence.to - sentence.from < n - 1
              ? t("ulum.scope.sentence")
              : l && l.from === 1 && l.to === n
                ? t("ulum.scope.ayah")
                : t("ulum.scope.phrase");
          })()}
        </span>
      </div>
      {r.phrase && (
        <div className={styles.tierPhrase} lang="ar" dir="rtl">
          ﴿{r.phrase}﴾
        </div>
      )}
      {ctx.scholar && <Line text={r.text} className={styles.tierAr} />}
      {r.also && ctx.scholar && <Line text={r.also} className={styles.cardArNote} />}
      {weak && <WeakNote weak={weak} ctx={ctx} />}
      <div className={styles.tierFoot}>
        <span className={styles.citeWhere}>{r.n ? t("ulum.hatim.n", { n: r.n }) : book(id)?.short}</span>
        {r.tier === "atba" && <span className={styles.tagOutline}>{t("ulum.tier.atba")}</span>}
        {id === "aldur-almanthoor" && <span className={styles.tagOutline}>{t("ulum.noChain")}</span>}
        {!weak && <span className={styles.tagOutline}>{t("ulum.ungraded")}</span>}
      </div>
    </div>
    );
  };

  const tiers = [
    {
      en: t("ulum.tier.quran"),
      ar: "القرآن بالقرآن",
      era: t("ulum.tier.quranEra"),
      body: xref?.list.length ? (
        xref.list.slice(0, 6).map((l, k) => (
          <div key={l.key} className={`${styles.tierItem} ${lit ? styles.risen : ""}`} style={{ transitionDelay: `${400 + k * 90}ms` }}>
            <div className={styles.tierItemHead}>
              <Link href={`/ayah/?v=${l.key}`} className={styles.tierWho}>
                {l.key}
              </Link>
              <span className={styles.tierScope}>{t("ulum.tier.brought", { count: l.works.length })}</span>
            </div>
            {xref.texts[l.key] && (
              <div className={styles.tierPhrase} lang="ar" dir="rtl">
                {xref.texts[l.key]}
              </div>
            )}
            <div className={styles.tierBy}>{l.works.map((w) => book(w)?.short ?? w).join(" · ")}</div>
          </div>
        ))
      ) : (
        <div className={styles.tierEmpty}>{xref ? t("ulum.tier.noneQuran") : t("ulum.loading")}</div>
      ),
    },
    {
      en: t("ulum.tier.sunnah"),
      ar: "السنة",
      era: t("ulum.tier.sunnahEra"),
      body: sahih.length ? (
        <>
          {(allSunnah ? sahih : sahih.slice(0, 4)).map(([from, to, book, n, arabic, english], k) => (
            <div key={`${book}${n}`} className={`${styles.tierItem} ${lit ? styles.risen : ""}`} style={{ transitionDelay: `${400 + k * 90}ms` }}>
              <div className={styles.tierItemHead}>
                <span className={styles.tierWho}>{t(book === "b" ? "ulum.bukhari" : "ulum.muslim", { n })}</span>
                <span className={styles.tierScope}>{from === to ? t("ulum.scope.ayah") : `${ctx.surah}:${from}–${to}`}</span>
              </div>
              {ctx.scholar && <BookText lines={[arabic]} fold={1} />}
              {english && <p className={styles.tierEn}>{english}</p>}
              <div className={styles.tierFoot}>
                <span className={styles.tagAccent}>{t("ulum.sahih")}</span>
                {english && <span className={styles.tierBy}>{t("ulum.trBy", { name: book === "b" ? "Muḥsin Khān" : "ʿAbd al-Ḥamīd Ṣiddīqī" })}</span>}
              </div>
            </div>
          ))}
          {sahih.length > 4 && (
            <button type="button" className={styles.more} onClick={() => setAllSunnah(!allSunnah)}>
              {allSunnah ? t("ulum.less") : t("ulum.moreReports", { count: sahih.length - 4 })}
            </button>
          )}
          <p className={styles.fromBook}>{t("ulum.sunnah.student")}</p>
          <Cite id="ibn-katheer" ctx={ctx} range={kathir.p} />
        </>
      ) : (
        <div className={styles.tierEmpty}>{hadith ? t("ulum.tier.noneSunnah") : t("ulum.loading")}</div>
      ),
    },
    {
      en: t("ulum.tier.sahabah"),
      ar: "الصحابة",
      era: t("ulum.tier.sahabahEra"),
      body: sahabah.length ? <Fold key={ctx.key} items={sahabah.map((r, k) => card(r, k))} label={moreReports} /> : <div className={styles.tierEmpty}>{reading ? t("ulum.loading") : t("ulum.tier.none")}</div>,
    },
    ...(ctx.scholar
      ? [
          {
            en: t("ulum.tier.tabiun"),
            ar: "التابعون",
            era: t("ulum.tier.tabiunEra"),
            body: tabiun.length || qatada.p ? (
              <>
                <Fold key={ctx.key} items={tabiun.map((r, k) => card(r, k))} label={moreReports} />
                {qatada.p && (
                  <div className={styles.tierItem}>
                    <div className={styles.tierItemHead}>
                      <span className={styles.tierWho}>Qatāda</span>
                      <span className={styles.tierScope}>{t("ulum.scope.ayah")}</span>
                    </div>
                    <BookText text={qatada.p.text} fold={2} />
                    <Cite id="qatada" ctx={ctx} range={qatada.p} />
                  </div>
                )}
              </>
            ) : (
              <div className={styles.tierEmpty}>{reading ? t("ulum.loading") : t("ulum.tier.none")}</div>
            ),
          },
        ]
      : []),
  ];

  return (
    <Chapter id="mathur" num="07" kicker={t("ulum.k.mathur")} title={t("ulum.t.mathur")} sub={t("ulum.s.mathur")} arabic="التفسير بالمأثور" ctx={ctx} innerRef={ref}>
      <div className={styles.mathurBar}>
        <span className={styles.prose}>
          {whole ? t("ulum.mathur.whole", { count: inAyah }) : t("ulum.mathur.sentence", { n: num(sentence.n), count: inAyah })}
        </span>
        {ctx.sentences.length > 1 && (
          <button type="button" className="btn btn-secondary" onClick={() => setWhole(!whole)}>
            {whole ? t("ulum.mathur.onlySentence") : t("ulum.mathur.allAyah")}
          </button>
        )}
      </div>
      <div className={`${styles.chain} ${lit ? styles.chainDrawn : ""}`} style={{ ["--tiers" as string]: tiers.length }}>
        <div className={styles.chainLine} />
        {tiers.map((tier, k) => (
          <div key={k} className={styles.tier}>
            <div className={styles.tierDot}>{ar(k + 1)}</div>
            <div className={styles.tierName}>{tier.en}</div>
            <div className={styles.tierAr} lang="ar">
              {tier.ar}
            </div>
            <div className={styles.miniKicker}>{tier.era}</div>
            <div className={styles.tierItems}>{tier.body}</div>
          </div>
        ))}
      </div>
      {found && !reading && bookId !== "ibn-abi-hatim" && <p className={styles.fromBook}>{t(bookId === "tabari" ? "ulum.mathur.fromTabari" : "ulum.mathur.fromDurr")}</p>}
      {found && read.p && <Cite id={bookId} ctx={ctx} range={read.p} />}
      {ctx.scholar && unknown.length + hatimUnknown.length > 0 && (
        <div className={styles.subBlock}>
          <div className={styles.kicker}>{t("ulum.mathur.others")}</div>
          <div className={styles.cards2}>
            {unknown.map((r, k) => card(r, k))}
            {hatimUnknown.map((r, k) => card(r, k, hatim, "ibn-abi-hatim"))}
          </div>
        </div>
      )}
      {!found && !reading && <Silent>{t("ulum.mathur.noHatim")}</Silent>}
    </Chapter>
  );
}
