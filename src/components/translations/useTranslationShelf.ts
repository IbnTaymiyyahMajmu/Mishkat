"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_TRANSLATIONS } from "@/lib/quran/resources";
import { heldCatalogue, loadCatalogue, translationName, type Catalogue } from "@/lib/quran/translations";
import { useSettings } from "@/lib/store/settings";
import { useToast } from "@/components/Toast";
import { useT } from "@/lib/i18n";

/**
 * The catalogue of translations, once it has arrived.
 *
 * Asked for by whichever screen first needs it and shared by the rest: it is
 * one answer for the session, kept by the corpus client for a week after.
 */
export function useCatalogue() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(heldCatalogue);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (catalogue) return;
    let alive = true;
    loadCatalogue().then(
      (c) => alive && setCatalogue(c),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [catalogue, attempt]);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);

  return { catalogue, failed, retry };
}

/** Said once a visit, however many screens notice the same translation gone. */
const announced = new Set<number>();

/**
 * The reader's translations: which are set under each ayah, and in what order.
 *
 * Kept with the settings, so the choice made beside one ayah holds for the
 * next surah, the tafsir page and the next visit.
 *
 * It also keeps the shelf honest. What the corpus offers changes — it stopped
 * carrying The Clear Qur'an, at its publisher's request — and a reader who had
 * chosen what is no longer there was left with nothing under the Arabic and no
 * word as to why. So once the catalogue is in hand, anything on the shelf that
 * is in neither it nor the files this site reads is taken off, and the reader
 * is told which and what they are reading now.
 */
export function useTranslationShelf() {
  const { settings, update } = useSettings();
  const toast = useToast();
  const t = useT();
  const { catalogue, failed, retry } = useCatalogue();
  const ids = settings.translationIds;

  useEffect(() => {
    if (!catalogue) return;
    const gone = ids.filter((id) => !catalogue.byId.has(id));
    if (!gone.length) return;

    const rest = ids.filter((id) => catalogue.byId.has(id));
    const next = rest.length ? rest : [catalogue.fallback];
    update({ translationIds: next });

    const unsaid = gone.filter((id) => !announced.has(id));
    if (!unsaid.length) return;
    unsaid.forEach((id) => announced.add(id));
    toast(
      t("translations.gone", {
        what: translationName(unsaid[0]) || t("translations.goneUnnamed"),
        next: translationName(next[0]) || t("translations.another"),
      }),
      9000,
    );
  }, [catalogue, ids, update, toast, t]);

  /** Set a translation under each ayah, or take it away. The last one stays. */
  const toggle = useCallback(
    (id: number) => {
      if (ids.includes(id)) {
        if (ids.length > 1) update({ translationIds: ids.filter((x) => x !== id) });
        else toast(t("translations.lastOne"), 4200);
        return;
      }
      if (ids.length >= MAX_TRANSLATIONS) {
        toast(t("translations.full", { max: MAX_TRANSLATIONS }), 4200);
        return;
      }
      update({ translationIds: [...ids, id] });
    },
    [ids, update, toast, t],
  );

  /**
   * Read this one first: it leads the shelf, and becomes the translation that
   * bookmarks, notes and the search are made in. One not yet on the shelf is
   * put on it, in place of the last if the shelf is full.
   */
  const lead = useCallback(
    (id: number) => {
      const rest = ids.filter((x) => x !== id);
      update({ translationIds: [id, ...rest].slice(0, MAX_TRANSLATIONS) });
    },
    [ids, update],
  );

  return { ids, catalogue, failed, retry, toggle, lead, full: ids.length >= MAX_TRANSLATIONS };
}
