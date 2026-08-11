"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "./Avatar";
import { toSquareDataUrl } from "@/lib/photo";

export function PhotoPicker({
  name,
  initialPhoto,
}: {
  name: string;
  initialPhoto: string | null;
}) {
  const [photo, setPhoto] = useState<string | null>(initialPhoto);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await toSquareDataUrl(file);
      startTransition(() => setPhoto(dataUrl));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image illisible.");
    }
  }

  return (
    <div className="flex items-center gap-4">
      <input type="hidden" name="photo" value={photo ?? ""} />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <Avatar name={name || "?"} photo={photo} size={56} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-quiet"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
        >
          {photo ? "Changer la photo" : "Ajouter une photo"}
        </button>
        {photo ? (
          <button
            type="button"
            className="text-ink-soft hover:text-no text-sm font-semibold underline underline-offset-4"
            onClick={() => setPhoto(null)}
          >
            Retirer
          </button>
        ) : (
          <span className="text-ink-faint text-sm">facultatif</span>
        )}
      </div>

      {error ? (
        <p className="text-no text-sm font-semibold" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
