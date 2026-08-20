/**
 * Immich shared albums.
 *
 * Two calls, both authenticated by the `x-api-key` header: create the album,
 * then hand it a public link. `allowUpload` is the whole point — guests drop
 * their own photos in rather than only looking at the host's.
 */

export type ImmichConfig = { url: string; key: string };

export const immichConfigured = (config: ImmichConfig): boolean =>
  config.url.length > 0 && config.key.length > 0;

export function readImmichConfig(): ImmichConfig {
  return {
    url: (process.env.IMMICH_URL ?? "").trim().replace(/\/+$/, ""),
    key: (process.env.IMMICH_API_KEY ?? "").trim(),
  };
}

/** The public address of a shared link, as Immich itself builds it. */
export const shareUrl = (base: string, key: string): string =>
  `${base.replace(/\/+$/, "")}/share/${key}`;

async function call<T>(
  config: ImmichConfig,
  path: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(`${config.url}/api${path}`, {
    method: "POST",
    headers: {
      "x-api-key": config.key,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
    // Nothing here should ever be served from a cache.
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Immich a répondu ${response.status} sur ${path}${detail ? ` : ${detail.slice(0, 200)}` : ""}`,
    );
  }

  return (await response.json()) as T;
}

export type SharedAlbum = { albumId: string; shareUrl: string };

export async function createSharedAlbum(
  title: string,
  description: string,
  config: ImmichConfig = readImmichConfig(),
): Promise<SharedAlbum> {
  if (!immichConfigured(config)) throw new Error("Immich n'est pas configuré.");

  const album = await call<{ id: string }>(config, "/albums", {
    albumName: title,
    description,
  });

  const link = await call<{ key: string }>(config, "/shared-links", {
    type: "ALBUM",
    albumId: album.id,
    allowUpload: true,
    allowDownload: true,
  });

  return { albumId: album.id, shareUrl: shareUrl(config.url, link.key) };
}
