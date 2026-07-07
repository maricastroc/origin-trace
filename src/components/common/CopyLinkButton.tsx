"use client";

import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { shareUrl } from "@/lib/permalink";

/**
 * Copies a permalink for the current result to the clipboard. The link carries
 * everything needed to reproduce the lookup — no server, no account.
 */
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
      // Clipboard blocked (insecure context / denied) — surface the URL so the
      // user can still copy it by hand.
      window.prompt("Copy this link", url);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-muted transition-colors hover:border-ink hover:text-ink"
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
