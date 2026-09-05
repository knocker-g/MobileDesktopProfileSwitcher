import assert from "node:assert/strict";
import test from "node:test";

import { DOMAIN_ERROR, DomainValidationError } from "../../src/core/domain-error.js";
import { PROFILE } from "../../src/core/profiles.js";
import {
  addSiteCandidate,
  removeSiteCandidate,
  updateSiteCandidate,
  validateProfile,
  validateSite,
  validateSiteCollection,
  validateSiteId,
} from "../../src/core/sites.js";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const SITE_C = "33333333-3333-4333-8333-333333333333";

function site(overrides = {}) {
  return {
    id: SITE_A,
    name: "YouTube",
    profile: PROFILE.DESKTOP,
    hosts: [
      { hostname: "www.youtube.com", ruleId: 1 },
      { hostname: "m.youtube.com", ruleId: 2 },
    ],
    ...overrides,
  };
}

function throwsCode(operation, code) {
  assert.throws(
    operation,
    (error) => error instanceof DomainValidationError && error.code === code,
  );
}

test("validates and canonicalizes a Site without mutating the candidate", () => {
  const candidate = site({
    name: "  YouTube  ",
    hosts: [{ hostname: "HTTPS://WWW.YOUTUBE.COM/watch?v=x", ruleId: 1 }],
  });
  const snapshot = structuredClone(candidate);
  const result = validateSite(candidate);

  assert.deepEqual(result, {
    id: SITE_A,
    name: "YouTube",
    profile: "desktop",
    hosts: [{ hostname: "www.youtube.com", ruleId: 1 }],
  });
  assert.deepEqual(candidate, snapshot);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.hosts));
  assert.ok(Object.isFrozen(result.hosts[0]));
});

test("accepts only the three product profiles", () => {
  assert.equal(validateProfile("default"), "default");
  assert.equal(validateProfile("desktop"), "desktop");
  assert.equal(validateProfile("mobile"), "mobile");
  throwsCode(() => validateProfile("custom"), DOMAIN_ERROR.UNKNOWN_PROFILE);
});

test("validates stable UUID v4 Site identifiers without generating them", () => {
  assert.equal(validateSiteId(SITE_A), SITE_A);
  throwsCode(() => validateSiteId("site-1"), DOMAIN_ERROR.INVALID_SITE_ID);
  throwsCode(
    () => validateSiteId("11111111-1111-1111-8111-111111111111"),
    DOMAIN_ERROR.INVALID_SITE_ID,
  );
});

test("rejects an empty Site name", () => {
  throwsCode(() => validateSite(site({ name: "  " })), DOMAIN_ERROR.EMPTY_SITE_NAME);
});

test("rejects a Site name longer than 80 Unicode code points", () => {
  throwsCode(
    () => validateSite(site({ name: "名".repeat(81) })),
    DOMAIN_ERROR.INVALID_SITE_NAME,
  );
});

test("rejects control characters in a Site name", () => {
  throwsCode(
    () => validateSite(site({ name: "YouTube\nInjected" })),
    DOMAIN_ERROR.INVALID_SITE_NAME,
  );
});

test("rejects an empty host list", () => {
  throwsCode(() => validateSite(site({ hosts: [] })), DOMAIN_ERROR.EMPTY_HOSTS);
});

test("rejects duplicate hosts inside one Site after normalization", () => {
  throwsCode(
    () =>
      validateSite(
        site({
          hosts: [
            { hostname: "WWW.YouTube.COM", ruleId: 1 },
            { hostname: "www.youtube.com.", ruleId: 2 },
          ],
        }),
      ),
    DOMAIN_ERROR.DUPLICATE_HOST,
  );
});

test("rejects invalid and duplicate rule IDs", () => {
  throwsCode(
    () => validateSite(site({ hosts: [{ hostname: "example.com", ruleId: 0 }] })),
    DOMAIN_ERROR.INVALID_RULE_ID,
  );
  throwsCode(
    () =>
      validateSite(
        site({
          hosts: [
            { hostname: "a.example.com", ruleId: 1 },
            { hostname: "b.example.com", ruleId: 1 },
          ],
        }),
      ),
    DOMAIN_ERROR.DUPLICATE_RULE_ID,
  );
});

