# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
OracleGuess (BUILD_SPEC section 14). Players lock in a whole number about a
live value. Guesses are plain deterministic writes. At the deadline the owner
locks the round and calls resolve: the leader fetches the JSON source and
walks the path to a number, each validator re-fetches and must land within
1%, then the ranking is computed deterministically. Earlier guesses win ties.
Only the owner sets the URL, so players can never point the contract at a
page they control.
"""
from genlayer import *

import json
import re

NAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,20}$")
MAX_GUESSES = 1000


class OracleGuess(gl.Contract):
    owner: Address
    round_count: u256
    rounds: TreeMap[str, str]   # rid -> {question, url, path, unit, state, answer}
    guesses: TreeMap[str, str]  # rid -> JSON object {player: int}, insertion ordered
    results: TreeMap[str, str]  # rid -> JSON ranked list

    def __init__(self):
        self.owner = gl.message.sender_address
        self.round_count = 0

    def _only_owner(self):
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("[EXPECTED] not owner")

    def _round(self, rid: str) -> dict:
        if rid not in self.rounds:
            raise gl.vm.UserError("[EXPECTED] unknown round")
        return json.loads(self.rounds[rid])

    @gl.public.write
    def open_round(self, question: str, url: str, path: str, unit: str) -> str:
        # url and path are set by the owner only, never by players
        self._only_owner()
        if not url.startswith("https://"):
            raise gl.vm.UserError("[EXPECTED] https only")
        self.round_count += 1
        rid = str(self.round_count)
        self.rounds[rid] = json.dumps({
            "question": question[:200], "url": url, "path": path,
            "unit": unit[:12], "state": "open", "answer": None,
        })
        self.guesses[rid] = "{}"
        return rid

    @gl.public.write
    def lock_round(self, rid: str):
        self._only_owner()
        r = self._round(rid)
        if r["state"] != "open":
            raise gl.vm.UserError("[EXPECTED] not open")
        r["state"] = "locked"
        self.rounds[rid] = json.dumps(r)

    @gl.public.write
    def guess(self, rid: str, player: str, value: int):
        r = self._round(rid)
        if r["state"] != "open":
            raise gl.vm.UserError("[EXPECTED] guessing closed")
        if not NAME_RE.match(player):
            raise gl.vm.UserError("[EXPECTED] bad player name")
        g = json.loads(self.guesses[rid])
        if player in g:
            raise gl.vm.UserError("[EXPECTED] already guessed")
        if len(g) >= MAX_GUESSES:
            raise gl.vm.UserError("[EXPECTED] round full")
        if value < -1000000000 or value > 1000000000:
            raise gl.vm.UserError("[EXPECTED] value out of range")
        g[player] = int(value)
        self.guesses[rid] = json.dumps(g)

    @gl.public.write
    def resolve(self, rid: str):
        self._only_owner()
        r = self._round(rid)
        if r["state"] != "locked":
            raise gl.vm.UserError("[EXPECTED] lock the round first")
        url, path = r["url"], r["path"]

        def fetch() -> int:
            resp = gl.nondet.web.get(url)
            data = json.loads(resp.body)
            for k in path.split("."):
                data = data[int(k)] if isinstance(data, list) else data[k]
            return int(round(float(data)))

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            mine = fetch()
            theirs = int(leader_result.calldata)
            if theirs == 0:
                return mine == 0
            return abs(mine - theirs) / abs(theirs) <= 0.01

        answer = int(gl.vm.run_nondet_unsafe(fetch, validator_fn))

        g = json.loads(self.guesses[rid])
        ranked = [{"player": p, "guess": v, "off": abs(v - answer)} for p, v in g.items()]
        ranked.sort(key=lambda x: x["off"])  # stable sort: earlier guess wins ties

        r["state"] = "resolved"
        r["answer"] = answer
        self.rounds[rid] = json.dumps(r)
        self.results[rid] = json.dumps(ranked[:100])

    @gl.public.view
    def get_latest_round_id(self) -> str:
        return str(self.round_count)

    @gl.public.view
    def get_round(self, rid: str) -> str:
        if rid not in self.rounds:
            return "{}"
        r = json.loads(self.rounds[rid])
        r["id"] = rid
        r["players"] = len(json.loads(self.guesses[rid]))
        return json.dumps(r)

    @gl.public.view
    def get_guess(self, rid: str, player: str) -> str:
        g = json.loads(self.guesses[rid]) if rid in self.guesses else {}
        return json.dumps(g[player]) if player in g else ""

    @gl.public.view
    def get_results(self, rid: str) -> str:
        return self.results[rid] if rid in self.results else "[]"
