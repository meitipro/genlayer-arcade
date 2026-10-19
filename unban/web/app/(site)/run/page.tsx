import { Runner } from "@/components/Runner";
import golden from "@/generated/golden.json";
import { CONTRACT } from "@/lib/deployment";
import type { Golden } from "@/lib/runner";

export const metadata = { title: "Run the evidence" };

export default function RunPage() {
  return (
    <section className="wrap" style={{ paddingTop: 40, display: "grid", gap: 16 }}>
      <span className="eyebrow">Evidence</span>
      <h1 style={{ margin: 0, fontSize: 36 }}>Deploy and prove it, from this page</h1>
      <p className="muted" style={{ margin: 0, maxWidth: 720 }}>
        This runs the same steps as the repository&apos;s scripts, in your browser: deploy contracts/unban.py, walk the reviewer&apos;s path
        to finality, run the sealed golden cases through real consensus, and seed two courts. It uses fresh test accounts funded by
        Studio&apos;s faucet that exist only in this tab. Every verdict is read back from the chain; nothing is filled in by hand.
      </p>
      <Runner current={CONTRACT} golden={golden as unknown as Golden & { seal: string }} />
    </section>
  );
}
