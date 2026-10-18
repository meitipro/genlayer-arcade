import { DeployPanel } from "@/components/DeployPanel";
import { CONTRACT } from "@/lib/deployment";

export const metadata = { title: "Deploy" };

export default function Deploy() {
  return (
    <section className="wrap" style={{ paddingTop: 40, display: "grid", gap: 16 }}>
      <span className="eyebrow">Deploy</span>
      <h1 style={{ margin: 0, fontSize: 36 }}>Deploy the Unban contract</h1>
      <p className="muted" style={{ margin: 0, maxWidth: 680 }}>
        One contract holds every court. This page sends the exact file in the repository, contracts/unban.py, to Studio Next from your
        own wallet. No key ever reaches this server.
      </p>
      <DeployPanel current={CONTRACT} />
    </section>
  );
}
