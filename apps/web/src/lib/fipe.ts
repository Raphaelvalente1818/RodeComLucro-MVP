// apps/web/src/lib/fipe.ts
//
// Cliente da Edge Function fipe-caminhao (proxy para a Tabela FIPE via
// parallelum.com.br/fipe/api) — marca -> modelo -> ano restringe as
// opções ao que a FIPE realmente cataloga, e o valor de mercado do ano
// escolhido vs. o ano anterior do mesmo modelo dá a base para calcular
// depreciação real em R$/km (ver Perfil.tsx).
//
// Formatos de resposta confirmados direto na API antes de codar (não por
// suposição — ver Docs/status-sessao.md, 05/08):
//   - marcas / anos: array de { codigo, nome }.
//   - modelos: { modelos: [{ codigo, nome }], anos: [...] } — o "anos"
//     embutido aqui é uma lista genérica (1983-2027, mesma pra qualquer
//     modelo), NÃO a lista real por modelo; a lista de verdade vem do
//     endpoint /anos dedicado, chamado à parte com o código do modelo.
//   - valor: chaves em PascalCase (Valor, Marca, Modelo, AnoModelo,
//     Combustivel, CodigoFipe, MesReferencia) — inconsistência da
//     própria API pública, não é erro nosso.
//
// Tudo aqui é best-effort: se a FIPE estiver fora do ar ou a Edge
// Function falhar, as funções retornam [] / null e o Perfil.tsx cai pro
// fluxo manual (marca/modelo digitados livremente, valor/depreciação
// editados na mão) — nunca trava o cadastro.

import { supabase } from './supabaseClient';
import { parseNumeroPtBR, caminhoes, marcas as marcasCatalogoEstatico } from '@rode/calc';
import type { ModeloCaminhao } from '@rode/calc';

export interface FipeItem {
  codigo: string;
  nome: string;
}

export interface FipeValor {
  valor: number;
  marca: string;
  modelo: string;
  anoModelo: number;
  combustivel: string;
  codigoFipe: string;
  mesReferencia: string;
}

type Acao = 'marcas' | 'modelos' | 'anos' | 'valor';

async function chamarFipe(
  acao: Acao,
  params: { codigoMarca?: string; codigoModelo?: string; codigoAno?: string } = {},
): Promise<unknown | null> {
  try {
    const { data, error } = await supabase.functions.invoke('fipe-caminhao', {
      body: { acao, ...params },
    });
    if (error || !data?.dados) return null;
    return data.dados;
  } catch {
    return null;
  }
}

export async function buscarMarcasFipe(): Promise<FipeItem[]> {
  const dados = await chamarFipe('marcas');
  return Array.isArray(dados) ? (dados as FipeItem[]) : [];
}

export async function buscarModelosFipe(codigoMarca: string): Promise<FipeItem[]> {
  const dados = await chamarFipe('modelos', { codigoMarca });
  if (!dados || typeof dados !== 'object') return [];
  const modelos = (dados as { modelos?: Array<{ codigo: string | number; nome: string }> }).modelos;
  if (!Array.isArray(modelos)) return [];
  return modelos.map((m) => ({ codigo: String(m.codigo), nome: m.nome }));
}

/** Lista de anos realmente disponível PARA AQUELE MODELO — é isso que restringe as opções ao que existiu de verdade. */
export async function buscarAnosFipe(codigoMarca: string, codigoModelo: string): Promise<FipeItem[]> {
  const dados = await chamarFipe('anos', { codigoMarca, codigoModelo });
  return Array.isArray(dados) ? (dados as FipeItem[]) : [];
}

function parseValorFipe(valorTexto: string): number {
  const limpo = valorTexto.replace(/[^\d,.-]/g, '');
  return parseNumeroPtBR(limpo);
}

export async function buscarValorFipe(codigoMarca: string, codigoModelo: string, codigoAno: string): Promise<FipeValor | null> {
  const dados = await chamarFipe('valor', { codigoMarca, codigoModelo, codigoAno });
  if (!dados || typeof dados !== 'object') return null;
  const d = dados as Record<string, unknown>;
  if (typeof d.Valor !== 'string') return null;
  return {
    valor: parseValorFipe(d.Valor),
    marca: String(d.Marca ?? ''),
    modelo: String(d.Modelo ?? ''),
    anoModelo: Number(d.AnoModelo ?? 0),
    combustivel: String(d.Combustivel ?? ''),
    codigoFipe: String(d.CodigoFipe ?? ''),
    mesReferencia: String(d.MesReferencia ?? ''),
  };
}

/** Extrai o ano (inteiro) do "nome" de um item de anos da FIPE (ex.: "2020" -> 2020). */
export function anoDoItem(item: FipeItem): number | null {
  const m = item.nome.match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}

/**
 * Tenta casar a marca/modelo escolhidos via FIPE com o catálogo estático
 * da calculadora do Emerson (que tem consumo de diesel/ARLA de
 * referência, mas só ~90 modelos curados — bem menos que os milhares da
 * FIPE). Casamento best-effort: marca por nome (case-insensitive),
 * modelo por substring depois de normalizar hífen/espaço (a FIPE usa
 * nomes mais verbosos, ex. "FH-500 4x2 2p (diesel) (E5)" contém o código
 * mais simples do catálogo, "FH 500"). Retorna null sem achar — quem
 * chama trata isso como "sem sugestão automática", nunca como erro.
 */
export function encontrarModeloEstatico(marcaFipe: string | null, modeloFipe: string | null): ModeloCaminhao | null {
  if (!marcaFipe || !modeloFipe) return null;
  const marcaKey = marcasCatalogoEstatico.find((m) => m.toLowerCase() === marcaFipe.trim().toLowerCase());
  if (!marcaKey) return null;
  const normalizar = (s: string) => s.toUpperCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  const modeloFipeNorm = normalizar(modeloFipe);
  const lista = caminhoes[marcaKey] ?? [];
  return lista.find((m) => modeloFipeNorm.includes(normalizar(m.modelo))) ?? null;
}
