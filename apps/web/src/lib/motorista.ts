// apps/web/src/lib/motorista.ts
//
// Helpers da tela "Meu perfil" (cadastro do motorista): nome, UF base e
// meta de lucro mensal. A linha em public.motoristas já existe desde o
// primeiro login (trigger on_auth_user_created, ver
// supabase/migrations/0003_identidade_trigger.sql) — por isso é sempre
// update, nunca insert/upsert por aqui.
//
// canal_wa_ativo e telefone_verificado são só leitura nesta tela: o
// vínculo real do WhatsApp passa pelo fluxo de código (wa_vinculo), não
// por um campo editável neste formulário.
//
// cidade_atual/uf_atual/cidade_atual_lat/cidade_atual_lng não são editados
// aqui — são preenchidos pela tela Buscar Frete (lib/municipios.ts), pra
// resolver o raio de busca. Ficam na mesma tabela por serem dado do
// motorista, mas o formulário desta tela (Meu Perfil) não mexe neles.

import { supabase } from './supabaseClient';
import { centsToReais, reaisToCents } from '@rode/calc';

export interface Motorista {
  id: string;
  nome: string | null;
  uf_base: string | null;
  meta_alvo_centavos: number | null;
  media_lucro_frete_centavos: number | null;
  canal_wa_ativo: boolean;
  telefone_verificado: boolean;
  cnh_numero: string | null;
  /** Formato ISO (YYYY-MM-DD), como o Postgres devolve uma coluna `date`. */
  cnh_vencimento: string | null;
  exame_toxicologico_vencimento: string | null;
  /** "Onde estou agora" — usado pelo filtro de raio da tela Buscar Frete, não é a UF base do cadastro. */
  cidade_atual: string | null;
  uf_atual: string | null;
  cidade_atual_lat: number | null;
  cidade_atual_lng: number | null;
}

export interface FormMotorista {
  nome: string;
  uf_base: string;
  /** Meta de lucro mensal, em reais (a UI trabalha em reais; o banco persiste em centavos). */
  metaAlvoReais: number | null;
  cnhNumero: string;
  /** Formato YYYY-MM-DD (o que <input type="date"> usa e o Postgres `date` aceita direto). */
  cnhVencimento: string;
  exameToxicologicoVencimento: string;
}

export function motoristaParaForm(m: Motorista): FormMotorista {
  return {
    nome: m.nome ?? '',
    uf_base: m.uf_base ?? '',
    metaAlvoReais: m.meta_alvo_centavos != null ? centsToReais(m.meta_alvo_centavos) : null,
    cnhNumero: m.cnh_numero ?? '',
    cnhVencimento: m.cnh_vencimento ?? '',
    exameToxicologicoVencimento: m.exame_toxicologico_vencimento ?? '',
  };
}

export async function carregarMotorista(userId: string): Promise<Motorista | null> {
  const { data, error } = await supabase
    .from('motoristas')
    .select(
      'id, nome, uf_base, meta_alvo_centavos, media_lucro_frete_centavos, canal_wa_ativo, telefone_verificado, cnh_numero, cnh_vencimento, exame_toxicologico_vencimento, cidade_atual, uf_atual, cidade_atual_lat, cidade_atual_lng',
    )
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    // eslint-disable-next-line no-console
    console.error('carregarMotorista', error);
    return null;
  }
  return data as Motorista | null;
}

/** Grava "onde o motorista está agora" — usado pelo filtro de raio da tela Buscar Frete. */
export async function salvarCidadeAtual(
  userId: string,
  cidade: string,
  uf: string,
  lat: number,
  lng: number,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('motoristas')
    .update({ cidade_atual: cidade, uf_atual: uf, cidade_atual_lat: lat, cidade_atual_lng: lng })
    .eq('id', userId);
  return { error: error?.message ?? null };
}

export async function salvarMotorista(
  userId: string,
  form: FormMotorista,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('motoristas')
    .update({
      nome: form.nome.trim() || null,
      uf_base: form.uf_base.trim().toUpperCase() || null,
      meta_alvo_centavos: form.metaAlvoReais != null ? reaisToCents(form.metaAlvoReais) : null,
      cnh_numero: form.cnhNumero.trim() || null,
      cnh_vencimento: form.cnhVencimento || null,
      exame_toxicologico_vencimento: form.exameToxicologicoVencimento || null,
    })
    .eq('id', userId);
  return { error: error?.message ?? null };
}
