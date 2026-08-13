// Piso mínimo de frete da ANTT — Tabela A (transporte rodoviário de carga
// lotação), agora cobrindo os 5 tipos de carga que o app usa (carga geral +
// os 4 que faltavam desde a extração original do motor: granel sólido,
// granel líquido, frigorificada/aquecida, conteinerizada).
//
// ATUALIZADO em 2026-08-13 (fechando o TODO desde a Fase 0): coeficientes
// extraídos direto do texto oficial em anttlegis.antt.gov.br (não de
// resumo de terceiros) — Resolução ANTT Nº 6.084, de 16/07/2026 (DOU
// 17/07/2026, Seção 1), que altera o Anexo II da Resolução ANTT 5.867/2020,
// "TABELA A - TRANSPORTE RODOVIÁRIO DE CARGA LOTAÇÃO", linhas 1-5 (só as 5
// categorias "normais" — não perigosa/neogranel/pressurizada, fora do
// escopo do app hoje). Os valores de "Carga Geral" já estavam certos desde
// 04/08 (conferidos batendo 1:1 com a fonte oficial); os outros 4 tipos são
// novos.
//
// Conteinerizada não tem coeficiente pra 2 eixos na tabela oficial — nota
// do Anexo II: "células sem valores... se referem a veículos combinados
// com número de eixos não utilizadas para o tipo de carga avaliado no
// mercado" (na prática, ninguém transporta contêiner num veículo de 2
// eixos). `calcularPisoANTT` já cai pro eixo disponível mais próximo nesse
// caso (mesma regra do Art. 5º §5º usada pra "8 eixos" hoje).
//
// Só a Tabela A (carga lotação, desempenho padrão) está coberta — as
// Tabelas B/C/D (só veículo automotor, alto desempenho) do Anexo II não
// entram: o app não modela essas variações (nem pergunta isso ao
// motorista), então ficam fora por enquanto, mesmo espírito do que já
// tinha sido decidido pra "perigosa"/"neogranel"/"pressurizada" (fora do
// escopo dos tipos de carroceria que o app já cadastra).
//
// Fórmula: piso = (distanciaKm × CCD) + CC
//   CCD = Coeficiente de Deslocamento (R$/km)
//   CC  = Coeficiente de Carga e Descarga (R$, fixo)
//
// Ainda sem processo automático de verificação de reajuste (gatilho do
// diesel/IPCA) — checagens futuras continuam manuais. A tabela
// `antt_piso_tabela` no Supabase (migration
// 20260813120000_antt_piso_tabela.sql) espelha estes mesmos valores, versão
// `resolucao-6084-2026`, pra consulta/consumo por outras partes do sistema
// (admin, portal) sem precisar publicar uma versão nova do pacote — mas o
// motor (`@rode/calc`) continua puro, sem chamar o banco: lê sempre desta
// constante em memória.

export type TipoCarga = 'carga_geral' | 'granel_solido' | 'granel_liquido' | 'frigorificada' | 'conteinerizada';

export const ANTT_VERSAO = 'resolucao-6084-2026';
export const ANTT_FONTE = 'Resolução ANTT Nº 6.084/2026 (altera Anexo II da Resolução ANTT 5.867/2020), Tabela A, DOU 17/07/2026';

type CoeficientesPorEixo = Record<number, { ccd: number; cc: number }>;

export const ANTT_GRANEL_SOLIDO: CoeficientesPorEixo = {
  2: { ccd: 4.0144, cc: 460.59 },
  3: { ccd: 5.1355, cc: 552.24 },
  4: { ccd: 5.8118, cc: 597.0 },
  5: { ccd: 6.6983, cc: 664.83 },
  6: { ccd: 7.3841, cc: 680.01 },
  7: { ccd: 8.0516, cc: 820.34 },
  9: { ccd: 9.2231, cc: 908.91 },
};

