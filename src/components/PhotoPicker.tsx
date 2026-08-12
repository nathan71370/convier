"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "./Avatar";
import { CameraCapture } from "./CameraCapture";
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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const albumRef = useRef<HTMLInputElement>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);

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

  function openCamera() {
    setError(null);
    // Needs a secure context; in-app browsers sometimes withhold it. The file
    // input with `capture` still reaches a camera there, even if it picks the
    // lens itself.
    // Typed as always present, absent in practice on insecure origins.
    const media = navigator.mediaDevices as MediaDevices | undefined;
    if (media && typeof media.getUserMedia === "function") setCameraOpen(true);
    else fallbackRef.current?.click();
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="photo" value={photo ?? ""} />
      <input
        ref={albumRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onPicked}
      />
      <input
        ref={fallbackRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        onChange={onPicked}
      />

      {cameraOpen ? (
        <CameraCapture
          onCapture={(dataUrl) => {
            setPhoto(dataUrl);
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />
      ) : null}

      <div className="flex items-center gap-4">
        <Avatar name={name || "?"} photo={photo} size={56} />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-quiet"
            onClick={openCamera}
            disabled={pending || cameraOpen}
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
