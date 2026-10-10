import type { Metadata } from "next";
import { AdminPanel } from "@/components/AdminPanel";
import bridges from "@/data/bridges.json";
import challenges from "@/data/challenges.json";
import oracles from "@/data/oracles.json";
import { previousSeasonId } from "@/lib/season";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function Admin() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <h1 className="text-[28px] font-bold">Admin</h1>
      <AdminPanel challenges={challenges} bridges={bridges} oracles={oracles.map((o) => o.question)} lastSeason={previousSeasonId()} />
    </div>
  );
}
