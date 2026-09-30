-- 30/09/2026 — OTP pelo WhatsApp (template de autenticação "modelo01" da
-- Meta) e link mágico do bot pro app. Ver Docs/status-sessao.md 30/09.
--
-- Os dois caminhos terminam na Edge Function `sessao-wa`, que valida
-- (código ou token) e devolve um token_hash de magiclink do Supabase —
-- o app troca por sessão com verifyOtp({ type: 'magiclink' }).

-- Código de 6 dígitos mandado pelo WhatsApp. Um por telefone (o mais
-- novo invalida o anterior), 10 min, 5 tentativas.
create table if not exists public.wa_otp (
  telefone_e164 text primary key,
  codigo_hash   text not null,
  expira_em     timestamptz not null,
  tentativas    int not null default 0,
  criado_em     timestamptz not null default now()
);
alter table public.wa_otp enable row level security;

-- Token de uso único que o bot põe no link do app (?t=...). 24h.
create table if not exists public.wa_login_token (
  token_hash   text primary key,
  motorista_id uuid not null references public.motoristas(id) on delete cascade,
  expira_em    timestamptz not null,
  usado_em     timestamptz,
  criado_em    timestamptz not null default now()
);
alter table public.wa_login_token enable row level security;
create index if not exists wa_login_token_motorista_idx on public.wa_login_token (motorista_id, criado_em desc);

-- Limpeza: tokens e códigos vencidos há mais de 7 dias (pg_cron já existe no projeto).
create or replace function public.limpar_tokens_wa() returns void
language sql security definer set search_path = public as $$
  delete from public.wa_login_token where expira_em < now() - interval '7 days';
  delete from public.wa_otp where expira_em < now() - interval '7 days';
$$;
