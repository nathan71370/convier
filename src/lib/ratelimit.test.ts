import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { CAPS, WINDOWS_MS, exceedsCaps } from "./ratelimit.ts";

const none = { perEmail: 0, perIp: 0, global: 0 };

describe("exceedsCaps", () => {
  test("laisse passer sous les plafonds", () => {
    assert.equal(exceedsCaps(none), false);
    assert.equal(exceedsCaps({ perEmail: CAPS.perEmail - 1, perIp: CAPS.perIp - 1, global: CAPS.global - 1 }), false);
  });

  test("bloque dès que le plafond par adresse est atteint", () => {
    assert.equal(exceedsCaps({ ...none, perEmail: CAPS.perEmail }), true);
  });

  test("bloque dès que le plafond par IP est atteint", () => {
    assert.equal(exceedsCaps({ ...none, perIp: CAPS.perIp }), true);
  });

  test("bloque au coupe-circuit global", () => {
    assert.equal(exceedsCaps({ ...none, global: CAPS.global }), true);
  });

  test("les plafonds vont du plus strict au plus large", () => {
    assert.ok(CAPS.perEmail < CAPS.perIp);
    assert.ok(CAPS.perIp < CAPS.global);
  });

  test("chaque plafond a une fenêtre non nulle", () => {
    for (const window of Object.values(WINDOWS_MS)) assert.ok(window > 0);
  });
});
