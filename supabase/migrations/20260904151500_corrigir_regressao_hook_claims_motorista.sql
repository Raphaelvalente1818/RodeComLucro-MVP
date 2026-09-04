-- Bug real e sério (encontrado ao investigar a base do frontend do
-- painel admin): a migration 20260902182345 fez `create or replace
-- function public.custom_access_token_hook`, e isso SUBSTITUIU por
-- inteiro a função original de 0004_identidade_access_token_hook.sql —
-- que injeta app_role='driver', driver_id, telefone_verificado e
-- quarentena no JWT de TODO motorista, usadas de verdade pelo app
-- (apps/web/src/pages/Garagem.tsx lê claims.telefone_verificado ao criar
-- o cache local; lib/claims.ts documenta as quatro).
--
-- Como a versão do painel admin só seta app_role pra quem está em
-- admin_user, desde 02/09 todo motorista comum (não-admin) passou a
-- receber um JWT SEM app_role, driver_id, telefone_verificado ou
-- quarentena — silenciosamente, sem erro (a função não quebra, só não
-- seta mais essas claims). Corrige juntando as duas responsabilidades
-- numa função só: claims de motorista pra todo mundo (igual antes) +
-- app_role do admin_user por cima, quando existir (prioridade sobre
-- 'driver', já que hoje só duas contas de teste têm as duas coisas).
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  m record;
  papel_admin text;
begin
  claims := event -> 'claims';

  select telefone_verificado, status
    into m
    from public.motoristas
   where id = (event ->> 'user_id')::uuid;

  if found then
    claims := jsonb_set(claims, '{app_role}', '"driver"');
    claims := jsonb_set(claims, '{driver_id}', to_jsonb((event ->> 'user_id')));
    claims := jsonb_set(claims, '{telefone_verificado}', to_jsonb(coalesce(m.telefone_verificado, false)));
    claims := jsonb_set(claims, '{quarentena}', to_jsonb(coalesce(m.status, '') = 'quarentena'));
  end if;

  -- admin_user tem prioridade sobre 'driver' quando a mesma conta tiver
  -- as duas linhas (não é o caso hoje, mas não custa deixar coerente).
  select role into papel_admin
    from public.admin_user
   where user_id = (event ->> 'user_id')::uuid
     and ativo = true;

  if papel_admin is not null then
    claims := jsonb_set(claims, '{app_role}', to_jsonb(papel_admin));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- ---------------------------------------------------------------------
-- Dois achados menores do advisor de segurança, corrigidos junto por
-- estarem no mesmo lote de trabalho:
-- ---------------------------------------------------------------------

-- v_journey_completion foi criada sem security_invoker=true — por padrão
-- roda com os privilégios do dono (postgres), ignorando RLS de
-- analytics_event caso algum dia ganhe GRANT pra anon/authenticated (hoje
-- não tem nenhum grant, mas é o padrão errado de deixar). Alinha com o
-- padrão já usado em 0002_identidade_rls.sql.
alter view public.v_journey_completion set (security_invoker = true);

-- As 4 funções refresh_* do painel admin são SECURITY DEFINER (correto,
-- precisam gravar nas tabelas de agregado) mas ficaram com EXECUTE aberto
-- pra anon/authenticated por padrão do Postgres — qualquer usuário
-- logado podia disparar um refresh via RPC. Não vaza dado (as funções
-- retornam void), mas não deveria ser chamável por fora do pg_cron.
revoke execute on function public.refresh_agg_kpi_diario() from anon, authenticated;
revoke execute on function public.refresh_mv_funnel_diario() from anon, authenticated;
revoke execute on function public.refresh_agg_veredito() from anon, authenticated;
revoke execute on function public.refresh_agg_validation() from anon, authenticated;
