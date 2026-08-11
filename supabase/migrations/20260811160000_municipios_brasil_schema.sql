-- =====================================================================
-- municipios_brasil: tabela de referência geográfica (lat/lng) dos
-- municípios brasileiros, usada pela busca de frete por raio no app do
-- motorista: o motorista digita a cidade onde está, escolhe um raio em
-- km, e o app calcula a distância em linha reta entre essa cidade e a
-- origem de cada frete disponível (ver `fretes_publicados.origem_lat`/
-- `origem_lng`, migration seguinte).
--
-- Decisão confirmada com o Raphael: distância em linha reta (haversine),
-- sem chamar API paga por busca — cálculo feito no cliente/servidor a
-- partir das coordenadas guardadas aqui.
--
-- Fonte do dado: CSV público `municipios.csv` do repositório
-- github.com/kelvins/Municipios-Brasileiros (dado do IBGE, mantido pela
-- comunidade), ~5571 municípios (5570 municípios + Distrito Federal).
--
-- `nome_norm`: nome do município normalizado (minúsculo, sem acento —
-- mesmo espírito de normalização usado em
-- packages/rode-calc/src/compatibilidadeExterna.ts), pra permitir bater
-- com `fretes_publicados.origem_cidade`/texto livre digitado pelo
-- motorista sem depender de acentuação/caixa exata.
-- =====================================================================

create table if not exists public.municipios_brasil (
  id bigserial primary key,
  nome text not null,
  nome_norm text not null,
  uf text not null,
  latitude numeric not null,
  longitude numeric not null
);

create index if not exists municipios_brasil_nome_norm_uf_idx on public.municipios_brasil (nome_norm, uf);
create index if not exists municipios_brasil_nome_norm_idx on public.municipios_brasil (nome_norm);

alter table public.municipios_brasil enable row level security;

-- Tabela de referência geográfica, sem dado sensível — qualquer usuário
-- autenticado (motorista logado) pode ler, mesmo padrão de
-- fretes_publicados_select_autenticado.
create policy "municipios_brasil_select_autenticado"
  on public.municipios_brasil
  for select
  to authenticated
  using (true);
