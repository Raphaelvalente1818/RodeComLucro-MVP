-- Bug real e grave (reportado pelo Raphael 08/09): "infinite recursion
-- detected in policy for relation admin_user" ao salvar o perfil do
-- motorista, e "Não foi possível carregar a lista" na maioria das telas
-- do painel admin.
--
-- Causa raiz: a policy admin_user_select_admin (migration
-- 20260904153000_rls_admin_leitura_motoristas_wa_admins.sql) tem uma
-- subquery que consulta a PRÓPRIA tabela admin_user:
--   using (exists (select 1 from admin_user au where au.user_id = auth.uid() and au.ativo))
-- Toda vez que o Postgres precisa avaliar RLS em admin_user (pra
-- qualquer policy, inclusive essa mesma), ele reavalia TODAS as policies
-- da tabela pra combinar com OR — o que reavalia admin_user_select_admin
-- de novo, que consulta admin_user de novo, infinitamente. E como
-- motoristas_select_admin e wa_freight_query_select_admin (mesma
-- migration) também consultam admin_user, a recursão vazou pra QUALQUER
-- select em motoristas — inclusive o motorista lendo/salvando o próprio
-- perfil, que não tem nada a ver com o painel admin.
--
-- Correção: função SECURITY DEFINER (dona = postgres, que no Supabase
-- tem BYPASSRLS) — dentro dela, a consulta a admin_user NÃO reavalia RLS
-- daquela tabela, então não recursiona. Troca todas as policies "é
-- admin?" (inclusive as de agregados/auditoria já existentes) pra usar
-- essa função em vez da subquery direta — mais seguro (elimina o risco
-- de recursão em qualquer tabela nova) e mais barato (não reavalia a
-- expressão inteira a cada policy).
create or replace function public.is_admin_ativo()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admin_user au
    where au.user_id = auth.uid() and au.ativo
  );
$$;

revoke all on function public.is_admin_ativo() from public, anon;
grant execute on function public.is_admin_ativo() to authenticated;

-- admin_user: remove a policy recursiva, recria sem se auto-referenciar
-- via subquery direta (agora via função, que bypassa RLS por dentro).
drop policy if exists admin_user_select_admin on public.admin_user;
create policy admin_user_select_admin
  on public.admin_user for select
  to authenticated
  using (public.is_admin_ativo());

-- motoristas / wa_freight_query: mesma troca, tira o risco de recursão
-- (mesmo não sendo auto-referentes, dependiam da subquery que recursionava
-- dentro de admin_user).
drop policy if exists motoristas_select_admin on public.motoristas;
create policy motoristas_select_admin
  on public.motoristas for select
  to authenticated
  using (public.is_admin_ativo());

drop policy if exists wa_freight_query_select_admin on public.wa_freight_query;
create policy wa_freight_query_select_admin
  on public.wa_freight_query for select
  to authenticated
  using (public.is_admin_ativo());

-- Tabelas de agregado/auditoria do painel admin (20260902182345) —
-- mesmo padrão, trocado por consistência e performance (não é obrigatório
-- pra corrigir a recursão, já que não apontavam pra admin_user
-- recursivamente, mas evita reintroduzir o mesmo problema no futuro).
drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin
  on public.audit_log for select
  to authenticated
  using (public.is_admin_ativo());

drop policy if exists app_log_select_admin on public.app_log;
create policy app_log_select_admin
  on public.app_log for select
  to authenticated
  using (public.is_admin_ativo());

drop policy if exists journey_definition_select_admin on public.journey_definition;
create policy journey_definition_select_admin
  on public.journey_definition for select
  to authenticated
  using (public.is_admin_ativo());

drop policy if exists agg_validation_select_admin on public.agg_validation;
create policy agg_validation_select_admin
  on public.agg_validation for select
  to authenticated
  using (public.is_admin_ativo());

drop policy if exists agg_kpi_daily_select_admin on public.agg_kpi_daily;
create policy agg_kpi_daily_select_admin
  on public.agg_kpi_daily for select
  to authenticated
  using (public.is_admin_ativo());

drop policy if exists mv_funnel_daily_select_admin on public.mv_funnel_daily;
create policy mv_funnel_daily_select_admin
  on public.mv_funnel_daily for select
  to authenticated
  using (public.is_admin_ativo());

drop policy if exists agg_veredito_select_admin on public.agg_veredito;
create policy agg_veredito_select_admin
  on public.agg_veredito for select
  to authenticated
  using (public.is_admin_ativo());
