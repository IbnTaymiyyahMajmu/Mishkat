"use client";

import { useEffect, useState } from "react";
import { fiqhPlaces, fiqhSection, shamelaUrl, type FiqhPlace } from "@/lib/ulum/fiqh";
import { useLocale } from "@/lib/i18n";
import { Cite, Deck, Leaves, Silent } from "./Chapter";
import type { StudyCtx } from "./study";
import styles from "./AyahStudy.module.css";

/**
 * The Ḥanbalī column of chapter nine.
 *
 * The other three columns are books that go through the Qurʾān. These two go by
 * the chapters of fiqh, so the column is the places they quote the ayah, in the
 * book's order, each with its heading and printed page. See `src/lib/ulum/fiqh.ts`.
 */

export interface HanbaliRead {
  loading: boolean;
  /** The books could not be reached. */
  failed: boolean;
  places: FiqhPlace[];
}

const WAITING: HanbaliRead = { loading: true, failed: false, places: [] };

/** The places, fetched once `enabled` — when the chapter is near. */
export function useHanbali(ctx: Pick<StudyCtx, "surah" | "ayah">, enabled: boolean): HanbaliRead {
  const key = `${ctx.surah}:${ctx.ayah}`;
  const [got, setGot] = useState<{ key: string; failed: boolean; places: FiqhPlace[] } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fiqhPlaces(ctx.surah, ctx.ayah)
      .then((places) => alive && setGot({ key, failed: false, places }))
      .catch(() => alive && setGot({ key, failed: true, places: [] }));
    return () => {
      alive = false;
    };
  }, [key, enabled, ctx.surah, ctx.ayah]);
  return got && got.key === key ? { loading: false, failed: got.failed, places: got.places } : WAITING;
}

const QUOTATION = /(\{[^{}]*\}\s*\[[^\]]{1,40}\])/;

/** A paragraph as the edition has it, with the quotation of this ayah marked. */
function Quoting({ text, reference }: { text: string; reference: string }) {
  return (
    <p className={styles.bookPara} dir="rtl" lang="ar">
      {text.split(QUOTATION).map((part, i) =>
        i % 2 && part.includes(`[${reference}]`) ? (
          <mark key={i} className={styles.citedAyah}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

function Place({ place, ctx }: { place: FiqhPlace; ctx: StudyCtx }) {
  const { t } = useLocale();
  const [whole, setWhole] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  const [down, setDown] = useState(false);
  const toggle = () => {
    if (whole) return setOpen(!open);
    setDown(false);
    fiqhSection(place.id, place.section)
      .then((paragraphs) => {
        setWhole(paragraphs);
        setOpen(true);
      })
      .catch(() => setDown(true));
  };
  return (
    <div className={styles.fiqhPlace}>
      <div className={styles.fiqhHead} dir="rtl" lang="ar">
        {place.kitab && !place.head.includes(place.kitab) && <span className={styles.fiqhKitab}>{place.kitab}</span>}
        {place.head && <span>{place.head}</span>}
      </div>
      <Leaves lines={open && whole ? whole : [place.text]} render={(text, i) => <Quoting key={i} text={text} reference={place.reference} />} />
      {place.paragraphs > 1 && (
        <button type="button" className={styles.more} onClick={toggle}>
          {open ? t("ulum.less") : t("ulum.more", { count: place.paragraphs - 1 })}
        </button>
      )}
      {down && <Silent>{t("ulum.booksDown")}</Silent>}
      <PlaceCite place={place} ctx={ctx} />
    </div>
  );
}

function PlaceCite({ place, ctx }: { place: FiqhPlace; ctx: StudyCtx }) {
  const { t } = useLocale();
  return (
    <Cite
      id={place.id}
      ctx={ctx}
      where={t("ulum.ahkam.volPage", { vol: place.vol, page: place.page })}
      check={{ href: shamelaUrl(place.id, place.shamela), label: t("ulum.checkShamela") }}
    />
  );
}

export function HanbaliPlaces({ read, ctx }: { read: HanbaliRead; ctx: StudyCtx }) {
  const { t } = useLocale();
  const { places } = read;

  if (read.failed) return <Silent>{t("ulum.booksDown")}</Silent>;
  if (!places.length) return <Silent>{read.loading ? t("ulum.loading") : t("ulum.ahkam.hanbaliSilent")}</Silent>;
  if (!ctx.scholar) {
    return (
      <>
        <p className={styles.cardText}>{t("ulum.ahkam.hanbaliCited", { count: places.length })}</p>
        <PlaceCite place={places[0]} ctx={ctx} />
      </>
    );
  }

  return (
    <>
      <p className={styles.fromBook}>{t("ulum.ahkam.hanbaliNote")}</p>
      <Deck items={places.map((place) => <Place key={`${place.id}${place.section}`} place={place} ctx={ctx} />)} wide />
    </>
  );
}
