-- Amplia a "UF base" (só sigla) do cadastro do motorista pra "cidade base"
-- completa (nome + UF + lat/lng), mesmo padrão de nomenclatura já usado por
-- cidade_atual/uf_atual/cidade_atual_lat/cidade_atual_lng (migration
-- 20260811160200_motoristas_cidade_atual.sql) -- só que aqui é o endereço
-- de base do motorista (onde mora), não onde ele está agora. uf_base
-- (char(2), já existe desde 0001_identidade_schema.sql) continua sendo
-- gravada em conjunto, pra não quebrar quem já lê só ela hoje (ex.:
-- Garagem.tsx).
alter table public.motoristas
  add column if not exists cidade_base text,
  add column if not exists cidade_base_lat numeric,
  add column if not exists cidade_base_lng numeric;
