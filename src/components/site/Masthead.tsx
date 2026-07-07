import { Mark } from "./Mark";

export function Masthead() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface-0/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <Mark className="h-5 w-[15px]" />
          <span className="text-[15px] font-medium tracking-tight text-ink">
            Origin Trace
          </span>
          <span className="kicker hidden sm:inline">
            {"// claim provenance"}
          </span>
        </a>
        <nav className="flex items-center gap-5">
          <a
            href="#method"
            className="hidden text-[13px] text-ink-muted transition-colors hover:text-ink sm:inline"
          >
            Method
          </a>
          <a
            href="#cases"
            className="hidden text-[13px] text-ink-muted transition-colors hover:text-ink sm:inline"
          >
            Cases
          </a>
          <a
            href="#live"
            className="rounded-md border border-line-strong bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-ink hover:text-accent"
          >
            Trace live
          </a>
        </nav>
      </div>
    </header>
  );
}
