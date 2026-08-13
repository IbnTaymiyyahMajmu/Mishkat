"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "./Toast";
import { SettingsProvider } from "@/lib/store/settings";
import { ChaptersProvider } from "@/lib/store/chapters";
import { LibraryProvider } from "@/lib/store/library";
import { PlayerProvider } from "@/lib/audio/player";
import { SearchProvider } from "./search/SearchProvider";

/**
 * Session state, outermost first. Settings must be above the player (which
 * reads the reciter and speed) and above the reader (which reads everything).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <ToastProvider>
        <ChaptersProvider>
          <LibraryProvider>
            <PlayerProvider>
              <SearchProvider>{children}</SearchProvider>
            </PlayerProvider>
          </LibraryProvider>
        </ChaptersProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
