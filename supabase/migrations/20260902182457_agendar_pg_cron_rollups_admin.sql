-- Agenda os 4 jobs de refresh do painel admin via pg_cron. Volume de
-- dados ainda é baixo (~120 eventos), então plain views/upsert em vez de
-- MATERIALIZED VIEW por enquanto (ver nota em 20260902182345) — o
-- agendamento aqui só evita ter que rodar os refreshes manualmente.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'refresh_agg_kpi_daily',
  '*/15 * * * *',
  $$select public.refresh_agg_kpi_diario()$$
);

select cron.schedule(
  'refresh_mv_funnel_daily',
  '*/15 * * * *',
  $$select public.refresh_mv_funnel_diario()$$
);

select cron.schedule(
  'refresh_agg_veredito',
  '*/15 * * * *',
  $$select public.refresh_agg_veredito()$$
);

select cron.schedule(
  'refresh_agg_validation',
  '*/30 * * * *',
  $$select public.refresh_agg_validation()$$
);
