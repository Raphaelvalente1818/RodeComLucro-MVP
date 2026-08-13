-- Fecha um TODO em aberto desde a Fase 0 (ver pisoANTT.ts): o PRD calc-app
-- desenha uma tabela `antt_piso_tabela` versionada no banco (por vigência +
-- tipo_carga), pra consulta por outras partes do sistema (admin, portal)
-- sem precisar publicar uma versão nova do pacote @rode/calc a cada
-- reajuste. O motor de cálculo em si (`@rode/calc`) continua puro — não
-- consulta este banco em runtime, lê sempre das constantes em memória em
-- pisoANTT.ts. Esta tabela é só o espelho versionado dos mesmos valores.
--
-- Valores conferidos direto no texto oficial (anttlegis.antt.gov.br),
-- Resolução ANTT Nº 6.084/2026, Anexo II, "TABELA A - TRANSPORTE
-- RODOVIÁRIO DE CARGA LOTAÇÃO", linhas 1-5 (carga geral + os 4 tipos que
-- faltavam: granel sólido, granel líquido, frigorificada/aquecida,
-- conteinerizada). Não inclui as variações "perigosa"/"neogranel"/
-- "pressurizada" nem as Tabelas B/C/D (só veículo automotor, alto
-- desempenho) — fora do escopo do app hoje, mesmo critério já usado pra
-- decidir o que entrar nas constantes do pacote.

create table if not exists public.antt_piso_tabela (
  id uuid primary key default gen_random_uuid(),
  tipo_carga text not null check (tipo_carga in ('carga_geral', 'granel_solido', 'granel_liquido', 'frigorificada', 'conteinerizada')),
  numero_eixos int not null check (numero_eixos > 0),
  ccd numeric(10,4) not null check (ccd >= 0),
  cc numeric(10,2) not null check (cc >= 0),
  versao text not null,
  fonte text not null,
  vigencia_inicio date not null,
  created_at timestamptz not null default now(),
  unique (tipo_carga, numero_eixos, versao)
);

comment on table public.antt_piso_tabela is
  'Espelho versionado dos coeficientes de piso mínimo ANTT (Tabela A, carga lotação) por tipo_carga e número de eixos. Fonte de verdade em runtime continua sendo packages/rode-calc/src/pisoANTT.ts (motor não depende de banco) — esta tabela é para consulta por outras partes do sistema (admin, portal) sem precisar publicar nova versão do pacote a cada reajuste.';

alter table public.antt_piso_tabela enable row level security;

create policy "antt_piso_tabela_select_authenticated"
  on public.antt_piso_tabela for select
  to authenticated
  using (true);

insert into public.antt_piso_tabela (tipo_carga, numero_eixos, ccd, cc, versao, fonte, vigencia_inicio) values
  ('carga_geral', 2, 3.9826, 451.84, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('carga_geral', 3, 5.0977, 541.86, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('carga_geral', 4, 5.7822, 588.86, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('carga_geral', 5, 6.6718, 657.56, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('carga_geral', 6, 7.3547, 671.93, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('carga_geral', 7, 8.0927, 831.66, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('carga_geral', 9, 9.2027, 903.32, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),

  ('granel_solido', 2, 4.0144, 460.59, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('granel_solido', 3, 5.1355, 552.24, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('granel_solido', 4, 5.8118, 597.00, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('granel_solido', 5, 6.6983, 664.83, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('granel_solido', 6, 7.3841, 680.01, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('granel_solido', 7, 8.0516, 820.34, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('granel_solido', 9, 9.2231, 908.91, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),

  ('granel_liquido', 2, 4.0884, 471.98, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('granel_liquido', 3, 5.2311, 569.57, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('granel_liquido', 4, 5.9661, 621.52, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('granel_liquido', 5, 6.8661, 693.08, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('granel_liquido', 6, 7.5572, 709.72, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('granel_liquido', 7, 8.1900, 840.50, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('granel_liquido', 9, 9.3822, 934.76, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),

  ('frigorificada', 2, 4.7095, 520.07, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('frigorificada', 3, 6.0159, 623.27, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('frigorificada', 4, 6.8646, 686.63, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('frigorificada', 5, 7.8666, 757.98, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('frigorificada', 6, 8.6661, 772.35, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('frigorificada', 7, 9.5884, 982.76, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('frigorificada', 9, 10.8870, 1067.06, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),

  -- Conteinerizada: sem entrada pra 2 eixos (a tabela oficial não define coeficiente pra esse caso).
  ('conteinerizada', 3, 5.1082, 544.75, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('conteinerizada', 4, 5.7396, 577.15, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('conteinerizada', 5, 6.6345, 647.29, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('conteinerizada', 6, 7.3186, 662.01, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('conteinerizada', 7, 8.0492, 819.69, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17'),
  ('conteinerizada', 9, 9.1399, 886.05, 'resolucao-6084-2026', 'Resolução ANTT Nº 6.084/2026, Anexo II, Tabela A', '2026-07-17')
on conflict (tipo_carga, numero_eixos, versao) do nothing;
