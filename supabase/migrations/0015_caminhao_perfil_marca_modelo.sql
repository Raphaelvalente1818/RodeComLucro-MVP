-- Marca e modelo do caminhao (Perfil.tsx), usados no autocomplete que
-- preenche consumo de diesel/ARLA de referencia por modelo. Sem check de
-- formato: nao sao chave de nada, so exibicao/preenchimento automatico.
alter table public.caminhao_perfil
  add column if not exists marca text,
  add column if not exists modelo text;

comment on column public.caminhao_perfil.marca is 'Marca do caminhao, selecionada via autocomplete em Perfil.tsx.';
comment on column public.caminhao_perfil.modelo is 'Modelo do caminhao, selecionado via autocomplete filtrado pela marca em Perfil.tsx.';
