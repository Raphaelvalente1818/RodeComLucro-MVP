-- =====================================================================
-- calc-app — schema (Fase 1, item 2 de Docs/sequencia-construcao.md)
--
-- Versão enxuta: sem route_cache/antt_piso_tabela/diesel_regiao/cost_defaults
-- versionados no banco (decisão registrada em sequencia-construcao.md,
-- 2026-07-17 e reafirmada na sessão de hoje) — o piso ANTT é calculado
-- 100% no cliente via packages/rode-calc/src/pisoANTT.ts, sem tabela
-- separada. Se algum dia precisar versionar por vigência, isso vira uma
-- migration nova, sem quebrar o que já existe.
-- =====================================================================

create table if not exists public.caminhao_perfil (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  apelido text,
  numero_eixos int not null default 5 check (numero_eixos between 2 and 9),
  diesel_km_por_lt numeric(5,2) not null default 2.5 check (diesel_km_por_lt > 0),
  diesel_preco_por_litro numeric(6,3) not null default 6.10 check (diesel_preco_por_litro >= 0),
  arla_km_por_lt numeric(6,2) not null default 20 check (arla_km_por_lt > 0),
  arla_preco_por_litro numeric(6,3) not null default 4.50 check (arla_preco_por_litro >= 0),
  manutencao_por_km numeric(6,3) not null default 0.35 check (manutencao_por_km >= 0),
  pneus_por_km numeric(6,3) not null default 0.12 check (pneus_por_km >= 0),
  depreciacao_por_km numeric(6,3) not null default 0.25 check (depreciacao_por_km >= 0),
  alimentacao_dia numeric(8,2) not null default 90 check (alimentacao_dia >= 0),
  pernoite_dia numeric(8,2) not null default 0 check (pernoite_dia >= 0),
  estacionamento_padrao numeric(8,2) not null default 0 check (estacionamento_padrao >= 0),
  chapa_padrao numeric(8,2) not null default 0 check (chapa_padrao >= 0),
  margem_desejada numeric(4,1) not null default 20 check (margem_desejada between 0 and 100),
  uf_base char(2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists caminhao_perfil_user_uidx on public.caminhao_perfil (user_id);

alter table public.caminhao_perfil enable row level security;

create policy caminhao_perfil_select_own on public.caminhao_perfil
  for select to authenticated using (user_id = auth.uid());
create policy caminhao_perfil_insert_own on public.caminhao_perfil
  for insert to authenticated with check (user_id = auth.uid());
create policy caminhao_perfil_update_own on public.caminhao_perfil
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy caminhao_perfil_delete_own on public.caminhao_perfil
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- analise_frete
--
-- id é gerado no CLIENTE (uuid) desde a v1, mesmo sem offline-first
-- ainda — o app já grava via upsert por id. Isso significa que, quando
-- a fila de sync com IndexedDB entrar (fase posterior), o contrato de
-- idempotência já está pronto, sem precisar mudar essa tabela.
-- ---------------------------------------------------------------------
create table if not exists public.analise_frete (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  caminhao_perfil_id uuid references public.caminhao_perfil(id) on delete set null,
  origem text not null,
  destino text not null,
  distancia_km numeric(8,1) not null check (distancia_km >= 0),
  distancia_estimada boolean not null default false,
  volta_vazia boolean not null default false,
  valor_frete_centavos bigint not null check (valor_frete_centavos >= 0),
  margem_desejada numeric(4,1) not null,
  numero_eixos int,
  custos_snapshot jsonb not null,
  resultado_snapshot jsonb not null,
  veredicto text not null check (veredicto in ('BOM','ACEITÁVEL','RUIM')),
  formula_versao text not null,
  created_at timestamptz not null default now()
);

create index if not exists analise_frete_user_created_idx
  on public.analise_frete (user_id, created_at desc);

alter table public.analise_frete enable row level security;

create policy analise_frete_select_own on public.analise_frete
  for select to authenticated using (user_id = auth.uid());
create policy analise_frete_insert_own on public.analise_frete
  for insert to authenticated with check (user_id = auth.uid());
create policy analise_frete_update_own on public.analise_frete
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy analise_frete_delete_own on public.analise_frete
  for delete to authenticated using (user_id = auth.uid());
