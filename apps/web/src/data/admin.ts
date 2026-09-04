// apps/web/src/data/admin.ts
//
// Leitura dos dados do painel admin — direto via cliente Supabase (RLS
// cuida do acesso: todas as tabelas aqui só liberam SELECT pra quem tem
// linha ativa em admin_user, ver 20260902182345_admin_auth_e_rollups.sql).
// Sem camada de Edge Function /admin/* como o PRD original desenha —
// decisão consciente pra essa primeira fase, dado que RLS já resolve a
// autorização sem precisar duplicar lógica numa API própria. Revisitar se
// o painel crescer pra ações de escrita (moderação, RPCs) que precisem de
// auditoria centralizada além do que audit_log já cobre.

import { supabase } from '../lib/supabaseClient';

export type PapelAdmin = 'admin' | 'operacao' | 'suporte';

export interface AdminKpi {
  dia: string;
  cadastrados: number;
  ativos30d: number;
  novos7d: number;
  simulacoes: number;
  fretesAceitos: number;
  pctAceitas: number | null;
  refreshedAt: string;
}

export interface AdminGate {
  dia: string;
  completosCumulativo: number;
  baseCadastrada: number;
  meta: number;
  journeyVersion: number;
  validado: boolean;
  refreshedAt: string;
}

export interface AdminFunilEtapa {
  etapa: 'cadastro_conta' | 'cadastro' | 'busca' | 'simulacao' | 'aceite';
  eventName: string;
  usuarios: number;
}

export interface AdminVeredito {
  veredito: string;
  qtd: number;
  pct: number | null;
}

export interface AdminVisaoGeral {
  kpi: AdminKpi | null;
  gate: AdminGate | null;
  funil: AdminFunilEtapa[];
  veredito: AdminVeredito[];
}

const ORDEM_FUNIL: AdminFunilEtapa['etapa'][] = ['cadastro_conta', 'cadastro', 'busca', 'simulacao', 'aceite'];

