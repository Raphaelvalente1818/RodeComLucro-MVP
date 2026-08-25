// supabase/functions/wa-webhook/calc.ts
//
// Cópia isomórfica do motor @rode/calc (packages/rode-calc/src/) pro
// runtime Deno das Edge Functions — o pacote em si não é importável
// direto por não estar publicado num registry nem servido via esm.sh
// (é workspace-local, consumido hoje só pelo app web via bundler). Em
// vez de duplicar a fórmula "de cabeça", este arquivo é uma cópia fiel
// (mesmos nomes, mesmos valores) de:
//   - packages/rode-calc/src/types.ts
//   - packages/rode-calc/src/pisoANTT.ts
//   - packages/rode-calc/src/calcularFrete.ts
//   - packages/rode-calc/src/tipoCargaPorCarroceria.ts (mapeamento inline,
//     sem importar TipoCarroceria — a coluna caminhao_perfil.tipo_carroceria
//     já é validada por CHECK constraint no banco, não precisa reforçar
//     o tipo aqui)
//   - packages/rode-calc/src/format.ts (fmtBRL/fmtPct)
//
// Se a fórmula em packages/rode-calc mudar, este arquivo precisa ser
// atualizado manualmente e reimplantado (deploy_edge_function) — não há
// hoje um jeito de compartilhar isso sem duplicação entre o app web
// (bundler/Vite) e as Edge Functions (Deno, sem build step próprio).

export type TipoCarga = 'carga_geral' | 'granel_solido' | 'granel_liquido' | 'frigorificada' | 'conteinerizada';

type CoeficientesPorEixo = Record<number, { ccd: number; cc: number }>;

const ANTT_GRANEL_SOLIDO: CoeficientesPorEixo = {
  2: { ccd: 4.0144, cc: 460.59 },
  3: { ccd: 5.1355, cc: 552.24 },
  4: { ccd: 5.8118, cc: 597.0 },
  5: { ccd: 6.6983, cc: 664.83 },
  6: { ccd: 7.3841, cc: 680.01 },
  7: { ccd: 8.0516, cc: 820.34 },
  9: { ccd: 9.2231, cc: 908.91 },
};

const ANTT_GRANEL_LIQUIDO: CoeficientesPorEixo = {
  2: { ccd: 4.0884, cc: 471.98 },
  3: { ccd: 5.2311, cc: 569.57 },
  4: { ccd: 5.9661, cc: 621.52 },
  5: { ccd: 6.8661, cc: 693.08 },
  6: { ccd: 7.5572, cc: 709.72 },
  7: { ccd: 8.19, cc: 840.5 },
  9: { ccd: 9.3822, cc: 934.76 },
};

const ANTT_FRIGORIFICADA: CoeficientesPorEixo = {
  2: { ccd: 4.7095, cc: 520.07 },
  3: { ccd: 6.0159, cc: 623.27 },
  4: { ccd: 6.8646, cc: 686.63 },
  5: { ccd: 7.8666, cc: 757.98 },
  6: { ccd: 8.6661, cc: 772.35 },
  7: { ccd: 9.5884, cc: 982.76 },
  9: { ccd: 10.887, cc: 1067.06 },
};

const ANTT_CONTEINERIZADA: CoeficientesPorEixo = {
  3: { ccd: 5.1082, cc: 544.75 },
  4: { ccd: 5.7396, cc: 577.15 },
  5: { ccd: 6.6345, cc: 647.29 },
  6: { ccd: 7.3186, cc: 662.01 },
  7: { ccd: 8.0492, cc: 819.69 },
  9: { ccd: 9.1399, cc: 886.05 },
};

const ANTT_CARGA_GERAL: CoeficientesPorEixo = {
  2: { ccd: 3.9826, cc: 451.84 },
  3: { ccd: 5.0977, cc: 541.86 },
  4: { ccd: 5.7822, cc: 588.86 },
  5: { ccd: 6.6718, cc: 657.56 },
  6: { ccd: 7.3547, cc: 671.93 },
  7: { ccd: 8.0927, cc: 831.66 },
  9: { ccd: 9.2027, cc: 903.32 },
};

const ANTT_TABELA_A: Record<TipoCarga, CoeficientesPorEixo> = {
  carga_geral: ANTT_CARGA_GERAL,
  granel_solido: ANTT_GRANEL_SOLIDO,
  granel_liquido: ANTT_GRANEL_LIQUIDO,
  frigorificada: ANTT_FRIGORIFICADA,
  conteinerizada: ANTT_CONTEINERIZADA,
};

function eixosOrdenados(tabela: CoeficientesPorEixo): number[] {
  return Object.keys(tabela).map(Number).sort((a, b) => a - b);
}

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

