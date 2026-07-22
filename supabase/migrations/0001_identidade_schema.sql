-- =====================================================================
-- Módulo identidade — schema base
-- Tabelas: motoristas, consentimento, otp_envio, otp_bloqueio,
--          wa_vinculo, identidade_audit, identidade_config
-- Ref: Docs/PRD-tecnico-identidade.html, Docs/sequencia-construcao.md
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- motoristas
-- ---------------------------------------------------------------------
create table if not exists public.motoristas (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  telefone_e164 text not null unique check (telefone_e164 ~ '^55[1-9][0-9]{9,10}$'),
  telefone_hash text not null,
  telefone_verificado boolean not null default false,
  telefone_verificado_em timestamptz,
  canal_wa_ativo boolean not null default false,
  uf_base char(2),
  onboarding_completo_em timestamptz,
  meta_alvo_centavos bigint,
  media_lucro_frete_centavos bigint,
  status text not null default 'ativa' check (status in ('ativa','quarentena','arquivada')),
  ultimo_login_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists motoristas_telefone_hash_idx on public.motoristas (telefone_hash);
create index if not exists motoristas_status_ultimo_login_idx on public.motoristas (status, ultimo_login_at);

-- ---------------------------------------------------------------------
-- consentimento (append-only)
-- ---------------------------------------------------------------------
create table if not exists public.consentimento (
  id uuid primary key default gen_random_uuid(),
  motorista_id uuid not null references public.motoristas(id),
  tipo text not null check (tipo in ('termos_uso','politica_privacidade','persistencia_historico','canal_whatsapp')),
  versao text not null,
  aceito boolean not null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists consentimento_motorista_tipo_created_idx
  on public.consentimento (motorista_id, tipo, created_at desc);

-- ---------------------------------------------------------------------
-- otp_envio
-- ---------------------------------------------------------------------
create table if not exists public.otp_envio (
  id uuid primary key default gen_random_uuid(),
  telefone_hash text not null,
  ip inet not null,
  canal text not null check (canal in ('sms','whatsapp')),
  provider text,
  custo_estimado_centavos int not null default 0,
  status text not null check (status in ('enviado','falha','bloqueado')),
  motivo_bloqueio text,
  convertido_login boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists otp_envio_telefone_created_idx on public.otp_envio (telefone_hash, created_at);
create index if not exists otp_envio_ip_created_idx on public.otp_envio (ip, created_at);

-- ---------------------------------------------------------------------
-- otp_bloqueio
-- ---------------------------------------------------------------------
create table if not exists public.otp_bloqueio (
  id uuid primary key default gen_random_uuid(),
  escopo text not null check (escopo in ('telefone','ip','global')),
  chave text not null,
  nivel int not null default 1 check (nivel between 1 and 3),
  bloqueado_ate timestamptz not null,
  motivo text not null,
  created_at timestamptz not null default now(),
  unique (escopo, chave)
);

-- ---------------------------------------------------------------------
-- wa_vinculo
-- ---------------------------------------------------------------------
create table if not exists public.wa_vinculo (
  id uuid primary key default gen_random_uuid(),
  motorista_id uuid not null references public.motoristas(id) on delete cascade,
  codigo_hash text not null,
  expira_em timestamptz not null,
  status text not null default 'pendente' check (status in ('pendente','verificado','expirado','revogado')),
  verificado_em timestamptz,
  wa_message_id text,
  tentativas int not null default 0 check (tentativas <= 5),
  created_at timestamptz not null default now()
);

-- no máximo 1 vínculo pendente por motorista
create unique index if not exists wa_vinculo_motorista_pendente_uidx
  on public.wa_vinculo (motorista_id) where (status = 'pendente');

-- ---------------------------------------------------------------------
-- identidade_audit
-- ---------------------------------------------------------------------
create table if not exists public.identidade_audit (
  id uuid primary key default gen_random_uuid(),
  motorista_id uuid,
  evento text not null check (evento in (
    'otp_solicitado','otp_bloqueado','login_ok','login_falha',
    'wa_vinculado','wa_desvinculado','troca_numero',
    'quarentena_desafio_ok','quarentena_desafio_falha',
    'conta_arquivada','conta_excluida'
  )),
  telefone_hash text,
  ip inet,
  detalhe jsonb,
  created_at timestamptz not null default now()
);

create index if not exists identidade_audit_created_idx on public.identidade_audit (created_at);
create index if not exists identidade_audit_motorista_idx on public.identidade_audit (motorista_id);

-- ---------------------------------------------------------------------
-- identidade_config (kill-switch / parâmetros anti-abuso)
-- ---------------------------------------------------------------------
create table if not exists public.identidade_config (
  chave text primary key,
  valor text not null,
  updated_at timestamptz not null default now()
);

insert into public.identidade_config (chave, valor) values
  ('otp_canal_ativo', 'true'),
  ('teto_sms_dia', '500'),
  ('limite_telefone_15min', '3'),
  ('limite_telefone_24h', '5'),
  ('limite_ip_hora', '10'),
  ('limite_ip_24h', '20'),
  ('otp_expiry_s', '300'),
  ('quarentena_dias', '180')
on conflict (chave) do nothing;
