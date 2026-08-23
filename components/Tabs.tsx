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
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" hidden={active !== t.key} className="print-page">
          {active === t.key && t.content}
        </div>
      ))}
    </div>
  );
}
