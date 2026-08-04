// Piso mínimo de frete da ANTT — Tabela A (Carga Geral, transporte
// rodoviário de carga lotação).
//
// ATUALIZADO em 2026-08-04: os coeficientes abaixo vêm da Resolução ANTT
// Nº 6.084, de 16/07/2026 (DOU de 17/07/2026, Seção 1, Pág. 168), que
// altera o Anexo II da Resolução ANTT 5.867/2020. Texto extraído direto
// do Diário Oficial (in.gov.br), linha "5 Carga Geral" da Tabela A.
// Substitui os valores da Portaria SUROC Nº 4/2026 (março/2026), que
// estavam vigentes até esta atualização e ficaram desatualizados sem
// ninguém perceber por ~2,5 semanas — não há nenhum processo automático
// de verificação de reajuste (gatilho do diesel/IPCA), então checagens
// futuras precisam ser manuais. Ver TODO abaixo sobre versionar isso no
// banco em vez de constante no cliente.
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

export const ANTT_VERSAO = 'resolucao-6084-2026';
export const ANTT_FONTE = 'Resolução ANTT Nº 6.084/2026 (altera Anexo II da Resolução ANTT 5.867/2020), DOU 17/07/2026';

export const ANTT_CARGA_GERAL: Record<number, { ccd: number; cc: number }> = {
  2: { ccd: 3.9826, cc: 451.84 },
  3: { ccd: 5.0977, cc: 541.86 },
  4: { ccd: 5.7822, cc: 588.86 },
  5: { ccd: 6.6718, cc: 657.56 },
  6: { ccd: 7.3547, cc: 671.93 },
  7: { ccd: 8.0927, cc: 831.66 },
  9: { ccd: 9.2027, cc: 903.32 },
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
