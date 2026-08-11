-- =====================================================================
-- fretes_publicados: colunas de geolocalização da origem
-- (origem_lat/origem_lng), pra viabilizar a busca de frete por raio no
-- app do motorista (motorista digita a cidade onde está, escolhe um
-- raio em km, o app calcula distância em linha reta até a origem de
-- cada frete). Ver `municipios_brasil` (migration anterior), fonte das
-- coordenadas.
--
-- Nesta migration só entra o schema (colunas nullable). O preenchimento
-- (UPDATE fazendo join por cidade normalizada + UF contra
-- municipios_brasil) é feito à parte, direto via execute_sql — é carga
-- de dado, não schema, mesmo padrão já usado pro seed de
-- fretes_publicados.
-- =====================================================================

alter table public.fretes_publicados
  add column if not exists origem_lat numeric,
  add column if not exists origem_lng numeric;
