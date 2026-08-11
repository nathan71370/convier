"use client";

import { useEffect, useState } from "react";

export function CopyField({
  value,
  label,
  hint,
  tone = "default",
}: {
  value: string;
  label: string;
  hint?: string;
  tone?: "default" | "secret";
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard blocked (insecure context, denied permission): fall back to
      // selecting the text so the user can copy it by hand.
      const node = document.getElementById(`copy-${label}`);
      if (node) window.getSelection()?.selectAllChildren(node);
    }
  }

  return (
    <div>
      <p className="eyebrow flex items-baseline gap-2">
        {label}
        {hint ? (
          <span className="text-ink-faint font-normal tracking-normal normal-case">
            {hint}
          </span>
        ) : null}
      </p>
      <div
        className={`border-(--rule) mt-2 flex items-center gap-3 rounded-full border py-1.5 pr-1.5 pl-4 ${
          tone === "secret" ? "border-dashed" : ""
        }`}
      >
        <code
          id={`copy-${label}`}
          className="min-w-0 flex-1 truncate font-mono text-[0.8rem]"
        >
          {value}
        </code>
        <button type="button" onClick={() => void copy()} className="btn-ink px-4 py-2 text-sm">
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
    </div>
  );
}