export async function carregarVisaoGeral(): Promise<AdminVisaoGeral> {
  const [kpiRes, gateRes, funilRes, veredictoRes] = await Promise.all([
    supabase.from('agg_kpi_daily').select('*').order('dia', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('agg_validation').select('*').order('dia', { ascending: false }).limit(1).maybeSingle(),
    // mv_funnel_daily/agg_veredito não têm uma view "só o dia mais
    // recente" pronta — busca as últimas linhas (no máx. 5/10 dias de
    // margem) e filtra em memória pelo dia mais recente presente.
    supabase.from('mv_funnel_daily').select('*').order('dia', { ascending: false }).limit(20),
    supabase.from('agg_veredito').select('*').order('dia', { ascending: false }).limit(20),
  ]);

  const kpi: AdminKpi | null = kpiRes.data
    ? {
        dia: kpiRes.data.dia,
        cadastrados: kpiRes.data.cadastrados,
        ativos30d: kpiRes.data.ativos_30d,
        novos7d: kpiRes.data.novos_7d,
        simulacoes: kpiRes.data.simulacoes,
        fretesAceitos: kpiRes.data.fretes_aceitos,
        pctAceitas: kpiRes.data.pct_aceitas != null ? Number(kpiRes.data.pct_aceitas) : null,
        refreshedAt: kpiRes.data.refreshed_at,
      }
    : null;

  const gate: AdminGate | null = gateRes.data
    ? {
        dia: gateRes.data.dia,
        completosCumulativo: gateRes.data.completos_cumulativo,
        baseCadastrada: gateRes.data.base_cadastrada,
        meta: gateRes.data.meta,
        journeyVersion: gateRes.data.journey_version,
        validado: gateRes.data.validado,
        refreshedAt: gateRes.data.refreshed_at,
      }
    : null;

  const diaFunilMaisRecente = funilRes.data?.[0]?.dia ?? null;
  const funilBruto = (funilRes.data ?? []).filter((r) => r.dia === diaFunilMaisRecente);
  const funil: AdminFunilEtapa[] = ORDEM_FUNIL.map((etapa) => {
    const linha = funilBruto.find((r) => r.etapa === etapa);
    return {
      etapa,
      eventName: linha?.event_name ?? '',
      usuarios: linha?.usuarios ?? 0,
    };
  });

  const diaVeredictoMaisRecente = veredictoRes.data?.[0]?.dia ?? null;
  const veredito: AdminVeredito[] = (veredictoRes.data ?? [])
    .filter((r) => r.dia === diaVeredictoMaisRecente)
    .map((r) => ({
      veredito: r.veredito,
      qtd: r.qtd,
      pct: r.pct != null ? Number(r.pct) : null,
    }))
    .sort((a, b) => b.qtd - a.qtd);

  return { kpi, gate, funil, veredito };
}

const LABEL_ETAPA: Record<AdminFunilEtapa['etapa'], string> = {
  cadastro_conta: 'Criou conta',
  cadastro: 'Cadastrou caminhão',
  busca: 'Buscou frete',
  simulacao: 'Simulou',
  aceite: 'Aceitou frete',
};

export function labelEtapaFunil(etapa: AdminFunilEtapa['etapa']): string {
  return LABEL_ETAPA[etapa];
}

// ---------------------------------------------------------------------
// Motoristas
// ---------------------------------------------------------------------

export interface AdminMotorista {
  id: string;
  nome: string | null;
  telefoneE164: string | null;
  telefoneVerificado: boolean;
  ufBase: string | null;
  cidadeBase: string | null;
  status: string | null;
  canalWaAtivo: boolean;
  cnhVencimento: string | null;
  exameToxicologicoVencimento: string | null;
  ultimoLoginAt: string | null;
  createdAt: string;
}

/** Paginado com busca simples por nome/telefone (ilike, client passa o termo já minúsculo/sem máscara). */
export async function carregarMotoristas(termo: string, pagina: number, porPagina = 30): Promise<{ linhas: AdminMotorista[]; total: number }> {
  let query = supabase
    .from('motoristas')
    .select(
      'id, nome, telefone_e164, telefone_verificado, uf_base, cidade_base, status, canal_wa_ativo, cnh_vencimento, exame_toxicologico_vencimento, ultimo_login_at, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(pagina * porPagina, pagina * porPagina + porPagina - 1);

  if (termo.trim()) {
    const t = termo.trim();
    query = query.or(`nome.ilike.%${t}%,telefone_e164.ilike.%${t}%,cidade_base.ilike.%${t}%`);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  const linhas: AdminMotorista[] = (data ?? []).map((m) => ({
    id: m.id,
    nome: m.nome,
    telefoneE164: m.telefone_e164,
    telefoneVerificado: Boolean(m.telefone_verificado),
    ufBase: m.uf_base,
    cidadeBase: m.cidade_base,
    status: m.status,
    canalWaAtivo: Boolean(m.canal_wa_ativo),
    cnhVencimento: m.cnh_vencimento,
    exameToxicologicoVencimento: m.exame_toxicologico_vencimento,
    ultimoLoginAt: m.ultimo_login_at,
    createdAt: m.created_at,
  }));

  return { linhas, total: count ?? linhas.length };
}

// ---------------------------------------------------------------------
// Fretes publicados
// ---------------------------------------------------------------------

export interface AdminFretePublicado {
  id: string;
  empresaNome: string | null;
  origemCidade: string | null;
  origemUf: string | null;
  destinoCidade: string | null;
  destinoUf: string | null;
  valorFreteCentavos: number | null;
  valorACombinar: boolean;
  tipoValor: string | null;
  status: string | null;
  fonte: string | null;
  dadoTeste: boolean;
  dataColeta: string | null;
  createdAt: string;
}

export async function carregarFretesPublicados(
  termo: string,
  status: string,
  pagina: number,
  porPagina = 30,
): Promise<{ linhas: AdminFretePublicado[]; total: number }> {
  let query = supabase
    .from('fretes_publicados')
    .select(
      'id, empresa_nome, origem_cidade, origem_uf, destino_cidade, destino_uf, valor_frete_centavos, valor_a_combinar, tipo_valor, status, fonte, dado_teste, data_coleta, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(pagina * porPagina, pagina * porPagina + porPagina - 1);

  if (status !== 'todos') query = query.eq('status', status);
  if (termo.trim()) {
    const t = termo.trim();
    query = query.or(`origem_cidade.ilike.%${t}%,destino_cidade.ilike.%${t}%,empresa_nome.ilike.%${t}%`);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  const linhas: AdminFretePublicado[] = (data ?? []).map((f) => ({
    id: f.id,
    empresaNome: f.empresa_nome,
    origemCidade: f.origem_cidade,
    origemUf: f.origem_uf,
    destinoCidade: f.destino_cidade,
    destinoUf: f.destino_uf,
    valorFreteCentavos: f.valor_frete_centavos,
    valorACombinar: Boolean(f.valor_a_combinar),
    tipoValor: f.tipo_valor,
    status: f.status,
    fonte: f.fonte,
    dadoTeste: Boolean(f.dado_teste),
    dataColeta: f.data_coleta,
    createdAt: f.created_at,
  }));

  return { linhas, total: count ?? linhas.length };
}

// ---------------------------------------------------------------------
// Consultas via WhatsApp (wa_freight_query)
// ---------------------------------------------------------------------

export interface AdminConsultaWhatsapp {
  id: string;
  fromE164: string | null;
  textoRecebido: string | null;
  status: string | null;
  extracaoSnapshot: unknown;
  resultadoSnapshot: unknown;
  criadoEm: string;
}

export async function carregarConsultasWhatsapp(pagina: number, porPagina = 30): Promise<{ linhas: AdminConsultaWhatsapp[]; total: number }> {
  const { data, count, error } = await supabase
    .from('wa_freight_query')
    .select('id, from_e164, texto_recebido, status, extracao_snapshot, resultado_snapshot, criado_em', { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range(pagina * porPagina, pagina * porPagina + porPagina - 1);

  if (error) throw error;

  const linhas: AdminConsultaWhatsapp[] = (data ?? []).map((c) => ({
    id: c.id,
    fromE164: c.from_e164,
    textoRecebido: c.texto_recebido,
    status: c.status,
    extracaoSnapshot: c.extracao_snapshot,
    resultadoSnapshot: c.resultado_snapshot,
    criadoEm: c.criado_em,
  }));

  return { linhas, total: count ?? linhas.length };
}

// ---------------------------------------------------------------------
// Administradores (admin_user)
// ---------------------------------------------------------------------

export interface AdminAdministrador {
  userId: string;
  role: PapelAdmin;
  ativo: boolean;
  createdAt: string;
  nome: string | null;
  telefoneE164: string | null;
}

export async function carregarAdministradores(): Promise<AdminAdministrador[]> {
  const { data: admins, error } = await supabase
    .from('admin_user')
    .select('user_id, role, ativo, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;

  const ids = (admins ?? []).map((a) => a.user_id);
  const { data: motoristasRel } = ids.length
    ? await supabase.from('motoristas').select('id, nome, telefone_e164').in('id', ids)
    : { data: [] as { id: string; nome: string | null; telefone_e164: string | null }[] };

  const porId = new Map((motoristasRel ?? []).map((m) => [m.id, m]));

  return (admins ?? []).map((a) => ({
    userId: a.user_id,
    role: a.role as PapelAdmin,
    ativo: Boolean(a.ativo),
    createdAt: a.created_at,
    nome: porId.get(a.user_id)?.nome ?? null,
    telefoneE164: porId.get(a.user_id)?.telefone_e164 ?? null,
  }));
}

// ---------------------------------------------------------------------
// Auditoria (audit_log + app_log)
// ---------------------------------------------------------------------

export interface AdminAuditLog {
  id: string;
  actorUserId: string;
  role: string;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string;
  createdAt: string;
}

export interface AdminAppLog {
  id: string;
  nivel: 'erro' | 'aviso' | 'info';
  source: string;
  message: string;
  context: unknown;
  createdAt: string;
}

export async function carregarAuditLog(pagina: number, porPagina = 30): Promise<{ linhas: AdminAuditLog[]; total: number }> {
  const { data, count, error } = await supabase
    .from('audit_log')
    .select('id, actor_user_id, role, action, target_type, target_id, reason, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(pagina * porPagina, pagina * porPagina + porPagina - 1);
  if (error) throw error;

  const linhas: AdminAuditLog[] = (data ?? []).map((r) => ({
    id: r.id,
    actorUserId: r.actor_user_id,
    role: r.role,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    reason: r.reason,
    createdAt: r.created_at,
  }));

  return { linhas, total: count ?? linhas.length };
}

export async function carregarAppLog(nivel: string, pagina: number, porPagina = 30): Promise<{ linhas: AdminAppLog[]; total: number }> {
  let query = supabase
    .from('app_log')
    .select('id, nivel, source, message, context, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(pagina * porPagina, pagina * porPagina + porPagina - 1);

  if (nivel !== 'todos') query = query.eq('nivel', nivel);

  const { data, count, error } = await query;
  if (error) throw error;

  const linhas: AdminAppLog[] = (data ?? []).map((r) => ({
    id: r.id,
    nivel: r.nivel,
    source: r.source,
    message: r.message,
    context: r.context,
    createdAt: r.created_at,
  }));

  return { linhas, total: count ?? linhas.length };
}
