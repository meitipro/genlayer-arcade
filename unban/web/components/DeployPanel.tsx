"use client";

import { useState } from "react";

import { addressUrl } from "@/lib/network";
import { deployFromWallet, reader } from "@/lib/wallet";
import { TxStatus, type TxView } from "./TxStatus";
import { Ready, useWallet } from "./Wallet";

/**
 * Deploys contracts/unban.py from the visitor's wallet. The file is first
 * validated against the live runtime (rule 21): a wrong runtime header can
 * deploy as ACCEPTED and create nothing.
 */
export function DeployPanel({ current }: { current: string }) {
  const { address, onNetwork } = useWallet();
  const [tx, setTx] = useState<TxView>({});
  const [check, setCheck] = useState("");
  const [made, setMade] = useState("");
  const busy = Boolean(tx.phase && !tx.error && !tx.done);
  const go = async () => {
    try {
      setTx({});
      setCheck("");
      const code = await (await fetch("/api/contract-source")).text();
      const schema: any = await reader().getContractSchemaForCode(code); // eslint-disable-line @typescript-eslint/no-explicit-any
      const methods = Object.keys(schema?.methods ?? {});
      setCheck(`The live runtime accepts the file: ${methods.length} public methods.`);
      const { address: at, hash } = await deployFromWallet(address!, code, (phase, hash) => setTx({ phase, hash }));
      setMade(at);
      setTx({ done: `Deployed at ${at}.`, hash });
    } catch (error) {
      const e = error as { message: string; hash?: string };
      setTx({ error: e.message, hash: e.hash });
    }
  };
  return (
    <div className="card pad" style={{ display: "grid", gap: 14, maxWidth: 720 }}>
      {current ? (
        <p className="muted" style={{ margin: 0 }}>
          This site already reads <a className="mono" href={addressUrl(current)} target="_blank" rel="noreferrer" style={{ color: "var(--amber)" }}>{current}</a>.
          Deploying again makes a separate, empty contract.
        </p>
      ) : (
        <p className="muted" style={{ margin: 0 }}>This site has no contract yet. Deploy one from your wallet; it costs only a fee deposit in test GEN.</p>
      )}
      <Ready />
      <button className="btn solid" style={{ justifySelf: "start" }} disabled={!address || !onNetwork || busy} onClick={go}>Validate and deploy unban.py</button>
      {check ? <div className="note ok">{check}</div> : null}
      <TxStatus tx={tx} onRetry={go} />
      {made ? (
        <div className="note">
          Point the site at it: set <code>NEXT_PUBLIC_UNBAN_CONTRACT={made}</code> in the Vercel project, or write the address into
          <code> unban/deployment.json</code> with <code>python scripts/deploy.py</code>, then redeploy.
        </div>
      ) : null}
    </div>
  );
}
