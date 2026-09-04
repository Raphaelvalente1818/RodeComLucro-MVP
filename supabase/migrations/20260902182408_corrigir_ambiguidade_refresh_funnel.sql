-- Bug real encontrado logo após aplicar 20260902182345: a tabela
-- derivada "etapas(etapa, event_name)" em refresh_mv_funnel_diario()
-- colidia sem qualificação com analytics_event.event_name no SELECT/
-- GROUP BY, dando "42702: column reference "event_name" is ambiguous".
-- Corrige qualificando todas as referências.
create or replace function public.refresh_mv_funnel_diario()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.mv_funnel_daily (dia, etapa, event_name, usuarios, refreshed_at)
  select current_date, etapas.etapa, etapas.event_name, count(distinct ae.actor_id), now()
  from (
    values
      ('cadastro', 'truck_profile_saved'),
      ('busca', 'freight_search'),
      ('simulacao', 'simulation_run'),
      ('aceite', 'freight_accepted')
  ) as etapas(etapa, event_name)
  left join public.analytics_event ae
    on ae.event_name = etapas.event_name and ae.actor_id is not null
  group by etapas.etapa, etapas.event_name
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
