-- =====================================================================
-- route-cost — pedágio estimado via Google Routes (extraComputations=TOLLS)
--
-- Adiciona a coluna de pedágio ao cache de distância. Cobertura de
-- pedágio da Routes API não é garantida pra rodovias brasileiras (doc
-- do Google só promete "cidades selecionadas") — a coluna fica nula
-- quando a API não retorna preço, e o app mantém o campo manual de
-- pedágio como fallback (ver Docs/sequencia-construcao.md, Fase 1).
-- =====================================================================

alter table public.rota_distancia_cache
  add column if not exists pedagio_centavos bigint;
