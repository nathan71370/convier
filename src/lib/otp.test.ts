process.env.AUTH_SECRET ??= "secret-de-test";

import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { CODE_TTL_MS, MAX_ATTEMPTS, checkCode, generateCode, hashCode } from "./otp.ts";

const base = {
  codeHash: hashCode("123456"),
  expiresAt: 1_000,
  attempts: 0,
  consumedAt: null as number | null,
};

describe("generateCode", () => {
  test("produit toujours six chiffres", () => {
    for (let i = 0; i < 200; i++) assert.match(generateCode(), /^\d{6}$/);
  });

  test("ne rend pas toujours la même valeur", () => {
    const seen = new Set(Array.from({ length: 50 }, generateCode));
    assert.ok(seen.size > 1);
  });
});

describe("hashCode", () => {
  test("est stable pour un même code", () => {
    assert.equal(hashCode("123456"), hashCode("123456"));
  });

  test("diffère pour deux codes voisins", () => {
    assert.notEqual(hashCode("123456"), hashCode("123457"));
  });

  test("ne laisse pas transparaître le code", () => {
    assert.ok(!hashCode("123456").includes("123456"));
  });
});

describe("checkCode", () => {
  test("accepte le bon code avant expiration", () => {
    assert.equal(checkCode(base, "123456", 999), "ok");
  });

  test("accepte pile à l'instant d'expiration", () => {
    assert.equal(checkCode(base, "123456", 1_000), "ok");
  });

  test("refuse un mauvais code", () => {
    assert.equal(checkCode(base, "000000", 999), "invalide");
  });

  test("refuse après expiration", () => {
    assert.equal(checkCode(base, "123456", 1_001), "invalide");
  });

  test("refuse un code déjà consommé, même juste", () => {
    assert.equal(checkCode({ ...base, consumedAt: 500 }, "123456", 999), "invalide");
  });

  test("refuse une fois les tentatives épuisées", () => {
    assert.equal(checkCode({ ...base, attempts: MAX_ATTEMPTS }, "123456", 999), "invalide");
    assert.equal(checkCode({ ...base, attempts: MAX_ATTEMPTS - 1 }, "123456", 999), "ok");
  });

  test("refuse une empreinte de longueur inattendue sans lever", () => {
    assert.equal(checkCode({ ...base, codeHash: "abcd" }, "123456", 999), "invalide");
  });

  test("expose une durée de vie utilisable", () => {
    assert.ok(CODE_TTL_MS >= 60_000);
  });
});
