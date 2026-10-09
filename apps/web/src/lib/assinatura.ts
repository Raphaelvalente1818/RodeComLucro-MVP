// apps/web/src/lib/assinatura.ts
//
// "Rode com Lucro PRO" no app (09/10/2026, Docs/pagamentos-assinatura.md).
// Quem decide "é PRO?" é a função motorista_assinante() no banco — a mesma
// que o bot usa. O app só pergunta e aplica as regras de PRO (abaixo).
//
// Regra da loja: dentro do app da Google Play (TWA) NÃO mostramos botão de
// compra — compra de serviço digital dentro do app exigiria o faturamento do
// Google. Lá o card diz "assine pelo WhatsApp". Detecção: o Android abre a
// TWA com referrer android-app://<package>.

import { supabase } from './supabaseClient';

/** Mesmos números de supabase/functions/wa-webhook/assinatura.ts. */
export const PRO = {
  /** fretes na tela Buscar pra quem não é PRO; PRO vê todos */
  appGratis: 5,
  /** frete publicado há menos de X h só aparece pra PRO */
  primeiraMaoHoras: 2,
} as const;

export interface EstadoAssinatura {
  ativa: boolean;
  status: 'incompleta' | 'ativa' | 'atrasada' | 'cancelada' | null;
  periodoFim: string | null;
}

export async function carregarAssinatura(userId: string): Promise<EstadoAssinatura> {
  const [{ data: ativa }, { data: a }] = await Promise.all([
    supabase.rpc('motorista_assinante', { p_motorista: userId }),
    supabase.from('assinatura').select('status, periodo_fim').eq('motorista_id', userId).maybeSingle(),
  ]);
  return {
    ativa: Boolean(ativa),
    status: (a?.status as EstadoAssinatura['status']) ?? null,
    periodoFim: (a?.periodo_fim as string | null) ?? null,
  };
}

let cacheDisponivel: boolean | null = null;

/** O plano existe (chaves do Stripe configuradas)? Sem ele, nenhum limite do grátis é aplicado. */
export async function planoProDisponivel(): Promise<boolean> {
  if (cacheDisponivel != null) return cacheDisponivel;
  try {
    const { data, error } = await supabase.functions.invoke('assinar', { body: { acao: 'status' } });
    cacheDisponivel = !error && data?.disponivel === true;
  } catch {
    cacheDisponivel = false;
  }
  return cacheDisponivel;
}

/** Link do Checkout (não assinante) ou do Portal (assinante). Null = plano não configurado. */
export async function abrirAssinatura(acao: 'checkout' | 'portal' = 'checkout'): Promise<{ url: string } | { disponivel: false } | { erro: string }> {
  const { data, error } = await supabase.functions.invoke('assinar', { body: { acao } });
  if (error) return { erro: error.message };
  if (data?.disponivel === false) return { disponivel: false };
  if (data?.url) return { url: data.url as string };
  return { erro: (data?.erro as string | undefined) ?? 'desconhecido' };
}

/** True quando o site está rodando dentro do app da Google Play (TWA). */
export function dentroDoAppDaPlay(): boolean {
  try {
    return document.referrer.startsWith('android-app://');
  } catch {
    return false;
  }
}

export function primeiraMao(createdAtIso: string): boolean {
  return Date.now() - new Date(createdAtIso).getTime() < PRO.primeiraMaoHoras * 60 * 60_000;
}
