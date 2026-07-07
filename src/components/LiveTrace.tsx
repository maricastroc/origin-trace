"use client";

import { useEffect, useState } from "react";
import type { ClaimProvenance } from "@/types/ClaimProvenance";
import { CaseFile } from "./case-file/CaseFile";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; data: ClaimProvenance };

const EXAMPLES: { article: string; phrase: string }[] = [
  { article: "Quokka", phrase: "happiest animal" },
  { article: "Coati", phrase: "Brazilian aardvark" },
  { article: "Petasites", phrase: "pyrrolizidine alkaloids" },
];

const inputClass =
  "rounded-md border border-line-strong bg-surface-1 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent";

export function LiveTrace() {
  const [article, setArticle] = useState("Quokka");
  const [phrase, setPhrase] = useState("happiest animal");
  const [state, setState] = useState<State>({ status: "idle" });

  async function run(event?: React.FormEvent) {
    event?.preventDefault();
    const a = article.trim();
    const p = phrase.trim();
    if (!a || !p) return;

    setState({ status: "loading" });
    try {
      const res = await fetch(
        `/api/trace?article=${encodeURIComponent(a)}&phrase=${encodeURIComponent(p)}`,
      );
      const body = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: body.error ?? `Erro ${res.status}` });
        return;
      }
      setState({ status: "done", data: body as ClaimProvenance });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const loading = state.status === "loading";

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={run}
        className="rounded-2xl border border-line-strong bg-surface-2 p-5 sm:p-6"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          investigation parameters
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-col gap-1.5 sm:w-1/3">
            <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
              Article
            </span>
            <input
              value={article}
              onChange={(e) => setArticle(e.target.value)}
              placeholder="Quokka"
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
              Claim phrase
            </span>
            <input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="happiest animal"
              className={inputClass}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-[color:var(--paper-raised)] transition-colors hover:bg-accent-strong disabled:opacity-40"
          >
            {loading ? "Tracing…" : "Trace"}
            {!loading && <span aria-hidden="true">→</span>}
          </button>
          <span className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            examples:
          </span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.article}
              type="button"
              onClick={() => {
                setArticle(ex.article);
                setPhrase(ex.phrase);
              }}
              className="rounded-full border border-line-strong px-2.5 py-0.5 text-[12px] text-ink-muted transition-colors hover:border-ink hover:text-ink"
            >
              {ex.article}
            </button>
          ))}
        </div>
      </form>

      {state.status === "loading" && <LiveTraceLoading />}

      {state.status === "error" && (
        <div className="rounded-xl border border-danger/30 bg-danger-bg px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-danger">
            couldn&rsquo;t trace
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
            {state.message}
          </p>
        </div>
      )}

      {state.status === "done" && (
        <div className="animate-rise rounded-2xl border border-line-strong bg-surface-2 p-5 shadow-[0_30px_60px_-40px_rgba(90,60,30,0.4)] sm:p-8">
          <CaseFile data={state.data} />
        </div>
      )}
    </div>
  );
}

const STEPS = [
  "Listing the revision history…",
  "Binary-searching for the introduction…",
  "Reading the revisions’ wikitext…",
  "Detecting the attached citation…",
];

function LiveTraceLoading() {
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const s = setInterval(() => setStep((v) => (v + 1) % STEPS.length), 2200);
    const t = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => {
      clearInterval(s);
      clearInterval(t);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-line-strong bg-surface-2 px-5 py-6 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
        <p className="font-mono text-[13px] text-ink">{STEPS[step]}</p>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-faint">
          {elapsed}s
        </span>
      </div>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-faint">
        The engine reads Wikipedia&rsquo;s real history and binary-searches down
        to the revision that introduced the phrase. Usually takes 10–40s.
      </p>
    </div>
  );
}
