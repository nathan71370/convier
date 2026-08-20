# Comptes, whitelist et albums Immich — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'identité par cookie de navigateur par des comptes vérifiés par code e-mail, réserver la création d'événement à une liste blanche externe, et permettre la création d'albums photo partagés Immich.

**Architecture:** Toute la logique décidable sans base ni réseau vit dans `src/lib/*` en fonctions pures, testées par `node --test`. Les accès base restent dans `src/lib/*-store.ts`, les mutations dans des Server Actions. Le contrôle d'accès est explicite : `requireUser()` en tête de chaque page, `canCreateEvents()` devant la création.

**Tech Stack:** Next 16 (App Router), Drizzle + libSQL, Zod 4, nodemailer, node:crypto, node:test.

**Spec:** `docs/superpowers/specs/2026-08-20-comptes-et-albums-design.md`

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/lib/whitelist.ts` | Analyse du fichier (pur) + lecture avec cache sur mtime |
| `src/lib/otp.ts` | Génération, empreinte et politique de vérification d'un code (pur) |
| `src/lib/ratelimit.ts` | Décision de plafond à partir de compteurs (pur) |
| `src/lib/mailer.ts` | Envoi SMTP, repli journalisé |
| `src/lib/session.ts` | Cookie de session, `requireUser`, `currentUser` |
| `src/lib/auth-store.ts` | Accès base : codes, sessions, comptes |
| `src/lib/migrate.ts` | Promotion `guests` → `users`/`rsvps` (planification pure + exécution) |
| `src/lib/immich.ts` | Client Immich : URL publique (pur) + création album/lien |
| `src/db/schema.ts` | Tables `users`, `login_codes`, `sessions`, `rsvps` ; `events` modifiée |
| `src/app/connexion/*` | Pages de connexion |
| `src/app/profil/page.tsx` | Profil et historique |

---

## Phase 1 — Comptes et accès

### Task 1 : Analyse du fichier de liste blanche

**Files:** Create `src/lib/whitelist.ts`, `src/lib/whitelist.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { normalizeEmail, parseWhitelist } from "./whitelist.ts";

describe("normalizeEmail", () => {
  test("met en minuscules et coupe les espaces", () => {
    assert.equal(normalizeEmail("  Nathan@Exemple.FR "), "nathan@exemple.fr");
  });
  test("rend null pour ce qui n'est pas une adresse", () => {
    for (const v of ["", "   ", "nathan", "nathan@", "@exemple.fr", "a b@c.fr"]) {
      assert.equal(normalizeEmail(v), null);
    }
  });
});

describe("parseWhitelist", () => {
  test("accepte virgules, points-virgules et retours à la ligne mêlés", () => {
    const set = parseWhitelist("a@x.fr, b@x.fr; c@x.fr\nd@x.fr");
    assert.deepEqual([...set].sort(), ["a@x.fr", "b@x.fr", "c@x.fr", "d@x.fr"]);
  });
  test("ignore les commentaires et les lignes vides", () => {
    const set = parseWhitelist("# amis\n\na@x.fr\n  # note\nb@x.fr,\n");
    assert.deepEqual([...set].sort(), ["a@x.fr", "b@x.fr"]);
  });
  test("normalise la casse et déduplique", () => {
    assert.deepEqual([...parseWhitelist("A@X.fr, a@x.FR")], ["a@x.fr"]);
  });
  test("écarte silencieusement les entrées invalides", () => {
    assert.deepEqual([...parseWhitelist("a@x.fr, pas-une-adresse, b@x.fr")].sort(), ["a@x.fr", "b@x.fr"]);
  });
  test("un contenu vide n'autorise personne", () => {
    assert.equal(parseWhitelist("").size, 0);
  });
});
```

- [ ] **Step 2: Lancer et vérifier l'échec** — `node --test "src/lib/whitelist.test.ts"` → ERR_MODULE_NOT_FOUND.

- [ ] **Step 3: Implémenter les deux fonctions pures**

```ts
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function normalizeEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return EMAIL.test(value) ? value : null;
}

export function parseWhitelist(contents: string): Set<string> {
  const out = new Set<string>();
  for (const line of contents.split(/\r?\n/)) {
    const withoutComment = line.split("#")[0];
    for (const piece of withoutComment.split(/[,;]/)) {
      const email = normalizeEmail(piece);
      if (email) out.add(email);
    }
  }
  return out;
}
```

- [ ] **Step 4: Vérifier que les tests passent** — `node --test "src/lib/whitelist.test.ts"`.

- [ ] **Step 5: Commit** — `git add src/lib/whitelist*.ts && git commit -m "Parse the shared whitelist file"`

---

### Task 2 : Lecture du fichier avec cache sur mtime

**Files:** Modify `src/lib/whitelist.ts`

- [ ] **Step 1: Ajouter la lecture**

```ts
import { readFileSync, statSync } from "node:fs";

let cache: { key: string; set: Set<string> } | null = null;

/**
 * Échec fermé : sans variable ou sans fichier lisible, personne ne peut créer
 * d'événement. Une liste d'accès qui laisse tout passer quand elle casse est
 * un piège silencieux.
 */
