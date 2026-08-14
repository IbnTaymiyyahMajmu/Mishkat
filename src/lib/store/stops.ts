/**
 * Where the reader last stopped, kept for each surah separately.
 *
 * This is not the same thing as `lastRead` in the settings store, which is the
 * one place "continue reading" returns to. This is a hundred and fourteen small
 * memories: come back to al-Baqarah a month later and the rail still shows the
 * ayah you got to, whatever you have read since.
 *
 * Read and written as plain functions rather than through a hook. The rail
 * shows where you left off *last time* and must not chase you down the page as
 * you read, so it takes its value once when the surah opens and never
 * subscribes to the writes it is itself making.
 */

const KEY = "mishkat.stops.v1";

type Stops = Record<string, number>;

function read(): Stops {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Stops) : {};
  } catch {
    return {}; // absent, private mode, or hand-edited into nonsense
  }
}

/** The ayah the reader had reached in this surah, or null if they never have. */
export function readStop(surah: number): number | null {
  const at = read()[String(surah)];
  return typeof at === "number" && at > 1 ? at : null;
}

export function writeStop(surah: number, ayah: number): void {
  // Only somewhere actually read counts. Arriving at the head of a surah must
  // not erase the place you left off at last time.
  if (!ayah || ayah <= 1) return;
  try {
    const stops = read();
    stops[String(surah)] = ayah;
    localStorage.setItem(KEY, JSON.stringify(stops));
  } catch {
    /* storage refused; the mark is a convenience, not the reader's data */
  }
}
