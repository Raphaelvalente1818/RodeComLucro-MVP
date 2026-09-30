-- 30/09/2026 — Camadas 2+3 da conversa no WhatsApp (Docs/status-sessao.md 30/09):
-- a IA classifica a intenção e, quando a mensagem não é sobre frete, responde
-- livre (limitada por dia). Novos status de auditoria em wa_freight_query.
--   resposta_livre      — respondida pelo Haiku (conta no limite diário)
--   limite_diario       — passou do limite de respostas livres; ficou em silêncio
--   busca_sem_resultado — busca rodou e não achou frete compatível
--   busca_origem        — busca pediu o caminhão antes (origem digitada guardada)

alter table public.wa_freight_query
  drop constraint if exists wa_freight_query_status_check;

alter table public.wa_freight_query
  add constraint wa_freight_query_status_check check (status = any (array[
    'calculado', 'confirmacao_pendente', 'dado_faltando', 'erro_extracao',
    'nao_vinculado', 'calculado_anonimo', 'nao_cadastrado', 'calculado_novo',
    'boas_vindas', 'onboarding_resposta', 'recalculado_perfil', 'sair',
    'resposta_livre', 'limite_diario', 'busca_sem_resultado', 'busca_origem'
  ]::text[]));

-- Índice pro limite diário (count por número/status/dia).
create index if not exists wa_freight_query_from_status_dia_idx
  on public.wa_freight_query (from_e164, status, criado_em desc);
