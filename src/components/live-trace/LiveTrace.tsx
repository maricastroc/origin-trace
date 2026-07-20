"use client";

import { useEffect, useRef, useState } from "react";
import { Quote, Search } from "lucide-react";
import type { ClaimProvenance } from "@/types/ClaimProvenance";
import type { Resolution } from "@/types/Resolution";
import type { TraceProgress } from "@/types/TraceProgress";
import type { SearchProbe } from "@/types/SearchProbe";
import type { TraceMetrics } from "@/engine/metrics";
import { streamTrace } from "@/lib/traceClient";
import { parseArticleInput } from "@/lib/articleInput";
import { errMsg } from "@/lib/errMsg";
import { useHistory } from "@/lib/history";
import { paramsToKey, readParams, updateUrl } from "@/lib/permalink";
import { useRevealResults } from "@/lib/useRevealResults";
import { verdictStyle } from "@/lib/verdictStyle";
import { CopyLinkButton } from "../common/CopyLinkButton";
import { HistoryStrip } from "../common/HistoryStrip";
import { CaseFile } from "../case-file/CaseFile";
import { ClearableInput } from "./ClearableInput";
import { LangPicker } from "./LangPicker";
import { LiveTraceLoading } from "./LiveTraceLoading";
import { ScopeBanner } from "./ScopeBanner";
import { ScopePicker } from "./ScopePicker";
import { StatusCard } from "./StatusCard";

type State =
  | { status: "idle" }
  | { status: "resolving" }
  | { status: "ambiguous"; resolution: Resolution }
  | { status: "unresolved"; note: string }
  | {
      status: "tracing";
      scope: string;
      progress: TraceProgress | null;
      probes: SearchProbe[];
      corpusSize?: number;
    }
  | { status: "error"; message: string; lang: string }
  | {
      status: "done";
      data: ClaimProvenance;
      metrics?: TraceMetrics;
      scope: string;
      phrase: string;
      lang?: string;
    };

const EXAMPLES: { phrase: string; article: string; label: string }[] = [
  { phrase: "happiest animal", article: "Quokka", label: "happiest animal" },
  {
    phrase: "Brazilian aardvark",
    article: "Coati",
    label: "Brazilian aardvark",
  },
  {
    phrase: "pyrrolizidine alkaloids",
    article: "Petasites",
    label: "pyrrolizidine alkaloids",
  },
];

const enc = encodeURIComponent;

