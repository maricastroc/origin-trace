"use client";

import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { shareUrl } from "@/lib/permalink";

export function CopyLinkButton({
  params,
  label = "Copy link",
}: {
  params: Record<string, string | undefined>;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    const url = shareUrl(params);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest text-ink-muted transition-colors hover:border-ink hover:text-ink"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
      ) : (
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}