export function loadWhitelist(): Set<string> {
  const path = process.env.WHITELIST_FILE;
  if (!path) {
    console.error("[whitelist] WHITELIST_FILE non définie : aucune création autorisée.");
    return new Set();
  }
  try {
    const stat = statSync(path);
    const key = `${stat.mtimeMs}:${stat.size}`;
    if (cache?.key === key) return cache.set;
    const set = parseWhitelist(readFileSync(path, "utf8"));
    cache = { key, set };
    return set;
  } catch (cause) {
    console.error(`[whitelist] ${path} illisible : aucune création autorisée.`, cause);
    return new Set();
  }
}

export function canCreateEvents(email: string | null | undefined): boolean {
  const normalized = email ? normalizeEmail(email) : null;
  return normalized !== null && loadWhitelist().has(normalized);
}
```

- [ ] **Step 2: Commit** — `git commit -am "Reload the whitelist when the file changes"`

---

### Task 3 : Codes à usage unique

**Files:** Create `src/lib/otp.ts`, `src/lib/otp.test.ts`

- [ ] **Step 1: Écrire les tests**

```ts
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { CODE_TTL_MS, MAX_ATTEMPTS, checkCode, generateCode, hashCode } from "./otp.ts";

const base = { codeHash: hashCode("123456"), expiresAt: 1_000, attempts: 0, consumedAt: null };

describe("generateCode", () => {
  test("produit six chiffres", () => {
    for (let i = 0; i < 50; i++) assert.match(generateCode(), /^\d{6}$/);
  });
});

describe("hashCode", () => {
  test("est stable et ne rend jamais le code en clair", () => {
    assert.equal(hashCode("123456"), hashCode("123456"));
    assert.notEqual(hashCode("123456"), hashCode("123457"));
    assert.ok(!hashCode("123456").includes("123456"));
  });
});

