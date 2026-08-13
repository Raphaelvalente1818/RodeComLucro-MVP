-- Pedido do Raphael (12/08): campo "Próxima troca de óleo" no Perfil do
-- caminhão, pra alertar o motorista na Garagem uma semana antes de
-- vencer — mesmo padrão de alerta já usado pra CNH/exame toxicológico
-- (motoristas.cnh_vencimento/exame_toxicologico_vencimento), mas por
-- caminhão (caminhao_perfil), não por motorista.
alter table public.caminhao_perfil
  add column if not exists proxima_troca_oleo date;

comment on column public.caminhao_perfil.proxima_troca_oleo is
  'Data prevista da próxima troca de óleo do caminhão. Usada para alertar o motorista na Garagem uma semana antes de vencer. Preenchimento opcional.';
