import type { Metadata } from "next";
import { DailyPage } from "@/components/DailyPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Word Bridge" };

export default function Page() {
  return <DailyPage game="bridge" />;
}
