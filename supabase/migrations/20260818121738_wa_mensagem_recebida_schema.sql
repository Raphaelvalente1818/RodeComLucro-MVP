-- =====================================================================
-- wa_mensagem_recebida — idempotência genérica do wa-webhook (Fase 2,
-- calc-wpp). O endpoint é compartilhado por todos os módulos -wpp
-- (VINCULAR/DESVINCULAR do identidade hoje; NLU do calc-wpp depois) e
-- a Meta reentrega webhooks em caso de timeout/erro — sem isso, uma
-- reentrega de "VINCULAR 123456" processaria o vínculo de novo (inofensivo
-- por ser idempotente na prática) mas uma reentrega de um intent de
-- cálculo futuro poderia duplicar efeito. Dedup acontece uma vez só, no
-- topo do webhook, antes de rotear pro intent.
-- =====================================================================

create table if not exists public.wa_mensagem_recebida (
  wa_message_id text primary key,
  from_e164 text not null,
  intent text,
  recebido_em timestamptz not null default now()
);

create index if not exists wa_mensagem_recebida_recebido_idx
  on public.wa_mensagem_recebida (recebido_em);

alter table public.wa_mensagem_recebida enable row level security;

-- Sem policy para authenticated — só service_role (a própria wa-webhook)
-- grava/lê aqui, mesmo padrão de otp_envio/otp_bloqueio/identidade_audit.
