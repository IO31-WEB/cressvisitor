"use client";

import { useState } from "react";
import clsx from "clsx";

export function Tabs({
  tabs,
}: {
  tabs: { key: string; label: string; content: React.ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.key);

  return (
    <div>
      {/* Tab buttons — hidden in print */}
      <div role="tablist" className="flex gap-1 border-b border-line mb-5 no-print">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={clsx(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              active === t.key
                ? "border-navy-900 text-navy-900"
                : "border-transparent text-ink/40 hover:text-ink/70"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Screen: only active tab. Print: all tabs stacked */}
      {tabs.map((t) => (
        <div
          key={t.key}
          role="tabpanel"
          className={clsx(
            "print-section",
            active === t.key ? "block" : "hidden print:block"
          )}
        >
          {/* Print-only section title */}
          <h3 className="hidden print:block text-sm font-semibold text-ink/60 uppercase tracking-wide mb-3 mt-6 first:mt-0">
            {t.label}
          </h3>
          {t.content}
        </div>
      ))}
    </div>
  );
}
