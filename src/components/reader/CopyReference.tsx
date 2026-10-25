"use client";

import { useEffect, useState } from "react";
import { useCopy } from "@/components/Toast";
import { useT } from "@/lib/i18n";
import { useSurahNames } from "@/lib/i18n/surah";
import styles from "./CopyReference.module.css";

/**
 * An ayah's reference, which copies itself.
 *
 * What it puts on the clipboard is the ayah as it is cited — the surah's name,
 * the surah's number and the ayah's: "Al-Kahf 18:10" — and nothing besides: not
 * the Arabic, not a translation, not a link, which each have a button of their
 * own. It is the line a reader writes in a message, or at the head of a note,
 * when what they mean is "this ayah".
 *
 * It is the reference already standing at the head of the ayah, made to be
 * pressed, rather than a ninth mark in a row of eight: a reader looking for
 * the way to copy "18:10" finds it on "18:10". The name is the one the reader
 * reads the surah by — "Al-Kahf" in English, الكهف in every other language
 * (lib/i18n/surah.ts) — so what they paste is what they saw.
 */
export function CopyReference({ verseKey, className = "" }: { verseKey: string; className?: string }) {
  const copy = useCopy();
  const t = useT();
  const names = useSurahNames();
  const [copied, setCopied] = useState(false);

  // Ticked for as long as it takes to see it, and back.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const reference = `${names.name(Number(verseKey.split(":")[0]))} ${verseKey}`;
  const label = t("verse.copyReference", { ref: reference });

  return (
    <button
      type="button"
      className={`${styles.ref} ${copied ? styles.done : ""} ${className}`}
      onClick={async () => setCopied(await copy(reference, t("toast.referenceCopied", { ref: reference })))}
      title={label}
      aria-label={label}
    >
      {verseKey}
      {/* A clipboard, and once the reference is on it, a clipboard ticked. */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        {copied && <path d="m9 14 2 2 4-4" />}
      </svg>
    </button>
  );
}
