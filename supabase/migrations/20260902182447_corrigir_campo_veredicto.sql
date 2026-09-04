-- Bug real: o PRD original (Docs/PRD-tecnico-admin.html) especifica o
-- campo props.veredito, mas o que calcularFrete() de fato grava (app web
-- e wa-webhook) é props.veredicto (grafia correta em português, com
-- "c") — confirmado inspecionando payloads reais de analytics_event.
-- Com o nome errado, refresh_agg_veredito() nunca populava nada.
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
    props ->> 'veredicto',
    count(*),
    round(count(*)::numeric / sum(count(*)) over () * 100, 1),
    now()
  from public.analytics_event
  where event_name in ('simulation_run', 'freight_accepted')
    and props ->> 'veredicto' is not null
  group by props ->> 'veredicto'
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

select public.refresh_agg_veredito();
