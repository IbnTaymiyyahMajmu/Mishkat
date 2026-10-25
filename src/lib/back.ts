"use client";

import { useEffect, useRef } from "react";

/**
 * What Back puts down before it goes anywhere.
 *
 * On a phone, Back is the way out of whatever is in front of you, and a sheet
 * drawn up over the page is in front of it: the search, the menu, the way to
 * an ayah, the study panel, the player's tuning. In the Android app the
 * system's Back went straight to the page before and left the sheet open over
 * it — a search still open on a page it was not opened on. So a sheet, while
 * it is open, puts its own way of closing here, and the app's Back
 * (Shell.java) asks the page to close the one in front before it goes back a
 * page. The one opened last is the one in front, and is put down first.
 *
 * A browser's Back is its history's, and is left alone: a sheet that wrote
 * itself into the history to be closed by it would leave a step behind in it
 * for every sheet ever opened. Where there is a keyboard, Escape is each
 * sheet's own.
 */

const open: (() => void)[] = [];

/** While `shown`, Back closes this by calling `close`. */
export function useClosedByBack(shown: boolean, close: () => void) {
  // The latest, so a sheet can hand in a new function on every render
  // without being taken off the stack and put back on top of it.
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });

  useEffect(() => {
    if (!shown) return;
    const entry = () => latest.current();
    open.push(entry);
    return () => {
      const at = open.lastIndexOf(entry);
      if (at !== -1) open.splice(at, 1);
    };
  }, [shown]);
}

/**
 * Closes the sheet in front, if one is open, and says whether one was. Taken
 * off at once rather than when it has gone, so that a second Back pressed
 * before the first has been drawn goes on to the sheet behind it.
 */
export function closeFront(): boolean {
  const close = open.pop();
  close?.();
  return close !== undefined;
}
