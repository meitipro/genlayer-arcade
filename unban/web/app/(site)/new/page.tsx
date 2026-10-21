import { NewCourt } from "./NewCourt";

export const metadata = { title: "Open a court" };

export default function NewPage() {
  return (
    <div className="wrap pt-12">
      <span className="eyebrow">Open a court</span>
      <h1 className="mt-3 text-[36px] font-bold tracking-tight">Write the rules once</h1>
      <p className="mt-3 max-w-2xl text-[15px] text-[var(--ink-2)]">
        Up to twelve numbered rules, a ladder of up to six penalties, the moderators who answer, the fee, the compensation,
        the response window and the first pool funding. Start from the template and change what does not fit.
      </p>
      <NewCourt />
    </div>
  );
}
