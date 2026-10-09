"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "./Toast";
import { SettingsProvider } from "@/lib/store/settings";
import { ChaptersProvider } from "@/lib/store/chapters";
import { LibraryProvider } from "@/lib/store/library";
import { PlayerProvider } from "@/lib/audio/player";
import { SearchProvider } from "./search/SearchProvider";
import { LocaleProvider } from "@/lib/i18n";
import { DocumentTitle } from "@/lib/i18n/follow";

/**
 * Session state, outermost first. Settings must be above the player (which
 * reads the reciter and speed) and above the reader (which reads everything).
 * The language is one of the settings, and sits directly under them: every
 * screen below says what it says through it.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <LocaleProvider>
        <ToastProvider>
          <DocumentTitle />
          <ChaptersProvider>
            <LibraryProvider>
              <PlayerProvider>
                <SearchProvider>{children}</SearchProvider>
              </PlayerProvider>
            </LibraryProvider>
          </ChaptersProvider>
        </ToastProvider>
      </LocaleProvider>
    </SettingsProvider>
  );
}
