"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { type FormState, removeGuestRsvp, setGuestRsvp } from "@/app/actions";
import { Avatar } from "./Avatar";
import type { RsvpStatus } from "@/db/schema";
import type { RsvpView } from "@/lib/rsvp";
import { MAX_PLUS_ONES } from "@/lib/validation";

const LABELS: Record<RsvpStatus, string> = {
  yes: "Présent",
  maybe: "Peut-être",
  no: "Absent",
};

const TINTS: Record<RsvpStatus, string> = {
  yes: "var(--color-yes)",
  maybe: "var(--color-maybe)",
  no: "var(--color-no)",
};

function SaveButton({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  if (!dirty) return null;
  return (
    <button type="submit" className="btn-ink animate-rise px-4 py-2 text-sm" disabled={pending}>
      {pending ? "…" : "Enregistrer"}
    </button>
  );
}

function Row({ guest, slug }: { guest: RsvpView; slug: string }) {
  const [state, action] = useActionState<FormState, FormData>(setGuestRsvp, {});
  const id = useId();

  const [status, setStatus] = useState<RsvpStatus>(guest.status);
  const [plusOnes, setPlusOnes] = useState(guest.plusOnes);

  const dirty = status !== guest.status || plusOnes !== guest.plusOnes;

  return (
    <li className="border-(--rule) border-t py-4 first:border-t-0">
      <form action={action} className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="rsvpId" value={guest.id} />
        <input type="hidden" name="plusOnes" value={plusOnes} />

        <Avatar name={guest.name} photo={guest.photo} size={36} />

        <div className="min-w-0 flex-1">
          <p className="leading-tight font-bold">
            {guest.name}
            {guest.hostEditedAt ? (
              <span className="text-ink-faint ml-2 text-xs font-normal">
                modifié par toi
              </span>
            ) : null}
          </p>
          {guest.message ? (
            <p className="text-ink-soft truncate text-sm">« {guest.message} »</p>
          ) : null}
        </div>

        <label className="sr-only" htmlFor={`${id}-status`}>
          Réponse de {guest.name}
        </label>
        <select
          id={`${id}-status`}
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as RsvpStatus)}
          style={{ borderColor: TINTS[status], color: TINTS[status] }}
          className="bg-(--surface) rounded-full border px-3 py-1.5 text-sm font-bold"
        >
          {(Object.keys(LABELS) as RsvpStatus[]).map((value) => (
            <option key={value} value={value}>
              {LABELS[value]}
            </option>
          ))}
        </select>

        {status === "yes" ? (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label={`Un accompagnant de moins pour ${guest.name}`}
              className="btn-quiet size-8 justify-center p-0"
              onClick={() => setPlusOnes((n) => Math.max(0, n - 1))}
            >
              −
            </button>
            <span className="w-10 text-center text-sm tabular-nums">
              {plusOnes === 0 ? "seul" : `+${plusOnes}`}
            </span>
            <button
              type="button"
              aria-label={`Un accompagnant de plus pour ${guest.name}`}
              className="btn-quiet size-8 justify-center p-0"
              onClick={() => setPlusOnes((n) => Math.min(MAX_PLUS_ONES, n + 1))}
            >
              +
            </button>
          </span>
        ) : null}

        <SaveButton dirty={dirty} />

        <button
          type="submit"
          formAction={removeGuestRsvp}
          formNoValidate
          className="text-ink-faint hover:text-no text-sm underline underline-offset-4"
        >
          Retirer
        </button>
      </form>

      {state.errors?.form ? (
        <p className="text-no mt-1 text-sm font-semibold" role="alert">
          {state.errors.form}
        </p>
      ) : null}
    </li>
  );
}

export function GuestAdminList({
  guests,
  slug,
}: {
  guests: RsvpView[];
  slug: string;
}) {
  if (guests.length === 0) {
    return (
      <p className="text-ink-faint text-sm">
        Personne n&apos;a encore répondu.
      </p>
    );
  }

  return (
    <>
      <ul>
        {guests.map((guest) => (
          <Row key={guest.id} guest={guest} slug={slug} />
        ))}
      </ul>
      <p className="text-ink-faint mt-4 text-sm text-pretty">
        Changer une réponse ici la marque comme modifiée par toi, et la personne
        le voit sur sa page. Son mot reste intact : il ne t&apos;appartient pas
        de le réécrire.
      </p>
    </>
  );
}
