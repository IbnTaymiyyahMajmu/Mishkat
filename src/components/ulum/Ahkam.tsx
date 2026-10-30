"use client";

import { useRef } from "react";
import { useLocale } from "@/lib/i18n";
import { Block, BookText, By, Chapter, Cite, Silent } from "./Chapter";
import { HanbaliPlaces, useHanbali } from "./Hanbali";
import { useBook, useNear, type StudyCtx } from "./study";
import { whoStyle } from "./who";
import styles from "./AyahStudy.module.css";

/**
 * 09 · Aḥkām — what it asks of the believer.
 *
 * The books of rulings on the shelf, one to a school where the shelf has one:
 * al-Jaṣṣāṣ for the Ḥanafīs, Ilkiyā al-Harrāsī for the Shāfiʿīs, Ibn al-ʿArabī
 * for the Mālikīs — each taking up the ayat a jurist of his school takes up,
 * and silent on the rest, as the page says. The shelf has no such book for the
 * Ḥanbalīs, so theirs is the places al-Mughnī and al-Mubdiʿ quote the ayah. Then
 * al-Suyūṭī's al-Iklīl, al-Ṭarīfī's Aḥkām, and Makkī on what of the ayah was
 * abrogated, if anything. The rulings are theirs and in their words; none is
 * summarised here.
 */

const SCHOOLS = [
  { id: "aljasas", school: "ulum.school.hanafi" },
  { id: "ilkia-alharrasee", school: "ulum.school.shafii" },
  { id: "ahkam-ibn-alarabee", school: "ulum.school.maliki" },
] as const;
const LATER = ["alikleel", "ahkam-altarayfi", "eedah-naskh-mansukh"];

export function Ahkam({ ctx }: { ctx: StudyCtx }) {
  const { t } = useLocale();
  const ref = useRef<HTMLElement>(null);
  const near = useNear(ref);
  const lit = ctx.seen("ahkam");
  const schools = [useBook(SCHOOLS[0].id, ctx, near), useBook(SCHOOLS[1].id, ctx, near), useBook(SCHOOLS[2].id, ctx, near)];
  const later = [useBook(LATER[0], ctx, near), useBook(LATER[1], ctx, near), useBook(LATER[2], ctx, near)];
  const hanbali = useHanbali(ctx, near);
  const any = [...schools, ...later].some((r) => r.p) || hanbali.places.length > 0;
  const loading = [...schools, ...later].some((r) => r.loading) || hanbali.loading;

  return (
    <Chapter id="ahkam" num="09" kicker={t("ulum.k.ahkam")} title={t("ulum.t.ahkam")} sub={t("ulum.s.ahkam")} arabic="الأحكام" ctx={ctx} innerRef={ref}>
      {!any && !loading ? (
        <div className={styles.two}>
          <div className={styles.bigLine}>{t("ulum.ahkam.none")}</div>
          <p className={styles.prose}>{t("ulum.ahkam.noneBody")}</p>
        </div>
      ) : (
        <>
          <Block kicker={t("ulum.ahkam.schools")} title={t("ulum.ahkam.schoolsTitle")}>
            <div className={styles.schools}>
              {SCHOOLS.map((s, k) => {
                const read = schools[k];
                return (
                  <article key={s.id} className={`${styles.school} ${lit ? styles.risen : ""}`} style={{ ...whoStyle(s.id), transitionDelay: `${200 + k * 120}ms` }}>
                    <div className={`${styles.schoolName} ${styles.whoName}`}>{t(s.school)}</div>
                    {read.p ? (
                      ctx.scholar ? (
                        <BookText text={read.p.text} />
                      ) : (
                        <p className={styles.cardText}>{t("ulum.ahkam.takes")}</p>
                      )
                    ) : (
                      <Silent>{read.loading ? t("ulum.loading") : t("ulum.ahkam.silent")}</Silent>
                    )}
                    {read.p ? <Cite id={s.id} ctx={ctx} range={read.p} /> : <By id={s.id} />}
                  </article>
                );
              })}
              <article className={`${styles.school} ${lit ? styles.risen : ""}`} style={{ ...whoStyle("almughni"), transitionDelay: `${200 + SCHOOLS.length * 120}ms` }}>
                <div className={`${styles.schoolName} ${styles.whoName}`}>{t("ulum.school.hanbali")}</div>
                <HanbaliPlaces key={ctx.key} read={hanbali} ctx={ctx} />
              </article>
            </div>
          </Block>
          {later.some((r) => r.p) && (
            <Block kicker={t("ulum.ahkam.later")} title={t("ulum.ahkam.laterTitle")}>
              <div className={styles.cards2}>
                {LATER.map((id, k) =>
                  later[k].p ? (
                    <article key={id} className={styles.card}>
                      {ctx.scholar ? <BookText text={later[k].p!.text} /> : <p className={styles.cardText}>{t("ulum.ahkam.takes")}</p>}
                      <Cite id={id} ctx={ctx} range={later[k].p} />
                    </article>
                  ) : null,
                )}
              </div>
            </Block>
          )}
        </>
      )}
    </Chapter>
  );
}
