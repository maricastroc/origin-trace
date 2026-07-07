import { Mark } from "./Mark";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-2.5">
          <Mark className="h-4 w-3" />
          <span className="font-mono text-[12px] text-ink-muted">
            origin-trace — project by Mariana Castro
          </span>
        </div>
        <span className="font-mono text-[12px] tracking-wide text-ink-faint">
          provenance <span className="text-accent">&gt;</span> summary
        </span>
      </div>
    </footer>
  );
}
