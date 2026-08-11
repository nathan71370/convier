import { customAlphabet, nanoid } from "nanoid";

/** No look-alike characters: a slug often gets read out loud or retyped. */
const readable = customAlphabet("23456789abcdefghijkmnpqrstuvwxyz", 6);

export const newId = () => nanoid(16);

/** 32 chars of unguessable secret — the only thing standing between a
 * stranger and the delete button. */
export const newAdminToken = () => nanoid(32);

export const newGuestKey = () => nanoid(24);

export function slugify(title: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base ? `${base}-${readable()}` : readable();
}
