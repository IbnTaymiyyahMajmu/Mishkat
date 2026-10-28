"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * A sideways stroke of the finger, read as "the next one" or "the one before".
 *
 * On a phone a row of works is a strip that has to be scrolled, and a reader
 * at the foot of a long passage is a long way from it. A stroke across the
 * passage itself is where their thumb already is. It is read only from a
 * finger — a mouse dragging across text is selecting it — and only when the
 * stroke is plainly sideways: a reader scrolling down a page never moves
 * straight down, and a stroke that is mostly down is theirs.
 *
 * Two places a stroke is not this one's. The edges of the screen, where the
 * device's own back gesture starts. And any stretch of text the reader has
 * selected, because a finger dragging a selection's handle is not turning a
 * page.
 *
 * Which way is "next" follows the way the page is read: on a page read right
 * to left, the next thing is to the left, and is brought in by a stroke to the
 * right.
 */
export function useSwipe(onSwipe: (to: "next" | "prev") => void, enabled = true) {
  const handler = useRef(onSwipe);
  useEffect(() => {
    handler.current = onSwipe;
  }, [onSwipe]);

  const node = useRef<HTMLElement | null>(null);
  const detach = useRef<(() => void) | null>(null);

  const attach = useCallback(
    (el: HTMLElement | null) => {
      detach.current?.();
      detach.current = null;
      node.current = el;
      if (!el || !enabled) return;

      let start: { x: number; y: number; at: number } | null = null;
      const EDGE = 28;

      const down = (e: TouchEvent) => {
        if (e.touches.length !== 1) {
          start = null;
          return;
        }
        const t = e.touches[0];
        start = t.clientX < EDGE || t.clientX > window.innerWidth - EDGE ? null : { x: t.clientX, y: t.clientY, at: e.timeStamp };
      };
      const up = (e: TouchEvent) => {
        const from = start;
        start = null;
        if (!from || e.changedTouches.length !== 1) return;
        if (String(window.getSelection?.() ?? "").length > 0) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - from.x;
        const dy = t.clientY - from.y;
        if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.8 || e.timeStamp - from.at > 900) return;
        const rtl = getComputedStyle(el).direction === "rtl";
        handler.current((dx < 0) !== rtl ? "next" : "prev");
      };
      const cancel = () => {
        start = null;
      };

      el.addEventListener("touchstart", down, { passive: true });
      el.addEventListener("touchend", up, { passive: true });
      el.addEventListener("touchcancel", cancel, { passive: true });
      detach.current = () => {
        el.removeEventListener("touchstart", down);
        el.removeEventListener("touchend", up);
        el.removeEventListener("touchcancel", cancel);
      };
    },
    [enabled],
  );

  useEffect(() => () => detach.current?.(), []);
  return attach;
}

/**
 * Whether the screen is at most this wide, kept true as it is resized. Before
 * the page is in a browser it is not, as the server has no screen.
 */
export function useNarrow(width: number): boolean {
  const query = `(max-width: ${width}px)`;
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