export const ANTT_GRANEL_LIQUIDO: CoeficientesPorEixo = {
  2: { ccd: 4.0884, cc: 471.98 },
  3: { ccd: 5.2311, cc: 569.57 },
  4: { ccd: 5.9661, cc: 621.52 },
  5: { ccd: 6.8661, cc: 693.08 },
  6: { ccd: 7.5572, cc: 709.72 },
  7: { ccd: 8.19, cc: 840.5 },
  9: { ccd: 9.3822, cc: 934.76 },
};

export const ANTT_FRIGORIFICADA: CoeficientesPorEixo = {
  2: { ccd: 4.7095, cc: 520.07 },
  3: { ccd: 6.0159, cc: 623.27 },
  4: { ccd: 6.8646, cc: 686.63 },
  5: { ccd: 7.8666, cc: 757.98 },
  6: { ccd: 8.6661, cc: 772.35 },
  7: { ccd: 9.5884, cc: 982.76 },
  9: { ccd: 10.887, cc: 1067.06 },
};

export const ANTT_CONTEINERIZADA: CoeficientesPorEixo = {
  // Sem entrada pra 2 eixos — ver nota no cabeçalho do arquivo.
  3: { ccd: 5.1082, cc: 544.75 },
  4: { ccd: 5.7396, cc: 577.15 },
  5: { ccd: 6.6345, cc: 647.29 },
  6: { ccd: 7.3186, cc: 662.01 },
  7: { ccd: 8.0492, cc: 819.69 },
  9: { ccd: 9.1399, cc: 886.05 },
};

export const ANTT_CARGA_GERAL: CoeficientesPorEixo = {
  2: { ccd: 3.9826, cc: 451.84 },
  3: { ccd: 5.0977, cc: 541.86 },
  4: { ccd: 5.7822, cc: 588.86 },
  5: { ccd: 6.6718, cc: 657.56 },
  6: { ccd: 7.3547, cc: 671.93 },
  7: { ccd: 8.0927, cc: 831.66 },
  9: { ccd: 9.2027, cc: 903.32 },
};

export const ANTT_TABELA_A: Record<TipoCarga, CoeficientesPorEixo> = {
  carga_geral: ANTT_CARGA_GERAL,
  granel_solido: ANTT_GRANEL_SOLIDO,
  granel_liquido: ANTT_GRANEL_LIQUIDO,
  frigorificada: ANTT_FRIGORIFICADA,
  conteinerizada: ANTT_CONTEINERIZADA,
};

/** Rótulo em português pra exibir na UI (ex.: KPI de piso ANTT na tela Resultado). */
export const TIPO_CARGA_LABEL: Record<TipoCarga, string> = {
  carga_geral: 'Carga Geral',
  granel_solido: 'Granel Sólido',
  granel_liquido: 'Granel Líquido',
  frigorificada: 'Frigorificada',
  conteinerizada: 'Conteinerizada',
};

function eixosOrdenados(tabela: CoeficientesPorEixo): number[] {
  return Object.keys(tabela)
    .map(Number)
    .sort((a, b) => a - b);
}

/**
 * Calcula o piso mínimo ANTT (Tabela A) para o tipo de carga informado.
 *
 * Res. ANTT 6.076/2026 Art. 5º §5º: se o número de eixos não constar na
 * tabela daquele tipo de carga, usa o coeficiente do eixo imediatamente
 * inferior (ou o menor disponível, se `numeroEixos` for menor que todos).
 * Defaults: 5 eixos (carreta) quando `numeroEixos` não é informado,
 * `'carga_geral'` quando `tipoCarga` não é informado — mantém compatível
 * com todo código existente que só passava distância/eixos.
 */
export function calcularPisoANTT(distanciaKm: number, numeroEixos?: number, tipoCarga: TipoCarga = 'carga_geral'): number {
  const eixos = numeroEixos ?? 5;
  const tabela = ANTT_TABELA_A[tipoCarga];
  const ordenados = eixosOrdenados(tabela);
  let eixosRef = ordenados[0];
  for (const e of ordenados) {
    if (e <= eixos) eixosRef = e;
  }
  const { ccd, cc } = tabela[eixosRef];
  return distanciaKm * ccd + cc;
}
