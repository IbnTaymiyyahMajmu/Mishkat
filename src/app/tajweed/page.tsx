import type { Metadata } from "next";
import { TajweedGuide } from "@/components/tajweed/TajweedGuide";

export const metadata: Metadata = {
  title: "Tajweed",
  description:
    "The rules of reciting the Qur'an as colours — what to hold, what goes through the nose, what bounces, what runs into the next letter and what is not said — with the words they are met in, a count to keep time with, and the signs for stopping.",
};

export default function Tajweed() {
  return <TajweedGuide />;
}
