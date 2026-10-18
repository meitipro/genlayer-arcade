import { OpenCourtForm } from "@/components/OpenCourtForm";
import { Unavailable } from "@/components/Unavailable";
import { CONTRACT, deployed } from "@/lib/deployment";

export const metadata = { title: "Open a court" };

export default function NewCourt() {
  return (
    <section className="wrap" style={{ paddingTop: 40, display: "grid", gap: 20 }}>
      <div>
        <span className="eyebrow">Open a court</span>
        <h1 style={{ margin: "6px 0 0", fontSize: 36 }}>Write the rules once</h1>
        <p className="muted" style={{ margin: "8px 0 0", maxWidth: 680 }}>
          Numbered rules, a penalty ladder, the moderators who may answer, the appeal fee, the compensation and the response window.
          Rules freeze while an appeal is open, and a change applies only to bans dated after it.
        </p>
      </div>
      {deployed ? <OpenCourtForm contract={CONTRACT} /> : <Unavailable message="The contract this site writes to has not been deployed yet." deployLink />}
    </section>
  );
}
