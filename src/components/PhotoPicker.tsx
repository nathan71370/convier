"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "./Avatar";
import { toSquareDataUrl } from "@/lib/photo";

function CameraIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 5.5h2.2l1-1.6h3.6l1 1.6H12a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 12 13.5H2A1.5 1.5 0 0 1 .5 12V7A1.5 1.5 0 0 1 2 5.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        transform="translate(1)"
      />
      <circle cx="8" cy="9.5" r="2.3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function AlbumIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="m2 11 3.2-3.2a1 1 0 0 1 1.4 0L9 10.2m1.4-1.4a1 1 0 0 1 1.4 0L14 11"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="10.5" cy="5.8" r="1.1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

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

  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await toSquareDataUrl(file);
      startTransition(() => setPhoto(dataUrl));
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Cette image n'a pas pu être lue. Essaie une autre photo.",
      );
    }
  }

  function onPicked(event: React.ChangeEvent<HTMLInputElement>) {
    void handleFile(event.target.files?.[0]);
    // Reset so re-picking the same file fires change again.
    event.target.value = "";
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="photo" value={photo ?? ""} />

      {/*
        Two inputs rather than one. A lone file input sends most phones straight
        to the album; `capture` is what opens the camera instead — and `user`,
        not `environment`, because someone photographing themselves for an
        avatar wants the front lens.
      */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        onChange={onPicked}
      />
      <input
        ref={albumRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onPicked}
      />

      <div className="flex items-center gap-4">
        <Avatar name={name || "?"} photo={photo} size={56} />

        <div className="flex flex-wrap items-center gap-2">
          {/*
            The camera button appears only on a coarse pointer. On a desktop
            browser `capture` is ignored and would just reopen the file dialog,
            so the label would promise something it cannot deliver. A media
            query keeps this out of JavaScript, and so out of hydration.
          */}
          <button
            type="button"
            className="btn-quiet hidden [@media(pointer:coarse)]:inline-flex"
            onClick={() => cameraRef.current?.click()}
            disabled={pending}
          >
            <CameraIcon />
            Prendre une photo
          </button>

          <button
            type="button"
            className="btn-quiet"
            onClick={() => albumRef.current?.click()}
            disabled={pending}
          >
            <AlbumIcon />
            {photo ? "Choisir une autre" : "Choisir une photo"}
          </button>

          {photo ? (
            <button
              type="button"
              className="text-ink-soft hover:text-no text-sm font-semibold underline underline-offset-4"
              onClick={() => {
                setPhoto(null);
                setError(null);
              }}
            >
              Retirer
            </button>
          ) : (
            <span className="text-ink-faint text-sm">facultatif</span>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-no text-sm font-semibold" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
