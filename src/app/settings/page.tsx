import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/SettingsPage";

export const metadata: Metadata = {
  title: "Reading settings",
  description: "Translation, typography, word-by-word display, reciter and sources.",
};

export default function Settings() {
  return <SettingsPage />;
}
