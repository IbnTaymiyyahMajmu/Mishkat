import type { Metadata } from "next";
import { BookmarksPage } from "@/components/bookmarks/BookmarksPage";

export const metadata: Metadata = {
  title: "Bookmarks",
  description: "The ayat you saved, stored on this device only.",
};

export default function Bookmarks() {
  return <BookmarksPage />;
}
