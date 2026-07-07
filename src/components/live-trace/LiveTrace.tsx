"use client";

import { useEffect, useRef, useState } from "react";
import { Quote, Search } from "lucide-react";
import type { ClaimProvenance } from "@/types/ClaimProvenance";
import type { Resolution } from "@/types/Resolution";
import type { TraceProgress } from "@/types/TraceProgress";
import { streamTrace } from "@/lib/traceClient";
import { errMsg } from "@/lib/errMsg";
import { useHistory } from "@/lib/history";
import { paramsToKey, readParams, updateUrl } from "@/lib/permalink";
import { verdictStyle } from "@/lib/verdictStyle";
import { CopyLinkButton } from "../common/CopyLinkButton";
import { HistoryStrip } from "../common/HistoryStrip";
import { CaseFile } from "../case-file/CaseFile";
import { ClearableInput } from "./ClearableInput";
import { LiveTraceLoading } from "./LiveTraceLoading";
import { ScopeBanner } from "./ScopeBanner";
import { ScopePicker } from "./ScopePicker";
import { StatusCard } from "./StatusCard";

type State =
  | { status: "idle" }
  | { status: "resolving" }
  | { status: "ambiguous"; resolution: Resolution }
  | { status: "unresolved"; note: string }
  | { status: "tracing"; scope: string; progress: TraceProgress | null }
  | { status: "error"; message: string }
  | { status: "done"; data: ClaimProvenance; scope: string; phrase: string; lang?: string };

const EXAMPLES: { phrase: string; label: string }[] = [
  { phrase: "happiest animal", label: "happiest animal" },
  { phrase: "Brazilian aardvark", label: "Brazilian aardvark" },
  { phrase: "pyrrolizidine alkaloids", label: "pyrrolizidine alkaloids" },
];

const enc = encodeURIComponent;

export function LiveTrace() {
  const [phrase, setPhrase] = useState("happiest animal");
  const [article, setArticle] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const { items: history, remember, forget, clear } = useHistory("trace");

  async function trace(scope: string, claimPhrase: string, lang?: string) {
    setState({ status: "tracing", scope, progress: null });
    try {
      const data = await streamTrace({
        article: scope,
        phrase: claimPhrase,
        lang,
        onProgress: (progress) =>
          setState({ status: "tracing", scope, progress }),
      });
      setState({ status: "done", data, scope, phrase: claimPhrase, lang });
      const params = { trace: claimPhrase, article: scope, lang };
      remember({
        key: paramsToKey(params),
        params,
        title: claimPhrase,
        subtitle: scope,
        badge: verdictStyle[data.verdict.primary].label,
      });
      updateUrl(params);
    } catch (err) {
      setState({ status: "error", message: errMsg(err) });
    }
  }

  async function resolveAndTrace(p: string, a: string, lang?: string) {
    if (!p) return;
    if (a) {
      await trace(a, p, lang);
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
        await trace(r.resolved, p, lang);
      } else if (r.scope === "not-found") {
        setState({ status: "unresolved", note: r.note });
      } else {
        setState({ status: "ambiguous", resolution: r });
      }
    } catch (err) {
      setState({ status: "error", message: errMsg(err) });
    }
  }

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    await resolveAndTrace(phrase.trim(), article.trim());
  }

  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const params = readParams();
    const p = params.get("trace");
    if (!p) return;
    const a = params.get("article") ?? "";
    const lang = params.get("lang") ?? undefined;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhrase(p); setArticle(a);
    document.getElementById("live")?.scrollIntoView({ behavior: "smooth", block: "start" });
    void resolveAndTrace(p, a, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function replay(entry: (typeof history)[number]) {
    const p = entry.params.trace ?? "";
    const a = entry.params.article ?? "";
    const lang = entry.params.lang ?? undefined;
    setPhrase(p);
    setArticle(a);
    void resolveAndTrace(p, a, lang);
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
            <ClearableInput
              value={phrase}
              onChange={setPhrase}
              onClear={() => setPhrase("")}
              placeholder="happiest animal"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wide text-ink-muted">
              Article — optional scope
            </span>
            <ClearableInput
              value={article}
              onChange={setArticle}
              onClear={() => setArticle("")}
              placeholder="leave empty and we'll try to resolve it"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-strong disabled:opacity-40"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            {state.status === "resolving"
              ? "Resolving…"
              : state.status === "tracing"
                ? "Tracing…"
                : "Trace"}
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
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-0.5 text-[12px] text-ink-muted transition-colors hover:border-ink hover:text-ink"
            >
              <Quote className="h-3 w-3" aria-hidden="true" />
              {ex.label}
            </button>
          ))}
        </div>
      </form>

      <HistoryStrip
        items={history}
        onPick={replay}
        onForget={forget}
        onClear={clear}
      />

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
          <LiveTraceLoading progress={state.progress} />
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ScopeBanner scope={state.scope} />
            <CopyLinkButton
              params={{ trace: state.phrase, article: state.scope, lang: state.lang }}
            />
          </div>
          <div className="rounded-2xl border border-line-strong bg-surface-2 p-5 shadow-[0_30px_60px_-40px_rgba(90,60,30,0.4)] sm:p-8">
            <CaseFile data={state.data} />
          </div>
        </div>
      )}
    </div>
  );
}
