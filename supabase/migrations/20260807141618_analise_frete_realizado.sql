-- =====================================================================
-- analise_frete.realizado — só fretes marcados como realmente executados
-- pelo motorista contam pro "lucro do mês" da Garagem. Antes, qualquer
-- análise salva já entrava na soma, mesmo sem o frete ter acontecido.
-- =====================================================================

alter table public.analise_frete
  add column if not exists realizado boolean not null default false,
  add column if not exists realizado_em timestamptz;

create index if not exists analise_frete_user_realizado_idx
  on public.analise_frete (user_id, realizado, created_at desc);
