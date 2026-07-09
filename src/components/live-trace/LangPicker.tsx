"use client";

export const LANGS: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "pt", name: "Português" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
];

export function LangPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <div
      className="inline-flex divide-x divide-line-strong overflow-hidden rounded-[3px] border border-line-strong"
      role="group"
      aria-label="Wikipedia language"
    >
      {LANGS.map((l) => {
        const active = l.code === value;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => onChange(l.code)}
            aria-pressed={active}
            title={`${l.name} — ${l.code}.wikipedia`}
            className={`px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
              active
                ? "bg-accent text-surface-2"
                : "text-ink-muted hover:bg-surface-1 hover:text-ink"
            }`}
          >
            {l.code}
          </button>
        );
      })}
    </div>
  );
}
