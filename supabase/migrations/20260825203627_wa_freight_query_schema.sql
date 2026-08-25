-- =====================================================================
-- wa_freight_query — auditoria de cada pedido de cálculo de frete feito
-- por texto livre no WhatsApp (Fase 2, calc-wpp). Guarda o texto bruto
-- recebido, o JSON extraído pela IA (Claude Haiku) e o resultado do
-- calcularFrete() rodado em cima dele — serve tanto pra depurar extração
-- ruim quanto pra medir custo/qualidade da IA ao longo do tempo. Não tem
-- relação com analise_frete (que é só o que o motorista salva de próprio
-- punho pelo app) — aqui é log de TODA tentativa, aceita ou não.
--
-- motorista_id nullable de propósito: se o número que mandou a mensagem
-- ainda não tiver vínculo confirmado (canal_wa_ativo=false), o cálculo é
-- recusado antes de chamar a IA, mas ainda registramos a tentativa pra
-- métrica de "gente pedindo cálculo sem vincular primeiro".
-- =====================================================================

create table if not exists public.wa_freight_query (
  id uuid primary key default gen_random_uuid(),
  wa_message_id text not null references public.wa_mensagem_recebida(wa_message_id) on delete cascade,
  motorista_id uuid references public.motoristas(id) on delete set null,
  from_e164 text not null,
  texto_recebido text not null,
  extracao_snapshot jsonb,           -- saída bruta da IA (campos + confiança por campo)
  status text not null check (status in ('calculado', 'confirmacao_pendente', 'dado_faltando', 'erro_extracao', 'nao_vinculado')),
  resultado_snapshot jsonb,          -- FreteResultado, só quando status = 'calculado'
  criado_em timestamptz not null default now()
);

create index if not exists wa_freight_query_motorista_idx
  on public.wa_freight_query (motorista_id, criado_em desc);

alter table public.wa_freight_query enable row level security;

-- Sem policy para authenticated — só service_role (a própria wa-webhook)
-- grava/lê aqui, mesmo padrão de wa_mensagem_recebida/identidade_audit.
