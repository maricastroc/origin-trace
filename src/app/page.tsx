import { CaseFileGallery } from "@/components/CaseFileGallery";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-12 sm:py-16">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Origin Trace
        </h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
          A história da credibilidade de uma afirmação na Wikipedia — não o
          resumo, a evolução. Três casos reais, rastreados na API.
        </p>
      </header>
      <CaseFileGallery />
    </main>
  );
}
