-- =====================================================================
-- Painel admin — fase 1 (Docs/PRD-tecnico-admin.html): auth por papel +
-- pipeline de agregação. Versão enxuta do PRD, ajustada ao que já existe
-- de verdade no banco hoje: analytics_event sem particionamento/
-- schema_version/session_id (20260826210825_analytics_event_schema.sql),
-- e sem os módulos B2B/parceiros/WhatsApp-agg ainda — por isso este
-- primeiro corte cobre só o que tem dado real fluindo: KPIs gerais,
-- funil, gate de validação (168/160) e distribuição de veredito. As
-- demais tabelas do PRD (agg_embarcador, agg_parceiro_receita,
-- wpp_message_agg, agg_alertas etc.) entram em fases seguintes, quando
-- os módulos que as alimentam existirem.
--
-- Nota (04/09, ver 20260902182408/182422/182447 e 20260904143103): esta
-- migration reproduz exatamente o que foi aplicado no banco em 02/09 via
-- MCP, incluindo dois bugs corrigidos depois em migrations separadas
-- (ambiguidade de coluna em refresh_mv_funnel_diario, campo errado
-- 'veredito' em vez de 'veredicto' em refresh_agg_veredito, e permissão
-- faltante do custom_access_token_hook pra supabase_auth_admin). Mantida
-- como está aqui de propósito, pra o histórico bater com o que rodou de
-- verdade — as correções ficam nos arquivos seguintes, na ordem em que
-- foram aplicadas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) admin_user + audit_log — autorização por papel e trilha de auditoria
-- ---------------------------------------------------------------------

create table if not exists public.admin_user (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'operacao', 'suporte')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.admin_user enable row level security;

-- Cada admin_user só enxerga a própria linha (pra checar o próprio papel
-- no front); nenhuma policy de INSERT/UPDATE/DELETE pra authenticated —
-- gestão de papéis é feita manualmente (service role) por enquanto, sem
-- self-service de promoção de papel.
create policy admin_user_select_own
  on public.admin_user for select
  to authenticated
  using (user_id = auth.uid());

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  role text not null,
  action text not null check (action in ('suspend_driver', 'takedown_freight', 'approve_company', 'reject_company', 'view_pii')),
  target_type text not null,
  target_id uuid,
  reason text not null,
  created_at timestamptz not null default now(),
  ip inet
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

-- INSERT-only por design (sem policy de UPDATE/DELETE pra ninguém).
-- SELECT restrito a quem tem admin_user ativo — a checagem de papel fino
-- (ex.: só admin vê financeiro) fica nas RPCs/views específicas, aqui é
-- só "é alguém do admin".
create policy audit_log_select_admin
  on public.audit_log for select
  to authenticated
  using (exists (select 1 from public.admin_user au where au.user_id = auth.uid() and au.ativo));

create policy audit_log_insert_service
  on public.audit_log for insert
  to service_role
  with check (true);

-- ---------------------------------------------------------------------
-- 1.1) app_log — observabilidade dos jobs de agregação (criada aqui,
-- antes das funções de refresh que gravam nela).
-- ---------------------------------------------------------------------

