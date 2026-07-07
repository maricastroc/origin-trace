import { Files, Route, ScanText } from "lucide-react";
import { Wordmark } from "./Wordmark";

export function Masthead() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface-0/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5 sm:px-8">
        <a href="#top" className="group flex items-center gap-3">
          <Wordmark className="h-5.5 w-auto" />
          <span className="kicker hidden sm:inline">
            {"// claim provenance"}
          </span>
        </a>

        <nav className="flex items-center gap-1 sm:gap-1.5">
          <NavLink href="#method" icon={<Route className="h-3.5 w-3.5" />}>
            Method
          </NavLink>
          <NavLink href="#cases" icon={<Files className="h-3.5 w-3.5" />}>
            Cases
          </NavLink>
          <NavLink href="#audit" icon={<ScanText className="h-3.5 w-3.5" />}>
            Audit
          </NavLink>
          <a
            href="#live"
            className="group ml-1 inline-flex items-center gap-2 rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-surface-2 shadow-[0_1px_2px_rgba(90,60,30,0.25)] transition-colors hover:bg-accent-strong"
          >
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-surface-2 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-surface-2" />
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

