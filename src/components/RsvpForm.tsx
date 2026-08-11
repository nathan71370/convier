"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { type FormState, submitRsvp, withdrawRsvp } from "@/app/actions";
import { FieldError, Label } from "./Field";
import { PhotoPicker } from "./PhotoPicker";
import type { RsvpStatus } from "@/db/schema";
import { MAX_PLUS_ONES } from "@/lib/validation";

const CHOICES: { value: RsvpStatus; label: string; mark: string; tint: string }[] = [
  { value: "yes", label: "Je serai là", mark: "✓", tint: "var(--color-yes)" },
  { value: "maybe", label: "Je ne sais pas encore", mark: "?", tint: "var(--color-maybe)" },
  { value: "no", label: "Je ne pourrai pas", mark: "✕", tint: "var(--color-no)" },
];

type Mine = {
  name: string;
  photo: string | null;
  status: RsvpStatus;
  plusOnes: number;
  message: string | null;
} | null;

function Submit({ existing }: { existing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-ink" disabled={pending}>
      {pending ? "Un instant…" : existing ? "Mettre à jour ma réponse" : "Envoyer ma réponse"}
    </button>
  );
}

export function RsvpForm({ slug, mine }: { slug: string; mine: Mine }) {
  const [state, formAction] = useActionState<FormState, FormData>(submitRsvp, {});
  const id = useId();
  const errors = state.errors ?? {};

  const [name, setName] = useState(mine?.name ?? "");
  const [status, setStatus] = useState<RsvpStatus | null>(mine?.status ?? null);
  const [plusOnes, setPlusOnes] = useState(mine?.plusOnes ?? 0);

  return (
    <form action={formAction} className="space-y-7">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="status" value={status ?? ""} />
      <input type="hidden" name="plusOnes" value={plusOnes} />

      <fieldset>
        <legend className="eyebrow mb-3">Ta réponse</legend>
        {/* Stacked, not side by side: the card sits in a narrow column and
            three-across squeezes every label onto three lines. */}
        <div className="grid gap-2.5">
          {CHOICES.map((choice) => {
            const active = status === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(choice.value)}
                style={
                  active
                    ? { borderColor: choice.tint, color: choice.tint }
                    : undefined
                }
                className={`border-(--rule) group flex items-center gap-3 rounded-full border px-4 py-3 text-left text-sm font-bold transition-all ${
                  active ? "bg-(--surface) shadow-sm" : "hover:border-ink-faint opacity-75 hover:opacity-100"
                }`}
              >
                <span
                  aria-hidden
                  style={{ background: active ? choice.tint : "transparent", color: active ? "#fff" : undefined }}
                  className={`border-(--rule) flex size-7 shrink-0 items-center justify-center rounded-full text-base ${
                    active ? "animate-stamp border-transparent" : "border"
                  }`}
                >
                  {choice.mark}
                </span>
                {choice.label}
              </button>
            );
          })}
        </div>
        <FieldError message={errors.status} />
      </fieldset>

      <div className="grid gap-6">
        <div>
          <Label htmlFor={`${id}-name`}>Ton prénom</Label>
          <input
            id={`${id}-name`}
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={60}
            autoComplete="given-name"
            placeholder="Camille"
            className="field mt-1 text-lg"
          />
          <FieldError message={errors.name} />
        </div>

        <div>
          <span className="eyebrow">Ta photo</span>
          <div className="mt-2">
            <PhotoPicker name={name} initialPhoto={mine?.photo ?? null} />
          </div>
          <FieldError message={errors.photo} />
        </div>
      </div>

      {status === "yes" ? (
        <div className="animate-rise">
          <span className="eyebrow">Tu viens accompagné ?</span>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              aria-label="Un accompagnant de moins"
              className="btn-quiet size-10 justify-center p-0 text-lg"
              onClick={() => setPlusOnes((n) => Math.max(0, n - 1))}
            >
              −
            </button>
            <span className="font-title min-w-24 text-center text-lg">
              {plusOnes === 0 ? "Seul·e" : `+ ${plusOnes}`}
            </span>
            <button
              type="button"
              aria-label="Un accompagnant de plus"
              className="btn-quiet size-10 justify-center p-0 text-lg"
              onClick={() => setPlusOnes((n) => Math.min(MAX_PLUS_ONES, n + 1))}
            >
              +
            </button>
          </div>
        </div>
      ) : null}

      <div>
        <Label htmlFor={`${id}-message`} hint="facultatif">
          Un mot
        </Label>
        <input
          id={`${id}-message`}
          name="message"
          defaultValue={mine?.message ?? ""}
          maxLength={280}
          placeholder="J'arriverai vers 21h, je ramène le dessert"
          className="field mt-1"
        />
        <FieldError message={errors.message} />
      </div>

      <FieldError message={errors.form} />

      <div className="flex flex-wrap items-center gap-4">
        <Submit existing={Boolean(mine)} />
        {mine ? (
          <button
            type="submit"
            formAction={withdrawRsvp}
            formNoValidate
            className="text-ink-soft hover:text-no text-sm font-semibold underline underline-offset-4 transition-colors"
          >
            Retirer ma réponse
          </button>
        ) : null}
      </div>
    </form>
  );
}
