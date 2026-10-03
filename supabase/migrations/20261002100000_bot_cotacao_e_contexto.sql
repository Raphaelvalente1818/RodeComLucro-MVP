-- 02/10/2026 — bot v50 (teste do Rapha, 01/10): cotação sem valor ("quanto
-- posso cobrar?"), pergunta sobre o último cálculo ("quanto de pedágio?"),
-- caminhão dito na mensagem. Novos status de auditoria em wa_freight_query.
alter table public.wa_freight_query
  drop constraint if exists wa_freight_query_status_check;

alter table public.wa_freight_query
  add constraint wa_freight_query_status_check check (status = any (array[
    'calculado', 'confirmacao_pendente', 'dado_faltando', 'erro_extracao',
    'nao_vinculado', 'calculado_anonimo', 'nao_cadastrado', 'calculado_novo',
    'boas_vindas', 'onboarding_resposta', 'recalculado_perfil', 'sair',
    'resposta_livre', 'limite_diario', 'busca_sem_resultado', 'busca_origem',
    'cotado', 'pergunta_calculo', 'veiculo_salvo'
  ]::text[]));
