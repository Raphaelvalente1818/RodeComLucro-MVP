-- =====================================================================
-- Módulo identidade — sync telefone_verificado com auth.users
--
-- Este trigger já rodava em produção (aplicado direto via SQL editor)
-- mas nunca foi versionado. Este arquivo formaliza o que já está em
-- uso: ao confirmar o telefone via OTP (auth.users.phone_confirmed_at
-- passa de null para not null), propaga o estado para
-- public.motoristas.telefone_verificado (lido pelo
-- custom_access_token_hook em 0004_identidade_access_token_hook.sql) e
-- para auth.users.raw_app_meta_data (fallback para quem lê
-- app_metadata sem passar pelas claims do JWT).
-- =====================================================================

create or replace function public.sync_telefone_verificado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.phone_confirmed_at is not null and old.phone_confirmed_at is null then
    update public.motoristas
       set telefone_verificado = true,
           telefone_verificado_em = new.phone_confirmed_at
     where id = new.id;

    update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                                || jsonb_build_object('telefone_verificado', true)
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_phone_confirmed on auth.users;
create trigger on_auth_user_phone_confirmed
  after update of phone_confirmed_at on auth.users
  for each row execute function public.sync_telefone_verificado();
