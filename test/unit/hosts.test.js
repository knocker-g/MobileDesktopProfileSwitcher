import assert from "node:assert/strict";
import test from "node:test";

import { DOMAIN_ERROR, DomainValidationError } from "../../src/core/domain-error.js";
import {
  normalizeHostInput,
  normalizeHostInputs,
} from "../../src/core/hosts.js";

const validCases = [
  ["www.youtube.com", "www.youtube.com"],
  ["WWW.YouTube.COM", "www.youtube.com"],
  ["  www.youtube.com.  ", "www.youtube.com"],
  ["https://www.youtube.com/watch?v=abc#chat", "www.youtube.com"],
  ["http://www.youtube.com:8080/path", "www.youtube.com"],
  ["example.com/path", "example.com"],
  ["https://evil.example/?host=example.com", "evil.example"],
  ["https://example.com.evil.example/", "example.com.evil.example"],
  ["例え.テスト", "xn--r8jz45g.xn--zckzah"],
  ["XN--R8JZ45G.XN--ZCKZAH", "xn--r8jz45g.xn--zckzah"],
];

for (const [input, expected] of validCases) {
  test(`normalizes ${JSON.stringify(input)} to ${expected}`, () => {
    assert.equal(normalizeHostInput(input), expected);
  });
}

const invalidCases = [
  "",
  "   ",
  "*",
  "*.example.com",
  "^example\\.com$",
  "not a host",
  "https://example.com@evil.example/",
  "https://user:secret@example.com/",
  "https://",
  "/path",
  "?host=example.com",
  "#example.com",
  ":443",
  "example.com:8443",
  "//example.com/path",
  "ftp://example.com/",
  "localhost",
  "intranet",
  "127.0.0.1",
  "https://127.0.0.1/path",
  "127.1",
  "2130706433",
  "0x7f000001",
  "[2001:db8::1]",
  "https://[2001:db8::1]/",
  "example.com..",
  "-example.com",
  "example-.com",
  "https://example.com%40evil.example/",
  "example.com|evil.example",
];

for (const input of invalidCases) {
  test(`rejects invalid host input ${JSON.stringify(input)}`, () => {
    assert.throws(
      () => normalizeHostInput(input),
      (error) =>
        error instanceof DomainValidationError &&
        error.code === DOMAIN_ERROR.INVALID_HOST,
    );
  });
}

test("rejects non-string host input", () => {
  assert.throws(
    () => normalizeHostInput(null),
    (error) => error.code === DOMAIN_ERROR.INVALID_HOST,
  );
});

test("normalizes and reports equivalent duplicates without mutating input", () => {
  const input = [
    "WWW.YouTube.COM",
    "www.youtube.com.",
    "https://m.youtube.com/watch?v=abc",
  ];
  const snapshot = [...input];
  const result = normalizeHostInputs(input);

  assert.deepEqual(result.hosts, ["www.youtube.com", "m.youtube.com"]);
  assert.deepEqual(result.duplicates, ["www.youtube.com"]);
  assert.deepEqual(input, snapshot);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.hosts));
  assert.ok(Object.isFrozen(result.duplicates));
});
