-- Pedido do Raphael (12/08): capturar a carga máxima do caminhão (em
-- toneladas) no Perfil, pra fechar o ciclo dos fretes cobrados "por
-- tonelada" em fretes_publicados (tipo_valor, ver migração
-- 20260812120000) — sabendo a capacidade do caminhão dá pra estimar o
-- valor TOTAL do frete (taxa/ton × carga máxima), não só a taxa unitária.
alter table public.caminhao_perfil
  add column if not exists carga_maxima_toneladas numeric(6,2) check (carga_maxima_toneladas is null or carga_maxima_toneladas >= 0);

comment on column public.caminhao_perfil.carga_maxima_toneladas is
  'Capacidade máxima de carga do caminhão, em toneladas. Usada para estimar o valor total de fretes com tipo_valor = ''por_tonelada'' (fretes_publicados), multiplicando pela taxa por tonelada. Preenchimento opcional pelo motorista.';
