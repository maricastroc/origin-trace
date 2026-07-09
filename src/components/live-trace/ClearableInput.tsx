"use client";

import { X } from "lucide-react";
import { inputClass } from "@/lib/ui";

export function ClearableInput({
  value,
  onChange,
  onClear,
  onBlur,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`${inputClass} pr-7`}
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear"
          className="absolute right-0 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-ink-faint transition-colors hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
