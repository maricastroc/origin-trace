import { SegBar } from "./SegBar";

export function CoverageBar({
  sourced,
  noteOnly,
  unsourced,
}: {
  sourced: number;
  noteOnly: number;
  unsourced: number;
}) {
  return (
    <SegBar
      sourced={sourced}
      noteOnly={noteOnly}
      unsourced={unsourced}
      className="mt-4 h-2 w-full"
    />
  );
}