create table if not exists public.app_log (
  id uuid primary key default gen_random_uuid(),
  nivel text not null check (nivel in ('erro', 'aviso', 'info')),
  source text not null,
  message text not null,
  context jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_log_nivel_created_idx on public.app_log (nivel, created_at desc);
create index if not exists app_log_source_created_idx on public.app_log (source, created_at desc);

alter table public.app_log enable row level security;

create policy app_log_select_admin
  on public.app_log for select
  to authenticated
  using (exists (select 1 from public.admin_user au where au.user_id = auth.uid() and au.ativo));

create policy app_log_insert_service
  on public.app_log for insert
  to service_role
  with check (true);

-- ---------------------------------------------------------------------
-- 2) app_role no JWT — custom access token hook (Supabase Auth)
-- ---------------------------------------------------------------------
-- Hook lido pelo Auth a cada emissão de token; injeta app_role no JWT
-- pra RLS/RPCs decidirem por papel sem round-trip extra ao banco. Sem
-- linha em admin_user (ou ativo=false), app_role fica ausente — front e
-- RLS tratam ausência como "sem acesso admin".
--
-- Atenção: essa função roda como o papel supabase_auth_admin (chamada
-- internamente pelo GoTrue), não como authenticated — a policy
-- admin_user_select_own acima NÃO cobre esse contexto. Faltou dar
-- permissão de leitura pra supabase_auth_admin aqui (bug real, corrigido
-- em 20260904143103_corrigir_permissao_hook_admin_user.sql).
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  papel text;
begin
  select role into papel
  from public.admin_user
  where user_id = (event ->> 'user_id')::uuid
    and ativo = true;

  claims := event -> 'claims';
  if papel is not null then
    claims := jsonb_set(claims, '{app_role}', to_jsonb(papel));
  end if;
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Permissões exigidas pelo Supabase pra habilitar o hook (configuração
-- final do hook em Auth Hooks -> Custom Access Token ainda precisa ser
-- feita no painel/via config.toml — a função só fica pronta pra uso).
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- ---------------------------------------------------------------------
-- 3) journey_definition + v_journey_completion + agg_validation
--    (o gate de validação do MVP — >=160 jornadas completas)
-- ---------------------------------------------------------------------

create table if not exists public.journey_definition (
  id serial primary key,
  version int not null unique,
  required_events text[] not null,
  window_days int not null default 30,
  meta int not null default 160,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Só 1 versão ativa por vez.
create unique index if not exists journey_definition_active_uidx
  on public.journey_definition (active) where active;

alter table public.journey_definition enable row level security;

create policy journey_definition_select_admin
  on public.journey_definition for select
  to authenticated
  using (exists (select 1 from public.admin_user au where au.user_id = auth.uid() and au.ativo));

-- v1: os eventos que já existem de verdade no catálogo (track.ts) e
-- fazem sentido como "motorista usou o produto de ponta a ponta" —
-- truck_profile_saved (cadastrou o caminhão) + simulation_run (calculou
-- um frete) + freight_accepted (aceitou um frete). signup_completed e
-- expense_logged do PRD original não são emitidos hoje (não existe
-- lançamento de gasto avulso, e o cadastro em si não dispara evento
-- ainda) — não entram na v1 pra não travar o gate num evento que nunca
-- vai bater.
insert into public.journey_definition (version, required_events, window_days, meta, active)
values (1, array['truck_profile_saved', 'simulation_run', 'freight_accepted'], 30, 160, true)
on conflict (version) do nothing;

-- View de completude por motorista — não materializada por enquanto
-- (121 eventos no total hoje; materializar é otimização prematura, vira
-- MATERIALIZED VIEW quando o volume justificar refresh agendado).
create or replace view public.v_journey_completion as
with jd as (
  select required_events, window_days, meta, version
  from public.journey_definition
  where active
),
primeiro_evento as (
  select ae.actor_id as driver_id, min(ae.occurred_at) as first_event_at
  from public.analytics_event ae, jd
  where ae.actor_id is not null
    and ae.event_name = any (jd.required_events)
  group by ae.actor_id
),
eventos_na_janela as (
  select
    pe.driver_id,
    count(distinct ae.event_name) as distintos_cumpridos
  from primeiro_evento pe
  join jd on true
  join public.analytics_event ae
    on ae.actor_id = pe.driver_id
   and ae.event_name = any (jd.required_events)
   and ae.occurred_at <= pe.first_event_at + (jd.window_days || ' days')::interval
  group by pe.driver_id
)
select
  jd.version as journey_version,
  pe.driver_id,
  pe.first_event_at,
  coalesce(en.distintos_cumpridos, 0) >= cardinality(jd.required_events) as is_complete
from primeiro_evento pe
join jd on true
left join eventos_na_janela en on en.driver_id = pe.driver_id;

-- Rollup diário do gate — grava snapshot do total cumulativo de jornadas
-- completas, pra "dados atualizados até <refreshed_at>" e pra não
-- recalcular tudo em cada carregamento de tela.
create table if not exists public.agg_validation (
  dia date primary key,
  completos_cumulativo int not null,
  base_cadastrada int not null,
  meta int not null default 160,
  journey_version int not null,
  validado boolean generated always as (completos_cumulativo >= meta) stored,
  refreshed_at timestamptz not null default now()
);

alter table public.agg_validation enable row level security;

create policy agg_validation_select_admin
  on public.agg_validation for select
  to authenticated
  using (exists (select 1 from public.admin_user au where au.user_id = auth.uid() and au.ativo));

create or replace function public.refresh_agg_validation()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completos int;
  v_base int;
  v_versao int;
begin
  select count(*) filter (where is_complete), count(*), max(journey_version)
  into v_completos, v_base, v_versao
  from public.v_journey_completion;

  insert into public.app_log (nivel, source, message, context)
  values ('info', 'job', 'refresh_agg_validation iniciado', jsonb_build_object('completos', coalesce(v_completos, 0)));

  insert into public.agg_validation (dia, completos_cumulativo, base_cadastrada, meta, journey_version, refreshed_at)
  values (current_date, coalesce(v_completos, 0), coalesce(v_base, 0), 160, coalesce(v_versao, 1), now())
  on conflict (dia) do update set
    completos_cumulativo = excluded.completos_cumulativo,
    base_cadastrada = excluded.base_cadastrada,
    meta = excluded.meta,
    journey_version = excluded.journey_version,
    refreshed_at = excluded.refreshed_at;
exception when others then
  insert into public.app_log (nivel, source, message, context)
  values ('erro', 'job', 'refresh_agg_validation falhou', jsonb_build_object('erro', sqlerrm));
  raise;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) agg_kpi_daily + mv_funnel_daily + agg_veredito
