import type { Reciter, TafsirResource, TranslationResource } from "./types";

/**
 * The works this build is connected to. Each entry is a deliberate editorial
 * choice, not the whole catalogue the corpus offers: the reader is asked to
 * pick between a handful of well-known translations rather than to audit a
 * list of a hundred. Adding a work is a one-line change here.
 */
export const TRANSLATIONS: TranslationResource[] = [
  { id: 20, label: "Saheeh International", short: "Saheeh International" },
  { id: 85, label: "M.A.S. Abdel Haleem", short: "Abdel Haleem" },
  { id: 131, label: "The Clear Qur’an · Khattab", short: "Mustafa Khattab" },
  { id: 84, label: "Mufti Taqi Usmani", short: "T. Usmani" },
  { id: 19, label: "Marmaduke Pickthall", short: "M. Pickthall" },
  { id: 22, label: "Abdullah Yusuf Ali", short: "A. Yusuf Ali" },
];

export const DEFAULT_TRANSLATION = 20;

export const TAFSIRS: TafsirResource[] = [
  { id: 169, name: "Tafsīr Ibn Kathīr (abridged)", author: "Ismāʿīl ibn Kathīr (d. 774 AH)", lang: "en" },
  { id: 168, name: "Maʿārif al-Qurʾān", author: "Mufti Muhammad Shafi (d. 1976)", lang: "en" },
  { id: 817, name: "Tazkirul Qurʾān", author: "Wahiduddin Khan (d. 2021)", lang: "en" },
  { id: 91, name: "Taysīr al-Karīm al-Raḥmān", author: "ʿAbd al-Raḥmān al-Saʿdī (d. 1376 AH)", lang: "ar" },
  { id: 15, name: "Jāmiʿ al-bayān", author: "Muḥammad ibn Jarīr al-Ṭabarī (d. 310 AH)", lang: "ar" },
  { id: 90, name: "al-Jāmiʿ li-aḥkām al-Qurʾān", author: "Muḥammad al-Qurṭubī (d. 671 AH)", lang: "ar" },
  { id: 16, name: "al-Tafsīr al-Muyassar", author: "King Fahd Complex", lang: "ar" },
];

export const DEFAULT_TAFSIRS = [169];

/**
 * Every reciter here carries word-level timings in the corpus, so recitation
 * can follow the text word by word rather than ayah by ayah.
 */
export const RECITERS: Reciter[] = [
  { id: 7, label: "Mishary Rashid al-ʿAfasy", timed: true },
  { id: 2, label: "ʿAbd al-Bāsiṭ ʿAbd al-Ṣamad · Murattal", timed: true },
  { id: 1, label: "ʿAbd al-Bāsiṭ ʿAbd al-Ṣamad · Mujawwad", timed: true },
  { id: 6, label: "Maḥmūd Khalīl al-Ḥuṣarī", timed: true },
  { id: 12, label: "Maḥmūd Khalīl al-Ḥuṣarī · Muʿallim", timed: true },
  { id: 9, label: "Muhammad Ṣiddīq al-Minshāwī", timed: true },
  { id: 3, label: "ʿAbd al-Raḥmān al-Sudays", timed: true },
  { id: 4, label: "Abū Bakr al-Shāṭrī", timed: true },
  { id: 5, label: "Hānī al-Rifāʿī", timed: true },
  { id: 10, label: "Saʿūd al-Shuraym", timed: true },
  { id: 11, label: "Muḥammad al-Ṭablāwī", timed: true },
];

export const DEFAULT_RECITER = 7;

/**
 * Arabic typefaces the reader can choose between. All three are self-hosted by
 * next/font, so switching one costs no network request.
 */
export const ARABIC_FONTS = [
  { id: "amiri-quran", label: "Amiri Qur’an", varName: "--font-amiri-quran" },
  { id: "scheherazade", label: "Scheherazade New", varName: "--font-scheherazade" },
  { id: "noto-naskh", label: "Noto Naskh", varName: "--font-noto-naskh" },
] as const;

export type ArabicFontId = (typeof ARABIC_FONTS)[number]["id"];

export function arabicFontStack(id: string): string {
  const f = ARABIC_FONTS.find((x) => x.id === id) ?? ARABIC_FONTS[0];
  return `var(${f.varName}), serif`;
}
