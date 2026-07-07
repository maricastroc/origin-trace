export function CredibilityRead({ text }: { text: string }) {
  return (
    <section className="rounded-xl bg-surface-1 px-5 py-4">
      <h2 className="mb-1.5 text-[13px] font-medium text-ink">
        Leitura de credibilidade
      </h2>
      <p className="text-sm leading-relaxed text-ink-muted">{text}</p>
    </section>
  );
}
