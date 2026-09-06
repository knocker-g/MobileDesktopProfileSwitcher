import assert from "node:assert/strict";
import test from "node:test";

import { DNR_ERROR } from "../../src/core/dnr-error.js";
import { MAX_DNR_RULE_ID, allocateRuleIds } from "../../src/core/rule-ids.js";

test("allocates the first and sequential positive rule IDs", () => {
  const result = allocateRuleIds({ existingHosts: [], hostnames: ["a.example", "b.example"], nextRuleId: 1 });
  assert.deepEqual(result.hosts, [
    { hostname: "a.example", ruleId: 1 },
    { hostname: "b.example", ruleId: 2 },
  ]);
  assert.equal(result.nextRuleId, 3);
});

test("keeps existing IDs stable and does not renumber after deletion", () => {
  const result = allocateRuleIds({
    existingHosts: [{ hostname: "kept.example", ruleId: 7 }],
    hostnames: ["kept.example", "new.example"],
    nextRuleId: 9,
  });
  assert.deepEqual(result.hosts, [
    { hostname: "kept.example", ruleId: 7 },
    { hostname: "new.example", ruleId: 9 },
  ]);
  assert.equal(result.nextRuleId, 10);
});

test("skips a used ID without changing existing entries", () => {
  const result = allocateRuleIds({
    existingHosts: [{ hostname: "kept.example", ruleId: 2 }],
    hostnames: ["new.example"],
    nextRuleId: 2,
  });
  assert.equal(result.hosts[0].ruleId, 3);
});

test("rejects duplicate, invalid, noncanonical, and overflowing IDs", () => {
  const cases = [
    { existingHosts: [{ hostname: "a.example", ruleId: 1 }, { hostname: "b.example", ruleId: 1 }], hostnames: [], nextRuleId: 2 },
    { existingHosts: [], hostnames: ["A.example"], nextRuleId: 1 },
    { existingHosts: [], hostnames: ["a.example", "a.example"], nextRuleId: 1 },
    { existingHosts: [], hostnames: ["a.example"], nextRuleId: 0 },
  ];
  for (const input of cases) assert.throws(() => allocateRuleIds(input), (error) => error.code === DNR_ERROR.INVALID_RULE_ID);
  assert.throws(
    () => allocateRuleIds({ existingHosts: [], hostnames: ["a.example"], nextRuleId: MAX_DNR_RULE_ID + 1 }),
    (error) => error.code === DNR_ERROR.RULE_ID_EXHAUSTED,
  );
});

test("allocates the final ID then leaves an exhausted monotonic counter", () => {
  const result = allocateRuleIds({ existingHosts: [], hostnames: ["a.example"], nextRuleId: MAX_DNR_RULE_ID });
  assert.equal(result.hosts[0].ruleId, MAX_DNR_RULE_ID);
  assert.equal(result.nextRuleId, MAX_DNR_RULE_ID + 1);
});
