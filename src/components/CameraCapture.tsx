"use client";

import { useEffect, useRef, useState } from "react";
import { frameToSquareDataUrl } from "@/lib/photo";

export type Facing = "user" | "environment";

/**
 * An in-page camera.
 *
 * The `capture` attribute on a file input only hands Android a hint: Chrome
 * forwards it to whatever camera app the phone uses, and the Pixel's ignores
 * the requested lens and opens the rear one. getUserMedia asks for the lens
 * directly, so "take a selfie" actually shows a face — and the visitor never
 * leaves the page.
 */
export function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>("user");
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let dropped = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false })
      .then((stream) => {
        // The effect may have been cleaned up while permission was pending;
        // leaving the tracks running would keep the camera light on.
        if (dropped) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setLive(true);
      })
      .catch((cause: unknown) => {
        if (dropped) return;
        const kind = cause instanceof DOMException ? cause.name : "";
        setError(
          kind === "NotAllowedError"
            ? "Accès à la caméra refusé. Autorise-le dans ton navigateur, ou choisis une photo dans ton album."
            : kind === "NotFoundError"
              ? "Aucune caméra détectée sur cet appareil."
              : "La caméra n'a pas pu démarrer. Choisis plutôt une photo dans ton album.",
        );
      });

    return () => {
      dropped = true;
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
      streamRef.current = null;
    };
  }, [facing]);

  function shoot() {
    const video = videoRef.current;
    if (!video) return;
    try {
      onCapture(frameToSquareDataUrl(video, facing === "user"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Prise de vue impossible.");
    }
  }

  function flip() {
    setLive(false);
    setError(null);
    setFacing((current) => (current === "user" ? "environment" : "user"));
  }

  return (
    <div className="border-(--rule) bg-(--surface) space-y-3 rounded-lg border p-3">
      {error ? (
        <p className="text-no text-sm font-semibold" role="alert">
          {error}
        </p>
      ) : (
        <div className="relative mx-auto aspect-square w-full max-w-[240px] overflow-hidden rounded-full">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="size-full object-cover"
            // Mirrored preview for the front lens: framing yourself against an
            // unmirrored image feels backwards. The capture matches it.
            style={facing === "user" ? { transform: "scaleX(-1)" } : undefined}
          />
          {!live ? (
            <span className="text-ink-faint absolute inset-0 grid place-items-center text-sm">
              Démarrage de la caméra…
            </span>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {!error ? (
          <>
            <button
              type="button"
              className="btn-ink px-5 py-2.5 text-sm"
              onClick={shoot}
              disabled={!live}
            >
              Prendre la photo
            </button>
            <button type="button" className="btn-quiet" onClick={flip}>
              Changer d&apos;objectif
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="text-ink-soft hover:text-vermilion text-sm font-semibold underline underline-offset-4"
          onClick={onClose}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
