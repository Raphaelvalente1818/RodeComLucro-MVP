-- Suporte a integracao com a Tabela FIPE (marca -> modelo -> ano) no
-- Perfil do caminhao: guarda os codigos FIPE selecionados (pra lembrar
-- a selecao exata na proxima vez) e o km rodado por ano, necessario pra
-- converter a depreciacao anual (diferenca de valor FIPE entre o ano
-- escolhido e o ano anterior do mesmo modelo) em R$/km.
alter table public.caminhao_perfil
  add column if not exists fipe_codigo_marca text,
  add column if not exists fipe_codigo_modelo text,
  add column if not exists fipe_codigo_ano text,
  add column if not exists km_rodados_ano numeric check (km_rodados_ano is null or km_rodados_ano > 0);

comment on column public.caminhao_perfil.fipe_codigo_marca is 'Codigo da marca na Tabela FIPE, para re-consultar valor/depreciacao sem o motorista escolher de novo.';
comment on column public.caminhao_perfil.fipe_codigo_modelo is 'Codigo do modelo na Tabela FIPE (dentro da marca).';
comment on column public.caminhao_perfil.fipe_codigo_ano is 'Codigo do ano/combustivel na Tabela FIPE (dentro do modelo).';
comment on column public.caminhao_perfil.km_rodados_ano is 'Km rodados por ano, usado para converter depreciacao anual (FIPE) em R$/km.';

-- ---------------------------------------------------------------------
-- Cache das respostas da Tabela FIPE (via parallelum.com.br/fipe/api),
-- consumido só pela Edge Function fipe-caminhao (service_role). A FIPE
-- atualiza mensalmente (mesReferencia), então o cache vale por 30 dias
-- sem re-consultar. RLS habilitada sem policy pública: só service_role
-- (que ignora RLS) lê/escreve; o cliente nunca acessa esta tabela direto.
-- ---------------------------------------------------------------------
create table if not exists public.fipe_cache (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  acao text not null check (acao in ('marcas','modelos','anos','valor')),
  codigo_marca text,
  codigo_modelo text,
  codigo_ano text,
  resposta jsonb not null,
  criado_em timestamptz not null default now()
);

alter table public.fipe_cache enable row level security;

create index if not exists fipe_cache_criado_em_idx on public.fipe_cache (criado_em);
