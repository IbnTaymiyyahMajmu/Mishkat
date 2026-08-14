import type { Metadata, Viewport } from "next";
import {
  Amiri,
  Amiri_Quran,
  Cormorant_Garamond,
  Lora,
  Noto_Naskh_Arabic,
  Scheherazade_New,
} from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { InlineScript } from "@/components/InlineScript";
import { Providers } from "@/components/Providers";

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

export const metadata: Metadata = {
  title: {
    default: "Mishkāt · Read the Qur'an",
    template: "%s · Mishkāt",
  },
  description:
    "Read the Qur'an in full, see every word's meaning and transliteration light up together, open the classical tafsir beside it, write your own notes, and keep your place.",
  applicationName: "Mishkāt",
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
   the same key through useSyncExternalStore, so the two always agree. */
const THEME_BOOTSTRAP = `(function(){try{var s=JSON.parse(localStorage.getItem('mishkat.settings.v1')||'{}');if(s.theme==='day'||s.theme==='night')document.documentElement.dataset.theme=s.theme;if(s.arabicSize)document.documentElement.style.setProperty('--arabic-size',s.arabicSize+'px');}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontVars = [
    cormorant.variable,
    lora.variable,
    amiri.variable,
    amiriQuran.variable,
    scheherazade.variable,
    notoNaskh.variable,
  ].join(" ");

  return (
    <html lang="en" className={fontVars} data-theme="evening" suppressHydrationWarning>
      <head>
        <InlineScript>{THEME_BOOTSTRAP}</InlineScript>
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
