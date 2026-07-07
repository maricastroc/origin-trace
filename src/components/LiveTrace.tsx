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
  "rounded-md border border-line bg-surface-1 px-2.5 py-1.5 text-sm text-ink outline-none transition-colors focus:border-line-strong";

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
        className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 px-5 py-4"
      >
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">
          Rastrear uma afirmação ao vivo
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-col gap-1 sm:w-1/3">
            <span className="text-[12px] text-ink-muted">Artigo</span>
            <input
              value={article}
              onChange={(e) => setArticle(e.target.value)}
              placeholder="Quokka"
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[12px] text-ink-muted">Frase da afirmação</span>
            <input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="happiest animal"
              className={inputClass}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-surface-2 transition-opacity disabled:opacity-40"
          >
            {loading ? "Rastreando…" : "Rastrear"}
          </button>
          <span className="text-[12px] text-ink-faint">exemplos:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.article}
              type="button"
              onClick={() => {
                setArticle(ex.article);
                setPhrase(ex.phrase);
              }}
              className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
            >
              {ex.article}
            </button>
          ))}
        </div>
      </form>

      {state.status === "loading" && <LiveTraceLoading />}
      {state.status === "error" && (
        <div className="rounded-xl border border-line bg-surface-2 px-5 py-4">
          <p className="text-sm font-medium text-danger">
            Não foi possível rastrear
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            {state.message}
          </p>
        </div>
      )}
      {state.status === "done" && <CaseFile data={state.data} />}
    </div>
  );
}

const STEPS = [
  "Listando o histórico de revisões…",
  "Busca binária pela introdução…",
  "Lendo o wikitext das revisões…",
  "Detectando a citação anexada…",
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
    <div className="rounded-xl border border-line bg-surface-2 px-5 py-6">
      <div className="flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-success" />
        <p className="text-sm text-ink">{STEPS[step]}</p>
        <span className="ml-auto font-mono text-[11px] text-ink-faint">
          {elapsed}s
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
        O motor lê o histórico real da Wikipedia e faz busca binária até a
        revisão que introduziu a frase. Costuma levar 10–40s.
      </p>
    </div>
  );
}
