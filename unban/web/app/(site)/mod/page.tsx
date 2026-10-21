import { Desk } from "./Desk";

export const metadata = { title: "Moderator desk" };

export default function ModPage() {
  return (
    <div className="wrap pt-12">
      <span className="eyebrow">For moderators</span>
      <h1 className="mt-3 text-[36px] font-bold tracking-tight">Moderator desk</h1>
      <Desk />
    </div>
  );
}
