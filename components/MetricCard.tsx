"use client";

import { useState } from "react";
import clsx from "clsx";

export function MetricCard({
  label,
  value,
  tooltip,
  tone = "default",
}: {
  label: string;
  value: string;
  tooltip: string;
  tone?: "default" | "excluded";
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={clsx(
        "card p-4 relative",
        tone === "excluded" && "bg-paper border-dashed"
      )}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-ink/50 uppercase tracking-wide">{label}</span>
        <button
          type="button"
          aria-label={`About ${label}`}
          onClick={() => setOpen((o) => !o)}
          className="text-ink/30 hover:text-ink/60 text-xs h-4 w-4 rounded-full border border-ink/20 flex items-center justify-center shrink-0"
        >
          i
        </button>
      </div>
      <p
        className={clsx(
          "mt-2 text-2xl font-semibold tabular-nums",
          tone === "excluded" ? "text-ink/50" : "text-ink"
        )}
      >
        {value}
      </p>
      {open && (
        <div className="absolute z-10 left-4 right-4 top-full mt-2 rounded-card bg-navy-950 text-white text-xs p-3 shadow-cardHover">
          {tooltip}
        </div>
      )}
    </div>
  );
}
