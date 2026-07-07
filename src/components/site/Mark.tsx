export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14.1 22.15"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <line
        x1="7.05"
        y1="2.1"
        x2="7.05"
        y2="15.1"
        stroke="var(--ink)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="7.05" cy="2.1" r="2.1" fill="var(--ink-faint)" />
      <circle
        cx="7.05"
        cy="15.1"
        r="6"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.1"
      />
      <circle cx="7.05" cy="15.1" r="3.1" fill="var(--accent)" />
    </svg>
  );
}
