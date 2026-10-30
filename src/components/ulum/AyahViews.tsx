"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchMorph, type SurahMorph } from "@/lib/ulum/corpus";
import { readTabariViews } from "@/lib/ulum/views";
import { useLocale } from "@/lib/i18n";
import { Block, Silent } from "./Chapter";
import { useBook, useNear, type StudyCtx } from "./study";
import { Differences, useViews } from "./Views";
import styles from "./AyahStudy.module.css";

/**
 * Where the scholars differ on an ayah, for a page that is not the ayah study: the
 * tafsir page sets this under whatever work is being read. The books are the same
 * and the block is the same, so a scholar is the same colour on either.
 */

const EMPTY: SurahMorph = { v: 1, surah: 0, ayat: [] } as unknown as SurahMorph;

function Inner({ surah, ayah, morph }: { surah: number; ayah: number; morph: SurahMorph }) {
  const { t } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const near = useNear(ref);
  const key = `${surah}:${ayah}`;
  const ctx = useMemo(
    () =>
      ({
        key,
        surah,
        ayah,
        morph,
        words: (morph.ayat[ayah - 1] ?? []).map((_, i) => ({ i: i + 1 })),
        cite: () => undefined,
      }) as unknown as StudyCtx,
    [key, surah, ayah, morph],
  );
  const tabari = useBook("tabari", ctx, near);
  const zad = useBook("zad-almaseer", ctx, near);
  const tabariViews = useViews(tabari, ctx, readTabariViews);
  const zadViews = useViews(zad, ctx);
  const count = tabariViews.length + zadViews.length;
  return (
    <div className={styles.page} ref={ref}>
      <div className={styles.block}>
        <Block kicker={t("ulum.diff.kicker")} title={t("ulum.diff.title", { count })}>
          {count ? (
            <Differences
              books={[
                { id: "tabari", read: tabari, views: tabariViews },
                { id: "zad-almaseer", read: zad, views: zadViews },
              ]}
              ctx={ctx}
            />
          ) : (
            <Silent>{tabari.loading || zad.loading ? t("ulum.loading") : t("ulum.diff.none")}</Silent>
          )}
        </Block>
      </div>
    </div>
  );
}

export function AyahViews({ surah, ayah }: { surah: number; ayah: number }) {
  const [morph, setMorph] = useState<SurahMorph | null>(null);
  useEffect(() => {
    let alive = true;
    fetchMorph(surah)
      .then((m) => alive && setMorph(m))
      .catch(() => alive && setMorph(EMPTY));
    return () => {
      alive = false;
    };
  }, [surah]);
  if (!morph || morph.surah !== surah) return null;
  return <Inner surah={surah} ayah={ayah} morph={morph} />;
}
