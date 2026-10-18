import assert from "node:assert/strict";
import test from "node:test";

import { findBanned, handleOf, plan } from "./rules.mjs";

test("handle from the case line", () => {
  assert.equal(handleOf("ardal on Discord, banned 2026-10-06"), "ardal");
  assert.equal(handleOf("@0xNadir on Telegram, banned 2026-10-01"), "0xnadir");
  assert.equal(handleOf("mirrr, banned 2026-10-08"), "mirrr");
});

test("what each ruling does", () => {
  assert.deepEqual(plan({ status: "OVERTURNED" }), { unban: true, then: null });
  assert.deepEqual(plan({ status: "DEFAULTED" }), { unban: true, then: null });
  assert.deepEqual(plan({ status: "UPHELD" }), { unban: false, then: null });
  assert.deepEqual(plan({ status: "REDUCED", new_level: "P2" }), { unban: true, then: { kind: "timeout", minutes: 1440 } });
  assert.deepEqual(plan({ status: "REDUCED", new_level: "P1" }), { unban: true, then: { kind: "warn" } });
  assert.equal(plan({ status: "REDUCED", new_level: "P4" }).unban, false);
  assert.equal(plan({ status: "REDUCED", new_level: "P2" }, { P2: "timeout:99999" }).then.minutes, 40320);
});

test("finds the banned user by username or display name", () => {
  const bans = [{ user: { id: "1", username: "ardal" } }, { user: { id: "2", username: "x", global_name: "Mirrr" } }];
  assert.equal(findBanned(bans, "ardal").id, "1");
  assert.equal(findBanned(bans, "mirrr").id, "2");
  assert.equal(findBanned(bans, "nobody"), null);
});
