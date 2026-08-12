-- A coluna "Valor" da fonte Fretebras trazia texto como "R$ 285,00 (Por
-- tonelada)" — na importação original (20260811150000) só o número foi
-- extraído, descartando a unidade. Resultado: 499 dos 800 fretes de teste
-- ficaram gravados como se o valor fosse o total do frete, quando na
-- verdade é uma taxa por tonelada (achado ao investigar uma pergunta do
-- Raphael sobre onde ficava essa distinção). Esta migração adiciona a
-- coluna que faltava; os dados são corrigidos numa reimportação separada
-- (execute_sql, não versionado — mesmo padrão do seed original).
alter table public.fretes_publicados
  add column if not exists tipo_valor text check (tipo_valor is null or tipo_valor in ('fixo', 'por_tonelada'));

comment on column public.fretes_publicados.tipo_valor is
  'Unidade do valor_frete_centavos quando valor_a_combinar = false: "fixo" (valor total do frete) ou "por_tonelada" (taxa por tonelada, não o total — a fonte não informa peso da carga, então não dá pra calcular o total automaticamente). Null quando valor_a_combinar = true.';
