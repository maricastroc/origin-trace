"use client";

import { useEffect, useState } from "react";
import type {
  ArticleAudit as ArticleAuditData,
  AuditClaim,
  AuditSection,
} from "@/types/ArticleAudit";
import type { ClaimProvenance } from "@/types/ClaimProvenance";
import { streamTrace, type TraceProgress } from "@/lib/traceClient";
import { CaseFile } from "./case-file/CaseFile";

const EXAMPLES = ["Quokka", "Coati", "Cleopatra", "Black hole"];

const enc = encodeURIComponent;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const inputClass =
  "w-full rounded-md border border-line-strong bg-surface-1 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent";

type State =
  | { status: "idle" }
  | { status: "loading"; article: string }
  | { status: "error"; message: string }
  | { status: "done"; data: ArticleAuditData };

/** Pull "Quokka" (and lang) out of a pasted title or full Wikipedia URL. */
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

// --- Summary: the document x-ray -------------------------------------------

function AuditSummary({ data }: { data: ArticleAuditData }) {
  const { body, lead, coverage } = data.summary;
  const pct = Math.round(coverage * 100);

  return (
    <section className="rounded-xl border border-line-strong bg-surface-1/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div>
          <p className="kicker">the audit · body</p>
          <div className="mt-2.5 flex items-end gap-3">
            <span className="font-display text-[34px] leading-none text-ink">
              {pct}%
            </span>
            <span className="mb-1 max-w-[15rem] text-[12.5px] leading-snug text-ink-muted">
              of the body&rsquo;s {body.total} sentences carry an inline citation
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Chip tone="ok">{body.sourced} sourced</Chip>
          {body.noteOnly > 0 && <Chip tone="warn">{body.noteOnly} note-only</Chip>}
          <Chip tone="danger">{body.unsourced} uncited</Chip>
        </div>
      </div>

      <CoverageBar
        sourced={body.sourced}
        noteOnly={body.noteOnly}
        unsourced={body.unsourced}
      />

      <div className="mt-4 flex flex-col gap-2 text-[12.5px] leading-relaxed text-ink-faint">
        {lead.total > 0 && (
          <p>
            <span className="text-ink-muted">Lead:</span> {lead.sourced} of{" "}
            {lead.total} sentences cited inline — the rest are conventionally
            sourced in the body (WP:LEADCITE), so they&rsquo;re counted apart.
          </p>
        )}
        <p>{data.meta.notes}</p>
      </div>
    </section>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "ok" | "warn" | "danger";
}) {
  const c =
    tone === "ok"
      ? "border-success/40 text-success"
      : tone === "warn"
        ? "border-warn/40 text-warn"
        : tone === "danger"
          ? "border-danger/40 text-danger"
          : "border-line-strong text-ink-muted";
  return (
    <span
      className={`rounded-full border bg-surface-2 px-2.5 py-0.5 font-mono text-[11px] ${c}`}
    >
      {children}
    </span>
  );
}

function CoverageBar({
  sourced,
  noteOnly,
  unsourced,
}: {
  sourced: number;
  noteOnly: number;
  unsourced: number;
}) {
  const total = Math.max(1, sourced + noteOnly + unsourced);
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-line"
      role="img"
      aria-label={`${sourced} sourced, ${noteOnly} note-only, ${unsourced} uncited`}
    >
      <div className="h-full bg-success" style={{ width: seg(sourced) }} />
      <div className="h-full bg-warn" style={{ width: seg(noteOnly) }} />
      <div className="h-full bg-danger/80" style={{ width: seg(unsourced) }} />
    </div>
  );
}

// --- The map ----------------------------------------------------------------

function AuditMap({ data }: { data: ArticleAuditData }) {
  return (
    <div className="flex flex-col gap-6">
      {data.sections.map((sec, i) => (
        <SectionBlock key={i} section={sec} article={data.article} />
      ))}
    </div>
  );
}

function SectionBlock({
  section,
  article,
}: {
  section: AuditSection;
  article: ArticleAuditData["article"];
}) {
  return (
    <section>
      <div className="flex items-center gap-2.5">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
          {section.isLead ? "lead" : section.heading}
        </h3>
        {section.isLead && (
          <span className="rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-faint">
            cited in body by convention
          </span>
        )}
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {section.claims.map((claim) => (
          <ClaimRow
            key={claim.id}
            claim={claim}
            article={article}
            muted={section.isLead}
          />
        ))}
      </ul>
    </section>
  );
}

