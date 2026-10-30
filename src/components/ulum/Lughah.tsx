"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LexiconEntry, LexiconText } from "@/lib/quran/types";
import { fetchAyahMorphology, fetchLexicon, fetchLexiconText, MORPHOLOGY_SOURCE } from "@/lib/quran/lexicon";
import { classOf, fetchRoots, stemOf, type Lemma, type RootTree } from "@/lib/ulum/corpus";
import { ornate, readDarwish, readAysar } from "@/lib/ulum/read";
import { useLocale } from "@/lib/i18n";
import { Block, BookText, Chapter, Cite, Line, Silent } from "./Chapter";
import { LETTER_NAMES } from "./terms";
import { inAyah, on, useBook, useNear, type StudyCtx } from "./study";
import styles from "./AyahStudy.module.css";

/**
 * 01 · Lughah — what the word grows from, and what the lexicographers said.
 *
 * The root and its letters are the corpus's. The tree is every lemma the corpus
 * finds grown from that root anywhere in the muṣḥaf, grouped as the
 * grammarians group derivations — the verb by its form, then the verbal nouns,
 * the participles and the rest — each with how often it occurs. The lexicon
 * entries are the lexicographers' own words, as the word study page reads
 * them; the glosses are those of the books of gharīb and of Darwīsh, each
 * shown under the word it glosses.
 */

const FORM_PATTERN = ["", "فَعَلَ", "فَعَّلَ", "فاعَلَ", "أَفْعَلَ", "تَفَعَّلَ", "تَفاعَلَ", "اِنْفَعَلَ", "اِفْتَعَلَ", "اِفْعَلَّ", "اِسْتَفْعَلَ", "اِفْعالَّ", "اِفْعَوْعَلَ"];
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const GHARIB = ["ghareeb-ibn-qutaybah", "altibyan-ghreeb", "siraaj-ghareeb", "almuyassar-ghareeb"];

let rootsAsked: Promise<{ roots: { [root: string]: RootTree } }> | null = null;

interface Branch {
  id: string;
  label: string;
  ar: string;
  lemmas: Lemma[];
}

function branches(tree: RootTree, t: ReturnType<typeof useLocale>["t"]): Branch[] {
  const out = new Map<string, Branch>();
  const add = (id: string, label: string, arLabel: string, l: Lemma) => {
    const b = out.get(id) ?? out.set(id, { id, label, ar: arLabel, lemmas: [] }).get(id)!;
    b.lemmas.push(l);
  };
  for (const l of tree.l) {
    const k = l[1];
    const form = Number(k.replace(/^\D+/, "")) || 1;
    if (k.startsWith("V")) add(`V${form}`, t("ulum.form", { n: ROMAN[form] }), FORM_PATTERN[form] ?? "", l);
    else if (k.startsWith("VN")) add("VN", t("ulum.tree.vn"), "المصادر", l);
    else if (k.startsWith("AP") || k.startsWith("PP")) add("PCPL", t("ulum.tree.pcpl"), "أسماء الفاعلين والمفعولين", l);
    else add("N", t("ulum.tree.nouns"), "الأسماء والصفات", l);
  }
  const order = (b: Branch) => (b.id.startsWith("V") ? Number(b.id.slice(1)) : b.id === "VN" ? 20 : b.id === "PCPL" ? 21 : 22);
  return [...out.values()].sort((a, b) => order(a) - order(b));
}

