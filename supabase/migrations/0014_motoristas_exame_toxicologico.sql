-- Validade do exame toxicologico no cadastro do motorista (tela "Meu perfil"),
-- mesmo padrao do vencimento da CNH: so leitura/edicao pelo proprio
-- motorista, nao entra na guarda de colunas sensiveis de 0003.
alter table public.motoristas
  add column if not exists exame_toxicologico_vencimento date;

comment on column public.motoristas.exame_toxicologico_vencimento is 'Data de validade do exame toxicologico, informada pelo motorista em Meu perfil.';
