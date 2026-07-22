-- =====================================================================
-- route-cost — cache de distância por rota (Google Routes API)
--
-- Fase 1, item 1 de Docs/sequencia-construcao.md: Edge Function
-- route-cost usando a API do Google para distância (pedágio continua
-- manual, nenhuma API de pedágio foi escolhida ainda). Esta tabela
-- evita cobrar de novo pela mesma rota — substitui a matriz estática
-- distancias.ts da calculadora original por um cache dinâmico.
-- =====================================================================

create table if not exists public.rota_distancia_cache (
  id uuid primary key default gen_random_uuid(),
  origem_norm text not null,
  destino_norm text not null,
  distancia_km numeric not null,
  duracao_min int,
  provider text not null default 'google_routes',
  criado_em timestamptz not null default now(),
  unique (origem_norm, destino_norm)
);

alter table public.rota_distancia_cache enable row level security;

-- Sem policies para `authenticated`: só a Edge Function route-cost
-- (via service_role, que ignora RLS) lê e escreve esta tabela.
