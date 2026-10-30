"use client";

import { useMemo, useRef } from "react";
import { book } from "@/lib/ulum/books";
import { benefits, quotedIn, readAysar, readDarwish, sections, type Jadwal } from "@/lib/ulum/read";
import { useLocale } from "@/lib/i18n";
import { Block, Chapter, Cite, Line, Silent } from "./Chapter";
import { local, useBook, useNear, type Read, type StudyCtx } from "./study";
import styles from "./AyahStudy.module.css";

/**
 * 11 · Fawāʾid — what the scholars drew from it, and what a student should
 * carry away.
 *
 * Four books that set out, under every ayah or passage, what is to be taken
 * from it, each in its own words: Abū Bakr al-Jazāʾirī's guidance of the ayat
 * (Aysar al-tafāsīr), Ibn ʿUthaymīn's benefits with the words of the ayah he
 * draws each from, the reflections of al-Qurʾān: tadabbur wa-ʿamal with the
 * scholar and the volume and page each is quoted from, and the benefits al-
 * Ṣāfī and Darwīsh close their passages with. A benefit drawn from particular
 * words of the ayah is set beside the sentence they are in.
 */

interface Point {
  id: string;
  text: string;
  read: Read;
  /** The sentences of the ayah its evidence quotes. */
  from: number[];
}

/** Al-Qurʾān: tadabbur wa-ʿamal — «١- ﴿…﴾» and then the reflection, under «* الوقفات التدبرية». */
function reflections(text: string): { quote: string; text: string }[] {
  const out: { quote: string; text: string }[] = [];
  for (const s of sections(text)) {
    if (!/التدبرية|العمل/.test(s.heading)) continue;
    for (const line of s.lines) {
      const m = /^[0-9٠-٩]{1,2}\s*[-–]\s*﴿([^﴾]+)﴾\s*(.*)$/u.exec(line);
      if (m) out.push({ quote: m[1], text: m[2] });
      else if (out.length && !/^السؤال/.test(line)) out[out.length - 1].text += `${out[out.length - 1].text ? "\n" : ""}${line}`;
    }
  }
  return out;
}

export function Fawaid({ ctx, jd }: { ctx: StudyCtx; jd: { j: Jadwal; read: Read } | null }) {
  const { t } = useLocale();
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const n = ctx.words.length;
  const lit = ctx.seen("fawaid");

  const aysar = useBook("aysar-altafasir", ctx, near);
  const uthaymin = useBook("ibn-uthaymeen", ctx, near);
  const tadabbur = useBook("tadabbur-wa-amal", ctx, near);
  const darwish = useBook("iraab-aldarweesh", ctx, near);

  const points = useMemo(() => {
    const out: Point[] = [];
    /** Which of this ayah's sentences a point quotes, and whether it quotes only another ayah. */
    const placeOf = (text: string, read: Read) => {
      const set = new Set<number>();
      let elsewhere = false;
      for (const p of quotedIn(text, read.words)) {
        const l = local(p, read, n);
        if (!l) {
          elsewhere = true;
          continue;
        }
        for (const s of ctx.sentences) if (l.from <= s.to && l.to >= s.from) set.add(s.n);
      }
      return { from: [...set].sort((a, b) => a - b), elsewhere };
    };
    const sentencesOf = (text: string, read: Read) => placeOf(text, read).from;
    // A point from a passage on several ayat belongs to them all — unless it
    // quotes another of them and nothing of this one, when it is that ayah's.
    const keep = (text: string, read: Read) => {
      const at = placeOf(text, read);
      return at.from.length > 0 || !at.elsewhere;
    };
    if (aysar.p)
      for (const g of readAysar(aysar.p.text).guidance) {
        if (keep(g, aysar)) out.push({ id: "aysar-altafasir", text: g, read: aysar, from: sentencesOf(g, aysar) });
      }
    if (uthaymin.p)
      for (const b of benefits(uthaymin.p.text)) {
        if (keep(b, uthaymin)) out.push({ id: "ibn-uthaymeen", text: b, read: uthaymin, from: sentencesOf(b, uthaymin) });
      }
    if (tadabbur.p)
      for (const r of reflections(tadabbur.p.text)) {
        const from = sentencesOf(`﴿${r.quote}﴾`, tadabbur);
        if (from.length) out.push({ id: "tadabbur-wa-amal", text: `﴿${r.quote}﴾\n${r.text}`, read: tadabbur, from });
      }
    if (jd)
      for (const f of jd.j.fawaid) {
        if (keep(f, jd.read)) out.push({ id: "aljadwal", text: f, read: jd.read, from: sentencesOf(f, jd.read) });
      }
    if (darwish.p)
      for (const f of readDarwish(darwish.p.text, darwish.words).fawaid) {
        if (keep(f, darwish)) out.push({ id: "iraab-aldarweesh", text: f, read: darwish, from: sentencesOf(f, darwish) });
      }
    return out;
  }, [aysar, uthaymin, tadabbur, darwish, jd, n, ctx.sentences]);

  const books = ["aysar-altafasir", "ibn-uthaymeen", "tadabbur-wa-amal", "aljadwal", "iraab-aldarweesh"].filter((id) =>
    points.some((p) => p.id === id),
  );
  const loading = aysar.loading || uthaymin.loading;

  return (
    <Chapter id="fawaid" num="11" kicker={t("ulum.k.fawaid")} title={t("ulum.t.fawaid")} sub={t("ulum.s.fawaid")} arabic="الفوائد" ctx={ctx} innerRef={ref}>
      {points.length === 0 ? (
        <Silent>{loading ? t("ulum.loading") : t("ulum.fawaid.none")}</Silent>
      ) : (
        books.map((id) => {
          const mine = points.filter((p) => p.id === id);
          return (
            <Block key={id} kicker={t("ulum.fawaid.from")} title={<BookName id={id} />}>
              {mine.map((p, k) => (
                <div
                  key={k}
                  className={`${styles.benefit} ${lit ? styles.risen : ""} ${p.from.includes(ctx.sentence.n) ? styles.benefitHere : ""}`}
                  style={{ transitionDelay: `${150 + k * 90}ms` }}
                >
                  <div className={styles.benefitNum}>{String(k + 1).padStart(2, "0")}</div>
                  <div className={styles.benefitBody}>
                    {ctx.scholar || id === "aysar-altafasir" ? (
                      p.text.split("\n").map((line, i) => <Line key={i} text={line} className={styles.benefitAr} />)
                    ) : (
                      <Line text={p.text.split("\n")[0]} className={styles.benefitAr} />
                    )}
                  </div>
                  <div className={styles.benefitSide}>
                    {p.from.length ? (
                      p.from.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            const x = ctx.sentences.find((y) => y.n === s);
                            if (x) ctx.pick(x.from);
                          }}
                        >
                          {t("ulum.sentenceN", { n: s })}
                        </button>
                      ))
                    ) : (
                      <span className={styles.blockNote}>{t("ulum.scope.ayah")}</span>
                    )}
                  </div>
                </div>
              ))}
              <Cite id={id} ctx={ctx} range={mine[0].read.p} />
            </Block>
          );
        })
      )}
    </Chapter>
  );
}

function BookName({ id }: { id: string }) {
  const b = book(id);
  return (
    <>
      <i>{b?.name}</i>
      <span className={styles.blockTitleAr} lang="ar">
        {" "}
        {b?.titleArabic ?? b?.nameArabic}
      </span>
    </>
  );
}
