// apps/web/src/lib/municipios.ts
//
// Autocomplete de cidade brasileira + distância em linha reta — usado
// pela tela Buscar Frete pra resolver "onde o motorista está agora" em
// lat/lng e comparar contra origem_lat/origem_lng dos fretes publicados.
//
// Dado geográfico vem de public.municipios_brasil (~5.571 municípios,
// carregado de um CSV público do IBGE — ver Docs/status-sessao.md, 11/08).
// Decisão de produto: distância em linha reta (haversine), não rota real
// de rodovia — evita chamar API paga (Google Routes, já usada em
// lib/frete.ts pra pedágio/km) numa lista inteira de fretes de uma vez só.

import { supabase } from './supabaseClient';
import { UFS_BRASIL } from './fretesPublicados';

export interface Municipio {
  nome: string;
  uf: string;
  latitude: number;
  longitude: number;
}

function normalizar(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Separa "Cidade/UF" ou "Cidade UF" digitado num campo só. `nome_norm` no
 * banco só guarda o nome do município (sem UF) — sem isso, digitar
 * "São Paulo/SP" ou "São Paulo SP" (como o placeholder sugere) nunca
 * batia com nada e a busca ficava sempre vazia, sem dar pra escolher a
 * cidade. Bug real, achado pelo Raphael testando (11/08).
 */
function extrairCidadeEUf(consulta: string): { cidade: string; uf: string | null } {
  const bruto = consulta.trim();
  const barraIdx = bruto.lastIndexOf('/');
  if (barraIdx > 0) {
    const ufCandidato = bruto.slice(barraIdx + 1).trim().toUpperCase();
    if (UFS_BRASIL.includes(ufCandidato)) {
      return { cidade: bruto.slice(0, barraIdx).trim(), uf: ufCandidato };
    }
  }
  const partes = bruto.split(/\s+/);
  if (partes.length > 1) {
    const ultimo = partes[partes.length - 1].toUpperCase();
    if (UFS_BRASIL.includes(ultimo)) {
      return { cidade: partes.slice(0, -1).join(' '), uf: ultimo };
    }
  }
  return { cidade: bruto, uf: null };
}

/** Sugestões de cidade pra autocomplete — busca por prefixo do nome normalizado (minúsculo, sem acento), com UF opcional pra desambiguar cidades com o mesmo nome em estados diferentes. */
export async function buscarMunicipios(consultaBruta: string, limite = 8): Promise<Municipio[]> {
  const { cidade, uf } = extrairCidadeEUf(consultaBruta);
  const termo = normalizar(cidade);
  if (termo.length < 2) return [];
  let query = supabase
    .from('municipios_brasil')
    .select('nome, uf, latitude, longitude')
    .ilike('nome_norm', `${termo}%`)
    .order('nome')
    .limit(limite);
  if (uf) query = query.eq('uf', uf);
  const { data, error } = await query;
  if (error) {
    // eslint-disable-next-line no-console
    console.error('buscarMunicipios', error);
    return [];
  }
  return (data ?? []).map((r) => ({
    nome: r.nome as string,
    uf: r.uf as string,
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
  }));
}

/** Distância em linha reta entre dois pontos (haversine), em km. */
export function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const RAIOS_KM = [100, 200, 300, 500, 1000];
