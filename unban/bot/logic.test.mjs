import assert from "node:assert/strict";
import { test } from "node:test";

import { discordId, durationOf, pending, plan } from "./logic.mjs";

const row = (over) => ({ id: 1, status: "OVERTURNED", case_ref: "ardal (Discord 418236001190019072), banned in #general", new_level: "", new_level_label: "", ...over });

test("the Discord id is the first 17-20 digit number in the case", () => {
  assert.equal(discordId("ardal (Discord 418236001190019072)"), "418236001190019072");
  assert.equal(discordId("banned Oct 3 2026, no id"), null);
  assert.equal(discordId("id 123456789012345678901"), null); // 21 digits is not a snowflake
});

test("ladder labels become timeouts, capped at 28 days", () => {
  assert.equal(durationOf("24h mute"), 86400);
  assert.equal(durationOf("7-day mute"), 7 * 86400);
  assert.equal(durationOf("30 minutes"), 1800);
  assert.equal(durationOf("2 weeks"), 14 * 86400);
  assert.equal(durationOf("90 days"), 28 * 86400);
  assert.equal(durationOf("warning"), 0);
  assert.equal(durationOf("ban"), 0);
});

test("overturned and defaulted lift the ban", () => {
  for (const status of ["OVERTURNED", "DEFAULTED"]) {
    const p = plan(row({ status }));
    assert.equal(p.unban, true);
    assert.equal(p.timeoutSeconds, 0);
    assert.equal(p.user, "418236001190019072");
  }
});

test("reduced lifts the ban and times out for the ladder level", () => {
  const p = plan(row({ status: "REDUCED", new_level: "P2", new_level_label: "24h mute" }));
  assert.deepEqual([p.unban, p.timeoutSeconds], [true, 86400]);
  const warning = plan(row({ status: "REDUCED", new_level: "P1", new_level_label: "warning" }));
  assert.deepEqual([warning.unban, warning.timeoutSeconds], [true, 0]);
});

test("upheld and open appeals ask nothing of the server", () => {
  assert.equal(plan(row({ status: "UPHELD" })), null);
  assert.equal(plan(row({ status: "FILED" })), null);
  assert.equal(plan(row({ status: "ANSWERED" })), null);
});

test("pending skips applied ids and open appeals, oldest first", () => {
  const rows = [row({ id: 4, status: "FILED" }), row({ id: 3 }), row({ id: 2, status: "UPHELD" }), row({ id: 1 })];
  assert.deepEqual(pending(rows, [1]).map((r) => r.id), [2, 3]);
});
