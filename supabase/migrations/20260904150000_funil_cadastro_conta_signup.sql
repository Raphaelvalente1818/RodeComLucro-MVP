-- Fecha o pendente anotado no checkpoint de 02/09: o evento
-- signup_completed já existe e já é emitido de verdade (ver
-- apps/web/src/pages/Verificacao.tsx, heurística de "conta nova" pelo
-- created_at de auth.users) — só ainda não tinha nenhuma linha em
-- analytics_event porque nenhum cadastro novo aconteceu desde que essa
-- instrumentação foi ao ar (commit 70ec7c4). Não faltava código, faltava
-- uso no funil/gate.
--
-- 1) Funil: acrescenta o estágio 'cadastro_conta' (signup_completed)
--    ANTES de 'cadastro' (que passa a ser só o cadastro do caminhão,
--    truck_profile_saved) — não substitui, complementa, pra não perder a
--    granularidade entre "criou conta" e "cadastrou o caminhão".
alter table public.mv_funnel_daily drop constraint if exists mv_funnel_daily_etapa_check;
alter table public.mv_funnel_daily add constraint mv_funnel_daily_etapa_check
  check (etapa in ('cadastro_conta', 'cadastro', 'busca', 'simulacao', 'aceite'));

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
      ('cadastro_conta', 'signup_completed'),
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

select public.refresh_mv_funnel_diario();

-- 2) Gate de validação (journey_definition): criada a v2, incluindo
--    signup_completed, mas NÃO ativada ainda de propósito — trocar a
--    versão ativa reseta o que já contava pro gate (hoje: base=2,
--    completos=1 na v1) pra 0, porque nenhum motorista existente tem
--    signup_completed (contas anteriores a essa instrumentação, ou
--    cadastradas fora da janela de 15s da heurística). Com só 6
--    motoristas cadastrados no total, o impacto de ativar agora é baixo,
--    mas é uma decisão de negócio (o que conta como "jornada completa"
--    pro MVP), não só técnica — fica registrada aqui pronta pra ativar
--    quando o Raphael confirmar.
insert into public.journey_definition (version, required_events, window_days, meta, active)
values (2, array['signup_completed', 'truck_profile_saved', 'simulation_run', 'freight_accepted'], 30, 160, false)
on conflict (version) do nothing;
