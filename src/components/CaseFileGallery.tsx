"use client";

import { useState } from "react";
import { cases } from "@/mocks";
import { CaseFile } from "./case-file/CaseFile";

export function CaseFileGallery() {
  const [activeId, setActiveId] = useState(cases[0].id);
  const active = cases.find((c) => c.id === activeId) ?? cases[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 rounded-lg border border-line bg-surface-1 p-1">
        {cases.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setActiveId(entry.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              entry.id === activeId
                ? "bg-surface-2 text-ink shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <CaseFile data={active.data} />
    </div>
  );
}