export function LiveTrace() {
  const [phrase, setPhrase] = useState("happiest animal");
  const [article, setArticle] = useState("Quokka");
  const [lang, setLang] = useState("en");
  const [state, setState] = useState<State>({ status: "idle" });
  const { items: history, remember, forget, clear } = useHistory("trace");
  const { ref: resultsRef, reveal } = useRevealResults(
    state.status,
    state.status === "resolving" || state.status === "tracing",
  );

  async function trace(scope: string, claimPhrase: string, lang = "en") {
    setState({
      status: "tracing",
      scope,
      progress: null,
      probes: [],
      corpusSize: undefined,
    });
    try {
      let capturedMetrics: TraceMetrics | undefined;
      const data = await streamTrace({
        article: scope,
        phrase: claimPhrase,
        lang,
        onMetrics: (m) => {
          capturedMetrics = m;
        },
        onProgress: (progress) =>
          setState((prev) =>
            prev.status === "tracing"
              ? {
                  ...prev,
                  progress,
                  probes:
                    progress.phase === "searching" && progress.probe
                      ? [...prev.probes, progress.probe]
                      : prev.probes,
                  corpusSize:
                    progress.phase === "listed"
                      ? progress.revisions
                      : prev.corpusSize,
                }
              : prev,
          ),
      });
      setState({
        status: "done",
        data,
        metrics: capturedMetrics,
        scope,
        phrase: claimPhrase,
        lang,
      });
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
      setState({ status: "error", message: errMsg(err), lang });
    }
  }

  const prewarmed = useRef("");
  function prewarm(rawArticle: string, lang: string) {
    const parsed = parseArticleInput(rawArticle);
    const effLang = parsed.lang ?? lang;
    const title = parsed.title.trim();
    if (!title) return;
    const key = `${effLang}:${title}`;
    if (prewarmed.current === key) return;
    prewarmed.current = key;
    void fetch(`/api/prewarm?article=${enc(title)}&lang=${enc(effLang)}`, {
      keepalive: true,
    }).catch(() => {});
  }

  async function resolveAndTrace(p: string, a: string, lang = "en") {
    if (!p) return;
    if (a) {
      await trace(a, p, lang);
      return;
    }

    setState({ status: "resolving" });
    try {
      const res = await fetch(
        `/api/resolve?phrase=${enc(p)}&lang=${enc(lang)}`,
      );
      const body = await res.json();
      if (!res.ok) {
        setState({
          status: "error",
          message: body.error ?? `Error ${res.status}`,
          lang,
        });
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
      setState({ status: "error", message: errMsg(err), lang });
    }
  }

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const parsed = parseArticleInput(article);
    const effLang = parsed.lang ?? lang;
    if (parsed.title !== article) setArticle(parsed.title);
    if (effLang !== lang) setLang(effLang);
    if (!phrase.trim()) return;
    reveal();
    await resolveAndTrace(phrase.trim(), parsed.title, effLang);
  }

  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const params = readParams();
    const p = params.get("trace");
    if (!p) return;
    const a = params.get("article") ?? "";
    const lang = params.get("lang") ?? "en";

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhrase(p);
    setArticle(a);
    setLang(lang);
    document
      .getElementById("live")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    void resolveAndTrace(p, a, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function replay(entry: (typeof history)[number]) {
    const p = entry.params.trace ?? "";
    const a = entry.params.article ?? "";
    const lang = entry.params.lang ?? "en";
    setPhrase(p);
    setArticle(a);
    setLang(lang);
    reveal();
    void resolveAndTrace(p, a, lang);
  }

  const busy = state.status === "resolving" || state.status === "tracing";

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={submit}
        className="overflow-hidden rounded-xl border border-t-2 border-line-strong border-t-ink bg-surface-2"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-2.5 sm:px-6">
          <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
            <span className="text-accent" aria-hidden="true">
              ▪
            </span>
            the claim
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
            → case file
          </p>
        </div>

        <div className="divide-y divide-line px-5 sm:px-6">
          <label className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr] sm:items-baseline sm:gap-5">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
              Claim
            </span>
            <ClearableInput
              value={phrase}
              onChange={setPhrase}
              onClear={() => setPhrase("")}
              placeholder="happiest animal"
            />
          </label>
          <label className="grid gap-1 py-3 sm:grid-cols-[7rem_1fr] sm:items-baseline sm:gap-5">
            <span className="font-mono text-[11px] uppercase leading-tight tracking-widest text-ink-muted">
              Article
              <span className="mt-0.5 block text-[10px] text-ink-faint">
                scope · optional
              </span>
            </span>
            <ClearableInput
              value={article}
              onChange={setArticle}
              onClear={() => setArticle("")}
              onBlur={() => prewarm(article, lang)}
              placeholder="leave empty and we'll try to resolve it"
            />
          </label>
          <div className="grid gap-1.5 py-3 sm:grid-cols-[7rem_1fr] sm:items-center sm:gap-5">
            <span className="font-mono text-[11px] uppercase leading-tight tracking-widest text-ink-muted">
              Language
              <span className="mt-0.5 block text-[10px] text-ink-faint">
                wikipedia
              </span>
            </span>
            <LangPicker value={lang} onChange={setLang} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-t border-line bg-surface-1/30 px-5 py-3 sm:px-6">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-[3px] bg-accent px-4 py-2 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-strong disabled:opacity-40"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            {state.status === "resolving"
              ? "Resolving…"
              : state.status === "tracing"
                ? "Tracing…"
                : "Trace"}
          </button>
          <span
            className="hidden h-4 w-px bg-line-strong sm:block"
            aria-hidden="true"
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
            specimens
          </span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.phrase}
              type="button"
              onClick={() => {
                setPhrase(ex.phrase);
                setArticle(ex.article);
                setLang("en");
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

      <div
        ref={resultsRef}
        className="flex scroll-mt-24 flex-col gap-5 empty:hidden"
      >
        {state.status === "resolving" && (
          <StatusCard title="Resolving scope…" pulse>
            Searching Wikipedia for the article(s) that carry this claim.
          </StatusCard>
        )}

        {state.status === "ambiguous" && (
          <ScopePicker
            resolution={state.resolution}
            onPick={(title) => trace(title, phrase.trim(), lang)}
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
            <LiveTraceLoading
              progress={state.progress}
              probes={state.probes}
              corpusSize={state.corpusSize}
            />
          </>
        )}

        {state.status === "error" && (
          <div className="rounded-xl border border-danger/30 bg-danger-bg px-5 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-danger">
              couldn&rsquo;t trace
              <span className="ml-2 text-ink-faint">
                · searched {state.lang}.wikipedia
              </span>
            </p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
              {state.message}
            </p>
            {state.lang !== "en" ? null : (
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-faint">
                Not in English? Pick a different Wikipedia language above and
                trace again.
              </p>
            )}
          </div>
        )}

        {state.status === "done" && (
          <div className="animate-rise flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ScopeBanner scope={state.scope} />
              <CopyLinkButton
                params={{
                  trace: state.phrase,
                  article: state.scope,
                  lang: state.lang,
                }}
              />
            </div>
            <div className="rounded-2xl border border-line-strong bg-surface-2 p-5 shadow-[0_30px_60px_-40px_rgba(90,60,30,0.4)] sm:p-8">
              <CaseFile data={state.data} metrics={state.metrics} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
