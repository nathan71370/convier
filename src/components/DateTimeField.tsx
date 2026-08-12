"use client";

import { useRef, useState } from "react";
import {
  DATE_PLACEHOLDER,
  DATETIME_PLACEHOLDER,
  fromDisplay,
  isIncorrect,
  maskDisplay,
  toDisplay,
} from "@/lib/dateinput";

type Props = {
  id: string;
  /** Name of the hidden field the form actually posts. */
  name: string;
  /** Canonical wall-clock value: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`. */
  value: string;
  onChange: (canonical: string) => void;
  withTime: boolean;
  required?: boolean;
};

/**
 * A date field that always reads `jj/mm/aaaa`, whatever locale the browser is
 * set to. Typing goes through a masked text input; the calendar button still
 * opens the browser's own picker, which is the part people actually want from
 * a native field.
 *
 * The parent owns the canonical value. This component keeps only the half-typed
 * text, so remounting it (see `key` where it is used) is what resyncs the
 * display after the parent rewrites the value.
 */
export function DateTimeField({
  id,
  name,
  value,
  onChange,
  withTime,
  required,
}: Props) {
  const [text, setText] = useState(() => toDisplay(value, withTime));
  const pickerRef = useRef<HTMLInputElement>(null);

  const wrong = isIncorrect(text, withTime);

  function handleText(raw: string) {
    const masked = maskDisplay(raw, withTime);
    setText(masked);
    onChange(fromDisplay(masked, withTime) ?? "");
  }

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      // Older browsers, or a picker refused outside a user gesture: focusing
      // the native field still lets the visitor use it.
      picker.focus();
    }
  }

  function handlePicker(next: string) {
    setText(toDisplay(next, withTime));
    onChange(next);
  }

  return (
    <div className="relative mt-1">
      <input type="hidden" name={name} value={value} />

      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required={required}
        value={text}
        onChange={(event) => handleText(event.target.value)}
        placeholder={withTime ? DATETIME_PLACEHOLDER : DATE_PLACEHOLDER}
        aria-invalid={wrong || undefined}
        aria-describedby={wrong ? `${id}-error` : undefined}
        className="field pr-9 tabular-nums"
        style={wrong ? { borderColor: "var(--color-no)" } : undefined}
      />

      <button
        type="button"
        onClick={openPicker}
        tabIndex={-1}
        aria-label="Ouvrir le calendrier"
        className="text-ink-faint hover:text-vermilion absolute top-1.5 right-0 p-1 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect
            x="1.5"
            y="3"
            width="13"
            height="11.5"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M5 1.5v3M11 1.5v3"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* The native control stays in the DOM purely to host the picker. It is
          nameless, so it never reaches the server. */}
      <input
        ref={pickerRef}
        type={withTime ? "datetime-local" : "date"}
        value={value}
        onChange={(event) => handlePicker(event.target.value)}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute right-1 bottom-0 h-0 w-0 opacity-0"
      />

      {wrong ? (
        <p id={`${id}-error`} className="text-no mt-1.5 text-[0.8rem] font-semibold">
          Date incorrecte
        </p>
      ) : null}
    </div>
  );
}
