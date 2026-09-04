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
