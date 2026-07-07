import { Mark } from "./Mark";

export function Masthead() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface-0/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5 sm:px-8">
        <a href="#top" className="group flex items-center gap-2.5">
          <Mark className="h-5 w-[15px]" />
          <span className="text-[15px] font-medium tracking-tight text-ink">
            Origin Trace
          </span>
          <span className="kicker hidden sm:inline">
            {"// claim provenance"}
          </span>
        </a>

        <nav className="flex items-center gap-1 sm:gap-1.5">
          <NavLink href="#method" icon={<MethodIcon />}>
            Method
          </NavLink>
          <NavLink href="#cases" icon={<CasesIcon />}>
            Cases
          </NavLink>
          <NavLink href="#audit" icon={<AuditIcon />}>
            Audit
          </NavLink>
          <a
            href="#live"
            className="group ml-1 inline-flex items-center gap-2 rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-[color:var(--paper-raised)] shadow-[0_1px_2px_rgba(90,60,30,0.25)] transition-colors hover:bg-accent-strong"
          >
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--paper-raised)] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--paper-raised)]" />
            </span>
            Trace live
          </a>
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="group hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-surface-1/70 hover:text-ink sm:inline-flex"
    >
      <span className="text-ink-faint transition-colors group-hover:text-ink">
        {icon}
      </span>
      {children}
    </a>
  );
}

function MethodIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 8h10" />
      <circle cx="3" cy="8" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1.6" />
      <circle cx="13" cy="8" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function AuditIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="2.5" width="10" height="11" rx="1.2" />
      <path d="M5.5 6h5M5.5 8.5h5M5.5 11h2.5" />
    </svg>
  );
}

function CasesIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="5.5" width="9" height="7" rx="1.2" />
      <path d="M5 5.5V4.2A1.2 1.2 0 016.2 3h3.1a1.2 1.2 0 011.2 1.2v1.3M13.5 6.5v5" />
    </svg>
  );
}
