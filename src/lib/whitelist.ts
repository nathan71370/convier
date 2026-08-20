import { readFileSync, statSync } from "node:fs";

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function normalizeEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return EMAIL.test(value) ? value : null;
}

/**
 * The file is written by hand and shared between several applications, so the
 * parser is deliberately liberal: commas, semicolons, newlines, `#` comments.
 */
export function parseWhitelist(contents: string): Set<string> {
  const out = new Set<string>();
  for (const line of contents.split(/\r?\n/)) {
    for (const piece of line.split("#")[0].split(/[,;]/)) {
      const email = normalizeEmail(piece);
      if (email) out.add(email);
    }
  }
  return out;
}

let cache: { key: string; set: Set<string> } | null = null;

/**
 * Fails closed. With no variable or no readable file, nobody may create an
 * event: an access list that lets everyone through when it breaks is a silent
 * trap. The blast radius stays small — the rest of the app keeps working.
 */
export function loadWhitelist(): Set<string> {
  const path = process.env.WHITELIST_FILE;
  if (!path) {
    console.error("[whitelist] WHITELIST_FILE non définie : aucune création autorisée.");
    return new Set();
  }
  try {
    const stat = statSync(path);
    // Re-read only when the file actually changed, so adding an address takes
    // effect without a redeploy but costs nothing per request.
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
