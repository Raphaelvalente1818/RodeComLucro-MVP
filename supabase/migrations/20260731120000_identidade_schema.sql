-- Módulo identidade — schema base
-- Fonte: Docs/PRD-tecnico-identidade.html (seções 4 "Modelo de dados" e 9
-- "Segurança & LGPD") e Docs/sequencia-construcao.md (Trilha C, item 1).
--
-- Escopo desta migration: as 7 tabelas do módulo + RLS. NÃO inclui ainda:
--   - trigger on_auth_user_created / custom access token hook (próxima migration)
--   - views de compatibilidade (perfis_motorista/driver_profiles/motorista),
--     que dependem de tabelas de outros módulos (caminhao_perfil) ainda
--     não criadas neste repositório — ficam para quando esses módulos
--     existirem, para não referenciar tabela inexistente.
--
-- Pendência: esta migration ainda não foi aplicada/testada (sem shell
-- disponível na sessão em que foi escrita) — rodar `supabase db push` (ou
-- `supabase migration up` local) e conferir com pgTAP antes de considerar
-- validada.

create extension if not exists pgcrypto;

-- =========================================================================
-- motoristas — tabela canônica do motorista, 1:1 com auth.users
-- =========================================================================
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

comment on table public.motoristas is 'Tabela canônica do motorista (id = auth.users.id). Colunas de confiança (telefone_verificado, canal_wa_ativo, status, ultimo_login_at, telefone_e164/hash) só mudam via service_role — ver trigger BEFORE UPDATE na próxima migration.';

alter table public.motoristas enable row level security;

create policy motoristas_select_own on public.motoristas
  for select using (auth.uid() = id);

-- Update de perfil pelo próprio titular: RLS garante a linha (id = auth.uid());
-- o BEFORE UPDATE trigger (próxima migration) rejeita alteração das colunas
-- de confiança mesmo dentro dessa policy. Column-level grant abaixo já
-- restringe quais colunas o role authenticated pode tentar escrever.
create policy motoristas_update_own on public.motoristas
  for update using (auth.uid() = id) with check (auth.uid() = id);

revoke update on public.motoristas from authenticated;
grant update (nome, uf_base, onboarding_completo_em, meta_alvo_centavos, media_lucro_frete_centavos, updated_at)
  on public.motoristas to authenticated;

-- =========================================================================
-- otp_envio — log de cada solicitação de código (custo, canal, status)
-- =========================================================================
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

create index if not exists otp_envio_telefone_hash_created_at_idx on public.otp_envio (telefone_hash, created_at);
create index if not exists otp_envio_ip_created_at_idx on public.otp_envio (ip, created_at);

comment on table public.otp_envio is 'Tabela interna — sem policy para authenticated. Acesso só via service_role (Edge Function otp-solicitar) e admin.';

alter table public.otp_envio enable row level security;
-- Nenhuma policy para authenticated/anon de propósito: bloqueia todo acesso via API pública, service_role sempre passa.

-- =========================================================================
-- otp_bloqueio — bloqueio progressivo (telefone / ip / global)
-- =========================================================================
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

comment on table public.otp_bloqueio is 'Consultada pelo otp-solicitar ANTES de qualquer chamada ao provedor de SMS/WhatsApp. Upsert incrementando nivel (15min -> 1h -> 24h).';

alter table public.otp_bloqueio enable row level security;
-- Sem policy para authenticated — só service_role.

-- =========================================================================
-- wa_vinculo — prova de posse do número no WhatsApp
-- =========================================================================
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

-- No máximo 1 vínculo pendente por motorista.
create unique index if not exists wa_vinculo_motorista_pendente_uidx
  on public.wa_vinculo (motorista_id) where (status = 'pendente');

alter table public.wa_vinculo enable row level security;

create policy wa_vinculo_select_own on public.wa_vinculo
  for select using (motorista_id = auth.uid());
-- Sem policy de insert/update/delete para authenticated: escrita só via
-- Edge Functions wa-vincular / wa-webhook com service_role.

-- =========================================================================
-- consentimento — append-only, versionado (LGPD)
-- =========================================================================
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

create index if not exists consentimento_motorista_tipo_created_at_idx
  on public.consentimento (motorista_id, tipo, created_at desc);

alter table public.consentimento enable row level security;

create policy consentimento_select_own on public.consentimento
  for select using (motorista_id = auth.uid());

create policy consentimento_insert_own on public.consentimento
  for insert with check (motorista_id = auth.uid());
-- Sem policy de UPDATE/DELETE: revogar consentimento é inserir nova linha com aceito=false.

-- =========================================================================
-- identidade_audit — trilha de auditoria, leitura só admin
-- =========================================================================
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

comment on table public.identidade_audit is 'NUNCA telefone em claro — só telefone_hash. Retenção de 180 dias (expurgo por pg_cron, a configurar). Leitura restrita a app_role=admin (policy adicionada quando o claim admin existir).';

alter table public.identidade_audit enable row level security;
-- Sem policy para authenticated ainda — leitura admin entra quando o
-- custom access token hook (próxima migration) começar a emitir app_role.

-- =========================================================================
-- identidade_config — parâmetros de anti-abuso, ajustáveis sem deploy
-- =========================================================================
create table if not exists public.identidade_config (
  chave text primary key,
  valor text not null,
  updated_at timestamptz not null default now()
);

comment on table public.identidade_config is 'Kill-switch e limites de anti-abuso. Escrita só admin, leitura só service_role.';

alter table public.identidade_config enable row level security;
-- Sem policy para authenticated — só service_role.

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
