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
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Wikipedia language">
      {LANGS.map((l) => {
        const active = l.code === value;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => onChange(l.code)}
            aria-pressed={active}
            title={`${l.name} — ${l.code}.wikipedia`}
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[12px] uppercase tracking-wide transition-colors ${
              active
                ? "border-accent bg-accent text-surface-2"
                : "border-line-strong text-ink-muted hover:border-ink hover:text-ink"
            }`}
          >
            {l.code}
          </button>
        );
      })}
    </div>
  );
}
