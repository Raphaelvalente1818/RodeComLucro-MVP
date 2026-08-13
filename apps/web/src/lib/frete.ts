// apps/web/src/lib/frete.ts
//
// Helpers compartilhados pelas telas Analisar/Resultado/Perfil: acesso ao
// perfil do caminhão, conversão perfil->Custos, auto-preenchimento de dias
// por faixa de km, e salvarAnalise() com id gerado no cliente + upsert.
//
// salvarAnalise() é escrita como uma função isolada de propósito: hoje ela
// grava direto no Supabase, mas a fila offline (IndexedDB) que entra numa
// fase posterior só troca o miolo desta função — as telas não mudam.

import type { Custos, FreteResultado } from '@rode/calc';
import { supabase } from './supabaseClient';

export interface CaminhaoPerfil {
  id: string;
  user_id: string;
  apelido: string | null;
  marca: string | null;
  modelo: string | null;
  numero_eixos: number;
  diesel_km_por_lt: number;
  diesel_preco_por_litro: number;
  arla_km_por_lt: number;
  arla_preco_por_litro: number;
  manutencao_por_km: number;
  pneus_por_km: number;
  depreciacao_por_km: number;
  alimentacao_dia: number;
  pernoite_dia: number;
  estacionamento_padrao: number;
  chapa_padrao: number;
  margem_desejada: number;
  uf_base: string | null;
  ano: number | null;
  valor_caminhao: number | null;
  fipe_codigo_marca: string | null;
  fipe_codigo_modelo: string | null;
  fipe_codigo_ano: string | null;
  /** Km rodados por ano — usado para converter depreciação anual (FIPE) em R$/km. */
  km_rodados_ano: number | null;
  tipo_veiculo: string | null;
  tipo_carroceria: string | null;
  /** Capacidade máxima de carga, em toneladas — usada para estimar o valor total de fretes cobrados "por tonelada" (ver lib/fretesPublicados.ts). Preenchimento opcional. */
  carga_maxima_toneladas: number | null;
  /** Data prevista da próxima troca de óleo (ISO, "AAAA-MM-DD") — alerta na Garagem uma semana antes de vencer. Preenchimento opcional. */
  proxima_troca_oleo: string | null;
}

export const PERFIL_DEFAULT: Omit<CaminhaoPerfil, 'id' | 'user_id'> = {
  apelido: null,
  marca: null,
  modelo: null,
  numero_eixos: 5,
  diesel_km_por_lt: 2.5,
  diesel_preco_por_litro: 6.1,
  arla_km_por_lt: 20,
  arla_preco_por_litro: 4.5,
  manutencao_por_km: 0.35,
  pneus_por_km: 0.12,
  depreciacao_por_km: 0.25,
  alimentacao_dia: 90,
  pernoite_dia: 0,
  estacionamento_padrao: 0,
  chapa_padrao: 0,
  margem_desejada: 20,
  uf_base: null,
  ano: null,
  valor_caminhao: null,
  fipe_codigo_marca: null,
  fipe_codigo_modelo: null,
  fipe_codigo_ano: null,
  km_rodados_ano: 100000,
  tipo_veiculo: null,
  tipo_carroceria: null,
  carga_maxima_toneladas: null,
  proxima_troca_oleo: null,
};

export async function carregarPerfil(userId: string): Promise<CaminhaoPerfil | null> {
  const { data, error } = await supabase
    .from('caminhao_perfil')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.error('carregarPerfil', error);
    return null;
  }
  return data as CaminhaoPerfil | null;
}

export async function salvarPerfil(
  userId: string,
  perfil: Omit<CaminhaoPerfil, 'id' | 'user_id'>,
  id?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('caminhao_perfil')
    .upsert(
      { id: id ?? crypto.randomUUID(), user_id: userId, ...perfil },
      { onConflict: 'user_id' },
    );
  return { error: error?.message ?? null };
}

/** Dias estimados por faixa de km (auto-preenchimento, editável pelo motorista). */
export function diasPorFaixaKm(distanciaKm: number): number {
  if (distanciaKm <= 600) return 1;
  if (distanciaKm <= 1200) return 2;
  if (distanciaKm <= 2000) return 3;
  if (distanciaKm <= 3000) return 4;
  return 5;
}

