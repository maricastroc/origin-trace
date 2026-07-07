import { describe, expect, it } from "vitest";
import { isHighImpact } from "@/lib/highImpact";

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
});
