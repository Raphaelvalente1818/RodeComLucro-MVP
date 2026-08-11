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

/** Sugestões de cidade pra autocomplete — busca por prefixo do nome normalizado (minúsculo, sem acento). */
export async function buscarMunicipios(consulta: string, limite = 8): Promise<Municipio[]> {
  const termo = normalizar(consulta);
  if (termo.length < 2) return [];
  const { data, error } = await supabase
    .from('municipios_brasil')
    .select('nome, uf, latitude, longitude')
    .ilike('nome_norm', `${termo}%`)
    .order('nome')
    .limit(limite);
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
