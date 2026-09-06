function clone(value) {
  return structuredClone(value);
}

export class FakeDnrApi {
  constructor(initialRules = [], {
    incorrectApplication = false,
    incorrectApplicationCalls = [],
    failUpdateCalls = [],
    retainRemoved = false,
  } = {}) {
    this.rules = clone(initialRules);
    this.incorrectApplication = incorrectApplication;
    this.incorrectApplicationCalls = new Set(incorrectApplicationCalls);
    this.failUpdateCalls = new Set(failUpdateCalls);
    this.retainRemoved = retainRemoved;
    this.updateCount = 0;
    this.failures = new Set();
    this.calls = [];
  }

  fail(operation) {
    this.failures.add(operation);
  }

  async getDynamicRules() {
    this.calls.push({ operation: "get" });
    if (this.failures.has("get")) throw new Error("Injected DNR get failure");
    return clone(this.rules);
  }

  async updateDynamicRules({ removeRuleIds, addRules }) {
    this.updateCount += 1;
    this.calls.push({ operation: "update", removeRuleIds: [...removeRuleIds], addRules: clone(addRules) });
    if (this.failures.has("update") || this.failUpdateCalls.has(this.updateCount)) {
      throw new Error("Injected DNR update failure");
    }
    const remove = new Set(removeRuleIds);
    if (!this.retainRemoved) this.rules = this.rules.filter((rule) => !remove.has(rule.id));
    if (!this.incorrectApplication && !this.incorrectApplicationCalls.has(this.updateCount)) {
      this.rules.push(...clone(addRules));
    }
  }
}
