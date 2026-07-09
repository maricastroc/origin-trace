import { describe, expect, it } from "vitest";
import type { TimelineEvent } from "@/types/TimelineEvent";
import { deriveSignals } from "@/lib/evidenceSignals";

const NOW = new Date("2020-06-15T00:00:00Z");

describe("deriveSignals — sourced state now", () => {
  it("reports the current source label when the latest event carries one", () => {
    const events: TimelineEvent[] = [
      {
        id: "e1",
        date: "2015-06",
        kind: "claim-introduced",
        source: { label: "The New York Times", type: "newspaper" },
      },
    ];
    const s = deriveSignals(events, NOW);
    expect(s.sourcedNow).toBe("yes");
    expect(s.currentSourceLabel).toBe("The New York Times");
  });

  it("reports 'no' when the latest present event has an explicit null source", () => {
    const events: TimelineEvent[] = [
      { id: "e1", date: "2015-06", kind: "claim-introduced", source: null },
    ];
    const s = deriveSignals(events, NOW);
    expect(s.sourcedNow).toBe("no");
    expect(s.currentSourceLabel).toBeNull();
  });

  it("reports 'unreadable' — not 'no' — when the current ref is cited but unparsed", () => {
    // refUnparsed: a real <ref> is attached but couldn't be parsed into a source.
    // The claim IS cited, so this must never read as the red "unsourced now" chip.
    const events: TimelineEvent[] = [
      {
        id: "e1",
        date: "2015-06",
        kind: "claim-introduced",
        source: null,
        refUnparsed: true,
      },
    ];
    const s = deriveSignals(events, NOW);
    expect(s.sourcedNow).toBe("unreadable");
    expect(s.currentSourceLabel).toBeNull();
  });

  it("reports 'removed' whenever a removal event exists, ignoring earlier sources", () => {
    const events: TimelineEvent[] = [
      {
        id: "e1",
        date: "2015-06",
        kind: "claim-introduced",
        source: { label: "NYT", type: "newspaper" },
      },
      { id: "e2", date: "2018", kind: "removed" },
    ];
    const s = deriveSignals(events, NOW);
    expect(s.sourcedNow).toBe("removed");
  });

  it("stays 'unknown' with no events", () => {
    const s = deriveSignals([], NOW);
    expect(s.sourcedNow).toBe("unknown");
    expect(s.ageLabel).toBeNull();
    expect(s.evidenceChanges).toBe(0);
  });

  it("surfaces an explanatory note on the current event", () => {
    const events: TimelineEvent[] = [
      {
        id: "e1",
        date: "2015-06",
        kind: "claim-introduced",
        source: null,
        hasExplanatoryNote: true,
      },
    ];
    expect(deriveSignals(events, NOW).explanatoryNoteNow).toBe(true);
  });
});

describe("deriveSignals — evidence change counting", () => {
  it("counts source-added, source-replaced and evidence-change transitions", () => {
    const events: TimelineEvent[] = [
      { id: "e1", date: "2015", kind: "claim-introduced", source: null },
      { id: "e2", date: "2016", kind: "source-added" },
      { id: "e3", date: "2017", kind: "source-replaced" },
      {
        id: "e4",
        date: "2018",
        kind: "current",
        transition: { changes: ["evidence-swapped"], magnitude: "major" },
      },
    ];
    expect(deriveSignals(events, NOW).evidenceChanges).toBe(3);
  });

  it("does not count rewordings that leave the evidence intact", () => {
    const events: TimelineEvent[] = [
      { id: "e1", date: "2015", kind: "claim-introduced", source: null },
      {
        id: "e2",
        date: "2016",
        kind: "reworded",
        transition: { changes: ["reworded"], magnitude: "minor" },
      },
    ];
    expect(deriveSignals(events, NOW).evidenceChanges).toBe(0);
  });
});

describe("deriveSignals — age label", () => {
  const label = (date: string) =>
    deriveSignals([{ id: "e1", date, kind: "claim-introduced" }], NOW).ageLabel;

  it("formats multi-year, single-year and sub-year ages", () => {
    expect(label("2015-06")).toBe("5 years");
    expect(label("2019-06")).toBe("1 year");
    expect(label("2020-03")).toBe("3 months");
    expect(label("2020-05")).toBe("1 month");
    expect(label("2020-06")).toBe("this month");
  });

  it("clamps future introductions to 'this month' rather than a negative age", () => {
    expect(label("2025-01")).toBe("this month");
  });

  it("returns null for an unparseable date", () => {
    expect(label("?")).toBeNull();
  });
});