// Mapeamento carroceria -> tipo de carga ANTT (mesmo conteúdo de
// tipoCargaPorCarroceria.ts, sem importar o union type TipoCarroceria —
// a coluna já é validada por CHECK constraint no Postgres).
const TIPO_CARGA_POR_CARROCERIA: Record<string, TipoCarga> = {
  Graneleiro: 'granel_solido',
  'Grade baixa': 'carga_geral',
  Prancha: 'carga_geral',
  Caçamba: 'granel_solido',
  Plataforma: 'carga_geral',
  Sider: 'carga_geral',
  Baú: 'carga_geral',
  'Baú Frigorífico': 'frigorificada',
  'Baú Refrigerado': 'frigorificada',
  Silo: 'granel_solido',
  Cegonheiro: 'carga_geral',
  Gaiola: 'carga_geral',
  Tanque: 'granel_liquido',
  'Bug Porta Container': 'conteinerizada',
  Munk: 'carga_geral',
  'Apenas Cavalo': 'carga_geral',
  Cavaqueira: 'granel_solido',
  Hoper: 'granel_solido',
};

export function tipoCargaPorCarroceria(carroceria: string | null | undefined): TipoCarga {
  if (!carroceria) return 'carga_geral';
  return TIPO_CARGA_POR_CARROCERIA[carroceria] ?? 'carga_geral';
}

export interface Custos {
  dieselKmPorLt: number;
  dieselPrecoPorLitro: number;
  arlaKmPorLt: number;
  arlaPrecoPorLitro: number;
  pedagio: number;
  alimentacao: number;
  pernoite: number;
  estacionamento: number;
  chapa: number;
  manutencaoPorKm: number;
  pneusPorKm: number;
  depreciacaoPorKm: number;
}

export interface FreteInput {
  origem: string;
  destino: string;
  distanciaKm: number;
  valorFrete: number;
  voltaVazia: boolean;
  margemDesejada: number;
  custos: Custos;
  distanciaEstimada?: boolean;
  numeroEixos?: number;
  tipoCarga?: TipoCarga;
}

export interface CustoDetalhado {
  diesel: number;
  arla: number;
  pedagio: number;
  alimentacao: number;
  pernoite: number;
  estacionamento: number;
  chapa: number;
  manutencao: number;
  pneus: number;
  depreciacao: number;
}

export type Veredicto = 'BOM' | 'ACEITÁVEL' | 'RUIM';

export interface FreteResultado {
  entrada: FreteInput;
  custoTotal: number;
  custoDetalhado: CustoDetalhado;
  lucro: number;
  margemReal: number;
  pisoANTT: number;
  abaixoPisoANTT: boolean;
  veredicto: Veredicto;
  formulaVersao: string;
}

export const FORMULA_VERSAO = 'emerson-v1';

export function calcularFrete(entrada: FreteInput): FreteResultado {
  const { distanciaKm, valorFrete, voltaVazia, margemDesejada, custos, numeroEixos, tipoCarga } = entrada;

  const fatorKm = voltaVazia ? 2 : 1;
  const distanciaTotal = distanciaKm * fatorKm;

  const diesel = (custos.dieselPrecoPorLitro / custos.dieselKmPorLt) * distanciaTotal;
  const arla = (custos.arlaPrecoPorLitro / custos.arlaKmPorLt) * distanciaTotal;
  const pedagio = custos.pedagio * fatorKm;
  const alimentacao = custos.alimentacao;
  const pernoite = custos.pernoite;
  const estacionamento = custos.estacionamento;
  const chapa = custos.chapa;
  const manutencao = custos.manutencaoPorKm * distanciaTotal;
  const pneus = custos.pneusPorKm * distanciaTotal;
  const depreciacao = custos.depreciacaoPorKm * distanciaTotal;

  const custoDetalhado: CustoDetalhado = {
    diesel, arla, pedagio, alimentacao, pernoite, estacionamento, chapa, manutencao, pneus, depreciacao,
  };

  const custoTotal = Object.values(custoDetalhado).reduce((acc, v) => acc + v, 0);
  const lucro = valorFrete - custoTotal;
  const margemReal = valorFrete > 0 ? (lucro / valorFrete) * 100 : 0;
  const pisoANTT = calcularPisoANTT(distanciaKm, numeroEixos, tipoCarga);
  const abaixoPisoANTT = valorFrete < pisoANTT;

  let veredicto: Veredicto;
  if (lucro <= 0 || abaixoPisoANTT) {
    veredicto = 'RUIM';
  } else if (margemReal >= margemDesejada) {
    veredicto = 'BOM';
  } else {
    veredicto = 'ACEITÁVEL';
  }

  return { entrada, custoTotal, custoDetalhado, lucro, margemReal, pisoANTT, abaixoPisoANTT, veredicto, formulaVersao: FORMULA_VERSAO };
}

export function fmtBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

export function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Dias estimados por faixa de km (mesma regra de apps/web/src/lib/frete.ts). */
export function diasPorFaixaKm(distanciaKm: number): number {
  if (distanciaKm <= 600) return 1;
  if (distanciaKm <= 1200) return 2;
  if (distanciaKm <= 2000) return 3;
  if (distanciaKm <= 3000) return 4;
  return 5;
}
