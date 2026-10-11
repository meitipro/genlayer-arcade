#!/usr/bin/env python3
"""
Set the production environment of the linked Vercel project without printing a
secret. Values are piped to `vercel env add` on stdin.

    python scripts/vercel_env.py            # add what is missing
    python scripts/vercel_env.py --force    # replace every value

Secrets (SESSION_SECRET, ADMIN_TOKEN, CRON_SECRET) are generated
once and kept in ~/.genlayer-arcade/vercel-secrets.json, outside the repo, so
the admin token can be read from there. RELAYER_PRIVATE_KEY comes from the
"relayer" account in ~/.genlayer-arcade/accounts.json, the account that
deployed and owns all four contracts. Contract addresses come from
lib/deployment.json. Upstash Redis comes from the Marketplace integration
(KV_REST_API_URL / KV_REST_API_TOKEN), not from here.
"""

from __future__ import annotations

import json
import os
import pathlib
import secrets
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
HOME = pathlib.Path.home() / ".genlayer-arcade"
SECRETS = HOME / "vercel-secrets.json"
SITE = os.environ.get("ARCADE_SITE_URL", "https://genlayergamehub.vercel.app")
# optional names read from ~/.genlayer-arcade/keys.json; anything else in that file is ignored
ALLOWED_EXTRA = ("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_GUILD_ID", "DISCORD_REDIRECT_URI", "TWITTERAPI_KEY")


def vercel() -> list[str]:
    cached = pathlib.Path.home() / "AppData/Local/npm-cache/_npx/69f9afb961c37556/node_modules/.bin/vercel.cmd"
    if cached.exists():
        return [str(cached)]
    found = shutil.which("vercel")
    return [found] if found else ["npx", "--yes", "vercel@latest"]


def main() -> int:
    force = "--force" in sys.argv
    HOME.mkdir(parents=True, exist_ok=True)
    stored = json.loads(SECRETS.read_text(encoding="utf-8")) if SECRETS.exists() else {}
    for name in ("SESSION_SECRET", "ADMIN_TOKEN", "CRON_SECRET"):
        stored.setdefault(name, secrets.token_hex(32))
    SECRETS.write_text(json.dumps(stored, indent=2) + "\n", encoding="utf-8", newline="\n")
    try:
        os.chmod(SECRETS, 0o600)
    except OSError:
        pass

    keys = json.loads((HOME / "accounts.json").read_text(encoding="utf-8"))
    dep = json.loads((ROOT / "lib" / "deployment.json").read_text(encoding="utf-8"))
    values = {
        **stored,
        "RELAYER_PRIVATE_KEY": "0x" + keys["relayer"].removeprefix("0x"),
        "GENLAYER_NETWORK": dep["network"],
        "NEXT_PUBLIC_EXPLORER": dep["explorer"],
        "NEXT_PUBLIC_SITE_URL": SITE,
        **{k: v for k, v in dep["contracts"].items() if v},
    }
    # keys the user hands over by writing them to a file outside the repository
    extra = HOME / "keys.json"
    if extra.exists():
        given = json.loads(extra.read_text(encoding="utf-8"))
        for name in ALLOWED_EXTRA:
            if given.get(name):
                values[name] = str(given[name]).strip()
    listed = subprocess.run([*vercel(), "env", "ls", "production"], cwd=ROOT, capture_output=True, text=True).stdout
    present = {line.split()[0] for line in listed.splitlines() if line.strip() and line.split()[0].isupper()}
    for name, value in values.items():
        if name in present and not force:
            print(f"  {name}: already set")
            continue
        if name in present:
            subprocess.run([*vercel(), "env", "rm", name, "production", "--yes"], cwd=ROOT, capture_output=True, text=True)
        sensitive = name not in ("GENLAYER_NETWORK", "NEXT_PUBLIC_EXPLORER", "NEXT_PUBLIC_SITE_URL", "DISCORD_CLIENT_ID", "DISCORD_GUILD_ID", "DISCORD_REDIRECT_URI") and not name.endswith("_CONTRACT")
        args = [*vercel(), "env", "add", name, "production"]
        if sensitive:
            args.append("--sensitive")
        r = subprocess.run(args, cwd=ROOT, input=value, capture_output=True, text=True)
        ok = r.returncode == 0
        # never echo the CLI output: it could contain the value on some versions
        print(f"  {name}: {'set' if ok else 'FAILED (exit ' + str(r.returncode) + ')'}")
        if not ok:
            return 1
    print(f"secrets kept in {SECRETS} (admin token: ADMIN_TOKEN)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
