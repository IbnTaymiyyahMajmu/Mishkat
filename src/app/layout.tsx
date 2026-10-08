import type { Metadata, Viewport } from "next";
import {
  Amiri,
  Amiri_Quran,
  Cormorant_Garamond,
  Lora,
  Noto_Naskh_Arabic,
  Noto_Sans_Arabic,
  Scheherazade_New,
} from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { InlineScript } from "@/components/InlineScript";
import { Providers } from "@/components/Providers";
import { LOCALE_BOOTSTRAP } from "@/lib/i18n/locales";

/* Self-hosted at build time by next/font: the pages make no request to a font
   CDN, which keeps the reader's visit between them and their host. */
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-cormorant",
  display: "swap",
});
const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-lora",
  display: "swap",
});
const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});
const amiriQuran = Amiri_Quran({
  subsets: ["arabic"],
  weight: ["400"],
  variable: "--font-amiri-quran",
  display: "swap",
});
const scheherazade = Scheherazade_New({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-scheherazade",
  display: "swap",
});
const notoNaskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-naskh",
  display: "swap",
});

/* The face the interface itself is set in where its language is written in
   Arabic script — Pashto, Persian. The two Latin faces above have no such
   letters, and the Naskh is drawn for prose at reading size: at the ten and
   eleven pixels of a label it closes up. This one is drawn for labels. It is
   not preloaded, so a reader of English never fetches it. */
const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "600"],
  variable: "--font-noto-sans-arabic",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Mishkāt · Read the Qur'an",
    template: "%s · Mishkāt",
  },
  description:
    "Read the Qur'an in full, see every word's meaning and transliteration light up together, open the classical tafsir beside it, write your own notes, and keep your place.",
  applicationName: "Mishkāt",
  // The browser is asked not to offer to translate these pages. A machine
  // rendering of a translation of the Qur'an is a third hand on the text, and
  // not one anybody reviewed; the translations here are their translators'.
  // The Quran Foundation asks this of every site that shows its corpus.
  other: { google: "notranslate" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4eee2" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0e10" },
  ],
  width: "device-width",
  initialScale: 1,
};

/* Runs in <head>, synchronously, while the browser is still parsing the
   document — so the reader's light is on the element before anything is
   painted, rather than a frame after React hydrates. The settings store reads
   the same key through useSyncExternalStore, so the two always agree.

   The language is set here too, and for the same reason: see LOCALE_BOOTSTRAP.
   It is tried separately, so that storage which cannot be read still leaves a
   reader with their device's language rather than with none. */
const BOOTSTRAP = `(function(){var d=document.documentElement,s={};try{s=JSON.parse(localStorage.getItem('mishkat.settings.v1')||'{}')||{};if(s.theme==='day'||s.theme==='night')d.dataset.theme=s.theme;if(s.arabicSize)d.style.setProperty('--arabic-size',s.arabicSize+'px');}catch(e){s={}}try{${LOCALE_BOOTSTRAP}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [
    cormorant.variable,
    lora.variable,
    amiri.variable,
    amiriQuran.variable,
    scheherazade.variable,
    notoNaskh.variable,
    notoSansArabic.variable,
  ].join(" ");

  return (
    <html lang="en" className={fontVars} data-theme="evening" suppressHydrationWarning>
      <head>
        <InlineScript>{BOOTSTRAP}</InlineScript>
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
