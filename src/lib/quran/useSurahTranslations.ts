"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchSurahTranslation, type TranslatedAyah } from "./api";
import { translationLanguage, translationName } from "./translations";

/** One translation of one ayah, ready to be set under it. */
export interface Rendering extends TranslatedAyah {
  id: number;
  /** The translator, as named under the text. */
  name: string;
  /** `"en"`, `"ur"` — or empty where it is not known. */
  lang: string;
}

interface Layer {
  id: number;
  surah: number;
  name: string;
  /** `null` when it was asked for and could not be had. */
  ayat: Map<string, TranslatedAyah> | null;
}

export interface SurahTranslations {
  /** What is set under each ayah, in the reader's order, by verse key. */
  byVerse: Map<string, Rendering[]>;
  /** The translations still on their way. */
  pending: number[];
  /** The ones that could not be had, so the reader can be told which. */
  failed: number[];
  retry: () => void;
}

const NONE: Rendering[] = [];
/** The same empty list every time, so an ayah with nothing under it yet does
 *  not look changed on every render of the reader. */
export const NO_RENDERINGS = NONE;

/**
 * The reader's translations of a surah, laid over its text.
 *
 * Each is one request and arrives on its own: the first is under the Arabic
 * as soon as it lands, without waiting for the third. Adding a translation
 * fetches that one and nothing else; taking one away fetches nothing. And none
 * of it touches the Arabic, which stays where it is while the English under it
 * changes.
 */
export function useSurahTranslations(surah: number, ids: number[]): SurahTranslations {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [nonce, setNonce] = useState(0);
  const held = useRef(layers);
  useEffect(() => {
    held.current = layers;
  }, [layers]);

  const wanted = ids.join(",");

  useEffect(() => {
    let alive = true;
    const put = (layer: Layer) =>
      alive &&
      setLayers((prev) => [
        // Another surah's translations are let go of here; the corpus client
        // keeps them, so coming back to that surah costs nothing.
        ...prev.filter((l) => l.surah === surah && l.id !== layer.id),
        layer,
      ]);

    for (const id of wanted ? wanted.split(",").map(Number) : []) {
      const have = held.current.find((l) => l.id === id && l.surah === surah);
      if (have?.ayat) continue;
      fetchSurahTranslation(id, surah).then(
        (t) => put({ id, surah, name: t.name, ayat: t.ayat }),
        () => put({ id, surah, name: "", ayat: null }),
      );
    }
    return () => {
      alive = false;
    };
  }, [surah, wanted, nonce]);

  const retry = useCallback(() => {
    setLayers((prev) => prev.filter((l) => l.ayat));
    setNonce((n) => n + 1);
  }, []);

  return useMemo(() => {
    const order = wanted ? wanted.split(",").map(Number) : [];
    const here = (id: number) => layers.find((l) => l.id === id && l.surah === surah);

    const byVerse = new Map<string, Rendering[]>();
    for (const id of order) {
      const layer = here(id);
      if (!layer?.ayat) continue;
      const name = translationName(id) || layer.name;
      const lang = translationLanguage(id);
      for (const [key, ayah] of layer.ayat) {
        const rendering = { id, name, lang, ...ayah };
        const list = byVerse.get(key);
        if (list) list.push(rendering);
        else byVerse.set(key, [rendering]);
      }
    }

    return {
      byVerse,
      pending: order.filter((id) => !here(id)),
      failed: order.filter((id) => here(id)?.ayat === null),
      retry,
    };
  }, [layers, surah, wanted, retry]);
}
