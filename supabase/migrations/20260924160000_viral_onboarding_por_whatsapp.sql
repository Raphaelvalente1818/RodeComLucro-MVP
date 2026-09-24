-- Fase 1 da estratégia viral (Docs/estrategia-viral-whatsapp.md, 24/09):
-- "o número já é o cadastro". Número desconhecido que manda mensagem vira
-- conta na hora (auth.admin.createUser no wa-webhook), e o perfil do
-- caminhão é colhido por botões no chat, em 3 toques.

-- De onde veio o motorista: código de indicação (#NOME no wa.me?text=)
-- ou 'contato' (chegou pelo cartão de contato / número salvo, sem código).
alter table public.motoristas
  add column if not exists origem_cadastro text,
  add column if not exists indicado_por_codigo text;

comment on column public.motoristas.origem_cadastro is
  'app (fluxo OTP no site) | whatsapp (conta criada na 1a mensagem, ver wa-webhook)';
comment on column public.motoristas.indicado_por_codigo is
  'Código que veio no texto da 1a mensagem (#EMERSON) — atribuição da indicação. Null se chegou sem código.';

-- Código de indicação de cada motorista (o que ele compartilha). Gerado a
-- partir do primeiro nome; único.
alter table public.motoristas
  add column if not exists codigo_indicacao text unique;

-- Estado do onboarding por chat: uma linha por número, apagada ao concluir.
create table if not exists public.wa_onboarding (
  from_e164 text primary key,
  motorista_id uuid not null references public.motoristas(id) on delete cascade,
  etapa text not null check (etapa in ('tipo', 'eixos', 'consumo')),
  tipo_veiculo text,
  numero_eixos integer,
  -- último frete calculado, pra recalcular com o caminhão real no fim
  ultimo_frete jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wa_onboarding enable row level security;
-- só o service role (wa-webhook) mexe aqui; nenhuma policy pra authenticated.

-- Novos status de auditoria em wa_freight_query
alter table public.wa_freight_query drop constraint if exists wa_freight_query_status_check;
alter table public.wa_freight_query add constraint wa_freight_query_status_check
  check (status in ('calculado','confirmacao_pendente','dado_faltando','erro_extracao','nao_vinculado',
                    'calculado_anonimo','nao_cadastrado','calculado_novo','boas_vindas','onboarding_resposta','recalculado_perfil','sair'));

-- Índice pra atribuição de indicação no admin
create index if not exists motoristas_indicado_por_codigo_idx on public.motoristas (indicado_por_codigo) where indicado_por_codigo is not null;
