// Piso mínimo de frete da ANTT — Tabela A (Operação completa / Carga Geral).
//
// Origem: extraído sem alteração de
// github.com/emerson1001a/calculadora-experimental (src/engine/pisoANTT.ts).
//
// Verificado na fonte oficial (ANTTlegis) em 2026-07-17: os coeficientes
// abaixo (Portaria SUROC Nº 4/2026, que reajusta o Anexo II da Resolução
// ANTT 6.076/2026 por gatilho do diesel — referência de diesel S10 a
// R$7,35/L) são os vigentes hoje. A "Resolução ANTT 6.034/2024" citada no
// PRD técnico do calc-app é uma norma anterior e está desatualizada — os
// PRDs devem ser corrigidos para referenciar a 6.076/2026 + Portaria
// SUROC 4/2026 ao invés da 6.034/2024.
//
// Fórmula: piso = (distanciaKm × CCD) + CC
//   CCD = Coeficiente de Deslocamento (R$/km)
//   CC  = Coeficiente de Carga e Descarga (R$, fixo)
//
// TODO (decisão registrada em analise-compatibilidade-calculadora-experimental.md):
// o PRD calc-app desenha uma tabela `antt_piso_tabela` versionada no banco
// (por vigência + múltiplos tipo_carga: granel_solido, frigorificada, etc.).
// Esta constante cobre só "carga geral" — ao migrar para o schema do banco,
// os demais tipos de carga ainda precisam ser levantados e adicionados.

export const ANTT_VERSAO = 'suroc-4-2026';
export const ANTT_FONTE = 'Portaria SUROC Nº 4/2026 (Resolução ANTT 6.076/2026, Anexo II)';

export const ANTT_CARGA_GERAL: Record<number, { ccd: number; cc: number }> = {
  2: { ccd: 4.0031, cc: 436.39 },
  3: { ccd: 5.1295, cc: 523.33 },
  4: { ccd: 5.8178, cc: 568.72 },
  5: { ccd: 6.7126, cc: 635.08 },
  6: { ccd: 7.4124, cc: 648.95 },
  7: { ccd: 8.1252, cc: 803.22 },
  9: { ccd: 9.2466, cc: 872.44 },
};

const EIXOS_ORDENADOS = Object.keys(ANTT_CARGA_GERAL)
  .map(Number)
  .sort((a, b) => a - b);

/**
 * Calcula o piso mínimo ANTT para carga geral.
 *
 * Res. ANTT 6.076/2026 Art. 5º §5º: se o número de eixos não constar na
 * tabela, usa o coeficiente do eixo imediatamente inferior. Fallback
 * padrão quando `numeroEixos` não é informado: 5 eixos (carreta).
 */
export function calcularPisoANTT(distanciaKm: number, numeroEixos?: number): number {
  const eixos = numeroEixos ?? 5;
  let eixosRef = EIXOS_ORDENADOS[0];
  for (const e of EIXOS_ORDENADOS) {
    if (e <= eixos) eixosRef = e;
  }
  const { ccd, cc } = ANTT_CARGA_GERAL[eixosRef];
  return distanciaKm * ccd + cc;
}
