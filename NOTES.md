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
- **O motor (#3) existe e roda ao vivo** (ver abaixo). `tsc --noEmit` e `eslint` limpos.

## O motor (WikiBlame) — feito

`src/engine/` produz um `ClaimProvenance` real a partir da API da Wikipedia. A costura
funcionou: mesmo objeto do contrato, só muda `meta.generatedBy` → `"wikiblame-pipeline"`.

- **`wikipedia.ts`** — cliente da Action API (lista revisões paginada, oldest-first; busca
  wikitext por revid, batched). `fetchJson` injetável → testável com fixtures gravados.
- **`blame.ts`** — puro. `normalize` (dropa `<ref>`, desembrulha links, colapsa markup);
  busca da introdução **robusta a gaps** (histórias não são monotônicas — a frase entra,
  some numa reformulação, volta; a busca acha a borda de uma banda e re-busca o prefixo
  abaixo até convergir na origem real); `detectRefNear` (ancora na frase _em prosa_, não
  dentro do título de uma citação; casa o `<ref>` inteiro limitando só a _distância_);
  `parseCitation` (extrai label/ano/tipo de `{{cite …}}`).
- **`trace.ts`** — orquestra tudo → `ClaimProvenance`. Conservador de propósito:
  `confidence: "low"` e premissas explícitas em `meta.notes`.
- **`cli.ts`** / **`validate.ts`** — `npm run trace -- Quokka "happiest animal"` e
  `npm run engine:validate` (os manuais viraram automáticos).

Eficiente: 37–75 revisões lidas de 1000–1700 (busca binária, não varredura).

### Achado que muda o plano: o motor bate o trace manual

Nos **3 fixtures**, o motor encontrou uma origem **mais antiga** que a pinada à mão:

| caso      | origem no mock     | origem do motor        | efeito                             |
| --------- | ------------------ | ---------------------- | ---------------------------------- |
| quokka    | 2016-07 (HuffPost) | **2014-05, sem fonte** | churn → **retrofit**               |
| coati     | 2008-08            | **2008-07, sem fonte** | ainda presente hoje (não removida) |
| petasites | 2009               | **2007-02, sem fonte** | **retrofit**                       |

Não é bug — é a tese se confirmando. O trace manual do quokka começou na citação de 2016 e
perdeu que a frase já existia _sem fonte_ desde 2014. Rastreamento determinístico revela a
proveniência que o resumo humano perde. **Consequência:** a validação NÃO pode exigir
"motor == mock". A invariante certa (imutável, em `validate.ts`) é
`origem_do_motor ≤ origem_manual` — só quebra se o motor _perder_ a origem.

## Design — "dossiê arquival" (light)

Reformulação completa da UI para nível de portfólio (régua: o Git Investigator).
Conceito: um **dossiê de proveniência forense** em papel.

- **Fontes** (`layout.tsx`, next/font): **Fraunces** (display, `--font-display`) nas
  manchetes e títulos; **Newsreader** itálico (`--font-voice`) nas citações — a afirmação
  sob exame; **Geist Mono** nos rótulos forenses (revids, datas, kickers `// ...`, `01 ·`);
  Geist Sans no corpo.
- **Paleta** (`globals.css`): papel quente off-white, tinta quase-preta, **acento oxblood**
  (`--accent: #8a2b26`) como assinatura. Um único tema claro art-directed (sem dark auto).
  Verdict = carimbo de borracha: born-sourced=verde, retrofit/unsourced=oxblood,
  churn/contested=ocre, ambiguous=neutro. `verdictStyle.ts` continua o **único** lugar
  onde semântica vira cor (contrato segue styling-free).
- **Narrativa** (`page.tsx`): masthead → **hero** (tese + specimen do dossiê) → **método**
  (01 genealogia · 02 corpus fechado · 03 honestidade) → **casos** como dossiês (cards com
  aposta + `CaseFile` aberto) → **explorador ao vivo** → rodapé (“proveniência > resumo”).
  As abas anônimas viraram um explorador de casos curado.
- **Elementos-assinatura**: a **timeline** (espinha 2px, nós com presença, rupturas
  coloridas por magnitude, revids como recibos mono, citações em serif) e o **carimbo de
  veredito** (`VerdictStamp`, moldura dupla rotacionada). Componentes novos em
  `components/site/` (Masthead, Hero, HeroSpecimen, Method, SiteFooter, Mark) e
  `CaseExplorer`/`CaseCard`.
- Verificado: `next build` limpo, `tsc`/`eslint` limpos, responsivo (mobile 375px sem
  overflow — o bug das abas sumiu com as abas).

## Resolução de escopo (phrase-only) — feita

Antes o `traceClaim` exigia `{ article, phrase }`. Agora dá pra colar **só a frase**: um
estágio de resolução (`src/engine/resolve.ts` → `/api/resolve`) descobre o(s) artigo(s) e
entrega ao motor inalterado. A regra é deliberadamente honesta — **nunca escolhe em
silêncio**:

- `resolveArticles(phrase)` roda duas buscas na search API: `insource:"frase"` (match
  literal no wikitext atual) + busca fuzzy ranqueada. Une, dedup, ordena (literal primeiro).
- **Só crava sozinho quando há exatamente 1 match literal** (`scope: "unambiguous"`) → aí
  traça direto. Todo o resto devolve a ambiguidade:
  - vários matches literais → `ambiguous` + nota "aparece literal em N artigos — sinal de
    propagação" (é a citogênese aparecendo na resolução: "Brazilian aardvark" cai em Coati +
    Circular reporting + Reliability of Wikipedia).
  - só matches fuzzy → `ambiguous` + "a redação pode ter mudado; estes são os mais próximos"
    (ex.: "happiest animal" não casa literal com "happiest animal**s**").
  - nada → `not-found` + "me diga o artigo".
