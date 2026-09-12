-- Identidade da empresa (embarcador) — pré-requisito #2 do módulo de
-- empresas publicando fretes direto. Ver Docs/status-sessao.md,
-- "PLANEJAMENTO — 11/09" e as decisões de 12/09: auto-cadastro com
-- aprovação manual do admin, grátis no MVP, login por e-mail+senha,
-- 1 usuário por empresa (mas user_id separado do id pra virar N depois).
--
-- Tudo aditivo — nada aqui muda o fluxo do motorista.

-- ---------------------------------------------------------------------
-- 1. Trigger de novo usuário do Auth: hoje cria motorista pra TODO
--    usuário, usando new.phone. Cadastro por e-mail (empresa) não tem
--    telefone → telefone_e164 NOT NULL estourava e o signup inteiro
--    falhava. Agora: sem telefone, não é motorista, não faz nada.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault', 'extensions'
as $$
declare
  v_pepper text;
begin
  if new.phone is null or new.phone = '' then
    -- Cadastro por e-mail (empresa) — motorista é só quem entra por telefone.
    return new;
  end if;

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

-- ---------------------------------------------------------------------
-- 2. Validação de CNPJ (dígitos verificadores). Aceita só os 14 dígitos
--    (o app normaliza antes de gravar).
-- ---------------------------------------------------------------------
create or replace function public.cnpj_valido(p text)
returns boolean
language plpgsql
immutable
as $$
declare
  d int[];
  soma int;
  dv1 int;
  dv2 int;
  pesos1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  pesos2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  i int;
begin
  if p is null or p !~ '^\d{14}$' then return false; end if;
  -- todos os dígitos iguais (00000000000000 etc.) passam no cálculo mas não existem
  if p ~ '^(\d)\1{13}$' then return false; end if;

  d := array(select (regexp_split_to_table(p, ''))::int);

  soma := 0;
  for i in 1..12 loop soma := soma + d[i] * pesos1[i]; end loop;
  dv1 := case when soma % 11 < 2 then 0 else 11 - (soma % 11) end;
  if d[13] <> dv1 then return false; end if;

  soma := 0;
  for i in 1..13 loop soma := soma + d[i] * pesos2[i]; end loop;
  dv2 := case when soma % 11 < 2 then 0 else 11 - (soma % 11) end;
  return d[14] = dv2;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Tabela empresas
-- ---------------------------------------------------------------------
create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  cnpj text not null unique check (cnpj_valido(cnpj)),
  razao_social text not null check (length(btrim(razao_social)) >= 3),
  nome_fantasia text,
  telefone text,
  email text not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovada', 'rejeitada', 'suspensa')),
  motivo_rejeicao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.empresas is
  'Embarcadores (empresas que publicam frete). Auto-cadastro por e-mail+senha; só publica depois que o admin aprova (admin_moderar_empresa). 1 user_id por empresa no MVP.';
comment on column public.empresas.cnpj is '14 dígitos, sem máscara, validado por cnpj_valido().';
comment on column public.empresas.motivo_rejeicao is 'Preenchido quando status = rejeitada/suspensa.';

create index empresas_status_idx on public.empresas (status);

alter table public.empresas enable row level security;

-- Empresa vê e edita só a própria linha (status/motivo não são editáveis
-- por ela — ver trigger abaixo).
create policy empresas_select_propria
  on public.empresas for select
  to authenticated
  using (user_id = auth.uid());

create policy empresas_insert_propria
  on public.empresas for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'pendente');

create policy empresas_update_propria
  on public.empresas for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admin vê todas (a moderação em si passa pela RPC, não por UPDATE direto).
create policy empresas_select_admin
  on public.empresas for select
  to authenticated
  using (is_admin_ativo());

-- Empresa não pode se auto-aprovar nem mexer no motivo: trava status e
-- motivo_rejeicao em UPDATE feito por quem não é admin.
create or replace function public.empresas_protege_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_ativo() and (new.status is distinct from old.status or new.motivo_rejeicao is distinct from old.motivo_rejeicao) then
    raise exception 'empresa_nao_pode_alterar_status' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger empresas_protege_status_trg
  before update on public.empresas
  for each row execute function public.empresas_protege_status();

-- ---------------------------------------------------------------------
-- 4. Hook de claims: terceiro papel 'empresa'. ATENÇÃO — o hook roda como
--    supabase_auth_admin; sem grant + policy pra esse papel, TODO login
--    quebra (bug real de 04/09 com admin_user). Mesmo remédio aqui.
-- ---------------------------------------------------------------------
grant usage on schema public to supabase_auth_admin;
grant select on public.empresas to supabase_auth_admin;

create policy empresas_select_auth_admin
  on public.empresas for select
  to supabase_auth_admin
  using (true);

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  m record;
  e record;
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

  select id, status
    into e
    from public.empresas
   where user_id = (event ->> 'user_id')::uuid;

  if found then
    claims := jsonb_set(claims, '{app_role}', '"empresa"');
    claims := jsonb_set(claims, '{empresa_id}', to_jsonb(e.id::text));
    claims := jsonb_set(claims, '{empresa_status}', to_jsonb(e.status));
  end if;

  -- admin por último: prevalece sobre driver/empresa.
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

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------
-- 5. Helper: empresa aprovada do usuário logado (null se não é empresa
--    ou não está aprovada). Usado nas policies de fretes_publicados.
-- ---------------------------------------------------------------------
create or replace function public.empresa_aprovada_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.empresas
   where user_id = auth.uid() and status = 'aprovada';
