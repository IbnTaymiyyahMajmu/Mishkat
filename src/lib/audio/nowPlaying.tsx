"use client";

import { useEffect } from "react";
import { useLocale } from "../i18n";
import { useSurahNames } from "../i18n/surah";
import { RECITERS } from "../quran/resources";
import { useSettings } from "../store/settings";
import type { PlayerStatus } from "./player";

/**
 * What the phone says is playing.
 *
 * Once the reader has gone to another app, or put the phone away, the lock
 * screen and the notification shade are all there is of the transport. Left to
 * itself the browser fills them with the title of the tab and the address of
 * the site; told, they say what the transport says — the surah, the ayah, the
 * voice — in the language the site is in, beside the lamp in its niche.
 *
 * The buttons and the place in the surah are the player's business and are
 * set there, beside the element; this is only the words.
 */

/** The mark from icon.svg, drawn large and lit, on the night light's sky. A
 *  bitmap, because a lock screen will not draw an SVG. */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const ARTWORK: MediaImage[] = [
  { src: `${BASE}/now-playing.jpg`, sizes: "512x512", type: "image/jpeg" },
];

export function NowPlaying({ status }: { status: PlayerStatus }) {
  const { open, playing, currentKey, error, echoing } = status;
  const { settings } = useSettings();
  const { t, arabicScript } = useLocale();
  const names = useSurahNames();

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    if (!open || !currentKey) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const reciter = RECITERS.find((r) => r.id === settings.reciterId);
    const voice = reciter ? (arabicScript ? reciter.labelArabic : reciter.label) : t("player.reciter");
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${names.name(Number(currentKey.split(":")[0]))} · ${currentKey}`,
        // The second line is the transport's: the voice, or else what the
        // reader most needs to know without unlocking the phone.
        artist: error ? t(error) : echoing ? t("player.turn") : voice,
        album: t("brand.name"),
        artwork: ARTWORK,
      });
    } catch {
      // A browser with a media session and no MediaMetadata shows its own.
    }
  }, [open, currentKey, error, echoing, settings.reciterId, arabicScript, names, t]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    // Said outright rather than left to be inferred from the element: in the
    // silence after an ayah the element is playing nothing anyone can hear,
    // and in the breath between two ayat it is, for an instant, not playing.
    navigator.mediaSession.playbackState = !open ? "none" : playing ? "playing" : "paused";
  }, [open, playing]);

  // Gone with the player, so a lock screen is not left naming a recitation
  // that has stopped.
  useEffect(
    () => () => {
      if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
    },
    [],
  );

  return null;
}
