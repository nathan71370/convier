import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { type LegacyGuest, planPromotion } from "./migrate-plan.ts";

const row = (over: Partial<LegacyGuest> = {}): LegacyGuest => ({
  id: "g1",
  eventId: "e1",
  email: "A@X.fr",
  name: "Léa",
  photo: null,
  status: "yes",
  plusOnes: 1,
  message: null,
  createdAt: 1,
  updatedAt: 2,
  migratedAt: null,
  ...over,
});

describe("planPromotion", () => {
  test("crée un seul compte par adresse, quelle que soit la casse", () => {
    const plan = planPromotion([row(), row({ id: "g2", eventId: "e2", email: "a@x.FR" })]);
    assert.equal(plan.users.length, 1);
    assert.equal(plan.users[0].email, "a@x.fr");
    assert.equal(plan.rsvps.length, 2);
  });

  test("laisse de côté les lignes sans adresse et les nomme", () => {
    const plan = planPromotion([row({ email: null }), row({ id: "g2", eventId: "e2" })]);
    assert.equal(plan.rsvps.length, 1);
    assert.deepEqual(plan.skipped, ["g1"]);
  });

  test("écarte une adresse illisible plutôt que d'inventer un compte", () => {
    const plan = planPromotion([row({ email: "pas-une-adresse" })]);
    assert.equal(plan.users.length, 0);
    assert.deepEqual(plan.skipped, ["g1"]);
  });

  test("ignore ce qui a déjà été migré", () => {
    const plan = planPromotion([row({ migratedAt: 123 })]);
    assert.equal(plan.rsvps.length, 0);
    assert.equal(plan.users.length, 0);
    assert.deepEqual(plan.skipped, []);
  });

  test("retient le prénom le plus récent pour le compte", () => {
    const plan = planPromotion([
      row({ id: "g1", name: "Ancien", updatedAt: 1 }),
      row({ id: "g2", eventId: "e2", name: "Récent", updatedAt: 9 }),
    ]);
    assert.equal(plan.users[0].name, "Récent");
  });

  test("récupère une photo présente sur une ligne plus ancienne", () => {
    const plan = planPromotion([
      row({ id: "g1", photo: "data:image/jpeg;base64,AA==", updatedAt: 1 }),
      row({ id: "g2", eventId: "e2", photo: null, updatedAt: 9 }),
    ]);
    assert.equal(plan.users[0].photo, "data:image/jpeg;base64,AA==");
  });

  test("une personne ne garde qu'une réponse par événement, la plus récente", () => {
    const plan = planPromotion([
      row({ id: "g1", status: "no", updatedAt: 1 }),
      row({ id: "g2", status: "yes", plusOnes: 3, updatedAt: 9 }),
    ]);
    assert.equal(plan.rsvps.length, 1);
    assert.equal(plan.rsvps[0].status, "yes");
    assert.equal(plan.rsvps[0].plusOnes, 3);
    assert.equal(plan.rsvps[0].guestId, "g2");
  });

  test("conserve les horodatages d'origine", () => {
    const plan = planPromotion([row({ createdAt: 111, updatedAt: 222 })]);
    assert.equal(plan.rsvps[0].createdAt, 111);
    assert.equal(plan.rsvps[0].updatedAt, 222);
  });

  test("un lot vide ne produit rien", () => {
    assert.deepEqual(planPromotion([]), { users: [], rsvps: [], skipped: [] });
  });
});