export function Lughah({ ctx }: { ctx: StudyCtx }) {
  const { t, n: num } = useLocale();
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const { cur } = ctx;
  const n = ctx.words.length;

  const [trees, setTrees] = useState<{ [root: string]: RootTree } | null>(null);
  useEffect(() => {
    if (!near) return;
    rootsAsked ??= fetchRoots();
    let alive = true;
    rootsAsked.then((r) => alive && setTrees(r.roots)).catch(() => (rootsAsked = null));
    return () => {
      alive = false;
    };
  }, [near]);
  const tree = cur.root && trees ? trees[cur.root] : undefined;
  const grown = useMemo(() => (tree ? branches(tree, t) : []), [tree, t]);

  // The lexicons address a root as the corpus does, in Buckwalter; the key for
  // this word is read from the same morphology the word study reads.
  const [rootKey, setRootKey] = useState<{ word: string; key: string } | null>(null);
  const wordId = `${ctx.key}:${cur.i}`;
  useEffect(() => {
    if (!near || !cur.root) return;
    let alive = true;
    fetchAyahMorphology(ctx.key)
      .then((ws) => {
        const segs = ws.find((w) => w.position === cur.i)?.segments ?? [];
        const k = segs.find((s) => s.rootKey)?.rootKey ?? "";
        if (alive) setRootKey({ word: wordId, key: k });
      })
      .catch(() => alive && setRootKey({ word: wordId, key: "" }));
    return () => {
      alive = false;
    };
  }, [near, ctx.key, cur.i, cur.root, wordId]);
  const lexKey = rootKey?.word === wordId ? rootKey.key : "";

  const [entries, setEntries] = useState<{ key: string; list: { e: LexiconEntry; text: LexiconText | null }[] } | null>(null);
  useEffect(() => {
    if (!lexKey) return;
    let alive = true;
    fetchLexicon(lexKey)
      .then(async (rows) => {
        // The root's sense from the oldest dictionary of roots, its use in the
        // Qurʾān from the lexicon of the Qurʾān, and the fullest of them all.
        const wanted = [/Maq/i, /Mufrad/i, /Lis/i];
        const chosen = wanted.map((re) => rows.find((r) => re.test(r.name))).filter((r): r is LexiconEntry => !!r);
        for (const r of rows) if (chosen.length < 3 && !chosen.includes(r)) chosen.push(r);
        const list = await Promise.all(chosen.map(async (e) => ({ e, text: await fetchLexiconText(e.id).catch(() => null) })));
        if (alive) setEntries({ key: lexKey, list });
      })
      .catch(() => alive && setEntries({ key: lexKey, list: [] }));
    return () => {
      alive = false;
    };
  }, [lexKey]);
  const lexicons = entries?.key === lexKey ? entries.list : null;

  const darwish = useBook("iraab-aldarweesh", ctx, near);
  const aysar = useBook("aysar-altafasir", ctx, near);
  const gharib = [useBook(GHARIB[0], ctx, near), useBook(GHARIB[1], ctx, near), useBook(GHARIB[2], ctx, near), useBook(GHARIB[3], ctx, near)];

  const dLughah = useMemo(() => (darwish.p ? readDarwish(darwish.p.text, darwish.words).lughah : []), [darwish]);
  const dOnWord = on(dLughah, darwish, n, cur.i);
  const aysarWords = useMemo(() => {
    if (!aysar.p) return [];
    return readAysar(aysar.p.text).words;
  }, [aysar]);
  const gloss = gharib.map((g, k) => {
    if (!g.p) return { id: GHARIB[k], read: g, rs: [] as ReturnType<typeof ornate> };
    const rs = ornate(g.p.text, g.words, true);
    return { id: GHARIB[k], read: g, rs };
  });
  const glossOnWord = gloss
    .map((g) => ({ id: g.id, read: g.read, r: on(g.rs, g.read, n, cur.i)[0] }))
    .filter((g) => g.r);

  const letters = [...cur.root];
  const stem = stemOf(cur.segs);
  const kind = stem ? classOf(stem) : "";
  const RADICAL = [t("ulum.radical1"), t("ulum.radical2"), t("ulum.radical3"), t("ulum.radical4")];
  const lit = ctx.seen("lughah");

  return (
    <Chapter
      id="lughah"
      num="01"
      kicker={t("ulum.k.lughah")}
      title={t("ulum.t.lughah")}
      sub={t("ulum.s.lughah")}
      arabic="اللغة"
      ctx={ctx}
      innerRef={ref}
    >
      {cur.root ? (
        <>
          <div className={styles.two}>
            <div className={styles.rootTiles} dir="rtl">
              {letters.map((ch, k) => (
                <div key={k} className={`${styles.rootTile} ${lit ? styles.risen : ""}`} style={{ transitionDelay: `${150 + k * 180}ms` }}>
                  <div className={styles.rootLetter} lang="ar">
                    {ch}
                  </div>
                  <div className={styles.rootName}>{LETTER_NAMES[ch] ?? ""}</div>
                  <div className={styles.rootPos} dir="ltr">
                    {RADICAL[k] ?? ""}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className={styles.kicker}>{t("ulum.theRoot")}</div>
              <div className={styles.rootBig} lang="ar">
                {letters.join(" ")}
              </div>
              {tree && (
                <div className={styles.occ}>
                  <span className={styles.occNum}>{num(tree.a)}</span>
                  <span className={styles.occText}>{t("ulum.occ", { words: num(tree.w), lemmas: num(tree.l.length) })}</span>
                </div>
              )}
              <p className={styles.fromBook}>{t("ulum.treeFrom", { corpus: MORPHOLOGY_SOURCE.name })}</p>
            </div>
          </div>

          {tree && (
            <Block
              kicker={t("ulum.tree.kicker")}
              title={
                <>
                  {t("ulum.tree.title")}{" "}
                  <span lang="ar" className={styles.accentAr}>
                    {letters.join(" ")}
                  </span>
                </>
              }
              aside={
                <span className={styles.legend}>
                  <span className={styles.legendSolid} />
                  {t("ulum.tree.inQuran")}
                  <span className={styles.legendHit} />
                  {t("ulum.tree.thisWord")}
                </span>
              }
            >
              <div className={`${styles.tree} ${lit ? styles.treeGrown : ""}`}>
                <div className={styles.treeRoot}>
                  <span lang="ar">{letters.join(" ")}</span>
                  <span className={styles.treeRootCount}>{t("ulum.tree.ayat", { count: tree.a, countText: num(tree.a) })}</span>
                </div>
                <div className={styles.treeBranches}>
                  <div className={styles.treeTrunk} />
                  {grown.map((b, bi) => (
                    <div key={b.id} className={styles.branch} style={{ transitionDelay: `${400 + bi * 140}ms` }}>
                      <div className={styles.branchLabel}>
                        <span className={styles.branchName}>{b.label}</span>
                        <span className={styles.branchAr} lang="ar">
                          {b.ar}
                        </span>
                      </div>
                      <div className={styles.branchWords}>
                        {b.lemmas.map((l, li) => {
                          const hit = l[0] === cur.lemma;
                          const [s, a, w] = l[3].split(":");
                          return (
                            <Link
                              key={`${l[0]}-${l[1]}-${li}`}
                              href={`/ayah/?v=${s}:${a}${Number(w) > 1 ? `&w=${w}` : ""}`}
                              className={hit ? styles.chipHit : styles.chip}
                              style={{ transitionDelay: `${700 + (bi * 6 + li) * 50}ms` }}
                              title={t("ulum.tree.first", { key: l[3] })}
                            >
                              <span className={styles.chipAr} lang="ar">
                                {l[0]}
                              </span>
                              <span className={styles.chipCount}>×{num(l[2])}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Block>
          )}

          <Block kicker={t("ulum.lex.kicker")} title={t("ulum.lex.title")}>
            {lexicons === null && lexKey !== "" ? (
              <Silent>{t("ulum.loading")}</Silent>
            ) : lexicons && lexicons.length ? (
              <div className={styles.cards3}>
                {lexicons.map(({ e, text }) => (
                  <article key={e.id} className={styles.card}>
                    <div className={styles.cardHead}>
                      <span className={styles.cardName}>{e.name}</span>
                      <span className={styles.cardAr} lang="ar">
                        {e.nameArabic}
                      </span>
                    </div>
                    <div className={styles.cardMeta}>
                      {e.author}
                      {e.quranic && <span className={styles.tagOutline}>{t("ulum.ofQuran")}</span>}
                    </div>
                    {ctx.scholar && text?.arabic && <Line text={clip(text.arabic, 900)} className={styles.cardArText} />}
                    {text?.english && <p className={styles.cardText}>{clip(text.english, 900)}</p>}
                    {text?.sourceUrl && (
                      <a className={styles.citeLink} href={text.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {t("ulum.lex.full")}
                      </a>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <Silent>{t("ulum.lex.none")}</Silent>
            )}
            <p className={styles.fromBook}>
              {t("ulum.lex.from")}{" "}
              <Link href={`/study/?w=${ctx.key}:${cur.i}`}>{t("ulum.lex.wordStudy")}</Link>
            </p>
          </Block>
        </>
      ) : (
        <div className={styles.two}>
          <div className={styles.bigLine}>{t("ulum.noRoot")}</div>
          <p className={styles.prose}>
            {t(kind === "INL" ? "ulum.noRootLetters" : kind === "PN" ? "ulum.noRootName" : "ulum.noRootBody")}
          </p>
        </div>
      )}

      <Block kicker={t("ulum.gloss.kicker")} title={t("ulum.gloss.title", { word: cur.ar })}>
        {glossOnWord.length || dOnWord.length ? (
          <div className={styles.cards2}>
            {glossOnWord.map((g) => (
              <article key={g.id} className={styles.card}>
                <Line text={`﴿${g.r!.quote}﴾: ${g.r!.text}`} className={styles.cardArText} />
                <Cite id={g.id} ctx={ctx} range={g.read.p} />
              </article>
            ))}
            {dOnWord.map((r, k) => (
              <article key={`d${k}`} className={styles.card}>
                <Line text={`(${r.quote}) ${r.text}`} className={styles.cardArText} />
                <Cite id="iraab-aldarweesh" ctx={ctx} range={darwish.p} />
              </article>
            ))}
          </div>
        ) : (
          <Silent>{gloss.some((g) => g.read.loading) ? t("ulum.loading") : t("ulum.gloss.none")}</Silent>
        )}
        {aysarWords.length > 0 && ctx.scholar && (
          <div className={styles.subBlock}>
            <div className={styles.kicker}>{t("ulum.gloss.aysar")}</div>
            <BookText lines={aysarWords.map((w) => `${w.quote}: ${w.text}`)} />
            <Cite id="aysar-altafasir" ctx={ctx} range={aysar.p} />
          </div>
        )}
        {ctx.scholar && inAyah(dLughah, darwish, n).length > 0 && (
          <div className={styles.subBlock}>
            <div className={styles.kicker}>{t("ulum.gloss.darwish")}</div>
            <BookText lines={inAyah(dLughah, darwish, n).map(({ r }) => `(${r.quote}) ${r.text}`)} />
            <Cite id="iraab-aldarweesh" ctx={ctx} range={darwish.p} />
          </div>
        )}
      </Block>
    </Chapter>
  );
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("۔"), cut.lastIndexOf("،"));
  return `${cut.slice(0, at > max * 0.6 ? at + 1 : max)} …`;
}
