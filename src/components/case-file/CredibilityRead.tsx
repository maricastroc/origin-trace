export function CredibilityRead({ text }: { text: string }) {
  return (
    <section className="border-l-2 border-accent py-0.5 pl-5">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
        credibility read
      </p>
      <p className="font-voice text-[17px] leading-relaxed text-ink">{text}</p>
    </section>
  );
}
