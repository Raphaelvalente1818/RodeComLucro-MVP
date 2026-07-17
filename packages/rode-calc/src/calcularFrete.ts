// Motor de cálculo de frete — fonte única de verdade da "fórmula do Emerson",
// consumida pelo app (calc-app), pelo copiloto de WhatsApp (calc-wpp) e pelo
// feed de oportunidades (find-app).
//
// Origem: adaptado de github.com/emerson1001a/calculadora-experimental
// (src/engine/calcularFrete.ts) — validado em campo por um motorista real
// (Emerson). Ver Docs/analise-compatibilidade-calculadora-experimental.md
// e Docs/sequencia-construcao.md para o histórico completo das decisões
// abaixo.
//
// Decisões aplicadas nesta versão (2026-07-17):
//   1. ARLA 32 mantém a fórmula da calculadora: consumo próprio
//      independente (litros/km × preço/litro), IGUAL ao diesel — não é
//      percentual do custo de diesel (`arlaPct`) como o PRD calc-app
//      descrevia. O PRD está desatualizado nesse ponto, não este motor.
//   2. Retorno é um booleano só (`voltaVazia`), como no PRD original —
//      não o `tipoRetorno` de 3 estados da calculadora. "Frete de retorno
//      pago" não é modelado aqui: vira uma segunda chamada a
//      `calcularFrete` (uma nova análise), não um campo desta função.
//   3. Campos novos validados na calculadora (`estacionamento`, `chapa`,
//      `pernoite`) fazem parte do contrato desde a primeira versão.
//   4. Veredito mantém a lógica simples da calculadora — sem a faixa
//      `LIMIAR_VERDE`/`pctAcimaPiso` que o PRD calc-app propunha.

import type { FreteInput, FreteResultado, CustoDetalhado } from './types';
import { calcularPisoANTT } from './pisoANTT';

/** Versão da fórmula, carimbada em toda análise persistida para reprodutibilidade do histórico. */
export const FORMULA_VERSAO = 'emerson-v1';

export function calcularFrete(entrada: FreteInput): FreteResultado {
  const { distanciaKm, valorFrete, voltaVazia, margemDesejada, custos, numeroEixos } = entrada;

  // Com volta vazia, os custos variáveis por km e o pedágio dobram (o
  // caminhão roda a distância total, ida + volta, sem gerar receita extra).
  const fatorKm = voltaVazia ? 2 : 1;
  const distanciaTotal = distanciaKm * fatorKm;

  const diesel = (custos.dieselPrecoPorLitro / custos.dieselKmPorLt) * distanciaTotal;
  const arla = (custos.arlaPrecoPorLitro / custos.arlaKmPorLt) * distanciaTotal;
  const pedagio = custos.pedagio * fatorKm;

  // Alimentação e pernoite já vêm totalizados (dias × valor diário é
  // responsabilidade de quem monta o FreteInput) — não dobram com a volta
  // vazia, dependem dos dias de viagem, não da distância.
  const alimentacao = custos.alimentacao;
  const pernoite = custos.pernoite;

  // Estacionamento e chapa são custos fixos da ida — não dobram na volta vazia.
  const estacionamento = custos.estacionamento;
  const chapa = custos.chapa;

  const manutencao = custos.manutencaoPorKm * distanciaTotal;
  const pneus = custos.pneusPorKm * distanciaTotal;
  const depreciacao = custos.depreciacaoPorKm * distanciaTotal;

  const custoDetalhado: CustoDetalhado = {
    diesel,
    arla,
    pedagio,
    alimentacao,
    pernoite,
    estacionamento,
    chapa,
    manutencao,
    pneus,
    depreciacao,
  };

  const custoTotal = Object.values(custoDetalhado).reduce((acc, v) => acc + v, 0);
  const lucro = valorFrete - custoTotal;
  const margemReal = valorFrete > 0 ? (lucro / valorFrete) * 100 : 0;
  const pisoANTT = calcularPisoANTT(distanciaKm, numeroEixos);
  const abaixoPisoANTT = valorFrete < pisoANTT;

  let veredicto: FreteResultado['veredicto'];
  if (lucro <= 0 || abaixoPisoANTT) {
    veredicto = 'RUIM';
  } else if (margemReal >= margemDesejada) {
    veredicto = 'BOM';
  } else {
    veredicto = 'ACEITÁVEL';
  }

  return {
    entrada,
    custoTotal,
    custoDetalhado,
    lucro,
    margemReal,
    pisoANTT,
    abaixoPisoANTT,
    veredicto,
    formulaVersao: FORMULA_VERSAO,
  };
}
