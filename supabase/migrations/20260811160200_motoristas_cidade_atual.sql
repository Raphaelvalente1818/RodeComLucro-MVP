-- =====================================================================
-- motoristas: campos de "onde o motorista está agora"
-- (cidade_atual/uf_atual + lat/lng correspondentes), pra alimentar o
-- outro lado da busca de frete por raio: o motorista digita/seleciona a
-- cidade onde está, e o app usa cidade_atual_lat/cidade_atual_lng pra
-- calcular distância em linha reta até a origem de cada frete
-- (fretes_publicados.origem_lat/origem_lng, migration anterior).
--
-- cidade_atual/uf_atual ficam como texto livre (mesmo padrão de
-- origem_cidade/origem_uf em fretes_publicados) — a tela que vier a
-- preencher isso decide se usa autocomplete contra `municipios_brasil`
-- ou texto livre + geocodificação posterior via UPDATE, igual ao que
-- fizemos agora pra fretes_publicados. Não confundir com `uf_base`
-- (já existente em motoristas) — uf_base é a UF onde o motorista mora/
-- é baseado, cidade_atual é onde ele está fisicamente agora (muda a
-- cada viagem).
-- =====================================================================

alter table public.motoristas
  add column if not exists cidade_atual text,
  add column if not exists uf_atual text,
  add column if not exists cidade_atual_lat numeric,
  add column if not exists cidade_atual_lng numeric;
