-- 09/10/2026 — Assinatura "Rode com Lucro PRO" via Stripe (decisão do Raphael).
-- Sem trial. PRO libera: fretes ilimitados na busca, fretes em primeira mão
-- (publicados há menos de PRO_PRIMEIRA_MAO_H), WhatsApp sem limite diário.
-- Preço/nome vivem no Stripe (Price), não aqui. Ver Docs/pagamentos-assinatura.md.
--
-- Uma linha por motorista (upsert pelo webhook do Stripe). Status segue o do
-- Stripe, simplificado: ativa (paga), atrasada (cobrança falhou, em retentativa),
-- cancelada (encerrou), incompleta (checkout aberto, sem pagamento ainda).

create table if not exists public.assinatura (
  motorista_id uuid primary key references auth.users (id) on delete cascade,
  provedor text not null default 'stripe',
  customer_id text,
  subscription_id text unique,
  plano text not null default 'pro',
  status text not null check (status in ('incompleta', 'ativa', 'atrasada', 'cancelada')),
  periodo_fim timestamptz,
  cancelada_em timestamptz,
  ultimo_evento_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assinatura_customer_idx on public.assinatura (customer_id);

-- Eventos do Stripe já processados (idempotência do webhook).
create table if not exists public.stripe_evento (
  id text primary key,
  tipo text not null,
  recebido_em timestamptz not null default now()
);

alter table public.assinatura enable row level security;
alter table public.stripe_evento enable row level security;

-- Motorista lê a própria; só service_role escreve (webhook).
drop policy if exists assinatura_le_propria on public.assinatura;
create policy assinatura_le_propria on public.assinatura
  for select to authenticated using (motorista_id = auth.uid());

-- Admin lê todas (mesmo critério das outras tabelas do painel).
drop policy if exists assinatura_admin_le on public.assinatura;
create policy assinatura_admin_le on public.assinatura
  for select to authenticated using (public.is_admin_ativo());

-- Fonte única da pergunta "é PRO?" — app, bot e RLS usam esta função.
-- Ativa, ou atrasada ainda dentro do período pago (retentativa do Stripe).
create or replace function public.motorista_assinante(p_motorista uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.assinatura a
     where a.motorista_id = p_motorista
       and (a.status = 'ativa' or (a.status = 'atrasada' and a.periodo_fim > now()))
  );
$$;

revoke all on function public.motorista_assinante(uuid) from public;
grant execute on function public.motorista_assinante(uuid) to authenticated, service_role;

-- updated_at automático
create or replace function public.assinatura_touch()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists assinatura_touch on public.assinatura;
create trigger assinatura_touch before update on public.assinatura
  for each row execute function public.assinatura_touch();
