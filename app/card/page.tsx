import type { Metadata } from "next";
import { MyCard } from "@/components/MyCard";

export const metadata: Metadata = { title: "My Card" };

export default function CardPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-[28px] font-bold">My Card</h1>
        <p className="text-muted">Your GenLayer identity in the arcade: your Discord roles from the GenLayer server, the tier they give, an optional X account, and your arcade standing.</p>
      </div>
      <MyCard />
    </div>
  );
}
