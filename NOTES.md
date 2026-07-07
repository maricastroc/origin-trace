# Origin Trace — handoff

Notas de contexto para retomar o projeto de qualquer sessão. Escrito em 2026-07-07.

---

## O que é

**Claim Provenance Explorer.** Você seleciona uma afirmação específica de um artigo da
Wikipedia e a ferramenta reconstrói **a história da credibilidade daquela afirmação**:
quando entrou, se nasceu com fonte, quando ganhou/trocou de fonte, se foi contestada, e
como a redação evoluiu — tudo auditável até a revisão exata.

Não é um fact-checker. Não diz "verdadeiro/falso". Diz "de onde veio o respaldo desta
afirmação, e o quão sólido ele é" — e se abstém honestamente onde o registro cala.

## A tese (por que não é só um chatbot)

Uma LLM (mesmo com busca) **resume** evidência tratando as fontes como independentes e
paralelas. Mas crença não se espalha em paralelo — se espalha **genealogicamente**. O
diferencial é reconstruir essa genealogia com **grounding determinístico**:

- **Pipeline determinístico coleta as evidências; a LLM só sintetiza no fim.** Igual ao
  padrão do "Git Investigator". A LLM nunca é fonte, só juiz do que foi recuperado.
- **Corpus fechado = firmeza.** O histórico de revisões de UM artigo é finito e
  enumerável. "Coletei tudo" é demonstrável, então a abstenção é confiável:
  "sem fonte até 2021" é **provado**, não "não encontrei". ("não existe" == "não achei".)
- Herança conceitual: **efeito Woozle** (N vozes, uma raiz fraca) e **citogênese**
  (xkcd 978: Wikipedia inventa → mídia repete → Wikipedia cita a mídia de volta).

## Taxonomia de vereditos

O badge é só o **resumo** da timeline (que é a protagonista). Tipos:

- `born-sourced` — afirmação e citação entraram juntas (ou a fonte precede).
- `retrofit` — existiu sem fonte por um tempo; citação grudada depois.
- `churn` — a afirmação persiste, mas a citação foi trocada ≥2 vezes.
- `unsourced-stable` — nunca teve fonte, mas ninguém removeu (a mais assustadora).
- `contested` — revertida / guerra de edição.
- `ambiguous` — **a identidade do produto**: o mesmo dado dá vereditos opostos
  dependendo do que conta como "a mesma afirmação". O produto mostra as duas leituras
  e devolve o julgamento pro usuário, em vez de fingir certeza.

## Validação já feita (8 casos reais, rastreados na API da Wikipedia)

- **O método funciona cross-category:** 8/8 rastreados, zero `indeterminate`. Retrofit e
  churn aparecem em ciência/geografia/medicina, não só em trivia.
- **Fáceis = chatos:** fatos escritos uma vez (ciência, política, história) = born-sourced,
  o produto não revela nada. Os casos **interessantes** são os que evoluíram.
- **O problema difícil (ponto 3): frases mudam.** A reformulação apareceu em 5/8 casos e
  **inverteu o veredito em 2/8** (retrofit vs born-sourced dependendo do recorte).
  → **Resolução (barata e on-brand): NÃO classificar com NLP. MOSTRAR a cadeia de
  reformulação e as duas leituras.** O problema de NLP vira decisão de UI honesta.
- **Segundo eixo:** proveniência ≠ qualidade da fonte (ex.: born-sourced mas autopublicada;
  ou churn com todas as fontes de mídia popular, nenhuma primária). Exibir os dois, sem
  confundir.

Casos-fixture (em `src/mocks/`): **quokka** (churn), **coati** (retrofit circular /
citogênese), **butterbur** (ambiguous — a identidade). Dados confirmados por leitura direta
do wikitext das revisões citadas em cada mock (`meta.notes`).

## Arquitetura (contract-first / mock-driven)

O **contrato de dados** (`ClaimProvenance`) é a costura: a UI consome; o motor produz.

```
src/
  types/        ClaimProvenance + partes (um tipo por arquivo)
  mocks/        quokka.ts, coati.ts, butterbur.ts (casos reais) + index.ts
  lib/          semântica→estilo (verdictStyle, sourceTypeLabel, changeTagLabel, ...)
  components/
    case-file/  CaseFile decomposto: Header, Timeline, TimelineRow, TransitionLabel,
                SourceChip, VerdictBadge, DualReadings, CircularLoop, CredibilityRead,
                SourceQualityNote, VerdictSummary, icons (SVG inline, sem deps)
    CaseFileGallery.tsx   seletor de abas (client component)
  app/          page.tsx (galeria), globals.css (tokens de design + --font-voice)
```

**Princípios embutidos no código:**

1. **O JSON carrega semântica, NUNCA estilo.** `verdict: "churn"`, `source.type:
   "popular-media"`. A cor mora em `src/lib/verdictStyle.ts` (lado da UI). Dá pra
   redesenhar a interface inteira sem tocar no contrato nem no motor.
2. **Timeline é protagonista, badge é legenda** (inclui a linha "é só o resumo da
   história acima, não o produto").
3. **A costura:** `meta.generatedBy: "manual-trace"` hoje. Quando o motor entrar, ele só
   troca pra `"wikiblame-pipeline"` e emite o mesmo objeto. Os 3 mocks viram os fixtures
   de teste do motor (a saída dele tem que bater com eles).

## O que está pronto e verificado

- Contrato + 3 mocks reais + UI completa consumindo o contrato.
- Dev server compila limpo (Next 16 + Turbopack) e renderiza as 3 abas, a timeline, as
  transições, o laço circular (coati), as duas leituras (butterbur), e os blocos de
  credibilidade/qualidade-da-fonte.

## Próximos passos

1. **O motor (#3, estilo WikiBlame):** o primeiro código que *produz* o `ClaimProvenance`
   a partir da API real, em vez de ler um mock. É a busca binária no histórico de revisões
   para localizar (a) onde uma frase entrou e (b) quando o `<ref>` foi anexado.
   Prior art: WikiBlame, "Who Wrote That?" / token-provenance (WikiWho). É integração, não
   invenção. (Nota: a API do WikiWho deu erro de SSL numa tentativa — confirmar; o WikiBlame
   é o prior art sólido.)
2. **Deixar o contrato evoluir** conforme a implementação pedir — provavelmente
   `contested`/edit-war como evento, e talvez normalizar as fontes num registro à parte
   para deduplicar. A filosofia é: contrato como ponto de partida, não como previsão total.
3. **Polir a UI** com base no uso real.

## Como rodar

```bash
npm run dev        # http://localhost:3000 (ou -- -p 3117 para uma porta dedicada)
```
