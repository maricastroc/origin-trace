"use client";

import { useState } from "react";
import { cases } from "@/mocks";
import { CaseFile } from "./case-file/CaseFile";
import { LiveTrace } from "./LiveTrace";

const LIVE_ID = "__live__";

export function CaseFileGallery() {
  const [activeId, setActiveId] = useState<string>(cases[0].id);
  const activeCase = cases.find((c) => c.id === activeId);
  const isLive = activeId === LIVE_ID;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 rounded-lg border border-line bg-surface-1 p-1">
        {cases.map((entry) => (
          <TabButton
            key={entry.id}
            active={entry.id === activeId}
            onClick={() => setActiveId(entry.id)}
          >
            {entry.label}
          </TabButton>
        ))}
        <TabButton active={isLive} onClick={() => setActiveId(LIVE_ID)}>
          <span className="flex items-center justify-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full bg-success"
              aria-hidden="true"
            />
            Ao vivo
          </span>
        </TabButton>
      </div>
      {isLive ? (
        <LiveTrace />
      ) : (
        <CaseFile data={(activeCase ?? cases[0]).data} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-surface-2 text-ink shadow-sm"
          : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
