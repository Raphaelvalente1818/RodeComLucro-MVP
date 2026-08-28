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
//
// cidade_base/cidade_base_lat/cidade_base_lng (28/08) ampliam a antiga "UF
// base" (só sigla) pra uma cidade completa, com o mesmo autocomplete de
// lib/municipios.ts usado em Buscar Frete — dá pra saber a localização do
// motorista (com coordenadas) desde o cadastro, sem depender dele ter
// usado Buscar Frete pelo menos uma vez pra existir cidade_atual.

import { supabase } from './supabaseClient';
import { centsToReais, reaisToCents } from '@rode/calc';
import { gravarOuEnfileirar, registrarExecutor } from './filaOffline';

export interface Motorista {
  id: string;
  nome: string | null;
  uf_base: string | null;
  /** Cidade do endereço base (onde mora) — par de uf_base, com coordenadas pra poder ser usada como origem de busca. */
  cidade_base: string | null;
  cidade_base_lat: number | null;
  cidade_base_lng: number | null;
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
  /** Nome da cidade base (sem UF) — preenchido junto com uf_base ao escolher uma sugestão do autocomplete. */
  cidade_base: string;
  cidade_base_lat: number | null;
  cidade_base_lng: number | null;
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
    cidade_base: m.cidade_base ?? '',
    cidade_base_lat: m.cidade_base_lat,
    cidade_base_lng: m.cidade_base_lng,
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
      'id, nome, uf_base, cidade_base, cidade_base_lat, cidade_base_lng, meta_alvo_centavos, media_lucro_frete_centavos, canal_wa_ativo, telefone_verificado, cnh_numero, cnh_vencimento, exame_toxicologico_vencimento, cidade_atual, uf_atual, cidade_atual_lat, cidade_atual_lng',
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

interface PayloadCidadeAtual {
  userId: string;
  cidade: string;
  uf: string;
  lat: number;
  lng: number;
}

registrarExecutor<PayloadCidadeAtual>('motoristas_cidade_atual', async ({ userId, cidade, uf, lat, lng }) => {
  const { error } = await supabase
    .from('motoristas')
    .update({ cidade_atual: cidade, uf_atual: uf, cidade_atual_lat: lat, cidade_atual_lng: lng })
    .eq('id', userId);
  return { error: error?.message ?? null };
});

/** Grava "onde o motorista está agora" — usado pelo filtro de raio da tela Buscar Frete. Passa pela fila offline (chave por usuário — só a última cidade digitada é reenviada). */
export async function salvarCidadeAtual(
  userId: string,
  cidade: string,
  uf: string,
  lat: number,
  lng: number,
): Promise<{ error: string | null }> {
  const payload: PayloadCidadeAtual = { userId, cidade, uf, lat, lng };
  const { error } = await gravarOuEnfileirar('motoristas_cidade_atual', payload, `motoristas_cidade_atual:${userId}`);
  return { error };
}

interface PayloadMotorista {
  userId: string;
  form: FormMotorista;
}

registrarExecutor<PayloadMotorista>('motoristas_editar', async ({ userId, form }) => {
  const { error } = await supabase
    .from('motoristas')
    .update({
      nome: form.nome.trim() || null,
      uf_base: form.uf_base.trim().toUpperCase() || null,
      cidade_base: form.cidade_base.trim() || null,
      cidade_base_lat: form.cidade_base_lat,
      cidade_base_lng: form.cidade_base_lng,
      meta_alvo_centavos: form.metaAlvoReais != null ? reaisToCents(form.metaAlvoReais) : null,
      cnh_numero: form.cnhNumero.trim() || null,
      cnh_vencimento: form.cnhVencimento || null,
      exame_toxicologico_vencimento: form.exameToxicologicoVencimento || null,
    })
    .eq('id', userId);
  return { error: error?.message ?? null };
});

/** Passa pela fila offline — chave por usuário: se o motorista editar o cadastro mais de uma vez sem sinal, só a última versão é reenviada. */
export async function salvarMotorista(
  userId: string,
  form: FormMotorista,
): Promise<{ error: string | null }> {
  const payload: PayloadMotorista = { userId, form };
  const { error } = await gravarOuEnfileirar('motoristas_editar', payload, `motoristas_editar:${userId}`);
  return { error };
}

export interface VinculoWhatsapp {
  /** Deep link pro WhatsApp oficial, já com "VINCULAR <código>" preenchido — só abrir e enviar. */
  waLink: string;
  /** ISO — o código vale por 10 minutos (ver supabase/functions/wa-vincular). */
  expiraEm: string;
}

/**
 * Gera o código de vínculo do WhatsApp (Edge Function wa-vincular) — não
 * passa pela fila offline de propósito: precisa de resposta imediata (o
 * link) pra mostrar na tela, e só funciona online mesmo (é uma chamada à
 * Meta por trás). Quem confirma de verdade é o wa-webhook, quando a
 * mensagem "VINCULAR <código>" chegar no número oficial.
 */
export async function iniciarVinculoWhatsapp(): Promise<{ vinculo: VinculoWhatsapp | null; erro: string | null }> {
  const { data, error } = await supabase.functions.invoke('wa-vincular');
  if (error) {
    // supabase-js expoe o status HTTP do erro em error.context quando disponivel (mesmo padrão de Entrada.tsx/otp-solicitar).
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429) {
      return { vinculo: null, erro: 'Muitos pedidos de código seguidos — aguarde um pouco e tente de novo.' };
    }
    if (status === 503) {
      return { vinculo: null, erro: 'Vínculo por WhatsApp ainda não está disponível. Tente mais tarde.' };
    }
    if (status === 401) {
      return { vinculo: null, erro: 'Sessão expirada — saia e entre de novo pra tentar.' };
    }
    return { vinculo: null, erro: 'Não foi possível gerar o código agora. Tente de novo.' };
  }
  if (!data?.wa_link) {
    return { vinculo: null, erro: 'Resposta inesperada do servidor.' };
  }
  return { vinculo: { waLink: data.wa_link as string, expiraEm: data.expira_em as string }, erro: null };
}
