-- =====================================================================
-- Módulo identidade — pepper de telefone via Supabase Vault
--
-- 0003 assumia `current_setting('app.settings.telefone_pepper')`, mas
-- ALTER DATABASE ... SET de um GUC customizado exige superuser, que não
-- está disponível no Postgres gerenciado do Supabase (erro 42501:
-- "permission denied to set parameter"). Trocamos para Supabase Vault,
-- que já vem habilitado neste projeto (extensão supabase_vault).
--
-- Setup (executado uma vez via SQL editor, não versionado em texto
-- plano):
--   select vault.create_secret(
--     encode(gen_random_bytes(32), 'hex'),
--     'telefone_pepper',
--     'Pepper HMAC-SHA256 para hash de telefone (modulo identidade)'
--   );
--
-- O mesmo valor também precisa estar configurado como secret da Edge
-- Function otp-solicitar (env var TELEFONE_PEPPER), para que o hash
-- calculado no trigger e no otp-solicitar sejam idênticos.
-- =====================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_pepper text;
begin
  select decrypted_secret into v_pepper
    from vault.decrypted_secrets
   where name = 'telefone_pepper';

  insert into public.motoristas (id, telefone_e164, telefone_hash, telefone_verificado, status)
  values (
    new.id,
    new.phone,
    encode(hmac(new.phone, v_pepper, 'sha256'), 'hex'),
    false,
    'ativa'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
