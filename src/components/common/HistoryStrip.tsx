"use client";

import { Clock, X } from "lucide-react";
import type { HistoryEntry } from "@/lib/history";

export function HistoryStrip({
  items,
  onPick,
  onForget,
  onClear,
}: {
  items: HistoryEntry[];
  onPick: (entry: HistoryEntry) => void;
  onForget: (key: string) => void;
  onClear: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-line bg-surface-1/40 px-4 py-3.5">
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          <Clock className="h-3 w-3" aria-hidden="true" />
          recent · this device
        </p>
        <button
          type="button"
          onClick={onClear}
          className="font-mono text-[11px] uppercase tracking-widest text-ink-faint transition-colors hover:text-ink"
        >
          clear
        </button>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((entry) => (
          <li key={entry.key}>
            <span className="group inline-flex items-center overflow-hidden rounded-full border border-line-strong text-[12px] text-ink-muted transition-colors hover:border-ink">
              <button
                type="button"
                onClick={() => onPick(entry)}
                className="inline-flex max-w-[16rem] items-center gap-1.5 py-0.5 pl-2.5 pr-1.5 transition-colors hover:text-ink"
                title={
                  entry.subtitle
                    ? `${entry.title} — ${entry.subtitle}`
                    : entry.title
                }
              >
                <span className="truncate">{entry.title}</span>
                {entry.badge && (
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
                    {entry.badge}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onForget(entry.key)}
                aria-label={`Remove ${entry.title}`}
                className="flex h-full items-center border-l border-line px-1.5 py-1 text-ink-faint transition-colors hover:text-danger"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
