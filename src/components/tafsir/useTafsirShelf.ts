"use client";

import { useCallback, useMemo } from "react";
import { tafsirWork, type TafsirWork } from "@/lib/quran/tafsir";
import { useSettings } from "@/lib/store/settings";

/**
 * The reader's tabs: which works they keep to hand, and which they are on.
 *
 * Kept with the settings, so the choice follows them from the panel to the
 * page and from one ayah to the next — a reader working through a surah with
 * al-Qurṭubī open should not have to open him again at every ayah.
 */
export function useTafsirShelf() {
  const { settings, update } = useSettings();
  const shelf = settings.tafsirShelf;

  const works = useMemo(
    () => shelf.map((id) => tafsirWork(id)).filter((w): w is TafsirWork => !!w),
    [shelf],
  );
  const active = tafsirWork(settings.tafsirActive) ?? works[0];

  /** Read this work. One that is not among the tabs yet becomes one. */
  const pick = useCallback(
    (id: string) => {
      if (!tafsirWork(id)) return;
      update({ tafsirActive: id, tafsirShelf: shelf.includes(id) ? shelf : [...shelf, id] });
    },
    [shelf, update],
  );

  /** Keep a work among the tabs, or put it away. The last one stays. */
  const toggle = useCallback(
    (id: string) => {
      if (!shelf.includes(id)) {
        update({ tafsirShelf: [...shelf, id] });
        return;
      }
      const rest = shelf.filter((x) => x !== id);
      if (!rest.length) return;
      update({
        tafsirShelf: rest,
        tafsirActive: settings.tafsirActive === id ? rest[0] : settings.tafsirActive,
      });
    },
    [shelf, settings.tafsirActive, update],
  );

  /** Larger or smaller, a step at a time. */
  const resize = useCallback(
    (direction: 1 | -1) => update({ tafsirScale: settings.tafsirScale + direction * 0.1 }),
    [settings.tafsirScale, update],
  );

  return { shelf, works, active, pick, toggle, scale: settings.tafsirScale, resize };
}
