"use client";

import { useEffect, type RefObject } from "react";
import { ayahIndex, noteRead } from "./store/reading";

/**
 * Notes which ayat have been read on this screen.
 *
 * An ayah is taken to have been read when it has been in view long enough to
 * read it: about a third of a second for each of its words, and never less
 * than a second and a half or more than twenty-five. Scrolling past it on the
 * way to somewhere else does not count; stopping on it does. Time with the
 * page hidden — another tab, a locked phone — is not counted either.
 *
 * Nothing here touches React state. The surah can be thousands of nodes, and
 * reading it must not re-render it: the elements are watched, the seconds are
 * added up in a plain map, and only an ayah that has been read is reported, to
 * the reading log, which keeps it a few seconds later.
 *
 *   root       the element the ayat are in; they are watched against the
 *              screen, which takes in whatever scrolls them
 *   selector   how an ayah is found in it: "[data-verse]" in the reader,
 *              "[data-key]" in the muṣḥaf view
 *   attribute  the attribute holding its key
 *   words      how many words an ayah has, by key
 *   version    anything that changes when more ayat are put on the page
 */
export function useReadingTracker(
  root: RefObject<HTMLElement | null>,
  selector: string,
  attribute: string,
  words: (key: string) => number,
  version: unknown,
) {
  useEffect(() => {
    const scroller = root.current;
    if (!scroller || !("IntersectionObserver" in window)) return;

    /** Seconds each ayah has spent in view so far, and whether it is in view now. */
    const spent = new Map<string, number>();
    const inView = new Set<string>();
    const done = new Set<string>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = (entry.target as HTMLElement).getAttribute(attribute);
          if (!key) continue;
          // An ayah taller than the screen is never mostly visible; it is in
          // view when it fills most of the screen instead.
          const r = entry.intersectionRect;
          const visible =
            entry.isIntersecting &&
            (entry.intersectionRatio >= 0.6 || r.height >= (entry.rootBounds?.height ?? window.innerHeight) * 0.5);
          if (visible) inView.add(key);
          else inView.delete(key);
        }
      },
      { threshold: [0, 0.3, 0.6, 1] },
    );

    for (const el of scroller.querySelectorAll<HTMLElement>(selector)) io.observe(el);

    const TICK = 500;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || !inView.size) return;
      const read: number[] = [];
      for (const key of inView) {
        if (done.has(key)) continue;
        const total = (spent.get(key) ?? 0) + TICK / 1000;
        spent.set(key, total);
        const need = Math.min(25, Math.max(1.5, words(key) * 0.32));
        if (total >= need) {
          done.add(key);
          const i = ayahIndex(key);
          if (i) read.push(i);
        }
      }
      if (read.length) noteRead(read);
    }, TICK);

    return () => {
      clearInterval(timer);
      io.disconnect();
    };
    // `words` is read through on each tick; a new function each render must not restart the watch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, selector, attribute, version]);
}
