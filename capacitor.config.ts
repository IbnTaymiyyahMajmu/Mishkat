import type { CapacitorConfig } from "@capacitor/cli";

// The Android app is the site itself, carried inside it. Capacitor puts the
// static export (`out/`) into the app and serves it from https://localhost,
// so every page, the tafsir library and the word timings are on the phone
// and need no server; what the site fetches from elsewhere (verses,
// translations, recitations) it still fetches, exactly as it does in a
// browser. Build it with `npm run android`, which exports the site for the
// app and copies it in — see scripts/build-android.mjs.
//
// The appId is the app's name on Google Play and on the phone, and once an
// app is published under it, it can never change.
const config: CapacitorConfig = {
  appId: "io.github.ibntaymiyyahmajmu.mishkat",
  appName: "Mishkāt",
  webDir: "out",
  plugins: {
    // The page runs under the status bar and the gesture bar and keeps its
    // words clear of them itself: its viewport says viewport-fit=cover in the
    // app's build (scripts/build-android.mjs), and the hint here lets the first
    // frame be laid out that way rather than corrected a frame later. On a
    // WebView too old to draw under the bars, Capacitor keeps the page between
    // them instead, and the app colours the strips (Shell.java).
    SystemBars: { insetsHandling: "css", initialViewportFitValueHint: "cover" },
  },
};

export default config;
