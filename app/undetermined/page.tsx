import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { AccentStyle } from "@/components/AccentStyle";

export const metadata: Metadata = { title: "UNDETERMINED (teaser)", description: "A teaser level across three worlds: Ink and Neon, The Vault and Contagion." };

const Teaser = dynamic(() => import("@/components/games/undetermined"));

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <AccentStyle accent="#FF4FD8" />
      <h1 className="text-[28px] font-bold">UNDETERMINED</h1>
      <p className="text-muted">
        A teaser level for a later game, reusing three Arcade worlds: Ink and Neon, The Vault and Contagion. Recover one fragment in each, then reach the gate. Not scored.
      </p>
      <Teaser />
      <ul className="text-sm text-muted">
        <li>Arrow keys or A / D to move, Space or W to jump.</li>
        <li>On a phone: hold the left or right third of the screen to move, tap the middle or swipe up to jump.</li>
        <li>Red spikes send you back to the start of the room.</li>
      </ul>
    </div>
  );
}
