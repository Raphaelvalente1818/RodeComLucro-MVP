-- Campos de CNH no cadastro do motorista (tela "Meu perfil").
-- Sem check de formato: a numeracao da CNH varia (11 digitos e o padrao
-- atual, mas ha registros antigos com menos digitos) - fica livre por
-- ora, igual uf_base. Nao entra na guarda de colunas sensiveis de
-- 0003_identidade_trigger.sql (allowlist implicito: so bloqueia o que
-- esta explicitamente listado la), entao o proprio motorista pode
-- editar via update normal.
alter table public.motoristas
  add column if not exists cnh_numero text,
  add column if not exists cnh_vencimento date;

comment on column public.motoristas.cnh_numero is 'Numero da CNH, informado pelo motorista em Meu perfil. Sem validacao de formato.';
comment on column public.motoristas.cnh_vencimento is 'Data de vencimento da CNH, informada pelo motorista em Meu perfil.';