- UI (`LiveTrace`): input de frase + campo de artigo **opcional** (override do escopo).
  Máquina de estados: idle → resolving → (unambiguous ⇒ tracing | ambiguous ⇒ `ScopePicker`
  com candidatos | not-found). O escopo escolhido aparece num banner acima do dossiê.
- Filosofia: "tento resolver o escopo; quando é ambíguo, mostro a ambiguidade" — não
  "digite qualquer frase e eu descubro tudo". Preserva o corpus fechado (ainda se traça o
  histórico finito de UM artigo) e o "admite quando o registro cala".

## Reframe epistemológico — feito

O produto respondia "quando surgiu"; o valor real é "qual o **estado epistemológico** da
afirmação". O veredito sempre foi uma _classificação da vida da afirmação_ — agora ele
lidera, em vez de ser legenda de canto.

- **`EvidenceStatus`** (novo, topo do `CaseFile`): a resposta. Palavra de saúde grande em
  Fraunces (`sourced / back-filled / unstable / unsourced / contested / ambiguous`) +
  significado em linguagem simples + carimbo + **sinais derivados** (`deriveSignals` em
  `lib/evidenceSignals.ts`): idade da afirmação, "sourced/unsourced now", "evidence changed
  N×". Severity `alert` (unsourced-stable) pinta o painel em oxblood.
- **`verdictStyle` virou taxonomia graduada por risco**: `severity` (good/caution/warn/
  alert/neutral) → cor, + `health`, `meaning`, `rank`. Fix importante: retrofit saiu do
  oxblood → ocre (foi fonteado, só que tarde); unsourced-stable é o único vermelho crítico.
- **`Taxonomy`** (novo, landing, entre Method e Cases): "It doesn't say true or false. It
  **classifies** the evidence history." — os 6 padrões como vocabulário visível. Vende o
  reframe: _classify the evidence history of any claim_.
- Removido `VerdictSummary` (a resposta agora mora no topo). Timeline re-legendada como "the
  evidence for the verdict".

## Próximos passos

1. **A aposta grande: auditar o artigo inteiro** (não uma frase por vez). Sair de "investigue
   isto" para "qual a qualidade do conhecimento deste artigo": quais afirmações estão sem
   fonte, quais foram retrofitadas, quais deram churn. **Insight de viabilidade (on-brand):
   NÃO usar NLP pra segmentar afirmações** — a fronteira vem de graça da estrutura da
   Wikipedia: **sentenças com `<ref>` vs. sem `<ref>`**. O "mapa de não-fonteadas" de um
   artigo é determinístico e barato; a classificação retrofit/churn por frase é a camada
   cara (um trace por frase) feita sob demanda. Detecção de `contested`/reverts (para
   "never challenged") continua pendente — hoje mostro "no removal recorded", não afirmo.
2. **Deixar o contrato evoluir** (seu ponto original). O motor v0 já pede:
   - um `verdict` "não-encontrada"/abstenção explícito (hoje `traceClaim` lança
     `ClaimNotFoundError`);
   - eventos intermediários reais (hoje o motor só emite intro + estado atual; falta o
     _quando_ exato da troca de fonte e das reformulações — mais buscas binárias por evento);
   - `SourceType` mais rico: `cite web` cai em `"other"` mesmo quando é jornal (ex.: The
     West Australian). Normalizar fontes num registro à parte ajudaria a deduplicar e tipar.
   - `contested`/edit-war ainda não detectado (precisa ler `comment`/reverts das revisões).
3. **Casar motor × UI:** apontar a galeria para a saída do motor (um caso ao vivo ao lado
   dos mocks), ou um input de "cole um artigo + frase". Hoje a UI só lê `src/mocks`.
4. **Polir a UI** com base no uso real.

## Como rodar

```bash
npm run dev                              # http://localhost:3000
npm run trace -- Quokka "happiest animal"  # roda o motor ao vivo, imprime o JSON
npm run engine:validate                  # invariante do motor vs os 3 traces manuais
```
