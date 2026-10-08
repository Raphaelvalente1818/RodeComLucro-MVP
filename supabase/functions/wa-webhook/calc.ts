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
  2: { ccd: 4.1056, cc: 460.59 },
  3: { ccd: 5.2555, cc: 552.24 },
  4: { ccd: 5.9476, cc: 597.0 },
  5: { ccd: 6.8548, cc: 664.83 },
  6: { ccd: 7.5641, cc: 680.01 },
  7: { ccd: 8.2316, cc: 820.34 },
  9: { ccd: 9.4318, cc: 908.91 },
};

const ANTT_GRANEL_LIQUIDO: CoeficientesPorEixo = {
  2: { ccd: 4.1796, cc: 471.98 },
  3: { ccd: 5.3511, cc: 569.57 },
  4: { ccd: 6.1019, cc: 621.52 },
  5: { ccd: 7.0226, cc: 693.08 },
  6: { ccd: 7.7372, cc: 709.72 },
  7: { ccd: 8.37, cc: 840.5 },
  9: { ccd: 9.5909, cc: 934.76 },
};

const ANTT_FRIGORIFICADA: CoeficientesPorEixo = {
  2: { ccd: 4.8234, cc: 520.07 },
  3: { ccd: 6.1659, cc: 623.27 },
  4: { ccd: 7.0345, cc: 686.63 },
  5: { ccd: 8.0623, cc: 757.98 },
  6: { ccd: 8.8911, cc: 772.35 },
  7: { ccd: 9.8134, cc: 982.76 },
  9: { ccd: 11.1479, cc: 1067.06 },
};

const ANTT_CONTEINERIZADA: CoeficientesPorEixo = {
  3: { ccd: 5.2282, cc: 544.75 },
  4: { ccd: 5.8755, cc: 577.15 },
  5: { ccd: 6.791, cc: 647.29 },
  6: { ccd: 7.4986, cc: 662.01 },
  7: { ccd: 8.2292, cc: 819.69 },
  9: { ccd: 9.3486, cc: 886.05 },
};

const ANTT_CARGA_GERAL: CoeficientesPorEixo = {
  2: { ccd: 4.0738, cc: 451.84 },
  3: { ccd: 5.2177, cc: 541.86 },
  4: { ccd: 5.918, cc: 588.86 },
  5: { ccd: 6.8284, cc: 657.56 },
  6: { ccd: 7.5347, cc: 671.93 },
  7: { ccd: 8.2727, cc: 831.66 },
  9: { ccd: 9.4114, cc: 903.32 },
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

// 02/10/2026 — tabela vigente vinda do banco (espelho de pisoANTT.ts no
// pacote): as constantes acima viram fallback; index.ts chama
// definirTabelaANTT() com as linhas de antt_piso_vigente() antes de calcular.
export const ANTT_VERSAO = 'portaria-suroc-22-2026';
export const ANTT_FONTE = 'Portaria SUROC Nº 22/2026 (reajusta Anexo II da Resolução ANTT 5.867/2020), Tabela A, DOU 29/09/2026 Ed. Extra';

export interface TabelaANTT {
  versao: string;
  fonte: string;
  vigenciaInicio: string;
  tabela: Record<TipoCarga, CoeficientesPorEixo>;
}

export interface LinhaTabelaANTT {
  tipo_carga: TipoCarga;
  numero_eixos: number;
  ccd: number;
  cc: number;
  versao: string;
  fonte: string;
  vigencia_inicio: string;
}

const TABELA_EMBUTIDA: TabelaANTT = { versao: ANTT_VERSAO, fonte: ANTT_FONTE, vigenciaInicio: '2026-09-30', tabela: ANTT_TABELA_A };
let tabelaAtiva: TabelaANTT = TABELA_EMBUTIDA;

export function montarTabelaANTT(linhas: LinhaTabelaANTT[]): TabelaANTT | null {
  if (!linhas.length) return null;
  const tabela: Partial<Record<TipoCarga, CoeficientesPorEixo>> = {};
  for (const l of linhas) {
    const ccd = Number(l.ccd);
    const cc = Number(l.cc);
    if (!Number.isFinite(ccd) || !Number.isFinite(cc)) continue;
    (tabela[l.tipo_carga] ??= {})[l.numero_eixos] = { ccd, cc };
  }
  if (!tabela.carga_geral?.[5]) return null;
  for (const t of Object.keys(ANTT_TABELA_A) as TipoCarga[]) {
    if (!tabela[t] || Object.keys(tabela[t]!).length === 0) tabela[t] = ANTT_TABELA_A[t];
  }
  const ref = linhas[0];
  return { versao: ref.versao, fonte: ref.fonte, vigenciaInicio: String(ref.vigencia_inicio), tabela: tabela as Record<TipoCarga, CoeficientesPorEixo> };
}

export function definirTabelaANTT(t: TabelaANTT | null): void {
  tabelaAtiva = t ?? TABELA_EMBUTIDA;
}

export function tabelaANTTAtual(): TabelaANTT {
  return tabelaAtiva;
}

export function calcularPisoANTT(distanciaKm: number, numeroEixos?: number, tipoCarga: TipoCarga = 'carga_geral'): number {
  const eixos = numeroEixos ?? 5;
  const tabela = tabelaAtiva.tabela[tipoCarga] ?? ANTT_TABELA_A[tipoCarga];
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
  anttVersao: string;
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

  return { entrada, custoTotal, custoDetalhado, lucro, margemReal, pisoANTT, abaixoPisoANTT, veredicto, formulaVersao: FORMULA_VERSAO, anttVersao: tabelaAtiva.versao };
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
