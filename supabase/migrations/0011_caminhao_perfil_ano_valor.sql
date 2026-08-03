-- =====================================================================
-- calc-app — adiciona ano e valor do caminhão ao perfil
-- =====================================================================

alter table public.caminhao_perfil
  add column if not exists ano int check (ano between 1970 and 2100),
  add column if not exists valor_caminhao numeric(10,2) check (valor_caminhao >= 0);
