import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { describe } from "node:test";
import { canCreateEvents, loadWhitelist, normalizeEmail, parseWhitelist } from "./whitelist.ts";

describe("normalizeEmail", () => {
  test("met en minuscules et coupe les espaces", () => {
    assert.equal(normalizeEmail("  Nathan@Exemple.FR "), "nathan@exemple.fr");
  });

  test("rend null pour ce qui n'est pas une adresse", () => {
    for (const value of ["", "   ", "nathan", "nathan@", "@exemple.fr", "a b@c.fr", "a@b"]) {
      assert.equal(normalizeEmail(value), null, `${value} devrait être rejeté`);
    }
  });
});

describe("parseWhitelist", () => {
  test("accepte virgules, points-virgules et retours à la ligne mêlés", () => {
    const set = parseWhitelist("a@x.fr, b@x.fr; c@x.fr\nd@x.fr");
    assert.deepEqual([...set].sort(), ["a@x.fr", "b@x.fr", "c@x.fr", "d@x.fr"]);
  });

  test("ignore les commentaires et les lignes vides", () => {
    const set = parseWhitelist("# les amis\n\na@x.fr\n   # une note\nb@x.fr,\n");
    assert.deepEqual([...set].sort(), ["a@x.fr", "b@x.fr"]);
  });

  test("normalise la casse et déduplique", () => {
    assert.deepEqual([...parseWhitelist("A@X.fr, a@x.FR")], ["a@x.fr"]);
  });

  test("écarte silencieusement les entrées invalides", () => {
    const set = parseWhitelist("a@x.fr, pas-une-adresse, b@x.fr");
    assert.deepEqual([...set].sort(), ["a@x.fr", "b@x.fr"]);
  });

  test("un contenu vide n'autorise personne", () => {
    assert.equal(parseWhitelist("").size, 0);
    assert.equal(parseWhitelist("# rien que des commentaires").size, 0);
  });
});

describe("loadWhitelist", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "convier-"));

  test("n'autorise personne sans WHITELIST_FILE", () => {
    delete process.env.WHITELIST_FILE;
    assert.equal(loadWhitelist().size, 0);
    assert.equal(canCreateEvents("a@x.fr"), false);
  });

  test("n'autorise personne si le fichier est absent", () => {
    process.env.WHITELIST_FILE = path.join(dir, "absent.txt");
    assert.equal(loadWhitelist().size, 0);
  });

  test("lit le fichier et autorise ceux qui y figurent", () => {
    const file = path.join(dir, "liste.txt");
    writeFileSync(file, "a@x.fr, b@x.fr");
    process.env.WHITELIST_FILE = file;
    assert.equal(canCreateEvents("A@X.fr"), true);
    assert.equal(canCreateEvents("inconnu@x.fr"), false);
    assert.equal(canCreateEvents(null), false);
    assert.equal(canCreateEvents(undefined), false);
  });

  test("relit le fichier quand il change", () => {
    const file = path.join(dir, "evolutif.txt");
    writeFileSync(file, "a@x.fr");
    process.env.WHITELIST_FILE = file;
    assert.equal(canCreateEvents("b@x.fr"), false);
    writeFileSync(file, "a@x.fr, b@x.fr");
    assert.equal(canCreateEvents("b@x.fr"), true);
  });
});
