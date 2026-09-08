-- Suporte a "Saúde do sistema" no painel admin.
-- Três coisas novas:
--   1. saude_jobs_rollup(): status da última execução de cada job de
--      pg_cron. authenticated não tem USAGE no schema cron (confirmado
--      via has_schema_privilege antes desta migration), então precisa
--      de SECURITY DEFINER — mesma técnica de is_admin_ativo().
--   2. saude_banco(): tamanho do banco + nº de conexões ativas
--      (pg_stat_activity), mesma razão (authenticated não enxerga
--      pg_stat_activity de outras sessões por padrão).
--   3. RLS de leitura em otp_bloqueio pra admin — hoje a tabela tem RLS
--      habilitado mas ZERO policies, então nem admin consegue ler (bloqueio
--      total, não intencional). Necessário pro card "alertas abertos"
--      (contar bloqueios ativos).
-- Todas gated por is_admin_ativo() internamente (SECURITY DEFINER não
-- impede RLS de quem CHAMA a função — quem decide quem pode ver o
-- resultado é a checagem explícita dentro dela).

create or replace function public.saude_jobs_rollup()
returns table (
  jobname text,
  schedule text,
  ativo boolean,
  ultima_execucao timestamptz,
  ultimo_status text,
  atrasado boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    j.jobname,
    j.schedule,
    j.active as ativo,
    r.start_time as ultima_execucao,
    r.status as ultimo_status,
    -- "atrasado": não roda há mais de 3x o intervalo esperado (heurística
    -- simples — os 4 jobs hoje rodam a cada 15 ou 30min, então 3x cobre
    -- uma falha isolada sem alarme falso por atraso de 1 ciclo).
    (r.start_time is null or r.start_time < now() - interval '2 hours') as atrasado
  from cron.job j
  left join lateral (
    select start_time, status
    from cron.job_run_details d
    where d.jobid = j.jobid
    order by start_time desc
    limit 1
  ) r on true
  where public.is_admin_ativo()
  order by j.jobname;
$$;
revoke all on function public.saude_jobs_rollup() from public, anon;
grant execute on function public.saude_jobs_rollup() to authenticated;

create or replace function public.saude_banco()
returns table (
  tamanho_bytes bigint,
  conexoes_ativas integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    pg_database_size(current_database()),
    (select count(*)::integer from pg_stat_activity)
  where public.is_admin_ativo();
$$;
revoke all on function public.saude_banco() from public, anon;
grant execute on function public.saude_banco() to authenticated;

create policy otp_bloqueio_select_admin
  on public.otp_bloqueio
  for select
  to authenticated
  using (public.is_admin_ativo());
