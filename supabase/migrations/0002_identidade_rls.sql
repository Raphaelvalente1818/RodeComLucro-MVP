-- =====================================================================
-- Módulo identidade — RLS e views de compatibilidade
-- =====================================================================

alter table public.motoristas enable row level security;
alter table public.consentimento enable row level security;
alter table public.wa_vinculo enable row level security;
alter table public.otp_envio enable row level security;
alter table public.otp_bloqueio enable row level security;
alter table public.identidade_audit enable row level security;
alter table public.identidade_config enable row level security;

-- ---------------------------------------------------------------------
-- motoristas: motorista só enxerga/edita a própria linha.
-- Colunas sensíveis (telefone_*, canal_wa_ativo, status, ultimo_login_at)
-- só podem mudar via service_role (Edge Functions/triggers) — trigger
-- de guarda em 0003_identidade_trigger.sql.
-- ---------------------------------------------------------------------
create policy motoristas_select_own on public.motoristas
  for select using (id = auth.uid());

create policy motoristas_update_own on public.motoristas
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- consentimento: append-only, cada motorista só insere/lê o próprio.
-- Sem policy de update/delete → ninguém edita ou apaga.
-- ---------------------------------------------------------------------
create policy consentimento_select_own on public.consentimento
  for select using (motorista_id = auth.uid());

create policy consentimento_insert_own on public.consentimento
  for insert with check (motorista_id = auth.uid());

-- ---------------------------------------------------------------------
-- wa_vinculo: leitura só do dono; escrita só via service_role (sem
-- policy de insert/update para authenticated).
-- ---------------------------------------------------------------------
create policy wa_vinculo_select_own on public.wa_vinculo
  for select using (motorista_id = auth.uid());

-- otp_envio, otp_bloqueio, identidade_config: nenhuma policy para
-- authenticated — RLS ligada e sem policies bloqueia tudo, exceto
-- service_role (que ignora RLS por padrão no Supabase).

-- identidade_audit: leitura liberada só para app_role='admin' via claim do JWT.
create policy identidade_audit_select_admin on public.identidade_audit
  for select using (coalesce((auth.jwt() -> 'app_metadata' ->> 'app_role'), '') = 'admin');

-- ---------------------------------------------------------------------
-- Views de compatibilidade (security_invoker: respeitam a RLS da tabela
-- base — nenhuma delas aceita INSERT/UPDATE). Marcadas DEPRECATED; ver
-- ADR de remoção antes de apagar.
-- ---------------------------------------------------------------------

-- DEPRECATED: alias plural para find-app. Remover após find-app migrar
-- para `motoristas` diretamente (ver ADR pendente).
create or replace view public.perfis_motorista
  with (security_invoker = true) as
  select m.*
  from public.motoristas m;

-- DEPRECATED: alias para o portal — nunca expõe telefone. Contato só via
-- Edge Function reveal-driver-contact (a criar na Fase 3).
create or replace view public.driver_profiles
  with (security_invoker = true) as
  select
    id, nome, canal_wa_ativo, uf_base, onboarding_completo_em,
    meta_alvo_centavos, media_lucro_frete_centavos, status,
    ultimo_login_at, created_at, updated_at
  from public.motoristas;

-- DEPRECATED: alias singular para os módulos -wpp.
create or replace view public.motorista
  with (security_invoker = true) as
  select m.*
  from public.motoristas m;
