-- =====================================================================
-- Módulo identidade — trigger on_auth_user_created + guarda de colunas
-- sensíveis em motoristas
--
-- IMPORTANTE: antes de aplicar esta migration em produção, defina o
-- pepper de hashing de telefone via SQL editor (fora do controle de
-- versão, nunca commitar o valor real):
--   alter database postgres set app.settings.telefone_pepper = '<segredo>';
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cria a linha em motoristas no primeiro login (idempotente: se já
-- existir, não duplica — auth.users.id é PK/FK 1:1).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.motoristas (id, telefone_e164, telefone_hash, telefone_verificado, status)
  values (
    new.id,
    new.phone,
    encode(hmac(new.phone, current_setting('app.settings.telefone_pepper', true), 'sha256'), 'hex'),
    false,
    'ativa'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- Guarda: bloqueia qualquer tentativa do próprio motorista (claim
-- app_role='driver') de alterar colunas sensíveis diretamente. Essas
-- colunas só mudam via service_role (Edge Functions) ou triggers.
-- ---------------------------------------------------------------------
create or replace function public.guard_motoristas_sensitive_columns()
returns trigger
language plpgsql
as $$
declare
  jwt_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'app_role', '');
begin
  if jwt_role = 'driver' then
    if new.telefone_e164 is distinct from old.telefone_e164
      or new.telefone_hash is distinct from old.telefone_hash
      or new.telefone_verificado is distinct from old.telefone_verificado
      or new.canal_wa_ativo is distinct from old.canal_wa_ativo
      or new.status is distinct from old.status
      or new.ultimo_login_at is distinct from old.ultimo_login_at
    then
      raise exception 'coluna sensivel de motoristas so pode ser alterada via service_role';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_motoristas_sensitive_columns on public.motoristas;
create trigger guard_motoristas_sensitive_columns
  before update on public.motoristas
  for each row execute function public.guard_motoristas_sensitive_columns();
