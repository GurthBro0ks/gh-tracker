"use client";

import { useState } from "react";

export function CopyControl({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`max-w-full rounded border border-cyan-300/45 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${
        compact
          ? "min-h-11 px-2 py-1 text-left font-mono text-[10px] break-all sm:text-xs"
          : "min-h-11 px-3 py-2 text-xs uppercase tracking-[0.08em] sm:text-sm"
      }`}
      aria-live="polite"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
