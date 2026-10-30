"use client";

import { useEffect, useMemo, useRef } from "react";
import { book } from "@/lib/ulum/books";
import { byPhrase, ornate, readDarwish, type Jadwal, type Remark } from "@/lib/ulum/read";
import { bare } from "@/lib/ulum/skeleton";
import { useLocale } from "@/lib/i18n";
import { Block, BookText, Chapter, Cite, Line, Silent } from "./Chapter";
import { officeOf } from "./terms";
import { ar, belongs, inAyah, local, on, useBook, useNear, type Read, type StudyCtx } from "./study";
import { Differences, useViews } from "./Views";
import { whoStyle } from "./who";
import styles from "./AyahStudy.module.css";

/**
 * 03 · Naḥw and iʿrāb — what each word does in its sentence, and how the
 * sentences stand together.
 *
 * The sentences, and the place each has in the iʿrāb, are al-Ṣāfī's, from the
 * list he gives under every ayah. The parse of a sentence word by word is
 * al-Daʿʿās's, whose iʿrāb names the office of every word and no more; its
 * brackets are the phrases al-Iʿrāb al-muyassar and al-Daʿʿās parse as one.
 * Under the word being studied stand al-Ṣāfī's full parsing, with the other
 * ways his editor's notes record, and then the other grammars on the shelf as
 * each words it. The English is only the name of each office (`terms.ts`).
 */

/** The first clause of a remark: what a grammarian says first, which is the office. */
function first(text: string, words = 7): string {
  const cut = text.split(/[،,.؛:]/u)[0] ?? text;
  const w = cut.trim().split(/\s+/);
  return w.length > words ? `${w.slice(0, words).join(" ")}…` : cut.trim();
}

const NUMBERS: Record<string, number> = { ثلاث: 3, اربع: 4, خمس: 5, ست: 6, سبع: 7, ثمان: 8, ثماني: 8, تسع: 9, عشر: 10 };

/** How many sentences a commentator says the ayah has, where he says. */
function sentencesCounted(text?: string): number {
  const hit = /(ثلاث|اربع|خمس|ست|سبع|ثماني|ثمان|تسع|عشر)\s+جمل/u.exec(bare(text ?? "").replace(/[أإآ]/g, "ا"));
  return hit ? NUMBERS[hit[1]] : 0;
}

