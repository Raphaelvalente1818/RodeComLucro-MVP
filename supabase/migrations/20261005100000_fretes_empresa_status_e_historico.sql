-- 05/10/2026 — Portal Sofrete: a empresa pausa, republica e fecha o próprio
-- frete; nada é apagado — toda mudança de status vira linha em
-- fretes_publicados_historico (evidência). Mockup aprovado:
-- Docs/mockup-fretes-empresa-status.html. Decisões do Raphael:
--   1) "fechado" é REVERSÍVEL (volta pra aberto ou pausado);
--   2) pausado não expira sozinho;
--   3) motivo opcional ao pausar/fechar.
--
-- O app do motorista e o bot filtram status = 'aberto' — pausado/fechado
-- somem dos dois sem mexer neles.

-- ---------------------------------------------------------------------
-- 1. status 'pausado'
-- ---------------------------------------------------------------------
alter table public.fretes_publicados
  drop constraint if exists fretes_publicados_status_check;

alter table public.fretes_publicados
  add constraint fretes_publicados_status_check
  check (status = any (array['aberto','negociando','fechado','expirado','pendente_aprovacao','rejeitado','pausado']));

-- ---------------------------------------------------------------------
-- 2. histórico de status (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.fretes_publicados_historico (
  id bigint generated always as identity primary key,
  frete_id uuid not null references public.fretes_publicados(id) on delete cascade,
  status_de text,
  status_para text not null,
  ator text not null check (ator in ('empresa','admin','sistema')),
  ator_user_id uuid,
  motivo text,
  criado_em timestamptz not null default now()
);

create index if not exists fretes_publicados_historico_frete_idx
  on public.fretes_publicados_historico (frete_id, criado_em);

comment on table public.fretes_publicados_historico is
  'Cada mudança de status de um frete publicado (quem, quando, motivo). Append-only; frete nunca é apagado — é a evidência do que esteve no ar.';

alter table public.fretes_publicados_historico enable row level security;

-- Empresa lê o histórico dos próprios fretes; admin lê tudo. Ninguém
-- escreve direto — só o trigger abaixo (security definer).
create policy fretes_publicados_historico_select_empresa
  on public.fretes_publicados_historico for select
  to authenticated
  using (
    exists (
      select 1 from public.fretes_publicados f
        join public.empresas e on e.id = f.company_id
       where f.id = frete_id and e.user_id = auth.uid()
    )
  );

create policy fretes_publicados_historico_select_admin
  on public.fretes_publicados_historico for select
  to authenticated
  using (is_admin_ativo());

-- Trigger: grava INSERT (null → status inicial) e toda troca de status.
-- Quem fez: admin ativo → 'admin'; dono da empresa do frete → 'empresa';
-- senão (service_role, job, importação) → 'sistema'. O motivo chega por
-- set_config('app.motivo_status', ..., true) — a RPC abaixo seta antes do
-- UPDATE; admin_moderar_frete não seta (o motivo dela já vai pro audit_log
-- e pra motivo_rejeicao).
create or replace function public.fretes_publicados_log_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ator text := 'sistema';
  v_uid uuid := auth.uid();
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  if v_uid is not null then
    if is_admin_ativo() then
      v_ator := 'admin';
    elsif exists (select 1 from public.empresas e where e.id = new.company_id and e.user_id = v_uid) then
      v_ator := 'empresa';
    end if;
  end if;
  insert into public.fretes_publicados_historico (frete_id, status_de, status_para, ator, ator_user_id, motivo)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status,
    v_ator,
    v_uid,
    nullif(btrim(coalesce(current_setting('app.motivo_status', true), '')), '')
  );
  return new;
end;
$$;

drop trigger if exists fretes_publicados_log_status on public.fretes_publicados;
create trigger fretes_publicados_log_status
  after insert or update of status on public.fretes_publicados
  for each row execute function public.fretes_publicados_log_status();

-- Backfill: uma linha "sistema" por frete já existente, na data de criação,
-- pra todo frete ter histórico desde o começo.
insert into public.fretes_publicados_historico (frete_id, status_de, status_para, ator, ator_user_id, motivo, criado_em)
select f.id, null, f.status, 'sistema', null, 'registro inicial (backfill 05/10/2026)', f.created_at
  from public.fretes_publicados f
 where not exists (select 1 from public.fretes_publicados_historico h where h.frete_id = f.id);

-- ---------------------------------------------------------------------
-- 3. RPC: empresa muda o status do PRÓPRIO frete, só nas transições
--    permitidas. Sem policy de UPDATE pra empresa — tudo passa por aqui.
--    Transições (frete já aprovado uma vez; não volta pra moderação):
--      aberto  → pausado | fechado
--      pausado → aberto  | fechado
--      fechado → aberto  | pausado      (decisão 1: reversível)
--    pendente_aprovacao / rejeitado / expirado / negociando: a empresa
--    não mexe.
-- ---------------------------------------------------------------------
create or replace function public.empresa_mudar_status_frete(
  p_frete_id uuid,
  p_status text,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid := empresa_aprovada_id();
  v_atual text;
begin
  if v_empresa is null then
    raise exception 'empresa_nao_aprovada';
  end if;
  if p_status not in ('aberto','pausado','fechado') then
    raise exception 'status_invalido';
  end if;

  select status into v_atual
    from fretes_publicados
   where id = p_frete_id and company_id = v_empresa
     for update;
  if v_atual is null then
    raise exception 'frete_nao_encontrado';
  end if;
  if v_atual not in ('aberto','pausado','fechado') then
    raise exception 'frete_nao_permite_mudanca';
  end if;
  if v_atual = p_status then
    return;
  end if;

  perform set_config('app.motivo_status', coalesce(p_motivo, ''), true);
  update fretes_publicados
     set status = p_status
   where id = p_frete_id;
end;
$$;

revoke all on function public.empresa_mudar_status_frete(uuid, text, text) from public, anon;
grant execute on function public.empresa_mudar_status_frete(uuid, text, text) to authenticated;

comment on function public.empresa_mudar_status_frete is
  'Portal Sofrete: empresa aprovada pausa/republica/fecha o próprio frete (aberto ↔ pausado ↔ fechado). Motivo opcional vai pro histórico via app.motivo_status.';