/** Converte o perfil do caminhão + dias de viagem no objeto Custos que o @rode/calc espera. */
export function perfilParaCustos(
  perfil: CaminhaoPerfil,
  dias: number,
  pedagio: number,
): Custos {
  return {
    dieselKmPorLt: perfil.diesel_km_por_lt,
    dieselPrecoPorLitro: perfil.diesel_preco_por_litro,
    arlaKmPorLt: perfil.arla_km_por_lt,
    arlaPrecoPorLitro: perfil.arla_preco_por_litro,
    pedagio,
    alimentacao: perfil.alimentacao_dia * dias,
    pernoite: perfil.pernoite_dia * dias,
    estacionamento: perfil.estacionamento_padrao,
    chapa: perfil.chapa_padrao,
    manutencaoPorKm: perfil.manutencao_por_km,
    pneusPorKm: perfil.pneus_por_km,
    depreciacaoPorKm: perfil.depreciacao_por_km,
  };
}

export interface AnaliseParaSalvar {
  origem: string;
  destino: string;
  distanciaKm: number;
  distanciaEstimada: boolean;
  voltaVazia: boolean;
  valorFreteCentavos: number;
  margemDesejada: number;
  numeroEixos?: number;
  custos: Custos;
  resultado: FreteResultado;
  caminhaoPerfilId?: string | null;
  /** Coletados no popup ao clicar "Salvar análise" — pra achar o contato depois. */
  empresaNome?: string | null;
  contatoNome?: string | null;
  contatoTelefone?: string | null;
  /** true quando o valor veio do modo "A negociar" (mínimo calculado pelo motorista), não de uma oferta real da empresa. */
  valorACombinar?: boolean;
}

/**
 * Grava a análise no Supabase com id gerado no cliente + upsert. Ponto
 * único de persistência — quando a fila offline (IndexedDB) entrar, só o
 * corpo desta função muda (grava local primeiro, sincroniza depois).
 */
export async function salvarAnalise(
  userId: string,
  analise: AnaliseParaSalvar,
): Promise<{ id: string; error: string | null }> {
  const id = crypto.randomUUID();
  const { error } = await supabase.from('analise_frete').upsert(
    {
      id,
      user_id: userId,
      caminhao_perfil_id: analise.caminhaoPerfilId ?? null,
      origem: analise.origem,
      destino: analise.destino,
      distancia_km: analise.distanciaKm,
      distancia_estimada: analise.distanciaEstimada,
      volta_vazia: analise.voltaVazia,
      valor_frete_centavos: analise.valorFreteCentavos,
      margem_desejada: analise.margemDesejada,
      numero_eixos: analise.numeroEixos ?? null,
      custos_snapshot: analise.custos,
      resultado_snapshot: analise.resultado,
      veredicto: analise.resultado.veredicto,
      formula_versao: analise.resultado.formulaVersao,
      empresa_nome: analise.empresaNome?.trim() || null,
      contato_nome: analise.contatoNome?.trim() || null,
      contato_telefone: analise.contatoTelefone?.trim() || null,
      valor_a_combinar: analise.valorACombinar ?? false,
    },
    { onConflict: 'id' },
  );
  return { id, error: error?.message ?? null };
}

/** Conselho contextual curto, mostrado junto do veredito na tela Resultado. */
export function explicarVeredicto(r: FreteResultado): string {
  if (r.abaixoPisoANTT) {
    const pct = r.pisoANTT > 0 ? ((r.pisoANTT - r.entrada.valorFrete) / r.pisoANTT) * 100 : 0;
    return `Esse frete está ${pct.toFixed(0)}% abaixo do piso mínimo da ANTT (R$ ${r.pisoANTT.toFixed(2)}). Negocie ou recuse.`;
  }
  if (r.veredicto === 'RUIM') {
    return 'O custo estimado é maior que o valor do frete — você sairia no prejuízo.';
  }
  if (r.veredicto === 'ACEITÁVEL') {
    const faltaPct = (r.entrada.margemDesejada - r.margemReal).toFixed(1);
    return `Dá lucro, mas fica ${faltaPct}pp abaixo da margem que você queria. Se der, negocie um pouco mais.`;
  }
  return 'Frete dentro (ou acima) da margem que você queria. Bom negócio.';
}

export interface AnaliseResumo {
  id: string;
  origem: string;
  destino: string;
  valorFreteCentavos: number;
  veredicto: 'BOM' | 'ACEITÁVEL' | 'RUIM';
  createdAt: string;
  /** Frete de fato executado (não só calculado/salvo) — só isso conta pro "lucro do mês". */
  realizado: boolean;
  /** true quando o valor veio do modo "A negociar" — não é uma oferta real da empresa. */
  valorACombinar: boolean;
}

