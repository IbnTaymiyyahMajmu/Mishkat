import type { Metadata } from "next";
import { PlanPage } from "@/components/plan/PlanPage";

export const metadata: Metadata = {
  title: "Finish the Qur'an",
  description:
    "A plan to finish the Qur'an — in a month, twenty days, ten, seven or three, as the Prophet ﷺ gave the steps, or by a day you choose — cut at the muṣḥaf's own divisions and kept as you read.",
};

export default function Plan() {
  return <PlanPage />;
}
