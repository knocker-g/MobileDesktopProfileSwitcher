import { DNR_ERROR, DnrError } from "../core/dnr-error.js";
import { diffDynamicRules, generateExpectedRules, rulesEqual } from "../core/dnr-rules.js";
import { VERIFIED_PROFILE_SET } from "../core/profiles.js";
import { configurationOf } from "../core/storage-schema.js";

function allHostnames(state) {
  return state.sites.flatMap((site) => site.hosts.map((host) => host.hostname));
}

export function createDnrReconciler({ dnr, permissions, profileSet = VERIFIED_PROFILE_SET }) {
  async function expectedFor(state) {
    const current = configurationOf(state);
    const inspections = await permissions.inspectHosts(allHostnames(current));
    return generateExpectedRules(current, inspections, profileSet);
  }

  async function reconcile(state) {
    const expected = await expectedFor(state);
    const actual = await dnr.getDynamicRules();
    const diff = diffDynamicRules(expected.rules, actual);
    if (diff.removeRuleIds.length > 0 || diff.addRules.length > 0) {
      const replacementIds = new Set(diff.addRules.map((rule) => rule.id));
      const replacesExistingRules = diff.removeRuleIds.some((id) => replacementIds.has(id));

      if (replacesExistingRules) {
        // Compatibility path for an observed runtime where an old header action
        // remained active: clear same-ID rules before installing replacements.
        await dnr.updateDynamicRules({ removeRuleIds: [...diff.removeRuleIds], addRules: [] });
        const afterRemoval = await dnr.getDynamicRules();
        const removedIds = new Set(diff.removeRuleIds);
        if (afterRemoval.some((rule) => removedIds.has(rule.id))) {
          throw new DnrError(
            DNR_ERROR.POST_CONDITION_FAILURE,
            "Replaced dynamic rules remain after the removal phase.",
          );
        }
        if (diff.addRules.length > 0) {
          await dnr.updateDynamicRules({ removeRuleIds: [], addRules: [...diff.addRules] });
        }
      } else {
        await dnr.updateDynamicRules({
          removeRuleIds: [...diff.removeRuleIds],
          addRules: [...diff.addRules],
        });
      }
    }
    const verified = await dnr.getDynamicRules();
    if (!rulesEqual(expected.rules, verified)) {
      throw new DnrError(
        DNR_ERROR.POST_CONDITION_FAILURE,
        "Dynamic rules do not match expected state after reconciliation.",
      );
    }
    return Object.freeze({ expectedRules: expected.rules, warnings: expected.warnings, diff });
  }

  async function failClosed(reason) {
    let actual;
    try {
      actual = await dnr.getDynamicRules();
      if (actual.length > 0) {
        await dnr.updateDynamicRules({
          removeRuleIds: actual.map((rule) => rule.id).sort((a, b) => a - b),
          addRules: [],
        });
      }
      const verified = await dnr.getDynamicRules();
      if (verified.length !== 0) throw new Error("Rules remain after fail closed.");
    } catch (cause) {
      throw new DnrError(
        DNR_ERROR.FAIL_CLOSED_FAILURE,
        "Could not remove all extension dynamic rules.",
        { reason },
        { cause },
      );
    }
    return Object.freeze({ failedClosed: true, reason, removedRuleCount: actual.length });
  }

  return Object.freeze({
    apply: reconcile,
    rollback: reconcile,
    reconcile,
    failClosed,
  });
}
