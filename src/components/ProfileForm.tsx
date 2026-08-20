"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { type ProfileState, saveProfile } from "@/app/profil/actions";
import { FieldError, Label } from "./Field";
import { PhotoPicker } from "./PhotoPicker";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-ink" disabled={pending}>
      {pending ? "Un instant…" : "Enregistrer"}
    </button>
  );
}

export function ProfileForm({
  name: initialName,
  photo,
}: {
  name: string | null;
  photo: string | null;
}) {
  const [state, action] = useActionState<ProfileState, FormData>(saveProfile, {});
  const [name, setName] = useState(initialName ?? "");

  return (
    <form action={action} className="space-y-7">
      <div>
        <Label htmlFor="name">Ton prénom</Label>
        <input
          id="name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={60}
          autoComplete="given-name"
          placeholder="Camille"
          className="field mt-1 text-lg"
        />
        <FieldError message={state.errors?.name} />
      </div>

      <div>
        <span className="eyebrow">Ta photo</span>
        <div className="mt-2">
          <PhotoPicker name={name} initialPhoto={photo} />
        </div>
        <FieldError message={state.errors?.photo} />
      </div>

      <p className="text-ink-faint text-sm text-pretty">
        Ce prénom et cette photo apparaissent sur toutes tes réponses, passées
        comme à venir. Les changer les met à jour partout.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <Submit />
        {state.ok ? (
          <span className="text-yes animate-stamp text-sm font-bold">
            ✓ Profil enregistré
          </span>
        ) : null}
      </div>
    </form>
  );
}
