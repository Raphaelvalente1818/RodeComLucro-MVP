-- Módulo identidade — trigger de criação de motorista, proteção de colunas
-- de confiança e custom access token hook.
-- Fonte: Docs/PRD-tecnico-identidade.html seções 2 (Arquitetura), 5
-- (Contratos de API — PATCH /rest/v1/motoristas) e 9 (Segurança & LGPD).
--
-- PENDÊNCIA CRÍTICA antes de produção: o pepper usado no HMAC do
-- telefone_hash está com um valor placeholder (app.settings.telefone_pepper).
-- Configurar via `supabase secrets set` / Vault e setar a config no projeto
-- antes de qualquer dado real ser gravado — nunca commitar o valor real.
--
-- Pendência: não testado (sem shell disponível na sessão em que foi
-- escrita). Antes de aplicar: `supabase db push` + smoke test de
-- verifyOtp real conferindo os claims no JWT decodificado.

-- =========================================================================
-- 1. Trigger on_auth_user_created — cria a linha canônica em motoristas
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_telefone text;
  v_pepper text;
begin
  v_telefone := new.phone;

  begin
    v_pepper := current_setting('app.settings.telefone_pepper', true);
  exception when others then
    v_pepper := null;
  end;
  if v_pepper is null or v_pepper = '' then
    -- Não deve chegar aqui em produção — ver PENDÊNCIA CRÍTICA no topo do arquivo.
    v_pepper := 'CHANGE_ME_PEPPER_NAO_USAR_EM_PRODUCAO';
  end if;

  insert into public.motoristas (id, telefone_e164, telefone_hash, status)
  values (
    new.id,
    v_telefone,
    encode(hmac(v_telefone, v_pepper, 'sha256'), 'hex'),
    'ativa'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================================
-- 2. Trigger BEFORE UPDATE — bloqueia escrita de colunas de confiança
--    vinda de request autenticado com claim app_role='driver'.
--    service_role (Edge Functions) não carrega esse claim e passa direto.
-- =========================================================================
create or replace function public.motoristas_protect_trust_columns()
returns trigger
language plpgsql
as $$
declare
  v_role text;
begin
  v_role := coalesce(auth.jwt() ->> 'app_role', '');

  if v_role = 'driver' then
    if new.telefone_e164 is distinct from old.telefone_e164
      or new.telefone_hash is distinct from old.telefone_hash
      or new.telefone_verificado is distinct from old.telefone_verificado
      or new.canal_wa_ativo is distinct from old.canal_wa_ativo
      or new.status is distinct from old.status
      or new.ultimo_login_at is distinct from old.ultimo_login_at
    then
      raise exception 'colunas de confianca (telefone_e164, telefone_hash, telefone_verificado, canal_wa_ativo, status, ultimo_login_at) so podem ser alteradas por service_role';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists motoristas_protect_trust_columns_trg on public.motoristas;
create trigger motoristas_protect_trust_columns_trg
  before update on public.motoristas
  for each row execute procedure public.motoristas_protect_trust_columns();

-- =========================================================================
-- 3. Custom access token hook — injeta app_role/driver_id/
--    telefone_verificado/quarentena no JWT. Precisa ser habilitado em
--    Authentication > Hooks no painel do Supabase (ou config.toml) apontando
--    para public.custom_access_token_hook — não é automático só por existir.
-- =========================================================================
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  v_motorista record;
begin
  claims := event->'claims';

  select telefone_verificado, status
  into v_motorista
  from public.motoristas
  where id = (event->>'user_id')::uuid;

  if found then
    claims := jsonb_set(claims, '{app_role}', '"driver"');
    claims := jsonb_set(claims, '{driver_id}', to_jsonb(event->>'user_id'));
    claims := jsonb_set(claims, '{telefone_verificado}', to_jsonb(v_motorista.telefone_verificado));
    claims := jsonb_set(claims, '{quarentena}', to_jsonb(v_motorista.status = 'quarentena'));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

grant select on public.motoristas to supabase_auth_admin;
