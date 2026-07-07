export function SourceQualityNote({
  quality,
}: {
  quality: { note: string; flags: string[] };
}) {
  return (
    <section className="rounded-xl border border-line px-5 py-3.5">
      <p className="text-[13px] leading-relaxed text-ink-muted">
        <span className="font-medium text-ink">Qualidade da fonte · </span>
        {quality.note}.
      </p>
    </section>
  );
}
