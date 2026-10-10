// The Community tab: games reviewed PLAYABLE on-chain, then every review with its verdict.
import { addressUrl, txUrl } from "@/lib/explorer";
import { COMMUNITY } from "@/lib/games";
import { chainBusy } from "@/lib/daily";
import { listReviews, reviewAddress, type Review } from "@/lib/community";
import { SubmitGame } from "./SubmitGame";

const LABEL_CLASS: Record<string, string> = { PLAYABLE: "text-accent", NOT_A_GAME: "text-muted", UNREACHABLE: "text-danger" };

export async function CommunityList() {
  let reviews: Review[] = [];
  let error = "";
  try {
    reviews = await listReviews();
  } catch (e) {
    error = chainBusy(e);
  }
  const listed = reviews.filter((r) => r.listed);
  const address = reviewAddress();
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        {error && <p className="card p-4 text-sm text-danger">{error}</p>}
        {listed.length === 0 && COMMUNITY.length === 0 ? (
          <p className="card p-5 text-muted">No community game is listed yet. Submit the first one below.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMMUNITY.map((c) => (
              <li key={c.href} className="card space-y-2 p-4">
                <a href={c.href} target="_blank" rel="noreferrer" className="font-semibold hover:text-accent">
                  {c.title}
                </a>
                <p className="text-sm text-muted">{c.blurb}</p>
              </li>
            ))}
            {listed.map((r) => (
              <li key={r.id} className="card flex flex-col gap-2 p-4">
                <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold hover:text-accent">
                  {r.title}
                </a>
                <p className="mono truncate text-xs text-muted">{r.url.replace(/^https:\/\//, "")}</p>
                <p className="text-sm text-muted">{r.reason}</p>
                <p className="mono mt-auto flex items-center gap-2 text-xs">
                  <span className="text-accent">PLAYABLE</span>
                  <span className="text-muted">by {r.player}</span>
                  {r.hash && (
                    <a href={txUrl(r.hash)} target="_blank" rel="noreferrer" className="ml-auto text-accent">
                      EXPLORER
                    </a>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SubmitGame />

      {reviews.length > 0 && (
        <section className="space-y-3" aria-labelledby="all-reviews">
          <h2 id="all-reviews" className="text-xl font-semibold">
            Every review
          </h2>
          <ul className="space-y-2">
            {reviews.map((r) => (
              <li key={r.id} className="card flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
                <span className="mono text-muted">#{r.id}</span>
                <span className="font-semibold">{r.title}</span>
                <span className={`mono text-xs ${LABEL_CLASS[r.label] ?? ""}`}>{r.delisted ? "DELISTED" : r.label}</span>
                <span className="w-full text-muted sm:w-auto sm:flex-1">{r.delisted ? `delisted: ${r.delisted}` : r.reason}</span>
                {r.hash && (
                  <a href={txUrl(r.hash)} target="_blank" rel="noreferrer" className="mono text-xs text-accent">
                    EXPLORER
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {address && (
        <a href={addressUrl(address)} target="_blank" rel="noreferrer" className="mono block break-all text-xs text-muted hover:text-text">
          GameReview contract {address}
        </a>
      )}
    </div>
  );
}
