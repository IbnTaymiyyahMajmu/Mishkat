import type { NextConfig } from "next";

// The site is exported as plain files: no Node process runs in production, so it
// can be hosted anywhere static — GitHub Pages, Cloudflare Pages, Netlify — for
// nothing. Everything dynamic (verses, tafsir, search, audio) is fetched in the
// browser, and everything personal (bookmarks, notes, settings) stays in it.
//
// BASE_PATH is set when the site is served from a sub-path, as it is on a
// GitHub project page (https://user.github.io/mishkat). Leave it empty for a
// custom domain or a user page.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath || undefined,
  // A static host has no image optimiser to call.
  images: { unoptimized: true },
  // Emit `/surahs/index.html` rather than `/surahs.html`, which is what static
  // hosts expect when they resolve a directory URL.
  trailingSlash: true,
  reactStrictMode: true,
  // Next's dev badge sits in the bottom-left corner, which is where the
  // transport puts play. It never ships — the export has no dev server behind
  // it — but while developing it covers the control it is sitting on.
  devIndicators: false,
};

export default nextConfig;
