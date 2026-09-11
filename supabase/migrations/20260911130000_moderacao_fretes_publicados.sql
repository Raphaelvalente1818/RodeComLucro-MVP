-- Moderação antes de auto-serviço (fretes_publicados).
--
-- Prepara o terreno para o futuro módulo de empresas (embarcadores)
-- postando fretes diretamente: nenhum frete de origem não confiável vai
-- direto pro ar. Por enquanto, o único caminho de INSERT em
-- fretes_publicados continua sendo admin (fretes_publicados_insert_admin),
-- então nada muda na prática hoje — este é o preparo de schema/RPC pro
-- dia em que existir um segundo caminho de INSERT (self-service).
--
-- status: adiciona 'pendente_aprovacao' (estado inicial de um frete
-- postado por fonte não confiável) e 'rejeitado' (moderação negou).
-- motivo_rejeicao: preenchido só quando status='rejeitado', obrigatório
-- nesse caso (a RPC abaixo garante isso).

alter table fretes_publicados
  drop constraint fretes_publicados_status_check;

alter table fretes_publicados
  add constraint fretes_publicados_status_check
  check (status = any (array['aberto','negociando','fechado','expirado','pendente_aprovacao','rejeitado']));

alter table fretes_publicados
  add column if not exists motivo_rejeicao text;

comment on column fretes_publicados.motivo_rejeicao is
  'Preenchido só quando status = rejeitado (moderação via admin_moderar_frete). Null nos demais casos.';

-- audit_log: registra as decisões de moderação. approve_company/reject_company
-- já existiam pré-provisionados (nunca usados); approve_freight/reject_freight
-- são o equivalente pro frete individual.
alter table audit_log
  drop constraint audit_log_action_check;

alter table audit_log
  add constraint audit_log_action_check
  check (action = any (array['suspend_driver','takedown_freight','approve_company','reject_company','view_pii','approve_freight','reject_freight']));

-- RLS: admin pode fazer UPDATE em fretes_publicados (hoje não existia
-- nenhuma policy de UPDATE — nem a RPC abaixo precisa dela, já que é
-- SECURITY DEFINER, mas o painel admin pode precisar editar outros campos
-- do frete fora do fluxo de moderação).
create policy fretes_publicados_update_admin
  on fretes_publicados
  for update
  using (is_admin_ativo())
  with check (is_admin_ativo());

-- RPC atômica de moderação — mesmo racional do registrar_bloqueio_otp:
-- update + audit insert numa transação só, sem depender de duas chamadas
-- separadas do cliente (que poderiam divergir por falha no meio).
create or replace function admin_moderar_frete(
  p_frete_id uuid,
  p_decisao text,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_novo_status text;
begin
  if not is_admin_ativo() then
    raise exception 'nao_autorizado' using errcode = '42501';
  end if;

  if p_decisao not in ('approve', 'reject') then
    raise exception 'decisao_invalida: %', p_decisao;
  end if;

  if p_decisao = 'reject' and (p_motivo is null or btrim(p_motivo) = '') then
    raise exception 'motivo_obrigatorio_para_rejeicao';
  end if;

  v_novo_status := case when p_decisao = 'approve' then 'aberto' else 'rejeitado' end;

  update fretes_publicados
     set status = v_novo_status,
         motivo_rejeicao = case when p_decisao = 'reject' then p_motivo else null end
   where id = p_frete_id
     and status = 'pendente_aprovacao';

  if not found then
    raise exception 'frete_nao_esta_pendente_de_aprovacao';
  end if;

  insert into audit_log (actor_user_id, role, action, target_type, target_id, reason)
  values (
    auth.uid(),
    'admin',
    case when p_decisao = 'approve' then 'approve_freight' else 'reject_freight' end,
    'frete_publicado',
    p_frete_id,
    coalesce(nullif(btrim(p_motivo), ''), 'aprovado sem observações adicionais')
  );
end;
$$;

-- A função já se protege internamente com is_admin_ativo(), mas por
-- padrão o Postgres concede EXECUTE a PUBLIC (herdado por anon) em toda
-- function nova. Revoga explicitamente pra ficar consistente com o
-- padrão já usado em saude_banco()/saude_jobs_rollup().
revoke all on function admin_moderar_frete(uuid, text, text) from public;
revoke all on function admin_moderar_frete(uuid, text, text) from anon;
grant execute on function admin_moderar_frete(uuid, text, text) to authenticated;

comment on function admin_moderar_frete is
  'Aprova ou rejeita um frete em status pendente_aprovacao, atomicamente com o registro em audit_log. Chamado pelo painel admin (Docs/PRD-tecnico-admin.html); pré-requisito para o futuro módulo de empresas postando fretes direto.';
