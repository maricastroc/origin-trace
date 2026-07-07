"use client";

import { useState } from "react";
import { cases } from "@/mocks";
import { CaseCard } from "./CaseCard";
import { CaseFile } from "./case-file/CaseFile";

export function CaseExplorer() {
  const [activeId, setActiveId] = useState(cases[0].id);
  const active = cases.find((c) => c.id === activeId) ?? cases[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cases.map((entry, i) => (
          <CaseCard
            key={entry.id}
            entry={entry}
            index={i}
            active={entry.id === activeId}
            onSelect={() => setActiveId(entry.id)}
          />
        ))}
      </div>

      <div
        key={active.id}
        className="animate-rise rounded-2xl border border-line-strong bg-surface-2 p-5 shadow-[0_30px_60px_-40px_rgba(90,60,30,0.4)] sm:p-8"
      >
        <CaseFile data={active.data} />
      </div>
    </div>
  );
}
