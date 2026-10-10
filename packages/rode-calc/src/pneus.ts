// packages/rode-calc/src/pneus.ts
//
// Custo de pneus por km em função do número de eixos do CONJUNTO
// (decisão do Raphael, 09/10/2026 — item "pneus por eixo" da auditoria de
// 08/10). Antes o padrão era um R$ 0,12/km fixo, igual pra Truck de 3 eixos
// ou bitrem de 7. Modelo híbrido: este é só o PADRÃO — se o motorista
// editou `pneus_por_km` no perfil, o valor dele vence.
//
// Contagem: eixo de direção tem 2 pneus; cada eixo restante tem 4 (rodado
// duplo). Truck 3 eixos = 10 pneus; Carreta LS 6 = 22; Bitrem 7 = 26.
// Custo por pneu ao longo da vida: pneu novo + recapagens, dividido pelos
// km que o conjunto (novo + recapagens) roda. Constantes abaixo são a
// calibração inicial — ajustar quando o Raphael validar a auditoria.
//
// `supabase/functions/wa-webhook/calc.ts` tem uma CÓPIA destas funções
// (Deno não resolve o workspace) — mudou aqui, muda lá.

export const PNEU = {
  /** Pneu novo de carga (295/80 R22.5), R$. */
  precoNovo: 2000,
  /** Quantas recapagens a carcaça aguenta. */
  recapagens: 2,
  /** Preço de cada recapagem, R$. */
  precoRecapagem: 600,
  /** Km rodados pela carcaça inteira (novo + recapagens). */
  vidaKmTotal: 240_000,
} as const;

/** Pneus no conjunto: 2 na direção + 4 em cada um dos demais eixos. */
export function numeroPneus(numeroEixos: number): number {
  const eixos = Math.max(1, Math.round(numeroEixos));
  return 2 + (eixos - 1) * 4;
}

/** R$/km de pneus pro conjunto, arredondado a 3 casas (coluna numeric(6,3)). */
export function pneusPorKmPadrao(numeroEixos: number): number {
  const custoPorPneu = PNEU.precoNovo + PNEU.recapagens * PNEU.precoRecapagem;
  const porKm = (numeroPneus(numeroEixos) * custoPorPneu) / PNEU.vidaKmTotal;
  return Math.round(porKm * 1000) / 1000;
}
