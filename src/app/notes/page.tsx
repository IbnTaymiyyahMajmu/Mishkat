import type { Metadata } from "next";
import { NotesPage } from "@/components/notes/NotesPage";

export const metadata: Metadata = {
  title: "Notes",
  description: "Everything you have written against the Qur'an, kept in this browser.",
};

export default function Notes() {
  return <NotesPage />;
}
