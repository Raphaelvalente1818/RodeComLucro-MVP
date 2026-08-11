-- Marca análises salvas cujo valor veio do modo "A negociar" (frete mínimo
-- calculado pelo motorista pra bater a margem desejada), e não de um valor
-- ofertado pela empresa. Evita confundir estimativa própria com oferta real
-- na tela Resultado e na lista de "Últimas análises" da Garagem.
alter table public.analise_frete
  add column if not exists valor_a_combinar boolean not null default false;

comment on column public.analise_frete.valor_a_combinar is
  'true quando o valor salvo veio do modo "A negociar" (frete mínimo calculado pelo motorista pra bater a margem desejada), não de um valor ofertado pela empresa. Usado pra não confundir estimativa própria com oferta real na tela Resultado / lista de últimas análises.';
