"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createAlbumForEvent, type FormState } from "@/app/actions";
import { FieldError } from "./Field";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-quiet" disabled={pending}>
      {pending ? "Création en cours…" : "Créer l'album photo partagé"}
    </button>
  );
}

/** Also the retry: a failed creation leaves the event intact and this button here. */
export function AlbumButton({ slug }: { slug: string }) {
  const [state, action] = useActionState<FormState, FormData>(createAlbumForEvent, {});

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="slug" value={slug} />
      <Submit />
      <p className="text-ink-soft text-sm text-pretty">
        Un album Immich sera créé et son lien affiché sur la page de
        l&apos;événement. Tes invités pourront y déposer leurs photos.
      </p>
      <FieldError message={state.errors?.form} />
    </form>
  );
}
