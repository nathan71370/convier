export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-no mt-1.5 text-[0.8rem] font-semibold" role="alert">
      {message}
    </p>
  );
}

export function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="eyebrow flex items-baseline gap-2">
      {children}
      {hint ? (
        <span className="text-ink-faint font-normal tracking-normal normal-case">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
