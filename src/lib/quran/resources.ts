import type { Reciter, TranslationResource } from "./types";

/**
 * The translations this build knows by name without asking.
 *
 * The whole catalogue — some 125 translations in seventy languages — is read
 * from the corpus when the library is opened (`translations.ts`), because it
 * changes: translations are added, and withdrawn. These are the well-known
 * English ones, named here for two reasons. They lead their shelf, in this
 * order, so that a reader who has never chosen a translation is not handed a
 * list of a hundred to audit. And they are named as the reader knows them
 * rather than as the corpus files them — "Marmaduke Pickthall", not
 * "M. Pickthall" — before the catalogue has arrived and after.
 */
export const TRANSLATIONS: TranslationResource[] = [
  { id: 20, label: "Saheeh International", short: "Saheeh International" },
  { id: 85, label: "M.A.S. Abdel Haleem", short: "Abdel Haleem" },
  // Not the corpus's any longer: read from files. See `translationFiles.ts`.
  { id: 131, label: "The Clear Qur’an · Mustafa Khattab", short: "Mustafa Khattab" },
  { id: 84, label: "Mufti Taqi Usmani", short: "T. Usmani" },
  { id: 19, label: "Marmaduke Pickthall", short: "M. Pickthall" },
  { id: 22, label: "Abdullah Yusuf Ali", short: "A. Yusuf Ali" },
  { id: 203, label: "al-Hilālī & Khān", short: "Hilālī & Khān" },
  { id: 149, label: "Bridges’ translation · Fadel Soliman", short: "Bridges" },
  { id: 95, label: "Abul Aʿlā Maudūdī · Tafhīm", short: "Maudūdī" },
];

export const DEFAULT_TRANSLATION = 20;

/** How many translations can be set under an ayah at once. */
export const MAX_TRANSLATIONS = 4;

/**
 * The languages the meaning under each word can be given in. These are the
 * ones the corpus has glossed word by word; asked for any other, it answers
 * in English without saying so.
 */
export const GLOSS_LANGUAGES = [
  { id: "en", label: "English" },
  { id: "ur", label: "اردو", name: "Urdu" },
  { id: "bn", label: "বাংলা", name: "Bengali" },
  { id: "hi", label: "हिन्दी", name: "Hindi" },
  { id: "id", label: "Indonesia", name: "Indonesian" },
  { id: "tr", label: "Türkçe", name: "Turkish" },
  { id: "fa", label: "فارسی", name: "Persian" },
  { id: "ta", label: "தமிழ்", name: "Tamil" },
  { id: "inh", label: "ГӀалгӀай", name: "Ingush" },
] as const;

export const DEFAULT_GLOSS_LANGUAGE = "en";

// The works of tafsir are in `tafsir.ts`: they come from three places now, and
// that file is where the three are made into one library.

/**
 * Every reciter here carries word-level timings in the corpus, so recitation
 * can follow the text word by word rather than ayah by ayah.
 *
 * Each is named twice: in Latin letters, and as the name is written. A reader
 * of Pashto or Persian is shown the second — the first is a transliteration
 * of it, made for readers who cannot read the original.
 */
export const RECITERS: Reciter[] = [
  { id: 7, label: "Mishary Rashid al-ʿAfasy", labelArabic: "مشاري راشد العفاسي", timed: true },
  { id: 2, label: "ʿAbd al-Bāsiṭ ʿAbd al-Ṣamad · Murattal", labelArabic: "عبد الباسط عبد الصمد · مرتّل", timed: true },
  { id: 1, label: "ʿAbd al-Bāsiṭ ʿAbd al-Ṣamad · Mujawwad", labelArabic: "عبد الباسط عبد الصمد · مجوّد", timed: true },
  { id: 6, label: "Maḥmūd Khalīl al-Ḥuṣarī", labelArabic: "محمود خليل الحصري", timed: true },
  { id: 12, label: "Maḥmūd Khalīl al-Ḥuṣarī · Muʿallim", labelArabic: "محمود خليل الحصري · معلّم", timed: true },
  { id: 9, label: "Muhammad Ṣiddīq al-Minshāwī", labelArabic: "محمد صديق المنشاوي", timed: true },
  { id: 3, label: "ʿAbd al-Raḥmān al-Sudays", labelArabic: "عبد الرحمن السديس", timed: true },
  { id: 4, label: "Abū Bakr al-Shāṭrī", labelArabic: "أبو بكر الشاطري", timed: true },
  { id: 5, label: "Hānī al-Rifāʿī", labelArabic: "هاني الرفاعي", timed: true },
  { id: 10, label: "Saʿūd al-Shuraym", labelArabic: "سعود الشريم", timed: true },
  { id: 11, label: "Muḥammad al-Ṭablāwī", labelArabic: "محمد الطبلاوي", timed: true },
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
