import { z } from "zod";

/** ~200 Ko of base64 — a 256px thumbnail lands well under this. */
export const MAX_PHOTO_CHARS = 200_000;
export const MAX_PLUS_ONES = 20;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .catch(null);

const timestamp = z.coerce
  .number()
  .int()
  .refine((value) => Number.isFinite(value) && value > 0, "Date invalide");

export const photoSchema = z
  .string()
  .trim()
  .max(MAX_PHOTO_CHARS, "Photo trop lourde")
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Format d'image non supporté");

export const eventInputSchema = z
  .object({
    title: z.string().trim().min(1, "Donne un titre à ton événement").max(120),
    description: optionalText(2000),
    location: optionalText(200),
    hostName: optionalText(80),
    startsAt: timestamp,
    endsAt: timestamp.nullable().catch(null),
    rsvpDeadline: timestamp.nullable().catch(null),
    allDay: z.coerce.boolean().default(false),
    timezone: z.string().trim().min(1).max(64).default("Europe/Paris"),
  })
  .refine((input) => input.endsAt === null || input.endsAt > input.startsAt, {
    message: "La fin doit suivre le début",
    path: ["endsAt"],
  })
  .refine((input) => input.rsvpDeadline === null || input.rsvpDeadline <= input.startsAt, {
    message: "La date limite doit précéder l'événement",
    path: ["rsvpDeadline"],
  });

export const rsvpInputSchema = z.object({
  name: z.string().trim().min(1, "Indique ton prénom").max(60),
  status: z.enum(["yes", "no", "maybe"], { message: "Choisis une réponse" }),
  plusOnes: z.coerce.number().int().min(0).max(MAX_PLUS_ONES).catch(0),
  message: optionalText(280),
  photo: photoSchema.nullable().catch(null),
});

export type EventInput = z.infer<typeof eventInputSchema>;
export type RsvpInput = z.infer<typeof rsvpInputSchema>;

/** Collapses a ZodError into `{ field: firstMessage }` for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}