const DOT: Record<AuditClaim["status"], string> = {
  sourced: "bg-success",
  "note-only": "bg-warn",
  unsourced: "bg-danger",
};

function ClaimRow({
  claim,
  article,
  muted,
}: {
  claim: AuditClaim;
  article: ArticleAuditData["article"];
  muted: boolean;
}) {
  const [open, setOpen] = useState(false);
  const traceable = claim.status !== "sourced";

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`group flex w-full items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
          open
            ? "border-line-strong bg-surface-2"
            : "border-transparent hover:border-line hover:bg-surface-1/50"
        }`}
      >
        <span
          className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${DOT[claim.status]} ${
            muted ? "opacity-50" : ""
          }`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span
            className={`text-[13.5px] leading-relaxed ${muted ? "text-ink-muted" : "text-ink"}`}
          >
            {claim.text}
          </span>
          {claim.source?.label && (
            <span className="ml-2 whitespace-nowrap font-mono text-[11px] text-success/90">
              ↳ {claim.source.label}
            </span>
          )}
        </span>
        <span
          className={`mt-0.5 shrink-0 font-mono text-[11px] transition-colors ${
            traceable
              ? "text-ink-faint group-hover:text-accent"
              : "text-ink-faint/60"
          }`}
        >
          {open ? "close" : traceable ? "trace →" : "history →"}
        </span>
      </button>

      {open && (
        <div className="animate-rise mt-1.5 mb-1">
          <ClaimDrillDown
            article={article.title}
            lang={article.lang}
            phrase={claim.text}
          />
        </div>
      )}
    </li>
  );
}

// --- Drill-down: run the real trace on demand ------------------------------

type TraceState =
  | { status: "idle" }
  | { status: "tracing"; progress: TraceProgress | null }
  | { status: "error"; message: string }
  | { status: "done"; data: ClaimProvenance };

function ClaimDrillDown({
  article,
  lang,
  phrase,
}: {
  article: string;
  lang: string;
  phrase: string;
}) {
  const [state, setState] = useState<TraceState>({ status: "tracing", progress: null });

  // Kick off the trace when the row opens; abort if it closes mid-flight.
  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    streamTrace({
      article,
      lang,
      phrase,
      signal: controller.signal,
      onProgress: (progress) => live && setState({ status: "tracing", progress }),
    })
      .then((data) => live && setState({ status: "done", data }))
      .catch((err) => {
        if (live && !controller.signal.aborted) {
          setState({ status: "error", message: errMsg(err) });
        }
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [article, lang, phrase]);

  return (
    <div className="rounded-xl border border-line bg-surface-1/40 p-4 sm:p-5">
      {state.status === "tracing" && <TraceProgressLine progress={state.progress} />}

      {state.status === "error" && (
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-warn">
            couldn&rsquo;t trace this sentence
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
            {state.message}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
            The sentence may have been reworded since it was introduced — the
            exact phrasing isn&rsquo;t in the older history.
          </p>
        </div>
      )}

      {state.status === "done" && <CaseFile data={state.data} />}
    </div>
  );
}

function TraceProgressLine({ progress }: { progress: TraceProgress | null }) {
  const { label, pct } = traceStatus(progress);
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
        <p className="font-mono text-[12.5px] text-ink">{label}</p>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-faint">
          {pct}%
        </span>
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function traceStatus(p: TraceProgress | null): { label: string; pct: number } {
  if (!p) return { label: "Opening the trace…", pct: 4 };
  switch (p.phase) {
    case "listing":
      return { label: "Listing the revision history…", pct: 9 };
    case "listed":
      return { label: `${p.revisions.toLocaleString()} revisions in scope`, pct: 18 };
    case "searching": {
      const ratio = Math.min(1, p.read / Math.max(1, p.estimate));
      return { label: "Binary-searching for the introduction…", pct: Math.round((0.2 + 0.6 * ratio) * 100) };
    }
    case "located":
      return { label: `Introduction located · ${p.year}`, pct: 86 };
    case "reading":
      return { label: "Reading the revisions…", pct: 92 };
    case "detecting":
      return { label: "Detecting the attached citation…", pct: 97 };
  }
}