describe("checkCode", () => {
  test("accepte le bon code avant expiration", () => {
    assert.equal(checkCode(base, "123456", 999), "ok");
  });
  test("refuse un mauvais code", () => {
    assert.equal(checkCode(base, "000000", 999), "invalide");
  });
  test("refuse après expiration", () => {
    assert.equal(checkCode(base, "123456", 1_001), "invalide");
  });
  test("refuse un code déjà consommé", () => {
    assert.equal(checkCode({ ...base, consumedAt: 500 }, "123456", 999), "invalide");
  });
  test("refuse une fois les tentatives épuisées", () => {
    assert.equal(checkCode({ ...base, attempts: MAX_ATTEMPTS }, "123456", 999), "invalide");
  });
  test("expose une durée de vie non nulle", () => {
    assert.ok(CODE_TTL_MS > 0);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**, puis implémenter

```ts
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_TTL_MS = 10 * 60_000;
export const MAX_ATTEMPTS = 5;

export const generateCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** Le sel serveur est obligatoire : une valeur par défaut finirait en production. */
function pepper(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET est obligatoire.");
  return secret;
}

export const hashCode = (code: string): string =>
  createHash("sha256").update(`${code}:${pepper()}`).digest("hex");

export type CodeRow = {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  consumedAt: number | null;
};

/**
 * Un seul verdict pour toutes les causes de refus : distinguer « expiré » de
 * « faux » n'aide que celui qui devine.
 */
export function checkCode(row: CodeRow, submitted: string, now: number): "ok" | "invalide" {
  if (row.consumedAt !== null) return "invalide";
  if (now > row.expiresAt) return "invalide";
  if (row.attempts >= MAX_ATTEMPTS) return "invalide";
  const a = Buffer.from(row.codeHash, "hex");
  const b = Buffer.from(hashCode(submitted), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "invalide";
  return "ok";
}
```

Les tests doivent définir `AUTH_SECRET` : ajouter `process.env.AUTH_SECRET ??= "test-secret";` en tête du fichier de test.

- [ ] **Step 3: Vérifier le passage des tests, puis commit** — `git commit -m "Hash one-time codes and give every refusal the same answer"`

---

### Task 4 : Plafonds d'émission

**Files:** Create `src/lib/ratelimit.ts`, `src/lib/ratelimit.test.ts`

- [ ] **Step 1: Tests**

```ts
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { CAPS, exceedsCaps } from "./ratelimit.ts";

describe("exceedsCaps", () => {
  test("laisse passer sous les plafonds", () => {
    assert.equal(exceedsCaps({ perEmail: 0, perIp: 0, global: 0 }), false);
  });
  test("bloque à l'adresse", () => {
    assert.equal(exceedsCaps({ perEmail: CAPS.perEmail, perIp: 0, global: 0 }), true);
  });
  test("bloque à l'IP", () => {
    assert.equal(exceedsCaps({ perEmail: 0, perIp: CAPS.perIp, global: 0 }), true);
  });
  test("bloque au coupe-circuit global", () => {
    assert.equal(exceedsCaps({ perEmail: 0, perIp: 0, global: CAPS.global }), true);
  });
  test("les plafonds sont ordonnés du plus strict au plus large", () => {
    assert.ok(CAPS.perEmail < CAPS.perIp && CAPS.perIp < CAPS.global);
  });
});
```

- [ ] **Step 2: Implémenter**

```ts
/** Fenêtres et plafonds : l'ouverture de la connexion à tous fait de la
 * demande de code un envoyeur d'e-mails accessible publiquement. */
export const CAPS = { perEmail: 3, perIp: 10, global: 100 } as const;
export const WINDOWS_MS = { perEmail: 15 * 60_000, perIp: 60 * 60_000, global: 60 * 60_000 } as const;

export type Counts = { perEmail: number; perIp: number; global: number };

export const exceedsCaps = (counts: Counts): boolean =>
  counts.perEmail >= CAPS.perEmail || counts.perIp >= CAPS.perIp || counts.global >= CAPS.global;
```

- [ ] **Step 3: Tests verts, commit** — `git commit -m "Cap how many codes can be sent"`

---

### Task 5 : Schéma des nouvelles tables

**Files:** Modify `src/db/schema.ts`, `src/db/index.ts`

- [ ] **Step 1: Ajouter dans `schema.ts`** les tables `users` (`id`, `email` unique, `name`, `photo`, `createdAt`, `lastSeenAt`), `loginCodes` (`id`, `email`, `codeHash`, `ip`, `expiresAt`, `attempts`, `consumedAt`, `createdAt`, index sur `email` et `createdAt`), `sessions` (`id`, `userId` → cascade, `createdAt`, `expiresAt`, index sur `userId`), `rsvps` (`id`, `eventId` cascade, `userId` cascade, `status`, `plusOnes`, `message`, `createdAt`, `updatedAt`, unique `(eventId, userId)`).
      Sur `events` : retirer `adminToken` et `hostName`, ajouter `hostUserId`, `immichAlbumId`, `immichShareUrl`.
      Exporter `UserRow`, `RsvpRow`, et faire pointer `RsvpStatus` sur `rsvps`.

- [ ] **Step 2: Ajouter les `CREATE TABLE IF NOT EXISTS` correspondants dans `ready()`**, plus les `ALTER TABLE events ADD COLUMN` pour `host_user_id`, `immich_album_id`, `immich_share_url`, chacun encadré d'un try/catch ignorant l'erreur « duplicate column » — la base de production existe déjà.

- [ ] **Step 3: Vérifier** — `npx tsc --noEmit` puis `npm run build`.

- [ ] **Step 4: Commit** — `git commit -am "Add accounts, sessions, codes and rsvps to the schema"`

---

### Task 6 : Migration des réponses existantes

**Files:** Create `src/lib/migrate.ts`, `src/lib/migrate.test.ts`

- [ ] **Step 1: Tests de la planification pure**

```ts
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { planPromotion } from "./migrate.ts";

const row = (over = {}) => ({ id: "g1", eventId: "e1", email: "A@X.fr", name: "Léa", photo: null, status: "yes", plusOnes: 1, message: null, createdAt: 1, updatedAt: 2, migratedAt: null, ...over });

describe("planPromotion", () => {
  test("crée un compte par adresse normalisée", () => {
    const p = planPromotion([row(), row({ id: "g2", eventId: "e2", email: "a@x.FR" })]);
    assert.equal(p.users.length, 1);
    assert.equal(p.users[0].email, "a@x.fr");
    assert.equal(p.rsvps.length, 2);
  });
  test("ignore les lignes sans adresse et les signale", () => {
    const p = planPromotion([row({ email: null }), row({ id: "g2" })]);
    assert.equal(p.rsvps.length, 1);
    assert.deepEqual(p.skipped, ["g1"]);
  });
  test("ignore les lignes déjà migrées", () => {
    assert.equal(planPromotion([row({ migratedAt: 123 })]).rsvps.length, 0);
  });
  test("garde le prénom et la photo les plus récents pour le compte", () => {
    const p = planPromotion([
      row({ id: "g1", name: "Ancien", photo: null, updatedAt: 1 }),
      row({ id: "g2", eventId: "e2", name: "Récent", photo: "data:image/jpeg;base64,AA==", updatedAt: 9 }),
    ]);
    assert.equal(p.users[0].name, "Récent");
    assert.equal(p.users[0].photo, "data:image/jpeg;base64,AA==");
  });
  test("une même personne sur le même événement ne donne qu'une réponse", () => {
    const p = planPromotion([row(), row({ id: "g2" })]);
    assert.equal(p.rsvps.length, 1);
  });
});
```

- [ ] **Step 2: Implémenter `planPromotion`** (pure : prend les lignes `guests`, rend `{ users, rsvps, skipped }`) **et `promoteLegacyGuests()`** qui l'exécute en base : `insert ... on conflict do nothing` sur `users`, idem sur `rsvps`, puis `update guests set migrated_at = ?`. Appeler `promoteLegacyGuests()` depuis `ready()` après les `CREATE TABLE`.

- [ ] **Step 3: Ajouter dans `ready()`** les `ALTER TABLE guests ADD COLUMN email TEXT` et `migrated_at INTEGER`, mêmes précautions qu'en Task 5.

- [ ] **Step 4: Tests verts, commit** — `git commit -m "Promote legacy guest rows into accounts, idempotently"`

---

### Task 7 : Envoi des codes

**Files:** Create `src/lib/mailer.ts`. `npm i nodemailer @types/nodemailer`

- [ ] **Step 1: Implémenter** `sendLoginCode(email, code)`. Si `SMTP_HOST` est absente, journaliser `[otp] <email> → <code>` et rendre la main : le parcours reste testable sans transport. Sinon `nodemailer.createTransport({ host, port, secure: port === 465, auth })` et un message texte simple portant le code et la durée de validité.

- [ ] **Step 2: Commit** — `git commit -m "Send login codes over SMTP, log them without it"`

---

### Task 8 : Sessions

**Files:** Create `src/lib/auth-store.ts`, `src/lib/session.ts`. Delete `src/lib/guest.ts`.

- [ ] **Step 1: `auth-store.ts`** — `createLoginCode`, `countRecentCodes`, `findLatestCode`, `bumpAttempts`, `consumeCode`, `findOrCreateUser`, `createSession`, `findSession` (jointure `users`, expiration vérifiée), `deleteSession`, `touchUser`, `updateProfile`.

- [ ] **Step 2: `session.ts`** — `currentUser(): Promise<UserRow | null>` (lit le cookie `session`, prolonge si à moins de 30 jours de l'expiration), `requireUser(next?: string): Promise<UserRow>` qui `redirect("/connexion?next=…")`, `startSession(userId)`, `endSession()`. Cookie `session` : `httpOnly`, `sameSite: "lax"`, `secure` en production, 90 jours.

- [ ] **Step 3: Vérifier** — `npx tsc --noEmit`. **Commit** — `git commit -m "Carry identity in a revocable server session"`

---

### Task 9 : Pages de connexion

**Files:** Create `src/app/connexion/page.tsx`, `src/app/connexion/actions.ts`, `src/components/LoginForm.tsx`, `src/components/CodeForm.tsx`

- [ ] **Step 1: `requestCode(prevState, form)`** — normaliser l'adresse (erreur « Adresse invalide » sinon), compter les codes récents selon `WINDOWS_MS`, et si `exceedsCaps` **rendre le même état de succès** sans rien envoyer. Sinon créer le code, l'envoyer, rendre `{ sent: true, email }`.

- [ ] **Step 2: `verifyCode(prevState, form)`** — charger le dernier code de l'adresse, `checkCode`; en cas d'échec incrémenter `attempts` et rendre « Code incorrect ou expiré ». En cas de succès : consommer, `findOrCreateUser`, `startSession`, `redirect(next ?? "/")`. Valider `next` : n'accepter qu'un chemin commençant par `/` et non `//`, sinon `/`.

- [ ] **Step 3: Page** — un seul écran à deux temps : le formulaire d'adresse, puis celui du code une fois `sent` vrai, avec un lien « changer d'adresse ». Reprendre `.field`, `.btn-ink`, `eyebrow`.

- [ ] **Step 4: Vérifier dans le navigateur** que le code apparaît dans les logs et ouvre bien une session. **Commit**

---

### Task 10 : Réponses rattachées au compte

**Files:** Modify `src/app/actions.ts`, `src/lib/rsvp.ts`, `src/lib/events.ts`, `src/components/RsvpForm.tsx`, `src/components/GuestList.tsx`, `src/app/e/[slug]/page.tsx`

- [ ] **Step 1: `listRsvps(eventId)`** joint `rsvps` et `users` et rend `{ id, userId, name, photo, status, plusOnes, message }`. Adapter `tally` et `findMine` (`findMine(list, userId)`), et leurs tests.

- [ ] **Step 2: `submitRsvp`** — `requireUser()`, plus de `guestKey`. Le prénom et la photo postés mettent à jour le **profil** s'il est vide, et la réponse ne stocke que statut, accompagnants et mot.

- [ ] **Step 3: `withdrawRsvp`** — supprime par `(eventId, userId)`.

- [ ] **Step 4: Tests de `rsvp.ts` mis à jour, verts. Commit**

---

### Task 11 : Création réservée à la liste

**Files:** Modify `src/app/page.tsx`, `src/app/actions.ts`, `src/app/e/[slug]/share/page.tsx`

- [ ] **Step 1: `createEvent`** — `const user = await requireUser()`, puis `if (!canCreateEvents(user.email)) return { errors: { form: "Ton adresse n'est pas autorisée à créer un événement." } }`. Enregistrer `hostUserId`, ne plus générer de jeton admin.

- [ ] **Step 2: Accueil** — si `canCreateEvents` est faux, remplacer le formulaire par un encart expliquant que la création est réservée, avec un lien vers le profil.

- [ ] **Step 3: `share/page.tsx`** — n'afficher que le lien public, le lien d'administration disparaît ; réserver la page au propriétaire.

- [ ] **Step 4: Commit**

---

### Task 12 : Administration par propriété

**Files:** Modify `src/app/e/[slug]/manage/page.tsx`, `src/app/actions.ts`, `src/lib/events.ts`

- [ ] **Step 1:** Remplacer `getEventByAdminToken` par `requireOwnedEvent(slug, userId)` qui rend l'événement si `hostUserId` correspond, et `notFound()` sinon — un événement dont on n'est pas propriétaire répond comme un événement inexistant.

- [ ] **Step 2:** `updateEvent` et `deleteEvent` prennent le `slug` et vérifient la propriété au lieu du jeton. Retirer le champ caché `token` de `EventForm`.

- [ ] **Step 3: Commit**

---

### Task 13 : Profil et historique

**Files:** Create `src/app/profil/page.tsx`, `src/app/profil/actions.ts`, `src/components/ProfileForm.tsx`. Modify `src/app/layout.tsx`

- [ ] **Step 1:** `saveProfile` — `requireUser`, valider prénom (1–60) et photo avec `photoSchema`, écrire dans `users`.

- [ ] **Step 2:** La page liste les événements organisés et ceux auxquels la personne a répondu, séparés en à venir et passés, triés par date. Une requête par groupe, jointure `rsvps`/`events`.

- [ ] **Step 3:** Ajouter dans l'en-tête du layout l'avatar et un lien vers `/profil` quand une session existe, un lien « Se connecter » sinon. Bouton de déconnexion sur le profil.

- [ ] **Step 4: Commit**

---

### Task 14 : Verrouiller ce qui reste

**Files:** Modify `src/app/e/[slug]/page.tsx`, `src/app/api/e/[slug]/ics/route.ts`

- [ ] **Step 1:** `requireUser()` en tête de la page événement, avec `next` pointant sur l'URL courante pour que la connexion ramène à l'invitation.

- [ ] **Step 2:** La route `.ics` exige une session et rend 401 sans redirection — c'est un téléchargement, pas une navigation.

- [ ] **Step 3: Vérifier dans le navigateur** : en navigation privée, ouvrir un lien d'invitation doit mener à `/connexion` puis revenir sur l'invitation après validation du code.

- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`. **Commit et push.**

---

## Phase 2 — Albums Immich

### Task 15 : Client Immich

**Files:** Create `src/lib/immich.ts`, `src/lib/immich.test.ts`

- [ ] **Step 1: Tests des parties pures**

```ts
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { immichConfigured, shareUrl } from "./immich.ts";

describe("shareUrl", () => {
  test("assemble l'URL publique documentée", () => {
    assert.equal(shareUrl("https://immich.test", "AbC-123"), "https://immich.test/share/AbC-123");
  });
  test("tolère une barre oblique finale", () => {
    assert.equal(shareUrl("https://immich.test/", "k"), "https://immich.test/share/k");
  });
});

describe("immichConfigured", () => {
  test("exige les deux variables", () => {
    assert.equal(immichConfigured({ url: "https://i.test", key: "k" }), true);
    assert.equal(immichConfigured({ url: "https://i.test", key: "" }), false);
    assert.equal(immichConfigured({ url: "", key: "k" }), false);
  });
});
```

- [ ] **Step 2: Implémenter** `shareUrl`, `immichConfigured`, et `createSharedAlbum(title, description)` qui enchaîne `POST {url}/api/albums` puis `POST {url}/api/shared-links` (`type: "ALBUM"`, `albumId`, `allowUpload: true`, `allowDownload: true`), en-tête `x-api-key`, et rend `{ albumId, shareUrl }`. Toute réponse non 2xx lève une erreur portant le statut.

- [ ] **Step 3: Tests verts, commit**

---

### Task 16 : Case à la création et bouton de rattrapage

**Files:** Modify `src/components/EventForm.tsx`, `src/app/actions.ts`, `src/app/e/[slug]/manage/page.tsx`, `src/app/e/[slug]/page.tsx`

- [ ] **Step 1:** Case « Créer un album photo partagé » dans `EventForm`, rendue uniquement si Immich est configuré (booléen passé par la page serveur).

- [ ] **Step 2:** Dans `createEvent`, **après** l'insertion de l'événement, si la case est cochée : appeler `createSharedAlbum` dans un try/catch et écrire `immichAlbumId`/`immichShareUrl`. Un échec ne remonte pas d'erreur bloquante — l'événement existe déjà.

- [ ] **Step 3:** Action `createAlbumForEvent(slug)` réservée au propriétaire, et bouton sur la page d'administration quand `immichShareUrl` est nul. Afficher le message d'erreur en cas d'échec.

- [ ] **Step 4:** Sur la page publique, afficher le lien de l'album pour tous les invités quand il existe.

- [ ] **Step 5:** `npm test`, `npx tsc --noEmit`, `npx eslint .`, `npm run build`. **Commit et push.**

---

## Après livraison

Mettre à jour `README.md` (variables, exploitation de la migration), `.env.example`, et `compose.yaml` — le fichier de liste blanche doit être monté en lecture seule dans le conteneur et `WHITELIST_FILE` pointer dessus.