export function Nahw({ ctx, jd }: { ctx: StudyCtx; jd: { j: Jadwal; read: Read } | null }) {
  const { t, n: num } = useLocale();
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const { cur, sentence, sentences, words } = ctx;
  const n = words.length;
  const lit = ctx.seen("nahw");

  const daas = useBook("iraab-daas", ctx, near);
  const muyassar = useBook("aliraab-almuyassar", ctx, near);
  const darwish = useBook("iraab-aldarweesh", ctx, near);
  const samin = useBook("aldur-almasoon", ctx, near);
  const nahhas = useBook("iraab-alnahas", ctx, near && ctx.scholar);
  const mujtaba = useBook("mujtaba-mushkil-iraab", ctx, near && ctx.scholar);

  const dRemarks = useMemo(() => (daas.p ? ornate(daas.p.text, daas.words) : []), [daas]);
  const mRemarks = useMemo(() => (muyassar.p ? ornate(muyassar.p.text, muyassar.words, true) : []), [muyassar]);
  const dwRemarks = useMemo(() => (darwish.p ? readDarwish(darwish.p.text, darwish.words).iraab : []), [darwish]);
  const sRemarks = useMemo(() => (samin.p ? byPhrase(samin.p.text, samin.words) : []), [samin]);
  const saminViews = useViews(samin, ctx);
  const kathir = useBook("ibn-katheer", ctx, near);
  const aysar = useBook("aysar-altafasir", ctx, near);
  const counts = [
    { id: "aljadwal", n: sentences.length },
    { id: "ibn-katheer", n: sentencesCounted(kathir.p?.text) },
    { id: "aysar-altafasir", n: sentencesCounted(aysar.p?.text) },
  ].filter((c): c is { id: string; n: number } => !!c.n);

  // ── the parse of the sentence being studied ───────────────────────────────
  const sw = words.filter((w) => w.j === sentence.n);
  const roleOf = (i: number): Remark | undefined => {
    const own = on(dRemarks, daas, n, i).find((r) => {
      const l = local(r.at, daas, n)!;
      return l.from === l.to;
    });
    return own ?? on(dRemarks, daas, n, i)[0] ?? (jd ? on(jd.j.iraab, jd.read, n, i)[0] : undefined);
  };
  const brackets = [
    ...inAyah(mRemarks, muyassar, n).map((x) => ({ ...x, id: "aliraab-almuyassar" })),
    ...inAyah(dRemarks, daas, n).map((x) => ({ ...x, id: "iraab-daas" })),
  ]
    .filter(({ l }) => l.to > l.from && l.from >= sentence.from && l.to <= sentence.to)
    .filter((x, k, all) => all.findIndex((y) => y.l.from === x.l.from && y.l.to === x.l.to) === k)
    .sort((a, b) => b.l.to - b.l.from - (a.l.to - a.l.from))
    .slice(0, 4);

  // ── the word being studied ────────────────────────────────────────────────
  const jRemark = jd ? on(jd.j.iraab, jd.read, n, cur.i) : [];
  const office = officeOf(jRemark[0]?.text ?? roleOf(cur.i)?.text ?? "");
  const others = [
    { id: "iraab-daas", rs: on(dRemarks, daas, n, cur.i), read: daas, wrap: "﴿﴾" },
    { id: "aliraab-almuyassar", rs: on(mRemarks, muyassar, n, cur.i), read: muyassar, wrap: "﴿﴾" },
    { id: "iraab-aldarweesh", rs: on(dwRemarks, darwish, n, cur.i), read: darwish, wrap: "()" },
    ...(ctx.scholar ? [{ id: "aldur-almasoon", rs: on(sRemarks, samin, n, cur.i), read: samin, wrap: "{}" }] : []),
  ].filter((o) => o.rs.length);

  const jumal = jd ? inAyah(jd.j.jumal, jd.read, n) : [];

  // A long sentence scrolls sideways; the word being studied is brought into it.
  const parseRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = parseRef.current;
    const cell = box?.querySelector<HTMLElement>("[data-on='1']");
    if (!box || !cell) return;
    const from = box.getBoundingClientRect();
    const to = cell.getBoundingClientRect();
    box.scrollBy({ left: to.left + to.width / 2 - (from.left + from.width / 2), behavior: "smooth" });
  }, [cur.i, sentence.n]);
  const nNominal = sentences.filter((s) => s.kind === "nominal").length;

  return (
    <Chapter id="nahw" num="03" kicker={t("ulum.k.nahw")} title={t("ulum.t.nahw")} sub={t("ulum.s.nahw")} arabic="النحو" ctx={ctx} innerRef={ref}>
      <Block
        kicker={t("ulum.arch.kicker")}
        title={t("ulum.arch.title", { count: sentences.length, nominal: num(nNominal), verbal: num(sentences.length - nNominal) })}
        aside={
          <span className={styles.legend}>
            <span className={styles.legendNominal} />
            {t("ulum.nominal")} · اسمية
            <span className={styles.legendVerbal} />
            {t("ulum.verbal")} · فعلية
          </span>
        }
      >
        <div className={`${styles.arch} ${lit ? styles.archGrown : ""}`} dir="rtl">
          {sentences.map((s, k) => (
            <button
              key={s.n}
              type="button"
              className={s.n === sentence.n ? styles.archOn : styles.archBlock}
              data-kind={s.kind}
              style={{ flexGrow: s.to - s.from + 1, transitionDelay: `${k * 80}ms` }}
              onClick={() => ctx.pick(s.from)}
            >
              <span className={styles.archNum} lang="ar">
                {ar(s.n)}
              </span>
              <span className={styles.archAr} lang="ar">
                {s.kind === "verbal" ? "فعلية" : "اسمية"}
              </span>
              <span className={styles.archKind} dir="ltr">
                {t(s.kind === "verbal" ? "ulum.verbal" : "ulum.nominal")}
              </span>
              {s.jumla && (
                <span className={styles.archRel} dir="ltr">
                  {officeOf(s.jumla.place)?.en ?? ""}
                </span>
              )}
            </button>
          ))}
        </div>
        <p className={styles.fromBook}>{t("ulum.arch.note")}</p>
        {counts.length > 1 && new Set(counts.map((c) => c.n)).size > 1 && (
          <div className={styles.counts}>
            <div className={styles.miniKicker}>{t("ulum.arch.counts")}</div>
            {counts.map((c) => (
              <span key={c.id} className={styles.countChip} style={whoStyle(c.id)}>
                <span className={styles.whoDot} aria-hidden />
                {book(c.id)?.short} · {t("ulum.arch.count", { count: c.n, countText: num(c.n) })}
              </span>
            ))}
            <p className={styles.fromBook}>{t("ulum.arch.countsNote")}</p>
          </div>
        )}
        {jumal.length > 0 && (
          <div className={styles.jumalList}>
            <div className={styles.miniKicker}>{t("ulum.arch.places")}</div>
            {jumal.map(({ r, l }, k) => (
              <button key={k} type="button" className={styles.jumalRow} onClick={() => ctx.pick(l.from)} data-main={r.main ? "1" : "0"}>
                <span className={styles.jumalQuote} lang="ar" dir="rtl">
                  «{r.quote}»
                </span>
                <span className={styles.jumalPlace} lang="ar" dir="rtl">
                  {r.place}
                </span>
                <span className={styles.jumalEn}>{officeOf(r.place)?.en ?? ""}</span>
              </button>
            ))}
            <Cite id="aljadwal" ctx={ctx} range={jd?.read.p} />
          </div>
        )}
      </Block>

      <Block kicker={t("ulum.parse.kicker", { n: num(sentence.n) })} title={t("ulum.parse.title")}>
        {daas.loading && !jd ? (
          <Silent>{t("ulum.loading")}</Silent>
        ) : (
          <div className={styles.parseScroll} ref={parseRef}>
            <div className={styles.parse} dir="rtl" style={{ gridTemplateColumns: `repeat(${sw.length}, auto)` }}>
              {sw.map((w, k) => {
                const r = roleOf(w.i);
                const o = officeOf(r?.text ?? "");
                return (
                  <button
                    key={w.i}
                    type="button"
                    className={w.i === cur.i ? styles.parseCellOn : styles.parseCell}
                    data-on={w.i === cur.i ? "1" : "0"}
                    style={{ gridColumn: k + 1 }}
                    onClick={() => ctx.pick(w.i)}
                  >
                    <span className={styles.parseAr} lang="ar">
                      {w.ar}
                    </span>
                    <span className={styles.parseRole} lang="ar">
                      {r ? first(r.text, 4) : "—"}
                    </span>
                    <span className={styles.parseEn} dir="ltr">
                      {o?.en ?? ""}
                    </span>
                  </button>
                );
              })}
              {brackets.map(({ r, l }, k) => (
                <div
                  key={k}
                  className={`${styles.bracket} ${lit ? styles.bracketOpen : ""}`}
                  style={{ gridColumn: `${l.from - sentence.from + 1} / ${l.to - sentence.from + 2}`, gridRow: 2 + k, transitionDelay: `${300 + k * 250}ms` }}
                >
                  <div className={styles.bracketLine} />
                  <div className={styles.bracketAr} lang="ar">
                    {first(r.text, 6)}
                  </div>
                  <div className={styles.bracketEn} dir="ltr">
                    {officeOf(r.text)?.en ?? ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <Cite id="iraab-daas" ctx={ctx} range={daas.p} />
      </Block>

      <div className={styles.iraab}>
        <div>
          <div className={styles.kicker}>{t("ulum.iraabOf", { word: cur.tr || cur.ar })}</div>
          <div className={styles.officeEn}>{office?.en ?? "—"}</div>
          <div className={styles.officeAr} lang="ar" dir="rtl">
            {office?.ar ?? ""}
          </div>
        </div>
        <div className={styles.iraabBody}>
          {jRemark.length ? (
            jRemark.map((r, k) => (
              <div key={k}>
                <Line text={`(${r.quote}) ${r.text}`} className={styles.iraabAr} />
                {ctx.scholar && r.notes.length > 0 && (
                  <div className={styles.alsoHeld}>
                    <div className={styles.miniKicker}>{t("ulum.alsoHeld")}</div>
                    {r.notes.map((x, i) => (
                      <Line key={i} text={x} className={styles.cardArNote} />
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            !ctx.booksDown && <Silent>{jd ? t("ulum.iraab.unplaced") : t("ulum.loading")}</Silent>
          )}
          {jd && <Cite id="aljadwal" ctx={ctx} range={jd.read.p} />}
        </div>
      </div>

      {others.length > 0 && (
        <Block kicker={t("ulum.grammars.kicker")} title={t("ulum.grammars.title", { word: cur.ar })}>
          <div className={styles.cards2}>
            {others.map((o) => (
              <article key={o.id} className={`${styles.card} ${styles.whoCard}`} style={whoStyle(o.id)}>
                {o.rs.slice(0, 2).map((r, k) => (
                  <Line key={k} text={`${o.wrap[0]}${r.quote}${o.wrap[1]} ${r.text}`} className={styles.cardArText} />
                ))}
                <Cite id={o.id} ctx={ctx} range={o.read.p} />
              </article>
            ))}
          </div>
        </Block>
      )}

      {(saminViews.length > 0 || (!samin.loading && !ctx.booksDown)) && (
        <Block kicker={t("ulum.diff.grammarKicker")} title={t("ulum.diff.grammarTitle", { count: saminViews.length })}>
          {saminViews.length ? (
            <>
              <p className={styles.fromBook}>{t("ulum.diff.grammarNote")}</p>
              <Differences books={[{ id: "aldur-almasoon", read: samin, views: saminViews }]} ctx={ctx} />
            </>
          ) : (
            <Silent>{t("ulum.diff.grammarNone")}</Silent>
          )}
        </Block>
      )}

      {ctx.scholar && (
        <Block kicker={t("ulum.grammars.whole")} title={t("ulum.grammars.wholeTitle")}>
          {[
            { id: "iraab-alnahas", read: nahhas },
            { id: "mujtaba-mushkil-iraab", read: mujtaba },
          ].map(({ id, read }) =>
            read.p ? (
              <div key={id} className={styles.subBlock}>
                <BookText text={read.p.text} />
                <Cite id={id} ctx={ctx} range={read.p} />
              </div>
            ) : null,
          )}
          {sRemarks.filter((r) => belongs(r, samin, n)).length > 0 && (
            <div className={styles.subBlock}>
              <BookText
                lines={sRemarks.filter((r) => belongs(r, samin, n)).map((r) => (r.quote ? `{${r.quote}}: ${r.text}` : r.text))}
              />
              <Cite id="aldur-almasoon" ctx={ctx} range={samin.p} />
            </div>
          )}
          {!nahhas.p && !mujtaba.p && !samin.p && !nahhas.loading && !ctx.booksDown && <Silent>{t("ulum.grammars.none")}</Silent>}
        </Block>
      )}
    </Chapter>
  );
}
