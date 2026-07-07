"use client";

import { useEffect, useState } from "react";
import type { ClaimProvenance } from "@/types/ClaimProvenance";
import { CaseFile } from "./case-file/CaseFile";

interface Candidate {
  title: string;
  snippet: string;
  exactWikitextMatch: boolean;
  fuzzyRank: number | null;
}
interface Resolution {
  phrase: string;
  scope: "unambiguous" | "ambiguous" | "not-found";
  resolved: string | null;
  candidates: Candidate[];
  note: string;
}

type State =
  | { status: "idle" }
  | { status: "resolving" }
  | { status: "ambiguous"; resolution: Resolution }
  | { status: "unresolved"; note: string }
  | { status: "tracing"; scope: string }
  | { status: "error"; message: string }
  | { status: "done"; data: ClaimProvenance; scope: string };

const EXAMPLES: { phrase: string; label: string }[] = [
  { phrase: "happiest animal", label: "happiest animal" },
  { phrase: "Brazilian aardvark", label: "Brazilian aardvark" },
  { phrase: "pyrrolizidine alkaloids", label: "pyrrolizidine alkaloids" },
];

const inputClass =
  "w-full rounded-md border border-line-strong bg-surface-1 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent";

const enc = encodeURIComponent;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function LiveTrace() {
  const [phrase, setPhrase] = useState("happiest animal");
  const [article, setArticle] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function trace(scope: string, claimPhrase: string) {
    setState({ status: "tracing", scope });
    try {
      const res = await fetch(
        `/api/trace?article=${enc(scope)}&phrase=${enc(claimPhrase)}`,
      );
      const body = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: body.error ?? `Error ${res.status}` });
        return;
      }
      setState({ status: "done", data: body as ClaimProvenance, scope });
    } catch (err) {
      setState({ status: "error", message: errMsg(err) });
    }
  }

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const p = phrase.trim();
    const a = article.trim();
    if (!p) return;

    // An explicit article skips resolution — you named the scope yourself.
    if (a) {
      await trace(a, p);
      return;
    }

    setState({ status: "resolving" });
    try {
      const res = await fetch(`/api/resolve?phrase=${enc(p)}`);
      const body = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: body.error ?? `Error ${res.status}` });
        return;
      }
      const r = body as Resolution;
      if (r.scope === "unambiguous" && r.resolved) {
        await trace(r.resolved, p);
      } else if (r.scope === "not-found") {
        setState({ status: "unresolved", note: r.note });
      } else {
        setState({ status: "ambiguous", resolution: r });
      }
    } catch (err) {
      setState({ status: "error", message: errMsg(err) });
    }
  }

  const busy = state.status === "resolving" || state.status === "tracing";

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={submit}
        className="rounded-2xl border border-line-strong bg-surface-2 p-5 sm:p-6"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          the claim
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
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
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
              Article — optional scope
            </span>
            <input
              value={article}
              onChange={(e) => setArticle(e.target.value)}
              placeholder="leave empty and we'll try to resolve it"
              className={`${inputClass} sm:max-w-xs`}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-[color:var(--paper-raised)] transition-colors hover:bg-accent-strong disabled:opacity-40"
          >
            {state.status === "resolving"
              ? "Resolving…"
              : state.status === "tracing"
                ? "Tracing…"
                : "Trace"}
            {!busy && <span aria-hidden="true">→</span>}
          </button>
          <span className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            examples:
          </span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.phrase}
              type="button"
              onClick={() => {
                setPhrase(ex.phrase);
                setArticle("");
              }}
              className="rounded-full border border-line-strong px-2.5 py-0.5 text-[12px] text-ink-muted transition-colors hover:border-ink hover:text-ink"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </form>

      {state.status === "resolving" && (
        <StatusCard title="Resolving scope…" pulse>
          Searching Wikipedia for the article(s) that carry this claim.
        </StatusCard>
      )}

      {state.status === "ambiguous" && (
        <ScopePicker
          resolution={state.resolution}
          onPick={(title) => trace(title, phrase.trim())}
        />
      )}

      {state.status === "unresolved" && (
        <div className="rounded-2xl border border-line-strong bg-surface-2 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink">
            couldn&rsquo;t resolve a scope
          </p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
            {state.note}
          </p>
        </div>
      )}

      {state.status === "tracing" && (
        <>
          <ScopeBanner scope={state.scope} />
          <LiveTraceLoading />
        </>
      )}

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
        <div className="animate-rise flex flex-col gap-4">
          <ScopeBanner scope={state.scope} />
          <div className="rounded-2xl border border-line-strong bg-surface-2 p-5 shadow-[0_30px_60px_-40px_rgba(90,60,30,0.4)] sm:p-8">
            <CaseFile data={state.data} />
          </div>
        </div>
      )}
    </div>
  );
}

function ScopeBanner({ scope }: { scope: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-1/50 px-4 py-2.5">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
        aria-hidden="true"
      />
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
        <span className="text-ink-muted">scope</span> ·{" "}
        <span className="text-ink">{scope}</span>
      </p>
    </div>
  );
}

function ScopePicker({
  resolution,
  onPick,
}: {
  resolution: Resolution;
  onPick: (title: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-line-strong bg-surface-2 p-5 sm:p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
        the scope is ambiguous
      </p>
      <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-muted">
        {resolution.note}
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {resolution.candidates.map((c) => (
          <li key={c.title}>
            <button
              onClick={() => onPick(c.title)}
              className="group flex w-full flex-col gap-1 rounded-lg border border-line bg-surface-1/40 px-4 py-3 text-left transition-colors hover:border-ink"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-medium text-ink">
                  {c.title}
                </span>
                {c.exactWikitextMatch && (
                  <span className="rounded-full border border-success/40 bg-success-bg px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-success">
                    verbatim
                  </span>
                )}
                {c.fuzzyRank && (
                  <span className="rounded-full border border-line-strong px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-faint">
                    relevance #{c.fuzzyRank}
                  </span>
                )}
                <span className="ml-auto font-mono text-[12px] text-ink-faint transition-colors group-hover:text-accent">
                  trace →
                </span>
              </div>
              {c.snippet && (
                <p className="line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">
                  {c.snippet}
                </p>
              )}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-ink-faint">
        Not one of these? Name the article in the scope field above.
      </p>
    </div>
  );
}

function StatusCard({
  title,
  pulse = false,
  children,
}: {
  title: string;
  pulse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line-strong bg-surface-2 px-5 py-6 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full bg-accent ${pulse ? "animate-pulse" : ""}`}
        />
        <p className="font-mono text-[13px] text-ink">{title}</p>
      </div>
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-faint">
        {children}
      </p>
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