-- ---------------------------------------------------------------------

create table if not exists public.agg_kpi_daily (
  dia date primary key,
  cadastrados int not null,
  ativos_30d int not null,
  novos_7d int not null,
  simulacoes int not null,
  fretes_aceitos int not null,
  pct_aceitas numeric,
  refreshed_at timestamptz not null default now()
);

alter table public.agg_kpi_daily enable row level security;

create policy agg_kpi_daily_select_admin
  on public.agg_kpi_daily for select
  to authenticated
  using (exists (select 1 from public.admin_user au where au.user_id = auth.uid() and au.ativo));

create table if not exists public.mv_funnel_daily (
  dia date not null,
  etapa text not null check (etapa in ('cadastro', 'busca', 'simulacao', 'aceite')),
  event_name text not null,
  usuarios int not null,
  refreshed_at timestamptz not null default now(),
  primary key (dia, etapa)
);

alter table public.mv_funnel_daily enable row level security;

create policy mv_funnel_daily_select_admin
  on public.mv_funnel_daily for select
  to authenticated
  using (exists (select 1 from public.admin_user au where au.user_id = auth.uid() and au.ativo));

create table if not exists public.agg_veredito (
  dia date not null,
  veredito text not null check (veredito in ('BOM', 'ACEITÁVEL', 'RUIM')),
  qtd int not null,
  pct numeric,
  refreshed_at timestamptz not null default now(),
  primary key (dia, veredito)
);

alter table public.agg_veredito enable row level security;

create policy agg_veredito_select_admin
  on public.agg_veredito for select
  to authenticated
  using (exists (select 1 from public.admin_user au where au.user_id = auth.uid() and au.ativo));

