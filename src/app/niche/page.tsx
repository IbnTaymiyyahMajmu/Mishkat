import type { Metadata } from "next";
import { NichePage } from "@/components/niche/NichePage";

export const metadata: Metadata = {
  title: "Your niche",
  description:
    "A niche lit by your reading, after the ayah of light: a tile for every day you read, a medallion on the lamp for every juzʾ, and another lamp hung each time you finish the Qur'an.",
};

export default function Niche() {
  return <NichePage />;
}
