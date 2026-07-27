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
}

export const PERFIL_DEFAULT: Omit<CaminhaoPerfil, 'id' | 'user_id'> = {
  apelido: null,
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
