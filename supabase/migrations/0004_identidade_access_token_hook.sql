-- =====================================================================
-- Módulo identidade — custom access token hook
--
-- Após aplicar esta migration, registre a função no dashboard:
--   Authentication → Hooks → "Customize Access Token (JWT) Claims"
--   → apontar para public.custom_access_token_hook
-- =====================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  m record;
begin
  claims := event -> 'claims';

  select telefone_verificado, status
    into m
    from public.motoristas
   where id = (event ->> 'user_id')::uuid;

  if not found then
    -- usuário ainda não tem linha em motoristas (não deveria acontecer
    -- após on_auth_user_created, mas não quebra o login por isso).
    return event;
  end if;

  claims := jsonb_set(claims, '{app_role}', '"driver"');
  claims := jsonb_set(claims, '{driver_id}', to_jsonb((event ->> 'user_id')));
  claims := jsonb_set(claims, '{telefone_verificado}', to_jsonb(coalesce(m.telefone_verificado, false)));
  claims := jsonb_set(claims, '{quarentena}', to_jsonb(coalesce(m.status, '') = 'quarentena'));

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- A função precisa ser executável pelo role usado pelos Auth Hooks.
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
