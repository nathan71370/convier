import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { createSharedAlbum, immichConfigured, shareUrl } from "./immich.ts";

describe("shareUrl", () => {
  test("assemble l'adresse publique documentée", () => {
    assert.equal(shareUrl("https://immich.test", "AbC-123"), "https://immich.test/share/AbC-123");
  });

  test("tolère une barre oblique finale", () => {
    assert.equal(shareUrl("https://immich.test/", "k"), "https://immich.test/share/k");
  });
});

describe("immichConfigured", () => {
  test("exige les deux réglages", () => {
    assert.equal(immichConfigured({ url: "https://i.test", key: "k" }), true);
    assert.equal(immichConfigured({ url: "https://i.test", key: "" }), false);
    assert.equal(immichConfigured({ url: "", key: "k" }), false);
  });
});

describe("createSharedAlbum", () => {
  const config = { url: "https://immich.test", key: "secret" };

  function stubFetch(handler: (url: string, init: RequestInit) => Response) {
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) =>
      handler(String(input), init ?? {})) as typeof fetch;
    return () => {
      globalThis.fetch = original;
    };
  }

  test("crée l'album puis le lien, et rend l'adresse publique", async () => {
    const seen: { url: string; body: unknown; key: string | undefined }[] = [];
    const restore = stubFetch((url, init) => {
      seen.push({
        url,
        body: JSON.parse(String(init.body)),
        key: new Headers(init.headers).get("x-api-key") ?? undefined,
      });
      const payload = url.endsWith("/albums") ? { id: "album-1" } : { key: "lien-1" };
      return new Response(JSON.stringify(payload), { status: 200 });
    });

    try {
      const result = await createSharedAlbum("Raclette", "Les photos", config);
      assert.deepEqual(result, {
        albumId: "album-1",
        shareUrl: "https://immich.test/share/lien-1",
      });
    } finally {
      restore();
    }

    assert.equal(seen.length, 2);
    assert.equal(seen[0].url, "https://immich.test/api/albums");
    assert.deepEqual(seen[0].body, { albumName: "Raclette", description: "Les photos" });
    assert.equal(seen[0].key, "secret", "la clé d'API doit voyager en en-tête");

    assert.equal(seen[1].url, "https://immich.test/api/shared-links");
    assert.deepEqual(seen[1].body, {
      type: "ALBUM",
      albumId: "album-1",
      allowUpload: true,
      allowDownload: true,
    });
  });

  test("le lien autorise le dépôt, sinon l'album ne sert à rien", async () => {
    let body: Record<string, unknown> = {};
    const restore = stubFetch((url, init) => {
      if (url.endsWith("/shared-links")) body = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify(url.endsWith("/albums") ? { id: "a" } : { key: "k" }),
        { status: 200 },
      );
    });
    try {
      await createSharedAlbum("T", "D", config);
    } finally {
      restore();
    }
    assert.equal(body.allowUpload, true);
  });

  test("remonte une erreur portant le statut renvoyé", async () => {
    const restore = stubFetch(() => new Response("clé refusée", { status: 401 }));
    try {
      await assert.rejects(
        () => createSharedAlbum("T", "D", config),
        /401/,
        "le statut doit apparaître pour que la panne soit diagnosticable",
      );
    } finally {
      restore();
    }
  });

  test("refuse de partir sans configuration", async () => {
    await assert.rejects(
      () => createSharedAlbum("T", "D", { url: "", key: "" }),
      /pas configuré/,
    );
  });
});
