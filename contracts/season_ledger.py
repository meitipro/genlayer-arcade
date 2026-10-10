# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
SeasonLedger (BUILD_SPEC section 15). No AI, no web: a cheap permanent
record. Keys look like validator-run:2026-W41, payload is the top 10 as JSON.
"""
from genlayer import *

import json


class SeasonLedger(gl.Contract):
    owner: Address
    seasons: TreeMap[str, str]  # "validator-run:2026-W41" -> JSON top-10
    keys: TreeMap[str, str]     # "index" -> JSON list of recorded keys

    def __init__(self):
        self.owner = gl.message.sender_address
        self.keys["index"] = "[]"

    @gl.public.write
    def record_season(self, key: str, payload: str):
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("[EXPECTED] not owner")
        if key in self.seasons:
            raise gl.vm.UserError("[EXPECTED] season already recorded")
        if len(payload) > 8000:
            raise gl.vm.UserError("[EXPECTED] payload too large")
        json.loads(payload)  # must be valid JSON
        self.seasons[key] = payload
        idx = json.loads(self.keys["index"])
        idx.append(key)
        self.keys["index"] = json.dumps(idx)

    @gl.public.view
    def get_season(self, key: str) -> str:
        if key not in self.seasons:
            return ""
        return self.seasons[key]

    @gl.public.view
    def list_seasons(self) -> str:
        return self.keys["index"]
