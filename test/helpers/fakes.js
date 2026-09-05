function clone(value) {
  return structuredClone(value);
}

export class MemoryStoragePort {
  constructor(initialState, { failReadCalls = [], failWriteCalls = [] } = {}) {
    this.state = clone(initialState);
    this.failReadCalls = new Set(failReadCalls);
    this.failWriteCalls = new Set(failWriteCalls);
    this.writeCount = 0;
    this.readCount = 0;
    this.history = [];
  }

  async readState() {
    this.readCount += 1;
    if (this.failReadCalls.has(this.readCount)) {
      throw new Error(`Injected read failure ${String(this.readCount)}`);
    }
    return clone(this.state);
  }

  async writeState(nextState) {
    this.writeCount += 1;
    if (this.failWriteCalls.has(this.writeCount)) {
      throw new Error(`Injected write failure ${String(this.writeCount)}`);
    }
    this.state = clone(nextState);
    this.history.push(clone(nextState));
  }

  rawState() {
    return clone(this.state);
  }
}

export class FakeDerivedStatePort {
  constructor({ failApplyCalls = [], failRollbackCalls = [], failClosedCalls = [] } = {}) {
    this.failApplyCalls = new Set(failApplyCalls);
    this.failRollbackCalls = new Set(failRollbackCalls);
    this.failClosedCalls = new Set(failClosedCalls);
    this.applyCalls = [];
    this.rollbackCalls = [];
    this.failClosedCallsLog = [];
  }

  async apply(state) {
    this.applyCalls.push(clone(state));
    if (this.failApplyCalls.has(this.applyCalls.length)) {
      throw new Error(`Injected apply failure ${String(this.applyCalls.length)}`);
    }
  }

  async rollback(state) {
    this.rollbackCalls.push(clone(state));
    if (this.failRollbackCalls.has(this.rollbackCalls.length)) {
      throw new Error(`Injected rollback failure ${String(this.rollbackCalls.length)}`);
    }
  }

  async failClosed(reason) {
    this.failClosedCallsLog.push(reason);
    if (this.failClosedCalls.has(this.failClosedCallsLog.length)) {
      throw new Error(
        `Injected fail-closed failure ${String(this.failClosedCallsLog.length)}`,
      );
    }
  }
}
