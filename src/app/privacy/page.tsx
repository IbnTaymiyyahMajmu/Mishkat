import type { Metadata } from "next";
import { PrivacyPage } from "@/components/privacy/PrivacyPage";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Mishkāt has no accounts, no analytics, no advertising and no tracking: what is kept on your device, what is asked for from elsewhere, and what the Android app asks of your phone.",
};

export default function Privacy() {
  return <PrivacyPage />;
}
