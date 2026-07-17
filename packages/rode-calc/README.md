# @rode/calc

Motor de cálculo de frete do RODE COM LUCRO — pacote isomórfico (roda no PWA/Vite e em Edge Functions Deno), sem nenhuma dependência de UI. É a fonte única de verdade da "fórmula do Emerson" e do piso mínimo ANTT, consumida por `calc-app`, `calc-wpp` e `find-app`.

## Origem

Extraído e adaptado de [`github.com/emerson1001a/calculadora-experimental`](https://github.com/emerson1001a/calculadora-experimental) (`src/engine/calcularFrete.ts` + `src/engine/pisoANTT.ts`), uma calculadora React Native/Expo já testada e aprovada por um motorista real. Este pacote preserva a lógica de cálculo validada em campo; o que muda é só o contrato de entrada em alguns pontos (ver abaixo) para ficar compatível com os demais PRDs do projeto.

Ver `Docs/analise-compatibilidade-calculadora-experimental.md` e `Docs/sequencia-construcao.md` no repositório para o histórico completo das decisões.

## Decisões de contrato (diferentes da calculadora original)

- **Retorno**: `voltaVazia: boolean` (como o PRD original), não o `tipoRetorno` de 3 estados da calculadora. Um frete de retorno pago vira uma segunda chamada a `calcularFrete`, não um campo desta função.
- **ARLA 32**: mantida a fórmula da calculadora — consumo próprio independente (`arlaPrecoPorLitro / arlaKmPorLt * distanciaTotal`), **não** percentual do custo de diesel. O PRD técnico do calc-app está desatualizado nesse ponto.
- **Veredito**: lógica simples da calculadora (`lucro<=0 OU abaixoPisoANTT → RUIM`; `margemReal>=margemDesejada → BOM`; senão `ACEITÁVEL`) — sem a faixa `LIMIAR_VERDE`/`pctAcimaPiso` que o PRD calc-app propunha.
- **Campos novos**: `estacionamento`, `chapa` e `pernoite` (separado de `alimentacao`) fazem parte do contrato desde a v1.
- **Piso ANTT**: coeficientes verificados na fonte oficial (ANTTlegis) em 2026-07-17 — vigente é a **Portaria SUROC Nº 4/2026** (Anexo II da Resolução ANTT 6.076/2026), não a "Resolução 6.034/2024" citada no PRD. Cobre hoje só "carga geral"; os demais tipos de carga do schema `antt_piso_tabela` do PRD ainda precisam ser levantados.

## Uso

```ts
import { calcularFrete, calcularPisoANTT, fmtBRL, reaisToCents, centsToReais } from '@rode/calc';

const resultado = calcularFrete({
  origem: 'São Paulo',
  destino: 'Recife',
  distanciaKm: 2650,
  valorFrete: 8000,
  voltaVazia: false,
  margemDesejada: 20,
  numeroEixos: 5,
  custos: {
    dieselKmPorLt: 2.5,
    dieselPrecoPorLitro: 6.1,
    arlaKmPorLt: 25,
    arlaPrecoPorLitro: 4.5,
    pedagio: 720,
    alimentacao: 360,
    pernoite: 0,
    estacionamento: 0,
    chapa: 0,
    manutencaoPorKm: 0.35,
    pneusPorKm: 0.12,
    depreciacaoPorKm: 0.25,
  },
});
```

## Testes

```
npm test
```

Cobre: fórmula do ARLA (consumo independente), comportamento da volta vazia (o que dobra e o que não dobra), guarda de divisão por zero, as 3 fronteiras do veredito, o cálculo e o fallback de eixos do piso ANTT, e o roundtrip `reaisToCents`/`centsToReais`.

**Pendência**: esta suíte ainda não foi executada (sandbox sem shell disponível na sessão em que foi escrita) — rodar `npm install && npm test` neste pacote antes de considerar a extração validada.
