// apps/web/src/lib/backlog.ts
//
// PROVISÓRIO — suporte ao formulário de backlog dos testes internos (os 4
// sócios). Sem relação com o produto final. Remover este arquivo junto com
// components/BacklogModal.tsx, o botão "Backlog" na Garagem.tsx e a
// migration 20260805200031_backlog_provisorio_schema.sql quando os testes
// acabarem.

import { supabase } from './supabaseClient';

export type BacklogStatus = 'aberto' | 'feito';

export interface BacklogItem {
  id: string;
  nome: string;
  pagina: string;
  problemaSugestao: string;
  observacao: string | null;
  status: BacklogStatus;
  createdAt: string;
}

export interface BacklogParaCriar {
  nome: string;
  pagina: string;
  problemaSugestao: string;
  observacao: string;
}

export async function listarBacklog(): Promise<BacklogItem[]> {
  const { data, error } = await supabase
    .from('backlog_provisorio')
    .select('id, nome, pagina, problema_sugestao, observacao, status, created_at')
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('listarBacklog', error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
    pagina: r.pagina as string,
    problemaSugestao: r.problema_sugestao as string,
    observacao: (r.observacao as string | null) ?? null,
    status: r.status as BacklogStatus,
    createdAt: r.created_at as string,
  }));
}

export async function criarBacklog(item: BacklogParaCriar): Promise<{ error: string | null }> {
  const { error } = await supabase.from('backlog_provisorio').insert({
    nome: item.nome.trim(),
    pagina: item.pagina.trim(),
    problema_sugestao: item.problemaSugestao.trim(),
    observacao: item.observacao.trim() || null,
  });
  return { error: error?.message ?? null };
}

export async function alternarStatusBacklog(
  id: string,
  statusAtual: BacklogStatus,
): Promise<{ status: BacklogStatus; error: string | null }> {
  const novoStatus: BacklogStatus = statusAtual === 'aberto' ? 'feito' : 'aberto';
  const { error } = await supabase
    .from('backlog_provisorio')
    .update({ status: novoStatus, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { status: novoStatus, error: error?.message ?? null };
}