/** Últimas N análises do motorista, mais recentes primeiro — usado no bloco "Últimas análises" da Garagem. */
export async function carregarUltimasAnalises(userId: string, limite = 3): Promise<AnaliseResumo[]> {
  const { data, error } = await supabase
    .from('analise_frete')
    .select('id, origem, destino, valor_frete_centavos, veredicto, created_at, realizado, valor_a_combinar')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('carregarUltimasAnalises', error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    origem: r.origem as string,
    destino: r.destino as string,
    valorFreteCentavos: r.valor_frete_centavos as number,
    veredicto: r.veredicto as AnaliseResumo['veredicto'],
    createdAt: r.created_at as string,
    realizado: Boolean(r.realizado),
    valorACombinar: Boolean(r.valor_a_combinar),
  }));
}

/**
 * Alterna `realizado` de uma análise — botão "Realizado" na lista da
 * Garagem. Só fretes com `realizado = true` entram na soma de
 * `carregarLucroMesAtual`.
 */
export async function alternarRealizado(
  id: string,
  realizadoAtual: boolean,
): Promise<{ realizado: boolean; error: string | null }> {
  const novo = !realizadoAtual;
  const { error } = await supabase
    .from('analise_frete')
    .update({ realizado: novo, realizado_em: novo ? new Date().toISOString() : null })
    .eq('id', id);
  return { realizado: novo, error: error?.message ?? null };
}

/** Soma do lucro (em reais) das análises REALIZADAS do mês corrente — usado na barra de meta de lucro da Garagem. */
export async function carregarLucroMesAtual(userId: string): Promise<number> {
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('analise_frete')
    .select('resultado_snapshot')
    .eq('user_id', userId)
    .eq('realizado', true)
    .gte('created_at', inicioMes.toISOString());
  if (error) {
    // eslint-disable-next-line no-console
    console.error('carregarLucroMesAtual', error);
    return 0;
  }
  return (data ?? []).reduce((acc, r) => {
    const snap = r.resultado_snapshot as { lucro?: number } | null;
    return acc + (snap?.lucro ?? 0);
  }, 0);
}

/** Quanto tempo faz desde `iso`, em português curto ("hoje", "há 2 dias", "há 3 semanas"). */
export function tempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'há 1 dia';
  if (dias < 7) return `há ${dias} dias`;
  const semanas = Math.floor(dias / 7);
  if (semanas === 1) return 'há 1 semana';
  if (semanas < 5) return `há ${semanas} semanas`;
  const meses = Math.floor(dias / 30);
  return meses <= 1 ? 'há 1 mês' : `há ${meses} meses`;
}

export interface AnaliseCompleta {
  resultado: FreteResultado;
  custos: Custos;
  distanciaEstimada: boolean;
  caminhaoPerfilId: string | null;
  createdAt: string;
  empresaNome: string | null;
  contatoNome: string | null;
  contatoTelefone: string | null;
  /** true quando o valor veio do modo "A negociar" — não é uma oferta real da empresa. */
  valorACombinar: boolean;
}

/** Carrega uma análise salva pelo id — usado pela tela Resultado quando aberta a partir da Garagem (histórico). */
export async function carregarAnalisePorId(id: string): Promise<AnaliseCompleta | null> {
  const { data, error } = await supabase
    .from('analise_frete')
    .select(
      'resultado_snapshot, custos_snapshot, distancia_estimada, caminhao_perfil_id, created_at, empresa_nome, contato_nome, contato_telefone, valor_a_combinar',
    )
    .eq('id', id)
    .maybeSingle();
  if (error || !data) {
    // eslint-disable-next-line no-console
    if (error) console.error('carregarAnalisePorId', error);
    return null;
  }
  return {
    resultado: data.resultado_snapshot as FreteResultado,
    custos: data.custos_snapshot as Custos,
    distanciaEstimada: Boolean(data.distancia_estimada),
    caminhaoPerfilId: (data.caminhao_perfil_id as string | null) ?? null,
    createdAt: data.created_at as string,
    empresaNome: (data.empresa_nome as string | null) ?? null,
    contatoNome: (data.contato_nome as string | null) ?? null,
    contatoTelefone: (data.contato_telefone as string | null) ?? null,
    valorACombinar: Boolean(data.valor_a_combinar),
  };
}
