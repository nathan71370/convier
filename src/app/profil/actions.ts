"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateProfile } from "@/lib/auth-store";
import { requireUser } from "@/lib/session";
import { fieldErrors, photoSchema } from "@/lib/validation";

export type ProfileState = { errors?: Record<string, string>; ok?: boolean };

const profileSchema = z.object({
  name: z.string().trim().min(1, "Indique ton prénom").max(60),
  photo: photoSchema.nullable().catch(null),
});

export async function saveProfile(
  _prev: ProfileState,
  form: FormData,
): Promise<ProfileState> {
  const user = await requireUser("/profil");

  const photo = String(form.get("photo") ?? "").trim();
  const parsed = profileSchema.safeParse({
    name: String(form.get("name") ?? ""),
    photo: photo || null,
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await updateProfile(user.id, { name: parsed.data.name, photo: parsed.data.photo });

  revalidatePath("/profil");
  return { ok: true };
}
