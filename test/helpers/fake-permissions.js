export class FakeChromePermissionsApi {
  constructor({ granted = [], requestResult = true, grantRequested = true, removeResult = true, retainRemoved = false } = {}) {
    this.granted = new Set(granted);
    this.requestResult = requestResult;
    this.grantRequested = grantRequested;
    this.removeResult = removeResult;
    this.retainRemoved = retainRemoved;
    this.failures = new Set();
    this.calls = [];
  }

  fail(operation) {
    this.failures.add(operation);
  }

  contains({ origins }) {
    this.calls.push({ operation: "contains", origins: [...origins] });
    if (this.failures.has("contains")) return Promise.reject(new Error("contains failure"));
    return Promise.resolve(origins.every((origin) => this.granted.has(origin)));
  }

  request({ origins }) {
    this.calls.push({ operation: "request", origins: [...origins] });
    if (this.failures.has("request")) return Promise.reject(new Error("request failure"));
    if (this.requestResult && this.grantRequested) {
      for (const origin of origins) this.granted.add(origin);
    }
    return Promise.resolve(this.requestResult);
  }

  remove({ origins }) {
    this.calls.push({ operation: "remove", origins: [...origins] });
    if (this.failures.has("remove")) return Promise.reject(new Error("remove failure"));
    if (this.removeResult && !this.retainRemoved) {
      for (const origin of origins) this.granted.delete(origin);
    }
    return Promise.resolve(this.removeResult);
  }
}