$$;

revoke all on function public.empresa_aprovada_id() from public, anon;
grant execute on function public.empresa_aprovada_id() to authenticated;

-- ---------------------------------------------------------------------
-- 6. fretes_publicados: FK company_id → empresas; empresa aprovada pode
--    inserir, mas SÓ como pendente_aprovacao e SÓ com o próprio
--    company_id — nunca vai direto pro ar (pré-requisito #1).
-- ---------------------------------------------------------------------
alter table public.fretes_publicados
  add constraint fretes_publicados_company_id_fkey
  foreign key (company_id) references public.empresas(id) on delete set null;

alter table public.fretes_publicados
  drop constraint fretes_publicados_fonte_check;

alter table public.fretes_publicados
  add constraint fretes_publicados_fonte_check
  check (fonte = any (array['RODE_DIRETO','MANUAL','EMPRESA']));

create policy fretes_publicados_insert_empresa
  on public.fretes_publicados for insert
  to authenticated
  with check (
    company_id is not null
    and company_id = empresa_aprovada_id()
    and status = 'pendente_aprovacao'
    and fonte = 'EMPRESA'
  );

-- ---------------------------------------------------------------------
-- 7. RPC de moderação da empresa — mesmo molde da admin_moderar_frete.
--    approve_company/reject_company já existiam no CHECK do audit_log
--    desde 02/09, sem uso até aqui.
-- ---------------------------------------------------------------------
create or replace function public.admin_moderar_empresa(
  p_empresa_id uuid,
  p_decisao text,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_novo_status text;
begin
  select au.role into v_role
    from admin_user au
   where au.user_id = auth.uid() and au.ativo;

  if v_role is null then
    raise exception 'nao_autorizado' using errcode = '42501';
  end if;

  if p_decisao not in ('approve', 'reject', 'suspend') then
    raise exception 'decisao_invalida: %', p_decisao;
  end if;

  if p_decisao in ('reject', 'suspend') and (p_motivo is null or btrim(p_motivo) = '') then
    raise exception 'motivo_obrigatorio';
  end if;

  v_novo_status := case p_decisao
    when 'approve' then 'aprovada'
    when 'reject' then 'rejeitada'
    else 'suspensa'
  end;

  update empresas
     set status = v_novo_status,
         motivo_rejeicao = case when p_decisao = 'approve' then null else p_motivo end,
         updated_at = now()
   where id = p_empresa_id
     and (
       (p_decisao = 'approve' and status in ('pendente', 'suspensa', 'rejeitada'))
       or (p_decisao = 'reject' and status = 'pendente')
       or (p_decisao = 'suspend' and status = 'aprovada')
     );

  if not found then
    raise exception 'transicao_invalida_para_status_atual';
  end if;

  insert into audit_log (actor_user_id, role, action, target_type, target_id, reason)
  values (
    auth.uid(),
    v_role,
    case when p_decisao = 'approve' then 'approve_company' else 'reject_company' end,
    'empresa',
    p_empresa_id,
    coalesce(nullif(btrim(p_motivo), ''), 'aprovada sem observações adicionais')
  );
end;
$$;

revoke all on function public.admin_moderar_empresa(uuid, text, text) from public, anon;
grant execute on function public.admin_moderar_empresa(uuid, text, text) to authenticated;

comment on function public.admin_moderar_empresa is
  'Aprova/rejeita/suspende uma empresa, atomicamente com o audit_log (approve_company/reject_company). Suspensão também registra reject_company com o motivo.';

-- ---------------------------------------------------------------------
-- 8. Cadastro de empresa via metadados do signUp (raw_user_meta_data):
--    funciona tanto com "Confirm email" ligado (sem sessão logo após o
--    signUp, então o app não conseguiria inserir em empresas por RLS)
--    quanto desligado. O app valida CNPJ antes de chamar o signUp; aqui
--    só cria a linha. Se cnpj vier inválido/duplicado, o insert falha e
--    o GoTrue devolve "Database error saving new user" — por isso o app
--    checa cnpj_disponivel() antes. (Substitui a versão do item 1.)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault', 'extensions'
as $$
declare
  v_pepper text;
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if new.phone is null or new.phone = '' then
    if v_meta ->> 'tipo' = 'empresa' then
      insert into public.empresas (user_id, cnpj, razao_social, nome_fantasia, telefone, email)
      values (
        new.id,
        regexp_replace(coalesce(v_meta ->> 'cnpj', ''), '\D', '', 'g'),
        coalesce(v_meta ->> 'razao_social', ''),
        nullif(btrim(coalesce(v_meta ->> 'nome_fantasia', '')), ''),
        nullif(regexp_replace(coalesce(v_meta ->> 'telefone', ''), '\D', '', 'g'), ''),
        coalesce(new.email, '')
      );
    end if;
    return new;
  end if;

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

-- Checagem prévia de CNPJ no cadastro (anon, antes do signUp). Só diz
-- "livre ou não" — não revela nada da empresa dona.
create or replace function public.cnpj_disponivel(p_cnpj text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.empresas
     where cnpj = regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g')
  );
$$;

grant execute on function public.cnpj_disponivel(text) to anon, authenticated;
