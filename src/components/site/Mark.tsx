/** The provenance spine in miniature — an origin node dropping to a later one. */
export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 22"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="4" r="3.2" fill="var(--accent)" />
      <line
        x1="8"
        y1="7.5"
        x2="8"
        y2="15"
        stroke="var(--line-strong)"
        strokeWidth="1.5"
      />
      <circle
        cx="8"
        cy="17.5"
        r="2.6"
        fill="var(--paper)"
        stroke="var(--ink)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
