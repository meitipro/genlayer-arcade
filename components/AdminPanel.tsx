"use client";
import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/client/player";
import { txUrl } from "@/lib/explorer";
import { EventsPanel, ReviewsPanel } from "./AdminExtras";

type Sent = { action: string; game?: string; hash: string; detail?: string; at?: string };
type Props = { challenges: { challenge: string; criteria: string }[]; bridges: { start: string; end: string }[]; oracles: string[]; lastSeason: string };

const ARCADE = ["validator-run", "consensus-stack", "leader-rotation", "equivalence", "chain-snake", "appeal-breaker", "sky-hop", "fee-flap", "whack-a-node", "node-defender", "stake-merge"];

export function AdminPanel({ challenges, bridges, oracles, lastSeason }: Props) {
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Sent[]>([]);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [rounds, setRounds] = useState<Record<string, { id?: string; open?: boolean; state?: string } | null>>({});

  useEffect(() => {
    try {
      setToken(sessionStorage.getItem("arcade.admin") ?? "");
    } catch {
      /* no storage */
    }
  }, []);

  const call = useCallback(
    async (action: string, body: Record<string, unknown> = {}) => {
      setBusy(true);
      setMsg("");
      const r = await postJson<Record<string, unknown>>(`/api/admin/${action}`, body, { "x-admin-token": token });
      setBusy(false);
      if (!r.ok) {
        setMsg(`${action}: ${r.data.error ?? r.status}`);
        return null;
      }
      return r.data;
    },
    [token],
  );

  const refresh = useCallback(async () => {
    const out: typeof rounds = {};
    for (const g of ["verdict", "bridge", "oracle"]) {
      const d = await fetch(`/api/daily/${g}/round`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
      out[g] = d.round ?? null;
    }
    setRounds(out);
    const l = await call("log");
    if (l) setLog((l.log as Sent[]) ?? []);
  }, [call]);

  async function act(action: string, body: Record<string, unknown> = {}) {
    const d = await call(action, body);
    if (!d) return;
    const sent = (Array.isArray(d.sent) ? d.sent : d.sent ? [d.sent] : []) as Sent[];
    const extra = d.skipped ? ` Skipped: ${(d.skipped as string[]).join("; ")}` : d.removed !== undefined ? ` Removed ${d.removed} entries.` : "";
    setMsg(`${action}: sent ${sent.length} transaction${sent.length === 1 ? "" : "s"}.${extra}`);
    void refresh();
  }

  async function check(hash: string) {
    const d = await call("tx", { hash });
    if (d) setStatus((s) => ({ ...s, [hash]: `${d.status}${d.result ? ` ${d.result}` : ""}${d.error ? `: ${d.error}` : ""}` }));
  }

  return (
    <div className="space-y-6">
      <form
        className="card flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            sessionStorage.setItem("arcade.admin", token);
          } catch {
            /* ignore */
          }
          void refresh();
        }}
      >
        <label className="min-w-64 flex-1">
          <span className="text-sm text-muted">Admin token</span>
          <input className="field mono" type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
        </label>
        <button className="btn btn-primary">Load</button>
      </form>
      {msg && (
        <p className="card p-3 text-sm" role="status">
          {msg}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Daily Verdict" round={rounds.verdict}>
          <PackOpen
            label="Challenge"
            options={challenges.map((c) => c.challenge)}
            onOpen={(index) => act("open", { game: "verdict", index })}
            busy={busy}
          />
          <CustomVerdict onOpen={(challenge, criteria) => act("open", { game: "verdict", challenge, criteria })} busy={busy} />
          {rounds.verdict?.id && rounds.verdict.open && (
            <button className="btn btn-ghost w-full" disabled={busy} onClick={() => act("close", { game: "verdict", round: rounds.verdict!.id })}>
              Close round {rounds.verdict.id}
            </button>
          )}
        </Panel>
        <Panel title="Word Bridge" round={rounds.bridge}>
          <PackOpen label="Pair" options={bridges.map((b) => `${b.start} to ${b.end}`)} onOpen={(index) => act("open", { game: "bridge", index })} busy={busy} />
          {rounds.bridge?.id && rounds.bridge.open && (
            <button className="btn btn-ghost w-full" disabled={busy} onClick={() => act("close", { game: "bridge", round: rounds.bridge!.id })}>
              Close round {rounds.bridge.id}
            </button>
          )}
        </Panel>
        <Panel title="Oracle Guess" round={rounds.oracle}>
          <PackOpen label="Question" options={oracles} onOpen={(index) => act("open", { game: "oracle", index })} busy={busy} />
          {rounds.oracle?.id && rounds.oracle.state === "open" && (
            <button className="btn btn-ghost w-full" disabled={busy} onClick={() => act("lock", { round: rounds.oracle!.id })}>
              Lock round {rounds.oracle.id}
            </button>
          )}
          {rounds.oracle?.id && rounds.oracle.state === "locked" && (
            <button className="btn btn-ghost w-full" disabled={busy} onClick={() => act("resolve", { round: rounds.oracle!.id })}>
              Resolve round {rounds.oracle.id}
            </button>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Schedules">
          <p className="text-sm text-muted">The crons run these at 00:00 and 18:00 UTC. Run them by hand if a cron missed.</p>
          <button className="btn btn-ghost w-full" disabled={busy} onClick={() => act("rollover")}>
            Run 00:00 rollover
          </button>
          <button className="btn btn-ghost w-full" disabled={busy} onClick={() => act("deadline")}>
            Run 18:00 Oracle deadline
          </button>
        </Panel>
        <Panel title="Seasons and moderation">
          <SeasonForm lastSeason={lastSeason} busy={busy} onFinalize={(season) => act("finalize-season", { season })} />
          <RemoveForm busy={busy} onRemove={(game, player, season) => act("remove-score", { game, player, season })} />
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <EventsPanel token={token} />
        <ReviewsPanel token={token} />
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Admin transactions</h2>
          <button className="text-sm text-muted hover:text-text" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        {log.length === 0 ? (
          <p className="text-sm text-muted">Nothing sent yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {log.map((l) => (
              <li key={l.hash} className="flex flex-wrap items-center gap-3">
                <span className="mono text-xs text-muted">{l.at?.slice(5, 16).replace("T", " ")}</span>
                <span>
                  {l.game} {l.action}
                </span>
                <span className="truncate text-muted">{l.detail}</span>
                <span className="mono text-xs text-accent">{status[l.hash]}</span>
                <button className="mono ml-auto text-xs text-muted hover:text-text" onClick={() => void check(l.hash)}>
                  STATUS
                </button>
                <a className="mono text-xs text-accent" href={txUrl(l.hash)} target="_blank" rel="noreferrer">
                  EXPLORER
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Panel({ title, round, children }: { title: string; round?: { id?: string; open?: boolean; state?: string } | null; children: React.ReactNode }) {
  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        {round !== undefined && (
          <span className="mono text-xs text-muted">
            {round?.id ? `#${round.id} ${round.state ?? (round.open ? "open" : "closed")}` : "no round"}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function PackOpen({ label, options, onOpen, busy }: { label: string; options: string[]; onOpen: (i: number) => void; busy: boolean }) {
  const [i, setI] = useState(0);
  return (
    <div className="space-y-2">
      <label className="block text-sm text-muted">
        {label} from the content pack
        <select className="field mt-1 text-sm" value={i} onChange={(e) => setI(Number(e.target.value))}>
          {options.map((o, k) => (
            <option key={k} value={k}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <button className="btn btn-primary w-full" disabled={busy} onClick={() => onOpen(i)}>
        Open round
      </button>
    </div>
  );
}

function CustomVerdict({ onOpen, busy }: { onOpen: (c: string, k: string) => void; busy: boolean }) {
  const [c, setC] = useState("");
  const [k, setK] = useState("");
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted">Custom challenge</summary>
      <div className="mt-2 space-y-2">
        <input className="field text-sm" placeholder="challenge" value={c} onChange={(e) => setC(e.target.value)} maxLength={400} />
        <input className="field text-sm" placeholder="criteria" value={k} onChange={(e) => setK(e.target.value)} maxLength={800} />
        <button className="btn btn-ghost w-full" disabled={busy || !c.trim()} onClick={() => onOpen(c, k)}>
          Open custom round
        </button>
      </div>
    </details>
  );
}

function SeasonForm({ lastSeason, busy, onFinalize }: { lastSeason: string; busy: boolean; onFinalize: (s: string) => void }) {
  const [s, setS] = useState(lastSeason);
  return (
    <div className="flex gap-2">
      <input className="field mono text-sm" value={s} onChange={(e) => setS(e.target.value)} aria-label="Season" />
      <button className="btn btn-primary" disabled={busy} onClick={() => onFinalize(s)}>
        Finalize
      </button>
    </div>
  );
}

function RemoveForm({ busy, onRemove }: { busy: boolean; onRemove: (g: string, p: string, s?: string) => void }) {
  const [g, setG] = useState(ARCADE[0]);
  const [p, setP] = useState("");
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <select className="field text-sm" value={g} onChange={(e) => setG(e.target.value)} aria-label="Game">
          {ARCADE.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input className="field mono text-sm" placeholder="player" value={p} onChange={(e) => setP(e.target.value)} />
      </div>
      <button className="btn btn-ghost w-full" disabled={busy || !p} onClick={() => confirm(`Remove ${p} from the ${g} boards?`) && onRemove(g, p)}>
        Remove score
      </button>
    </div>
  );
}
