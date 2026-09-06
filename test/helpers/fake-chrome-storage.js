export class FakeChromeStorageArea {
  constructor(initial = {}, { failGet = false, failSet = false } = {}) {
    this.data = structuredClone(initial);
    this.failGet = failGet;
    this.failSet = failSet;
    this.setCalls = [];
  }

  async get(key) {
    if (this.failGet) throw new Error("Injected storage get failure");
    return Object.hasOwn(this.data, key) ? { [key]: structuredClone(this.data[key]) } : {};
  }

  async set(values) {
    if (this.failSet) throw new Error("Injected storage set failure");
    this.setCalls.push(structuredClone(values));
    Object.assign(this.data, structuredClone(values));
  }
}
