<div align="center">

# Origin Trace

**🔍 Provenance for a Claim on Wikipedia**

Point at any claim and get back the history of its _evidence_ — when it entered the article, whether it was ever sourced, and how its citation changed over time.<br/>
Reconstructed deterministically from Wikipedia's full revision history — no language model anywhere. Not a fact-check: it classifies the _life of the evidence_, and when a claim was never backed, it says so.

<br/>

[![Features](https://img.shields.io/badge/★_Features-1a1a1a?style=for-the-badge)](#-features)
[![Docs](https://img.shields.io/badge/▣_Docs-1a1a1a?style=for-the-badge)](#ℹ%EF%B8%8F-how-to-run-the-application)

</div>

<br/>

## 🔍 Features

|                                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **📍 Deterministic origin**          | Binary-searches an article's _entire_ revision history — WikiBlame-style — toward the revision that introduced a claim. Gap-robust: it survives claims that were removed and reintroduced, converging on the earliest occurrence it reaches rather than the nearest one — and reports whether that origin is _proven_ (every earlier revision read and absent) or the earliest it _sampled_, never passing one off as the other.                       |
| **🧬 Evidence-history verdict**      | It doesn't judge true or false. It classifies the _life of the evidence_ — `born-sourced`, `retrofit` (sourced only later), `unsourced-stable` (never backed, never removed), and more — graded by epistemic risk, stamped on the case file like a rubber stamp.                                                                                                                                                                                    |
| **🔄 Circular source (citogenesis)** | The strongest tell a provenance tool can find: when a claim lived unsourced and the citation later bolted onto it was _published after_ the claim already appeared here, the source can't be its origin — it may have drawn from Wikipedia. The engine flags this loop deterministically from the two dates, and says plainly the backing may be circular.                                                                                          |
| **🧾 Closed-corpus receipt**         | Wikipedia's history is finite and enumerable, so the corpus is closed — and the receipt says exactly what that bought: whether every revision below the origin was read (a true _proof of absence_) or the range was only _sampled_ (a valid origin, but a sparse earlier occurrence can't be ruled out), plus a warning when truncation broke closure outright. It never dresses a sample as a proof.                                                |
| **📑 Whole-article audit**           | One read of the current revision maps _every sentence_ to its evidence — which carry an inline citation, which assert without one. The claim boundary comes free from Wikipedia's own structure (a sentence and its `<ref>`) — **no NLP**. Then click any uncited sentence to trace its history down to its origin.                                                                                                                                 |
| **🎯 Honest scope resolution**       | Given only a phrase, it finds the article(s) that carry it — and when several match _verbatim_ (itself a propagation signal) or none do, it shows you the candidates instead of guessing at the wrong one.                                                                                                                                                                                                                                          |
| **🔕 A note is not a source**        | An `[α]`-style explanatory footnote (`{{efn}}` / a grouped `<ref group=…>`) reads like a reference but cites nothing. The engine tells them apart — and looks _inside_ a note for a nested citation — refusing to count a note as backing.                                                                                                                                                                                                          |
| **🤐 Honest abstention**             | When a phrase isn't in the history, it says so rather than inventing an origin. It reports "no removal recorded" — never "never challenged" — because it can't yet prove the latter. Silence, and uncertainty, are results.                                                                                                                                                                                                                         |
| **⚡ Live, streamed, zero setup**    | The whole pipeline runs against the public Wikipedia API with **no keys, no LLM, no database required** — every verdict is reproducible from the revision history alone. Progress streams as the search runs; long histories are enumerated in parallel, the search speculatively prefetches its own descent, and repeat traces are served from a persistent cache (in-process, optionally backed by Redis/KV) that nothing the verdict depends on. |

<br/>

## 🛠️ Tech Stack

<p>
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Wikipedia-000000?style=for-the-badge&logo=wikipedia&logoColor=white" alt="Wikipedia API" />
  <img src="https://img.shields.io/badge/No_LLM-2e7d32?style=for-the-badge&logoColor=white" alt="No LLM" />
</p>

| Category        | Technologies                                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**   | Next.js 16 (App Router), React 19                                                                                                                                                                                                 |
| **Language**    | TypeScript 5                                                                                                                                                                                                                      |
| **Styling**     | Tailwind CSS v4                                                                                                                                                                                                                   |
| **Engine**      | Pure TypeScript — WikiBlame gap-robust binary search over a closed revision corpus; the core is dependency-free (one optional dep, the Upstash Redis client, only for the cache layer)                                            |
| **Evidence**    | MediaWiki Action API — revision enumeration (fanned out across concurrent timestamp windows), wikitext content, and full-text search; nothing cloned or scraped                                                                   |
| **Determinism** | **No LLM, no database.** Every verdict is a reproducible function of the revision history                                                                                                                                         |
| **Caching**     | Two-tier — an in-process LRU in front of an optional Upstash Redis/KV layer (gzipped). Immutable revision bodies never expire, so a warm article traces in seconds; with no store configured it degrades to in-memory, zero setup |
| **Streaming**   | Server-Sent Events — real binary-search progress, not a faked spinner                                                                                                                                                             |
| **Runtime**     | Node.js API routes — `/api/trace` (SSE), `/api/resolve`, `/api/audit`, `/api/prewarm`                                                                                                                                             |
| **Tooling**     | ESLint, `tsc`, **Vitest** (a unit suite over the engine + lib, no network), and a live validation harness (`engine:validate`) that checks the engine against hand traces                                                          |

<br/>

## 📝 Project Description

Origin Trace answers the question a Wikipedia citation can't: **what is the evidence history of this claim?**

You paste a claim (or an article to audit) and the engine enumerates the article's _entire_ revision history — a closed, finite corpus — then binary-searches it toward the earliest revision where it can confirm the claim (and tells you whether that origin is proven or only the earliest it sampled). At that revision, and at the current one, it reads whether a citation actually sits on the claim's own sentence. From those facts it classifies the claim's **evidence history**: was it born with a source, back-filled with one later, or never backed at all?

Crucially, there is **no language model anywhere in the pipeline.** The origin is found by search, the citation is read from the markup, and the verdict is computed from those signals — so every result is reproducible from the revision history alone, and the tool never has to be trusted to have "not made it up."

The result is presented as a **case file**: an evidence-status verdict up top (the epistemic health of the claim), a **timeline** tracing the claim from _absent_ → _introduced_ → _current_ with the wording and citation at each step, and a **closed-corpus receipt** that states whether the origin is a proven proof of absence or the earliest occurrence the search sampled.

**Additional features:**

- **Audit a whole article, then drill in.** Beyond a single phrase, Origin Trace maps an entire article in one fetch — segmenting it by structure (a sentence, and whether a `<ref>` sits on it) into `sourced`, `note-only` and `uncited`, with a coverage x-ray at the top. The lead section is counted _apart_ (per WP:LEADCITE, lead claims are conventionally cited in the body), and "uncited" is stated descriptively — never as "wrong". Click any uncited sentence and it runs the full origin trace on it, inline, so the cheap structural map and the expensive per-claim history are one continuous flow.
- **Gap-robust blame.** Real histories aren't monotonic: a claim can be introduced, reworded away, then reappear — several disjoint "present" bands. A plain lower-bound search would return the edge of whichever band the probes fell into. The engine finds the left edge of a band, then re-searches the prefix below it for any _earlier_ occurrence, repeating until its samples below the bound come back empty. When it has actually read every revision below, that origin is _proven_; otherwise it reports the earliest it found and flags that a sparse earlier occurrence — an island narrower than the sampling stride — can't be ruled out. It never presents a sampled origin as a proof.
- **Scope resolution that refuses to guess.** From a bare phrase, the engine only pins an article when the phrase appears verbatim in exactly one. Several verbatim matches (a propagation signal), only fuzzy matches (the wording may have drifted), or nothing at all — each returns the ambiguity for you to resolve, never a silently-wrong trace.
- **Note vs. citation, decided honestly.** `{{efn}}`/`{{refn}}` footnotes and grouped `<ref group=…>` markers look like references but cite nothing. They're classified as _notes_ — and a note is only allowed to "count" if it embeds a real citation of its own. The verdict stays unsourced, and the UI says exactly why.
- **A terminal companion.** `npm run trace` runs the same collect → search → detect → classify pipeline from the CLI and prints the `ClaimProvenance` as JSON — the exact shape the UI consumes.
- **A self-checking engine.** `npm run engine:validate` runs the engine against hand-verified traces on the live API. The invariant isn't equality — the engine is _expected_ to find an earlier origin than a human did — but an inequality: `engine origin ≤ manual pin`. A later origin is the only real failure.

<br/>

## 🔬 How it works

The pipeline is fully deterministic end to end — there is no probabilistic component to distrust. Every stage is a pure function of the revision history:

```
phrase → resolve scope       — which article carries it? honest about ambiguity   [deterministic]
       → enumerate the corpus — every revision, oldest-first (a closed set)         [deterministic]
       → binary-search origin — gap-robust, O(log n) reads to the earliest occurrence found  [deterministic]
       → detect the citation  — is a <ref> on the claim's sentence, at birth & now? [deterministic]
       → classify the history — born-sourced / retrofit / unsourced-stable / …      [deterministic]
       → case file (verdict · timeline · closed-corpus receipt)
```

**Resolve ([`src/engine/resolve.ts`](src/engine/resolve.ts)).** A phrase is searched two ways — `insource:"…"` for verbatim current-wikitext matches and a fuzzy relevance search — and only when it appears verbatim in exactly one article is a scope pinned. Everything else returns candidates, ranked, for a human to choose.

**Collect + search ([`src/engine/wikipedia.ts`](src/engine/wikipedia.ts), [`src/engine/blame.ts`](src/engine/blame.ts)).** The article's revisions are enumerated oldest-first — the closed corpus. A long history is fanned out into concurrent timestamp windows rather than walked one paginated request at a time; the windows are deduped by revision id and re-ordered, so the result is byte-for-byte the serial list — nothing lost or duplicated at a seam. A gap-robust binary search then reads only `O(log n)` revisions to find the earliest one containing the claim, and **speculatively prefetches each descent** — warming, in one batched round-trip, every revision the next few comparisons could touch — so the search rarely blocks on a per-level fetch. Substring matching survives re-linking and re-formatting by normalizing away wiki markup.

**Detect ([`src/engine/blame.ts`](src/engine/blame.ts)).** At the origin revision and the current one, the engine anchors on the claim as _prose_ (not where it happens to appear inside a citation's own title) and reads whether a real `<ref>`/`{{cite}}` sits on that claim's **own sentence** — bounded to the sentence so it can't borrow the neighbour's citation.

**Classify ([`src/engine/trace.ts`](src/engine/trace.ts)).** From "sourced at birth?" and "sourced now?" it derives the verdict — `born-sourced`, `retrofit`, `source-lost` (born cited, later stripped), or `unsourced-stable` (plus a _removed_ state) — assembles the timeline, and reports its confidence and caveats honestly in `meta.notes`. On a retrofit, it also cross-checks dates: when the citation that later backed the claim was _published after_ the claim first appeared here, that source can't be its origin — the engine emits a **citogenesis loop** (unsourced here → source published later → cited back) and marks the backing as possibly circular.

**Audit ([`src/engine/audit.ts`](src/engine/audit.ts)).** For a whole article, a single fetch of the current revision is segmented structurally — `<ref>`/template spans masked, sentences split with an abbreviation guard, the trailing citation after each period attached to the sentence it backs — and each sentence is classified with the _same_ citation rules as the per-claim trace.

**Cache + prewarm ([`src/engine/cache.ts`](src/engine/cache.ts), [`src/engine/redis-cache.ts`](src/engine/redis-cache.ts), [`src/app/api/prewarm/route.ts`](src/app/api/prewarm/route.ts)).** A revision is immutable, so once its wikitext is read it never needs reading again. Revision bodies and lists are cached in an in-process LRU fronting an optional Redis/KV layer (gzipped — a 12k-revision list packs from ~1.8 MB to well under the store's request limit) that survives the serverless cold starts an in-memory cache can't. The moment you scope an article its history is prewarmed in the background, so it's already resident when you hit _Trace_ — and a repeat trace of a warm article skips the network almost entirely.

<br/>

## 🧬 The vocabulary

Origin Trace doesn't return true or false. Every claim resolves to one of these patterns — a read on the _life of its evidence_, graded from soundest to most alarming:

| Verdict              | Health      | What it means                                                                                             |
| -------------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| **born-sourced**     | sourced     | Claim and citation entered the article in the same revision.                                              |
| **retrofit**         | back-filled | Lived as unsourced fact first; a citation was attached only later.                                        |
| **source-lost**      | unsourced   | Born with a citation that was later stripped — the claim now stands uncited.                              |
| **unsourced-stable** | unsourced   | Has carried no citation in its entire history, yet no one removed it.                                     |
| **ambiguous**        | ambiguous   | The verdict flips depending on where you draw the line around "the same claim" — both readings are shown. |

> The live engine classifies claims into **born-sourced**, **retrofit**, **source-lost**, **unsourced-stable** and **ambiguous**, plus a terminal **removed** state. `churn` (a citation swapped repeatedly) and `contested` (revert / edit-war analysis) are on the roadmap and are **not shown** in the UI until the engine actually emits them — until then it deliberately says "no removal recorded" rather than "never challenged".

<br/>

## 📌 Design notes

The central claim of this project is that a provenance answer is worthless unless you can trust it wasn't invented — so the entire pipeline is built to be _reproducible_, not merely plausible.

- **Determinism over plausibility.** There is no language model in the pipeline. The origin is found by binary search, the citation is read from the markup, and the verdict is a pure function of those two. Run it twice and you get the same answer, from the same evidence, every time.
- **The corpus is closed.** Because a Wikipedia article's revision history is finite and fully enumerable, reading every revision below an origin makes it a _proof of absence_, not an unsampled gap. The receipt makes that argument explicit when the search read exhaustively — and withholds it, flagging a sparse earlier occurrence as not ruled out, when the range was only sampled or the history was truncated.
- **Abstention is a first-class result.** "The phrase isn't in this history" and "no removal is recorded" are correct, useful answers — not errors to paper over. The engine would rather abstain than pin the wrong origin or over-claim what it can prove.
- **Provenance ≠ source quality.** _When_ a claim was backed and _how good_ that backing is are two different axes. Origin Trace reports the first precisely and flags the second (e.g. "no primary or peer-reviewed source detected") without conflating them.
- **A note is not a source.** The one place the tool is opinionated is refusing to let an explanatory footnote masquerade as a citation — because that's exactly the mistake a careless reader makes.

<br/>

## ⚠️ Limitations

A tool that stakes its value on honesty should be just as honest about its own edges:

- **Citation detection is heuristic.** It looks for a `<ref>`/`{{cite}}` on the claim's own sentence — good for the common `claim.<ref>…</ref>` shape, deliberately modest about exotic citation structures. It reports `confidence: low` accordingly.
- **Sentence segmentation is structural, not perfect.** The whole-article audit infers sentence boundaries from markup with an abbreviation guard — reliable, but heuristic. "Uncited" means _no inline citation sits on the sentence_; it is descriptive, and some sentences legitimately need none.
- **Reworded claims may not be found.** The trace matches a phrase across history; if the wording drifted substantially, the exact phrase won't be in the older revisions, and the tool returns an honest "not found" rather than a wrong origin.
- **Contested and churn aren't detected yet.** Revert and edit-war analysis is unimplemented, so the engine says "no removal recorded" rather than "never challenged", and doesn't yet surface a citation that was swapped repeatedly.
- **Circular-source detection needs a live citation.** The citogenesis check compares the cited source's publication _year_ to the claim's introduction year, so it only fires on a retrofit still present in the current revision — a claim exposed and _removed_ (the canonical "Brazilian aardvark") no longer carries a citation to test. It also reasons at year granularity, and doesn't pin the exact revision that attached the citation — the loop's note says so rather than overstating it.
- **Current-state vs. history can differ — legitimately.** The audit reads the _current_ revision; the drill-down reads the _history_. A claim that was born with a source later stripped shows as `uncited` now in the audit, and as `source-lost` in its trace — the badge names the loss instead of asserting the birth state. Both are true; they describe different points in time.
- **Very long histories can be truncated.** Enumeration is capped at a generous page limit. When it bites, closure is _unproven_ — and the receipt says so, rather than quietly presenting a partial search as complete.

<br/>

## 🧪 Testing

Because the pipeline is a set of pure, deterministic functions, it's tested the same way — **no network, no live API**. The engine takes an injectable `fetchJson`, so a small in-memory stand-in for the MediaWiki API drives whole traces end to end; every assertion is reproducible offline, exactly like the verdicts themselves.

- **178 tests across 18 files**, run with **Vitest**.
- **Engine** — the gap-robust binary search (including removed-and-reintroduced histories) and its **speculative-prefetch descent** (proven to locate the identical origin with far fewer round-trips), citation-vs-note detection, `{{cite}}` parsing, structural article segmentation, and every verdict path: `born-sourced`, `retrofit`, `source-lost`, `unsourced-stable`, _removed_, and the **citogenesis loop**.
- **Wikipedia client** — `rvcontinue` pagination, truncation, missing pages, wikitext-snippet cleaning, and the **parallel windowed enumeration proven equivalent to a serial walk** — same revisions, same order, nothing lost or duplicated even when a window boundary splits a same-timestamp cluster.
- **Caching** — the two-tier cache (in-process LRU + gzip'd Redis round-trip, backfill, and cached-`null`-vs-miss), exercised against an in-memory Redis stand-in.
- **Lib** — high-impact phrase detection (EN + PT), audit metrics/model, evidence signals, and the label/verdict maps.
- **API routes** — input-validation branches.

```bash
npm test
```

<br/>

## ℹ️ How to run the application?

> No API keys, database, or accounts are required — Origin Trace runs entirely against the public Wikipedia API.

> Clone the repository:

```bash
git clone https://github.com/maricastroc/origin-trace
```

> Install the dependencies:

```bash
npm install
```

> Start the dev server:

```bash
npm run dev
```

> ⏩ Access [http://localhost:3000](http://localhost:3000) to view the web application.

> **Optional — persistent cache.** To make repeat traces survive serverless cold starts, point it at an Upstash Redis / Vercel KV store by setting `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or the `KV_REST_API_URL` / `KV_REST_API_TOKEN` pair). With neither set, the cache stays in-process and everything runs unchanged.

> Or trace a claim straight from the terminal — it prints the full `ClaimProvenance` as JSON:

```bash
npm run trace -- Quokka "happiest animal"
```

> Check the engine against the hand-verified traces on the live API (the `engine origin ≤ manual pin` invariant):

```bash
npm run engine:validate
```

> Run the unit suite (Vitest, fully offline):

```bash
npm test
```

<br/>

## 🔎 Try these

Three real Wikipedia claims that each tell a different story about their evidence:

| Article       | Claim                       | What you'll find                                                                                                                                              |
| ------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quokka**    | _"happiest animal"_         | `retrofit` + a **citogenesis loop** — the citation backing it (The West Australian, 2019) was published years _after_ the claim already lived in the article. |
| **Coati**     | _"Brazilian aardvark"_      | `unsourced-stable` — the famous citogenesis case: a coined nickname that lived in the article unbacked.                                                       |
| **Petasites** | _"pyrrolizidine alkaloids"_ | `retrofit` — the engine pins the origin years earlier than a manual trace did.                                                                                |

<br/>

## 📄 License

Released under the MIT License. You're free to use, study, fork and build on this code — **as long as the original copyright and license notice are kept**. Reuse it and learn from it; don't strip the attribution and present it as your own.

© 2025–2026 Mariana Castro

<br/>

<div align="center">

⭐ If you like this project, give it a star on GitHub!

</div>
