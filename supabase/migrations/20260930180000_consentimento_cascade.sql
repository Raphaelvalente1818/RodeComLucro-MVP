-- 30/09/2026 — "SAIR" (auth.admin.deleteUser) falhava pra quem tinha linha em
-- consentimento (vínculo pelo app): a FK era ON DELETE NO ACTION. Descoberto ao
-- apagar contas de teste. Todas as outras FKs pra motoristas já cascateiam
-- (ou põem null: wa_freight_query, analytics_event — auditoria fica).
alter table public.consentimento
  drop constraint if exists consentimento_motorista_id_fkey;

alter table public.consentimento
  add constraint consentimento_motorista_id_fkey
  foreign key (motorista_id) references public.motoristas(id) on delete cascade;
