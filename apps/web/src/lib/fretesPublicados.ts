// apps/web/src/lib/fretesPublicados.ts
//
// "Busca frete" dentro do app do motorista — lê da tabela
// fretes_publicados (ver supabase/migrations/20260811150000_..._schema.sql
// e Docs/status-sessao.md, 11/08). Hoje essa tabela só tem dado de teste
// importado da Fretebras (fonte = 'MANUAL', dado_teste = true) — quando o
// portal de empresas existir e passar a gravar fonte = 'RODE_DIRETO' na
// mesma tabela, esta tela não muda nada, só passa a misturar dado real
// junto do de teste.

import { supabase } from './supabaseClient';
import type { TipoVeiculo, TipoCarroceria } from '@rode/calc';

export interface FretePublicado {
  id: string;
  empresaNome: string;
  contatoNome: string | null;
  contatoTelefone: string | null;
  origemCidade: string;
  origemUf: string;
  /** Nulo pros poucos registros que não bateram com nenhum município da base geográfica (ver Docs/status-sessao.md, 11/08). */
  origemLat: number | null;
  origemLng: number | null;
  destinoCidade: string;
  destinoUf: string;
  valorFreteCentavos: number | null;
  valorACombinar: boolean;
  tiposVeiculoAceitos: TipoVeiculo[];
  tiposCarroceriaAceitos: TipoCarroceria[];
  status: string;
  createdAt: string;
}

export interface FiltrosFrete {
  destinoUf?: string | null;
  /** Filtra por fretes que aceitam esse tipo de veículo (usa o array tipos_veiculo_aceitos). */
  tipoVeiculo?: string | null;
}

/** Fretes com status "aberto", mais recentes primeiro, com filtros opcionais de UF de destino/tipo de veículo. O filtro de raio (distância até a cidade atual do motorista) é aplicado depois, no cliente — ver BuscarFrete.tsx. */
export async function listarFretesAbertos(filtros: FiltrosFrete = {}, limite = 300): Promise<FretePublicado[]> {
  let query = supabase
    .from('fretes_publicados')
    .select(
      'id, empresa_nome, contato_nome, contato_telefone, origem_cidade, origem_uf, origem_lat, origem_lng, destino_cidade, destino_uf, valor_frete_centavos, valor_a_combinar, tipos_veiculo_aceitos, tipos_carroceria_aceitos, status, created_at',
    )
    .eq('status', 'aberto')
    .order('created_at', { ascending: false })
    .limit(limite);

  if (filtros.destinoUf) query = query.eq('destino_uf', filtros.destinoUf);
  if (filtros.tipoVeiculo) query = query.contains('tipos_veiculo_aceitos', [filtros.tipoVeiculo]);

  const { data, error } = await query;
  if (error) {
    // eslint-disable-next-line no-console
    console.error('listarFretesAbertos', error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    empresaNome: r.empresa_nome as string,
    contatoNome: (r.contato_nome as string | null) ?? null,
    contatoTelefone: (r.contato_telefone as string | null) ?? null,
    origemCidade: r.origem_cidade as string,
    origemUf: r.origem_uf as string,
    origemLat: r.origem_lat != null ? Number(r.origem_lat) : null,
    origemLng: r.origem_lng != null ? Number(r.origem_lng) : null,
    destinoCidade: r.destino_cidade as string,
    destinoUf: r.destino_uf as string,
    valorFreteCentavos: (r.valor_frete_centavos as number | null) ?? null,
    valorACombinar: Boolean(r.valor_a_combinar),
    tiposVeiculoAceitos: (r.tipos_veiculo_aceitos as TipoVeiculo[] | null) ?? [],
    tiposCarroceriaAceitos: (r.tipos_carroceria_aceitos as TipoCarroceria[] | null) ?? [],
    status: r.status as string,
    createdAt: r.created_at as string,
  }));
}

export const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];
