-- =====================================================================
-- fretes_publicados: tabela compartilhada de fretes ofertados —
-- alimentada pelo futuro portal de empresas (RODE_DIRETO) e, enquanto
-- esse portal não existe, por inserção manual/admin (MANUAL). O app do
-- motorista ("busca frete") vai ler daqui.
--
-- Decisões desta primeira versão:
--   - company_id fica sem FK por enquanto — a tabela `companies` (portal
--     de empresas) ainda não existe. Quando existir, uma migration futura
--     adiciona a constraint. Até lá, quem oferece o frete é identificado
--     só por texto livre (empresa_nome/contato_nome/contato_telefone),
--     igual ao que já fizemos em analise_frete.
--   - valor guardado em centavos (valor_frete_centavos), mesmo padrão de
--     analise_frete.valor_frete_centavos. `valor_a_combinar` cobre o caso
--     "A combinar" (bem comum no mercado — a amostra da Fretebras trouxe
--     196 de 800 anúncios assim).
--   - tipos_veiculo_aceitos / tipos_carroceria_aceitos são arrays, não
--     um campo só — um mesmo frete pode aceitar mais de um tipo. Ver
--     packages/rode-calc/src/compatibilidadeExterna.ts, que já sabe
--     decompor um campo externo de texto único nesses dois arrays.
--   - RLS: qualquer motorista autenticado pode ler (é vitrine pública de
--     frete). Escrita fica só para service_role por enquanto — não existe
--     login de empresa ainda, então não tem "dono" pra restringir por
--     auth.uid(). Isso muda quando o portal de empresas nascer.
--   - dado_teste: flag pra marcar registros de teste/seed (ex: importados
--     de amostra pública de concorrente pra ter massa de dados) —
--     precisa dar pra identificar e apagar isso depois, sem misturar com
--     frete real de empresa cadastrada.
-- =====================================================================

create table if not exists public.fretes_publicados (
  id uuid primary key default gen_random_uuid(),

  company_id uuid, -- sem FK ainda, ver comentário acima

  empresa_nome text not null,
  contato_nome text,
  contato_telefone text,

  origem_cidade text not null,
  origem_uf text not null,
  destino_cidade text not null,
  destino_uf text not null,

  valor_frete_centavos bigint check (valor_frete_centavos is null or valor_frete_centavos >= 0),
  valor_a_combinar boolean not null default false,

  tipos_veiculo_aceitos text[] not null default '{}',
  tipos_carroceria_aceitos text[] not null default '{}',

  peso_kg numeric check (peso_kg is null or peso_kg >= 0),
  distancia_km numeric(8,1) check (distancia_km is null or distancia_km >= 0),
  data_coleta date,
  pedagio_por_conta_de text check (pedagio_por_conta_de is null or pedagio_por_conta_de in ('empresa', 'motorista')),

  status text not null default 'aberto' check (status in ('aberto', 'negociando', 'fechado', 'expirado')),
  fonte text not null default 'MANUAL' check (fonte in ('RODE_DIRETO', 'MANUAL')),
  dado_teste boolean not null default false,

  observacoes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fretes_publicados_origem_uf_idx on public.fretes_publicados (origem_uf);
create index if not exists fretes_publicados_destino_uf_idx on public.fretes_publicados (destino_uf);
create index if not exists fretes_publicados_status_idx on public.fretes_publicados (status);
create index if not exists fretes_publicados_tipos_veiculo_idx on public.fretes_publicados using gin (tipos_veiculo_aceitos);
create index if not exists fretes_publicados_tipos_carroceria_idx on public.fretes_publicados using gin (tipos_carroceria_aceitos);

alter table public.fretes_publicados enable row level security;

-- Qualquer usuário autenticado (motorista logado) pode ler — é vitrine pública.
create policy "fretes_publicados_select_autenticado"
  on public.fretes_publicados
  for select
  to authenticated
  using (true);

-- Escrita só via service_role por enquanto (não existe login de empresa ainda).
