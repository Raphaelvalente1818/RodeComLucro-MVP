-- Suporte ao onboarding de motorista novo via WhatsApp compartilhado
-- (estratégia B aprovada, ver Docs/status-sessao.md 08/09 e 10/09):
-- número sem nenhuma conta que manda um pedido de frete completo agora
-- recebe uma estimativa com perfil de caminhão padrão (mesmo
-- PERFIL_CUSTO_DEFAULT já usado pra motorista vinculado sem perfil
-- cadastrado) + CTA de cadastro. Dois status novos pra diferenciar essas
-- consultas anônimas das de motorista de verdade, sem misturar com
-- 'nao_vinculado' (que significa "tem conta, só não linkou o WhatsApp").
alter table public.wa_freight_query drop constraint wa_freight_query_status_check;
alter table public.wa_freight_query add constraint wa_freight_query_status_check
  check (status = any (array[
    'calculado', 'confirmacao_pendente', 'dado_faltando', 'erro_extracao', 'nao_vinculado',
    'calculado_anonimo', 'nao_cadastrado'
  ]));
