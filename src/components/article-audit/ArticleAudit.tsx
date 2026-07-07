"use client";

import { useState } from "react";
import type { ArticleAudit as ArticleAuditData } from "@/types/ArticleAudit";
import { errMsg } from "@/lib/errMsg";
import { inputClass } from "@/lib/ui";
import { AuditMap } from "./AuditMap";
import { AuditSummary } from "./AuditSummary";

const EXAMPLES = ["Quokka", "Coati", "Cleopatra", "Black hole"];

const enc = encodeURIComponent;

type State =
  | { status: "idle" }
  | { status: "loading"; article: string }
  | { status: "error"; message: string }
  | { status: "done"; data: ArticleAuditData };

function parseArticle(raw: string): { article: string; lang: string } {
  const t = raw.trim();
  const m = t.match(/^https?:\/\/([a-z]{2,3})\.(?:m\.)?wikipedia\.org\/wiki\/([^#?]+)/i);
  if (m) {
    return { article: decodeURIComponent(m[2]).replace(/_/g, " "), lang: m[1].toLowerCase() };
  }
  return { article: t, lang: "en" };
}

export function ArticleAudit() {
  const [input, setInput] = useState("Quokka");
  const [state, setState] = useState<State>({ status: "idle" });

  async function run(raw: string) {
    const { article, lang } = parseArticle(raw);
    if (!article) return;
    setState({ status: "loading", article });
    try {
      const res = await fetch(`/api/audit?article=${enc(article)}&lang=${enc(lang)}`);
      const body = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: body.error ?? `Error ${res.status}` });
        return;
      }
      setState({ status: "done", data: body as ArticleAuditData });
    } catch (err) {
      setState({ status: "error", message: errMsg(err) });
    }
  }

  const busy = state.status === "loading";

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
        }}
        className="rounded-2xl border border-line-strong bg-surface-2 p-5 sm:p-6"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          the article
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Article title or Wikipedia URL"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-[color:var(--paper-raised)] transition-colors hover:bg-accent-strong disabled:opacity-40"
          >
            {busy ? "Auditing…" : "Audit"}
            {!busy && <span aria-hidden="true">→</span>}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            examples:
          </span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setInput(ex);
                run(ex);
              }}
              className="rounded-full border border-line-strong px-2.5 py-0.5 text-[12px] text-ink-muted transition-colors hover:border-ink hover:text-ink"
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      {state.status === "loading" && (
        <div className="rounded-2xl border border-line-strong bg-surface-2 px-5 py-6">
          <div className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
            <p className="font-mono text-[13px] text-ink">
              Reading the current revision of “{state.article}”…
            </p>
          </div>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-faint">
            One fetch, then a structural read of every sentence — no history walk.
          </p>
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-xl border border-danger/30 bg-danger-bg px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-danger">
            couldn&rsquo;t audit
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
            {state.message}
          </p>
        </div>
      )}

      {state.status === "done" && (
        <div className="animate-rise flex flex-col gap-5">
          <AuditSummary data={state.data} />
          <AuditMap data={state.data} />
        </div>
      )}
    </div>
  );
}
