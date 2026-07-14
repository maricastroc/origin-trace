"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, ScanSearch } from "lucide-react";
import type { ArticleAudit as ArticleAuditData } from "@/types/ArticleAudit";
import { errMsg } from "@/lib/errMsg";
import { useHistory } from "@/lib/history";
import { paramsToKey, readParams, updateUrl } from "@/lib/permalink";
import { useRevealResults } from "@/lib/useRevealResults";
import { CopyLinkButton } from "../common/CopyLinkButton";
import { HistoryStrip } from "../common/HistoryStrip";
import { ClearableInput } from "../live-trace/ClearableInput";
import { AuditReport } from "./AuditReport";

const EXAMPLES = ["Quokka", "Coati", "Cleopatra", "Black hole"];

const enc = encodeURIComponent;

type State =
  | { status: "idle" }
  | { status: "loading"; article: string }
  | { status: "error"; message: string }
  | { status: "done"; data: ArticleAuditData };

function parseArticle(raw: string): { article: string; lang: string } {
  const t = raw.trim();
  const m = t.match(
    /^https?:\/\/([a-z]{2,3})\.(?:m\.)?wikipedia\.org\/wiki\/([^#?]+)/i,
  );
  if (m) {
    return {
      article: decodeURIComponent(m[2]).replace(/_/g, " "),
      lang: m[1].toLowerCase(),
    };
  }
  return { article: t, lang: "en" };
}

export function ArticleAudit() {
  const [input, setInput] = useState("Quokka");
  const [state, setState] = useState<State>({ status: "idle" });
  const { items: history, remember, forget, clear } = useHistory("audit");
  const { ref: resultsRef, reveal } = useRevealResults(
    state.status,
    state.status === "loading",
  );

  async function execute(article: string, lang: string) {
    if (!article) return;
    setState({ status: "loading", article });
    try {
      const res = await fetch(
        `/api/audit?article=${enc(article)}&lang=${enc(lang)}`,
      );
      const body = await res.json();
      if (!res.ok) {
        setState({
          status: "error",
          message: body.error ?? `Error ${res.status}`,
        });
        return;
      }
      const data = body as ArticleAuditData;
      setState({ status: "done", data });
      const params = { audit: data.article.title, lang: data.article.lang };
      remember({
        key: paramsToKey(params),
        params,
        title: data.article.title,
        subtitle: data.article.lang !== "en" ? data.article.lang : undefined,
        badge: `${Math.round(data.summary.coverage * 100)}% cited`,
      });
      updateUrl(params);
    } catch (err) {
      setState({ status: "error", message: errMsg(err) });
    }
  }

  function run(raw: string) {
    const { article, lang } = parseArticle(raw);
    if (!article.trim()) return;
    void execute(article, lang);
    reveal();
  }

  function replay(entry: (typeof history)[number]) {
    const article = entry.params.audit ?? "";
    const lang = entry.params.lang ?? "en";
    setInput(article);
    void execute(article, lang);
    reveal();
  }

  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const params = readParams();
    const article = params.get("audit");
    if (!article) return;
    const lang = params.get("lang") ?? "en";

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInput(article);
    document
      .getElementById("audit")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    void execute(article, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = state.status === "loading";

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
        }}
        className="overflow-hidden rounded-xl border border-t-2 border-line-strong border-t-ink bg-surface-2"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-2.5 sm:px-6">
          <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
            <span className="text-accent" aria-hidden="true">
              ▪
            </span>
            the article
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
            → evidence map
          </p>
        </div>

        <div className="px-5 py-3 sm:px-6">
          <label className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:items-baseline sm:gap-5">
            <span className="font-mono text-[11px] uppercase leading-tight tracking-widest text-ink-muted">
              Article
              <span className="mt-0.5 block text-[10px] text-ink-faint">
                title or url
              </span>
            </span>
            <ClearableInput
              value={input}
              onChange={setInput}
              onClear={() => setInput("")}
              placeholder="Quokka — or paste a Wikipedia URL"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-t border-line bg-surface-1/30 px-5 py-3 sm:px-6">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[3px] bg-accent px-4 py-2 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-strong disabled:opacity-40"
          >
            <ScanSearch className="h-4 w-4" aria-hidden="true" />
            {busy ? "Auditing…" : "Audit"}
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
              key={ex}
              type="button"
              onClick={() => {
                setInput(ex);
                run(ex);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-0.5 text-[12px] text-ink-muted transition-colors hover:border-ink hover:text-ink"
            >
              <FileText className="h-3 w-3" aria-hidden="true" />
              {ex}
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
        {state.status === "loading" && (
          <div className="rounded-2xl border border-line-strong bg-surface-2 px-5 py-6">
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
              <p className="font-mono text-[13px] text-ink">
                Reading the current revision of “{state.article}”…
              </p>
            </div>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-faint">
              One fetch, then a structural read of every sentence — no history
              walk.
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
          <div className="animate-rise flex flex-col gap-3">
            <div className="flex justify-end">
              <CopyLinkButton
                params={{
                  audit: state.data.article.title,
                  lang: state.data.article.lang,
                }}
              />
            </div>
            <AuditReport data={state.data} />
          </div>
        )}
      </div>
    </div>
  );
}
