import { describe, expect, it } from "vitest";
import { highImpactScore, isHighImpact } from "@/lib/highImpact";

describe("isHighImpact", () => {
  it("flags English superlative / consensus framing", () => {
    expect(isHighImpact("He is widely regarded as the greatest of all time")).toBe(
      true,
    );
    expect(isHighImpact("the best-selling album in history")).toBe(true);
    expect(isHighImpact("the largest stadium in the world")).toBe(true);
    expect(isHighImpact("the first person to cross the ocean solo")).toBe(true);
    expect(isHighImpact("a record-breaking performance")).toBe(true);
  });

  it("flags Portuguese superlative / consensus framing", () => {
    expect(isHighImpact("É considerado o maior jogador de todos os tempos")).toBe(
      true,
    );
    expect(isHighImpact("uma das melhores atrizes da história")).toBe(true);
    expect(isHighImpact("o time mais vitorioso do mundo")).toBe(true);
    expect(isHighImpact("foi a primeira pessoa a completar a prova")).toBe(true);
    // Multi-word superlative + scope (not just "mais <one word>").
    expect(isHighImpact("o terceiro atleta mais bem pago do mundo")).toBe(true);
  });

  it("does not treat a bare 'Copa do Mundo' mention as high-impact", () => {
    // "Copa do Mundo" contains the scope phrase "do mundo" — the single most
    // common false positive the old boolean produced on football articles.
    expect(
      isHighImpact("Marcou quatro gols na Copa do Mundo de 2014."),
    ).toBe(false);
    expect(
      isHighImpact("Participou das Copas do Mundo de 2018 e 2022."),
    ).toBe(false);
  });

  it("leaves plain descriptive prose alone", () => {
    expect(isHighImpact("The building was completed in 1974.")).toBe(false);
    expect(isHighImpact("It has a population of about 40,000 residents.")).toBe(
      false,
    );
    expect(isHighImpact("A cidade fica no litoral norte.")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isHighImpact("THE GREATEST OF ALL TIME")).toBe(true);
  });

  it("does not flag an absolute-scope phrase on its own", () => {
    // Scope words with no superlative/reputation/record signal: descriptive,
    // not a claim of grandeur. The old boolean `some()` flagged these.
    expect(isHighImpact("one of the busiest airports in the world")).toBe(false);
    expect(isHighImpact("Ela visitou vários países do mundo")).toBe(false);
    expect(isHighImpact("um evento marcante da história local")).toBe(false);
    // But scope paired with a superlative stays high.
    expect(isHighImpact("Foi um dos jogos mais assistidos do mundo")).toBe(true);
  });
});

describe("highImpactScore", () => {
  it("returns 0 for plain prose", () => {
    expect(highImpactScore("The building was completed in 1974.")).toBe(0);
  });

  it("scores a scope phrase alone below threshold", () => {
    expect(highImpactScore("an airport in the world")).toBe(1);
  });

  it("scores a lone superlative at or above threshold", () => {
    expect(highImpactScore("the largest stadium")).toBeGreaterThanOrEqual(2);
  });

  it("stacks signals so superlative + scope outscores either alone", () => {
    const stacked = highImpactScore("regarded as the greatest of all time");
    expect(stacked).toBeGreaterThan(highImpactScore("the greatest stadium"));
  });
});
