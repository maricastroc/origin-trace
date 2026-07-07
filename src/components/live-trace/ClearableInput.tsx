"use client";

import { X } from "lucide-react";
import { inputClass } from "@/lib/ui";

export function ClearableInput({
  value,
  onChange,
  onClear,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass.replace("px-3", "pl-3 pr-9")}
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear"
          className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
