import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE,
  PROFILE_VALUES,
  VERIFIED_PROFILE_SET,
  userAgentForProfile,
} from "../../src/core/profiles.js";

const DESKTOP_REDUCED_UA =
  /^Mozilla\/5\.0 \(Windows NT 10\.0; Win64; x64\) AppleWebKit\/537\.36 \(KHTML, like Gecko\) Chrome\/(\d+)\.0\.0\.0 Safari\/537\.36$/;
const MOBILE_REDUCED_UA =
  /^Mozilla\/5\.0 \(Linux; Android 10; K\) AppleWebKit\/537\.36 \(KHTML, like Gecko\) Chrome\/(\d+)\.0\.0\.0 Mobile Safari\/537\.36$/;

function reducedUaMajor(userAgent, pattern) {
  const match = pattern.exec(userAgent);
  assert.ok(match, `Not a recognized Reduced UA: ${userAgent}`);
  return Number(match[1]);
}

test("the public profile enum contains only Default, Desktop, and Mobile", () => {
  assert.deepEqual(PROFILE, {
    DEFAULT: "default",
    DESKTOP: "desktop",
    MOBILE: "mobile",
  });
  assert.deepEqual(PROFILE_VALUES, ["default", "desktop", "mobile"]);
});

test("the bundled Verified Profile Set uses milestone 152 for both profiles", () => {
  assert.deepEqual(Object.keys(VERIFIED_PROFILE_SET), [
    "milestone",
    "desktopUserAgent",
    "mobileUserAgent",
  ]);
  assert.equal(VERIFIED_PROFILE_SET.milestone, 152);

  const desktopMajor = reducedUaMajor(
    VERIFIED_PROFILE_SET.desktopUserAgent,
    DESKTOP_REDUCED_UA,
  );
  const mobileMajor = reducedUaMajor(
    VERIFIED_PROFILE_SET.mobileUserAgent,
    MOBILE_REDUCED_UA,
  );

  assert.equal(desktopMajor, 152);
  assert.equal(mobileMajor, 152);
  assert.equal(desktopMajor, mobileMajor);
  assert.equal(desktopMajor, VERIFIED_PROFILE_SET.milestone);
});

test("Default has no User-Agent while Desktop and Mobile use the bundled set", () => {
  assert.equal(userAgentForProfile(PROFILE.DEFAULT), null);
  assert.equal(
    userAgentForProfile(PROFILE.DESKTOP),
    VERIFIED_PROFILE_SET.desktopUserAgent,
  );
  assert.equal(
    userAgentForProfile(PROFILE.MOBILE),
    VERIFIED_PROFILE_SET.mobileUserAgent,
  );
});

test("unknown profiles fail explicitly", () => {
  assert.throws(() => userAgentForProfile("custom"), RangeError);
});

test("profile constants and the bundled set cannot be mutated", () => {
  assert.ok(Object.isFrozen(PROFILE));
  assert.ok(Object.isFrozen(PROFILE_VALUES));
  assert.ok(Object.isFrozen(VERIFIED_PROFILE_SET));
});
