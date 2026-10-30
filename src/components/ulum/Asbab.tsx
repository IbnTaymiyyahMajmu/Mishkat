"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fetchVerse } from "@/lib/quran/api";
import type { Verse } from "@/lib/quran/types";
import { useSettings } from "@/lib/store/settings";
import { plainText } from "@/lib/text";
import { useLocale } from "@/lib/i18n";
import { Block, BookText, Chapter, Cite, Silent } from "./Chapter";
import { useBook, useNear, type StudyCtx } from "./study";
import styles from "./AyahStudy.module.css";

/**
 * 06 · Asbāb al-nuzūl — what it came down in answer to, and where it stands.
 *
 * The occasion is al-Wāḥidī's, the book the science is named after, in his own
 * words and chains. Where he records none the page says so: most of the
 * Qurʾān came down with no occasion anyone recorded, and an empty answer is
 * the true one. Then the ayah in its passage — the one before and the one
 * after — because the place an ayah stands in is part of what it means.
 */

export function Asbab({ ctx, prevKey, nextKey }: { ctx: StudyCtx; prevKey: string; nextKey: string }) {
  const { t } = useLocale();
  const { settings } = useSettings();
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const lit = ctx.seen("asbab");
  const wahidi = useBook("wahidi-asbab", ctx, near);

  const [around, setAround] = useState<{ key: string; prev: Verse | null; next: Verse | null } | null>(null);
  useEffect(() => {
    if (!near) return;
    let alive = true;
    Promise.all([
      prevKey ? fetchVerse(prevKey, settings.translationId) : Promise.resolve(null),
      nextKey ? fetchVerse(nextKey, settings.translationId) : Promise.resolve(null),
    ]).then(([prev, next]) => alive && setAround({ key: ctx.key, prev, next }));
    return () => {
      alive = false;
    };
  }, [near, prevKey, nextKey, settings.translationId, ctx.key]);
  const ctxAyat = around?.key === ctx.key ? around : null;

  const cells = [
    { k: prevKey, v: ctxAyat?.prev ?? null, me: false },
    { k: ctx.key, v: null, me: true },
    { k: nextKey, v: ctxAyat?.next ?? null, me: false },
  ];

  return (
    <Chapter id="asbab" num="06" kicker={t("ulum.k.asbab")} title={t("ulum.t.asbab")} sub={t("ulum.s.asbab")} arabic="أسباب النزول" ctx={ctx} innerRef={ref}>
      {wahidi.p ? (
        <div className={styles.report}>
          <div>
            <div className={styles.miniKicker}>{t("ulum.asbab.by")}</div>
            <div className={styles.reportWho}>al-Wāḥidī</div>
            <span className={styles.tagOutline}>{t("ulum.asbab.chains")}</span>
          </div>
          <div>
            {ctx.scholar ? (
              <BookText text={wahidi.p.text} />
            ) : (
              <p className={styles.prose}>{t("ulum.asbab.student")}</p>
            )}
            <Cite id="wahidi-asbab" ctx={ctx} range={wahidi.p} />
          </div>
        </div>
      ) : (
        <div className={styles.two}>
          <div className={styles.bigLine}>{wahidi.loading ? t("ulum.loading") : t("ulum.asbab.none")}</div>
          <p className={styles.prose}>{t("ulum.asbab.noneBody")}</p>
        </div>
      )}

      <Block kicker={t("ulum.siyaq.kicker")} title={t("ulum.siyaq.title")}>
        <div className={styles.siyaq}>
          {cells.map((c, idx) => (
            <div key={idx} className={styles.siyaqStep}>
              <div className={`${c.me ? styles.siyaqMe : styles.siyaqCell} ${lit ? styles.risen : ""}`} style={{ transitionDelay: `${200 + idx * 400}ms` }}>
                {c.k ? (
                  <>
                    {c.me ? (
                      <div className={styles.siyaqKey}>{c.k}</div>
                    ) : (
                      <Link className={styles.siyaqKey} href={`/ayah/?v=${c.k}`}>
                        {c.k}
                      </Link>
                    )}
                    <div className={styles.siyaqAr} dir="rtl" lang="ar">
                      {c.me ? ctx.words.map((w) => w.ar).join(" ") : (c.v?.text_uthmani ?? "")}
                    </div>
                    <div className={styles.siyaqEn}>{c.me ? ctx.translation : plainText(c.v?.translations?.[0]?.text ?? "")}</div>
                  </>
                ) : (
                  <Silent>{idx === 0 ? t("ulum.siyaq.first") : t("ulum.siyaq.last")}</Silent>
                )}
              </div>
              {idx < 2 && (
                <svg viewBox="0 0 48 20" className={`${styles.siyaqArrow} ${lit ? styles.drawn : ""}`} aria-hidden>
                  <path d="M2 10h42M36 3l8 7-8 7" pathLength={1} />
                </svg>
              )}
            </div>
          ))}
        </div>
      </Block>
    </Chapter>
  );
}
