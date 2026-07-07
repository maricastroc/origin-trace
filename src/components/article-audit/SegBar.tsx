export function SegBar({
  sourced,
  noteOnly,
  unsourced,
  className = "h-2",
}: {
  sourced: number;
  noteOnly: number;
  unsourced: number;
  /** height + any layout classes for the track */
  className?: string;
}) {
  const total = Math.max(1, sourced + noteOnly + unsourced);
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      className={`flex shrink-0 overflow-hidden rounded-full bg-line ${className}`}
      role="img"
      aria-label={`${sourced} sourced, ${noteOnly} note-only, ${unsourced} uncited`}
    >
      <div className="h-full bg-success" style={{ width: seg(sourced) }} />
      <div className="h-full bg-warn" style={{ width: seg(noteOnly) }} />
      <div className="h-full bg-danger/80" style={{ width: seg(unsourced) }} />
    </div>
  );
}