-- Funil real hoje: cadastro=truck_profile_saved (não há signup_completed
-- emitido ainda — ver nota da journey_definition acima), busca=
-- freight_search, simulacao=simulation_run, aceite=freight_accepted.
--
-- Bug real (corrigido em 20260902182408): a coluna etapa/event_name da
-- tabela derivada "etapas" colidia sem qualificação com
-- analytics_event.event_name no group by, dando erro de ambiguidade.
create or replace function public.refresh_agg_kpi_diario()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agg_kpi_daily (dia, cadastrados, ativos_30d, novos_7d, simulacoes, fretes_aceitos, pct_aceitas, refreshed_at)
  select
    current_date,
    (select count(*) from public.motoristas),
    (select count(distinct actor_id) from public.analytics_event where actor_id is not null and occurred_at >= now() - interval '30 days'),
    (select count(*) from public.motoristas where created_at >= now() - interval '7 days'),
    (select count(*) from public.analytics_event where event_name = 'simulation_run'),
    (select count(*) from public.analytics_event where event_name = 'freight_accepted'),
    case when (select count(*) from public.analytics_event where event_name = 'simulation_run') > 0
      then round(
        (select count(*) from public.analytics_event where event_name = 'freight_accepted')::numeric
        / (select count(*) from public.analytics_event where event_name = 'simulation_run') * 100, 1)
      else 0 end,
    now()
  on conflict (dia) do update set
    cadastrados = excluded.cadastrados,
    ativos_30d = excluded.ativos_30d,
    novos_7d = excluded.novos_7d,
    simulacoes = excluded.simulacoes,
    fretes_aceitos = excluded.fretes_aceitos,
    pct_aceitas = excluded.pct_aceitas,
    refreshed_at = excluded.refreshed_at;

  insert into public.app_log (nivel, source, message, context)
  values ('info', 'job', 'refresh_agg_kpi_diario concluído', '{}'::jsonb);
exception when others then
  insert into public.app_log (nivel, source, message, context)
  values ('erro', 'job', 'refresh_agg_kpi_diario falhou', jsonb_build_object('erro', sqlerrm));
  raise;
end;
$$;

create or replace function public.refresh_mv_funnel_diario()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mv_funnel_daily (dia, etapa, event_name, usuarios, refreshed_at)
  select current_date, etapa, event_name, count(distinct actor_id), now()
  from (
    values
      ('cadastro', 'truck_profile_saved'),
      ('busca', 'freight_search'),
      ('simulacao', 'simulation_run'),
      ('aceite', 'freight_accepted')
  ) as etapas(etapa, event_name)
  left join public.analytics_event ae
    on ae.event_name = etapas.event_name and ae.actor_id is not null
  group by etapa, event_name
  on conflict (dia, etapa) do update set
    usuarios = excluded.usuarios,
    refreshed_at = excluded.refreshed_at;

  insert into public.app_log (nivel, source, message, context)
  values ('info', 'job', 'refresh_mv_funnel_diario concluído', '{}'::jsonb);
exception when others then
  insert into public.app_log (nivel, source, message, context)
  values ('erro', 'job', 'refresh_mv_funnel_diario falhou', jsonb_build_object('erro', sqlerrm));
  raise;
end;
$$;

-- Bug real (corrigido em 20260902182447): o PRD original chama o campo
-- de props.veredito, mas o que calcularFrete() grava de verdade (app e
-- wa-webhook) é props.veredicto — essa versão ainda lê o nome errado e
-- por isso nunca populava agg_veredito.
create or replace function public.refresh_agg_veredito()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agg_veredito (dia, veredito, qtd, pct, refreshed_at)
  select
    current_date,
    props ->> 'veredito',
    count(*),
    round(count(*)::numeric / sum(count(*)) over () * 100, 1),
    now()
  from public.analytics_event
  where event_name in ('simulation_run', 'freight_accepted')
    and props ->> 'veredito' is not null
  group by props ->> 'veredito'
  on conflict (dia, veredito) do update set
    qtd = excluded.qtd,
    pct = excluded.pct,
    refreshed_at = excluded.refreshed_at;

  insert into public.app_log (nivel, source, message, context)
  values ('info', 'job', 'refresh_agg_veredito concluído', '{}'::jsonb);
exception when others then
  insert into public.app_log (nivel, source, message, context)
  values ('erro', 'job', 'refresh_agg_veredito falhou', jsonb_build_object('erro', sqlerrm));
  raise;
end;
$$;
