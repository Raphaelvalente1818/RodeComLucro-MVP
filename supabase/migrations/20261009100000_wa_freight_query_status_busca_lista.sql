-- 09/10/2026 — cota diária do bot, opção A (Raphael): "hoje" vira dia de
-- calendário (America/Sao_Paulo) e só consulta de verdade conta (cálculo,
-- cotação, busca). A busca que ACHA fretes e manda a lista não gravava linha
-- nenhuma em wa_freight_query (só as falhas: busca_origem/busca_sem_resultado),
-- então nunca entrava na cota. Status novo: busca_lista.
alter table public.wa_freight_query drop constraint if exists wa_freight_query_status_check;
alter table public.wa_freight_query add constraint wa_freight_query_status_check check (status = any (array[
  'calculado','confirmacao_pendente','dado_faltando','erro_extracao','nao_vinculado','calculado_anonimo',
  'nao_cadastrado','calculado_novo','boas_vindas','onboarding_resposta','recalculado_perfil','sair',
  'resposta_livre','limite_diario','busca_sem_resultado','busca_origem','cotado','pergunta_calculo',
  'veiculo_salvo','cidade_pendente','doc_convite','doc_lido','doc_salvo','doc_cancelado','doc_ilegivel',
  'doc_imagem_sem_contexto','busca_lista'
]));
