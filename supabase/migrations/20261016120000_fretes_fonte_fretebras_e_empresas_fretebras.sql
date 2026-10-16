-- Base nova de fretes (16/10/2026): planilha fretes16outubro.xlsx com 13.145
-- anúncios de 2.402 empresas (Fretebras, 12–16/10). Substitui os 813 de agosto.
--
-- 1) fonte 'FRETEBRAS' + rastreio do anúncio original (link e data) — base do
--    robô de 3 h do plano (passo 10): o robô vai comparar por fonte_url.
-- 2) empresas_fretebras: as empresas que anunciam lá, com "ativa há" — é a
--    lista "aceita na Fretebras" da decisão D4 (entrada segura do embarcador).

alter table public.fretes_publicados
  drop constraint if exists fretes_publicados_fonte_check;
alter table public.fretes_publicados
  add constraint fretes_publicados_fonte_check
  check (fonte = any (array['RODE_DIRETO','MANUAL','EMPRESA','FRETEBRAS']));

alter table public.fretes_publicados
  add column if not exists fonte_url text,
  add column if not exists anunciado_em timestamptz,
  add column if not exists carga text,
  add column if not exists especie text;

create unique index if not exists fretes_publicados_fonte_url_idx
  on public.fretes_publicados (fonte_url) where fonte_url is not null;
create index if not exists fretes_publicados_anunciado_em_idx
  on public.fretes_publicados (anunciado_em desc);

comment on column public.fretes_publicados.fonte_url is 'Link do anúncio na fonte externa (Fretebras). Único: o robô usa pra saber se o frete já existe.';
comment on column public.fretes_publicados.anunciado_em is 'Data/hora do anúncio na fonte. Null = desconhecida.';
comment on column public.fretes_publicados.carga is 'Produto anunciado (ex.: MILHO, DDGS) — texto livre da fonte.';
comment on column public.fretes_publicados.especie is 'Espécie da carga na fonte (Granel, Pallet, Big Bag, Saco, Caixa...).';

create table if not exists public.empresas_fretebras (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativa_ha text,
  whatsapp text,
  celular text,
  contato_nome text,
  qtd_fretes int not null default 0,
  primeiro_anuncio timestamptz,
  ultimo_anuncio timestamptz,
  importado_em timestamptz not null default now()
);
comment on table public.empresas_fretebras is 'Empresas que anunciam na Fretebras (decisão D4, 15/10): sinal de confiança na moderação da Sofrete. Carregada da planilha de 16/10; o robô atualiza.';
alter table public.empresas_fretebras enable row level security;
create policy "empresas_fretebras_admin_select" on public.empresas_fretebras
  for select to authenticated using (public.is_admin_ativo());

-- Apaga a base antiga (809 importados de agosto; pedido do Raphael em 16/10, sem backup).
-- Os 4 fretes publicados pelo portal (fonte EMPRESA) ficam.
delete from public.fretes_publicados where fonte = 'MANUAL';
