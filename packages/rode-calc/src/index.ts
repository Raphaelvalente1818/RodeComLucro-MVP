export type { FreteInput, FreteResultado, CustoDetalhado, Custos, Veredicto } from './types';
export { calcularFrete, FORMULA_VERSAO } from './calcularFrete';
export {
  calcularPisoANTT,
  ANTT_TABELA_A,
  ANTT_CARGA_GERAL,
  ANTT_GRANEL_SOLIDO,
  ANTT_GRANEL_LIQUIDO,
  ANTT_FRIGORIFICADA,
  ANTT_CONTEINERIZADA,
  ANTT_VERSAO,
  ANTT_FONTE,
  TIPO_CARGA_LABEL,
} from './pisoANTT';
export type { TipoCarga } from './pisoANTT';
export { TIPO_CARGA_POR_CARROCERIA, tipoCargaPorCarroceria } from './tipoCargaPorCarroceria';
export { fmtBRL, fmtPct, centsToReais, reaisToCents, parseNumeroPtBR } from './format';
export { caminhoes, marcas } from './caminhoes';
export type { ModeloCaminhao } from './caminhoes';
export { VEICULOS, CARROCERIAS, eixosPorCarroceria } from './tiposCaminhao';
export type { TipoVeiculo, TipoCarroceria } from './tiposCaminhao';
export { normalizarVeiculoExterno } from './compatibilidadeExterna';
export type { ResultadoNormalizacao } from './compatibilidadeExterna';