test("rejects the same normalized host across Sites", () => {
  const other = site({
    id: SITE_B,
    name: "Other",
    profile: PROFILE.DEFAULT,
    hosts: [{ hostname: "WWW.YOUTUBE.COM.", ruleId: 3 }],
  });
  throwsCode(
    () => validateSiteCollection([site(), other]),
    DOMAIN_ERROR.DUPLICATE_HOST,
  );
});

test("rejects duplicate Site IDs", () => {
  const other = site({
    name: "Other",
    hosts: [{ hostname: "example.com", ruleId: 3 }],
  });
  throwsCode(
    () => validateSiteCollection([site(), other]),
    DOMAIN_ERROR.DUPLICATE_SITE_ID,
  );
});

test("rejects duplicate rule IDs across Sites", () => {
  const other = site({
    id: SITE_B,
    name: "Other",
    hosts: [{ hostname: "example.com", ruleId: 1 }],
  });
  throwsCode(
    () => validateSiteCollection([site(), other]),
    DOMAIN_ERROR.DUPLICATE_RULE_ID,
  );
});

test("addSiteCandidate returns a new immutable collection", () => {
  const original = [site()];
  const snapshot = structuredClone(original);
  const added = addSiteCandidate(
    original,
    site({
      id: SITE_B,
      name: "Example",
      profile: PROFILE.MOBILE,
      hosts: [{ hostname: "example.com", ruleId: 3 }],
    }),
  );

  assert.equal(added.length, 2);
  assert.equal(added[1].name, "Example");
  assert.deepEqual(original, snapshot);
  assert.ok(Object.isFrozen(added));
});

test("updateSiteCandidate preserves the stable ID and does not mutate input", () => {
  const original = [site()];
  const snapshot = structuredClone(original);
  const updated = updateSiteCandidate(
    original,
    SITE_A,
    site({
      name: "Updated",
      profile: PROFILE.MOBILE,
      hosts: [{ hostname: "example.com", ruleId: 1 }],
    }),
  );

  assert.deepEqual(updated[0], {
    id: SITE_A,
    name: "Updated",
    profile: "mobile",
    hosts: [{ hostname: "example.com", ruleId: 1 }],
  });
  assert.deepEqual(original, snapshot);
  assert.ok(Object.isFrozen(updated));

  throwsCode(
    () => updateSiteCandidate(original, SITE_A, site({ id: SITE_B })),
    DOMAIN_ERROR.INVALID_SITE_ID,
  );
});

test("updateSiteCandidate detects cross-Site host conflicts", () => {
  const original = [
    site(),
    site({
      id: SITE_B,
      name: "Example",
      hosts: [{ hostname: "example.com", ruleId: 3 }],
    }),
  ];
  throwsCode(
    () =>
      updateSiteCandidate(
        original,
        SITE_B,
        site({
          id: SITE_B,
          hosts: [{ hostname: "www.youtube.com.", ruleId: 3 }],
        }),
      ),
    DOMAIN_ERROR.DUPLICATE_HOST,
  );
});

test("updateSiteCandidate preserves an existing host rule ID", () => {
  throwsCode(
    () =>
      updateSiteCandidate(
        [site()],
        SITE_A,
        site({
          hosts: [
            { hostname: "www.youtube.com", ruleId: 99 },
            { hostname: "m.youtube.com", ruleId: 2 },
          ],
        }),
      ),
    DOMAIN_ERROR.INVALID_RULE_ID,
  );
});

test("removeSiteCandidate returns a new immutable collection", () => {
  const original = [
    site(),
    site({
      id: SITE_B,
      name: "Example",
      hosts: [{ hostname: "example.com", ruleId: 3 }],
    }),
  ];
  const snapshot = structuredClone(original);
  const removed = removeSiteCandidate(original, SITE_A);

  assert.deepEqual(removed.map(({ id }) => id), [SITE_B]);
  assert.deepEqual(original, snapshot);
  assert.ok(Object.isFrozen(removed));
  throwsCode(
    () => removeSiteCandidate(original, SITE_C),
    DOMAIN_ERROR.SITE_NOT_FOUND,
  );
});
