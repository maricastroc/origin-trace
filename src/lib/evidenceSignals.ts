import type { TimelineEvent } from "@/types/TimelineEvent";

export interface EvidenceSignals {
  ageLabel: string | null;
  sourcedNow: "yes" | "no" | "removed" | "unknown";
  currentSourceLabel: string | null;
  evidenceChanges: number;
  explanatoryNoteNow: boolean;
}

export function deriveSignals(
  events: TimelineEvent[],
  now: Date,
): EvidenceSignals {
  const intro =
    events.find((e) => e.kind === "claim-introduced") ??
    events.find((e) => e.kind !== "claim-absent");
  const present = [...events]
    .reverse()
    .find((e) => e.kind !== "claim-absent" && e.kind !== "removed");
  const removed = events.some((e) => e.kind === "removed");

  let sourcedNow: EvidenceSignals["sourcedNow"] = "unknown";
  let currentSourceLabel: string | null = null;
  let explanatoryNoteNow = false;
  if (removed) {
    sourcedNow = "removed";
  } else if (present) {
    if (present.source === null) sourcedNow = "no";
    else if (present.source) {
      sourcedNow = "yes";
      currentSourceLabel = present.source.label;
    }
    explanatoryNoteNow = Boolean(present.hasExplanatoryNote);
  }

  const evidenceChanges = events.filter(
    (e) =>
      e.kind === "source-replaced" ||
      e.kind === "source-added" ||
      (e.transition?.changes.includes("evidence-changed") ?? false),
  ).length;

  return {
    ageLabel: intro ? formatAge(intro.date, now) : null,
    sourcedNow,
    currentSourceLabel,
    evidenceChanges,
    explanatoryNoteNow,
  };
}

function formatAge(dateStr: string, now: Date): string | null {
  const m = dateStr.match(/(\d{4})(?:-(\d{2}))?/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) - 1 : 0;
  let months = (now.getFullYear() - year) * 12 + (now.getMonth() - month);
  if (months < 0) months = 0;
  if (months >= 24) return `${Math.floor(months / 12)} years`;
  if (months >= 12) return "1 year";
  if (months >= 1) return `${months} month${months > 1 ? "s" : ""}`;
  return "this month";
}
