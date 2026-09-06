import test from "node:test";
import assert from "node:assert/strict";
import { runAcceptancePreflight } from "../../scripts/acceptance-preflight.mjs";

test("PC acceptance preflight passes every release-safety contract", async () => {
  const report = await runAcceptancePreflight();
  assert.equal(report.status, "PASS");
  assert.equal(report.failed, 0);
  assert.equal(report.passed, 15);
  assert.equal(report.results.every((result) => result.status === "PASS"), true);
});
