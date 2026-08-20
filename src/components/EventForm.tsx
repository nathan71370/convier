"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/app/actions";
import { DateTimeField } from "./DateTimeField";
import { FieldError, Label } from "./Field";

export type EventFormInitial = {
  title: string;
  description: string;
  location: string;
  /** Wall-clock strings already expressed in `timezone` by the server. */
  startLocal: string;
  endLocal: string;
  deadlineLocal: string;
  allDay: boolean;
};

type Props = {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  initial: EventFormInitial;
  /** The zone the wall-clock values above belong to. */
  timezone: string;
  /** Creating: adopt the visitor's zone. Editing: keep the event's own. */
  detectTimezone: boolean;
  /** Shown only when the server has Immich configured. */
  offerAlbum?: boolean;
  hidden?: Record<string, string>;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-ink w-full sm:w-auto" disabled={pending}>
      {pending ? "Un instant…" : label}
    </button>
  );
}

export function EventForm({
  action,
  submitLabel,
  initial,
  timezone,
  detectTimezone,
  offerAlbum,
  hidden,
}: Props) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const id = useId();
  const errors = state.errors ?? {};

  const [allDay, setAllDay] = useState(initial.allDay);
  const [start, setStart] = useState(initial.startLocal);
  const [end, setEnd] = useState(initial.endLocal);
  const [deadline, setDeadline] = useState(initial.deadlineLocal);
  const [showExtras, setShowExtras] = useState(
    Boolean(initial.endLocal || initial.deadlineLocal),
  );

  // Written straight to the DOM rather than through state: the server rendered
  // a zone already, and a re-render here would only risk a hydration mismatch.
  const timezoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!detectTimezone || !timezoneRef.current) return;
    timezoneRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, [detectTimezone]);

  // Switching to an all-day event drops the time portion rather than keeping a
  // stale hour hidden in state.
  function switchAllDay(next: boolean) {
    setAllDay(next);
    setStart((value) => (next ? value.slice(0, 10) : `${value.slice(0, 10)}T19:30`));
    setEnd((value) =>
      value ? (next ? value.slice(0, 10) : `${value.slice(0, 10)}T23:00`) : value,
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      {Object.entries(hidden ?? {}).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <input ref={timezoneRef} type="hidden" name="timezone" defaultValue={timezone} />

      <div>
        <Label htmlFor={`${id}-title`}>Quel est l&apos;événement ?</Label>
        <input
          id={`${id}-title`}
          name="title"
          defaultValue={initial.title}
          required
          maxLength={120}
          autoComplete="off"
          placeholder="Crémaillère chez Nathan"
          className="field font-title mt-1 text-2xl leading-snug sm:text-3xl"
          style={{ fontVariationSettings: "'SOFT' 30, 'WONK' 1" }}
        />
        <FieldError message={errors.title} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-start`}>Quand</Label>
          <DateTimeField
            key={`start-${allDay}`}
            id={`${id}-start`}
            name="startsAt"
            value={start}
            onChange={setStart}
            withTime={!allDay}
            required
          />
          <FieldError message={errors.startsAt} />
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="allDay"
              checked={allDay}
              onChange={(event) => switchAllDay(event.target.checked)}
              className="accent-vermilion size-4"
            />
            Journée entière
          </label>
        </div>

        <div>
          <Label htmlFor={`${id}-location`} hint="facultatif">
            Où
          </Label>
          <input
            id={`${id}-location`}
            name="location"
            defaultValue={initial.location}
            maxLength={200}
            autoComplete="off"
            placeholder="12 rue des Lilas, Lyon"
            className="field mt-1"
          />
          <FieldError message={errors.location} />
        </div>
      </div>

      <div>
        <Label htmlFor={`${id}-description`} hint="facultatif">
          Un mot pour les invités
        </Label>
        <textarea
          id={`${id}-description`}
          name="description"
          defaultValue={initial.description}
          rows={3}
          maxLength={2000}
          placeholder="On commence par l'apéro, ramenez ce que vous voulez boire."
          className="field mt-1 resize-y"
        />
        <FieldError message={errors.description} />
      </div>

      {showExtras ? (
        <div className="border-(--rule) grid gap-6 border-l-2 pl-5 sm:grid-cols-2">
          <div className="min-w-0">
            <Label htmlFor={`${id}-end`} hint="facultatif">
              Fin
            </Label>
            <DateTimeField
              key={`end-${allDay}`}
              id={`${id}-end`}
              name="endsAt"
              value={end}
              onChange={setEnd}
              withTime={!allDay}
            />
            <FieldError message={errors.endsAt} />
          </div>
          <div className="min-w-0">
            <Label htmlFor={`${id}-deadline`} hint="facultatif">
              Réponses avant le
            </Label>
            <DateTimeField
              id={`${id}-deadline`}
              name="rsvpDeadline"
              value={deadline}
              onChange={setDeadline}
              withTime
            />
            <FieldError message={errors.rsvpDeadline} />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowExtras(true)}
          className="text-ink-soft hover:text-vermilion text-sm font-semibold underline underline-offset-4 transition-colors"
        >
          + Heure de fin, date limite de réponse
        </button>
      )}

      {offerAlbum ? (
        <label className="border-(--rule) flex cursor-pointer items-start gap-3 border-l-2 py-1 pl-4 text-sm">
          <input type="checkbox" name="immichAlbum" className="accent-vermilion mt-1 size-4" />
          <span>
            <strong className="block font-bold">Créer un album photo partagé</strong>
            <span className="text-ink-soft">
              Un album Immich est créé et son lien affiché sur la page. Tes invités
              pourront y déposer leurs photos sans avoir de compte.
            </span>
          </span>
        </label>
      ) : null}

      <FieldError message={errors.form} />

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <Submit label={submitLabel} />
        {state.ok ? (
          <span className="text-yes animate-stamp text-sm font-bold">
            ✓ Modifications enregistrées
          </span>
        ) : null}
      </div>
    </form>
  );
}
