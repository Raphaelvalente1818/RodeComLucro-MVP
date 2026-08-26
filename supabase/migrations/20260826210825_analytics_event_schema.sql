-- Instrumentação de eventos pro futuro painel admin (Docs/PRD-tecnico-admin.html).
-- Versão MVP simplificada em relação ao PRD: sem particionamento por mês, sem
-- journey_definition/rollups ainda (isso entra quando o admin de verdade for
-- construído) — só a camada de captura, que precisa rodar desde já pra ter
-- histórico quando o resto vier.
create table if not exists public.analytics_event (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  actor_id uuid references auth.users(id) on delete set null,
  source text not null default 'app' check (source in ('app', 'whatsapp')),
  props jsonb not null default '{}'::jsonb,
  idempotency_key text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists analytics_event_idempotency_uidx
  on public.analytics_event (idempotency_key)
  where idempotency_key is not null;

create index if not exists analytics_event_name_occurred_idx
  on public.analytics_event (event_name, occurred_at desc);

create index if not exists analytics_event_actor_occurred_idx
  on public.analytics_event (actor_id, occurred_at desc);

alter table public.analytics_event enable row level security;

-- Mesmo padrão de caminhao_perfil/analise_frete (0008_calc_app_schema.sql):
-- usuário só grava evento em nome de si mesmo. Sem policy de select/update/delete
-- pra authenticated -- só service_role lê (mesmo padrão de wa_mensagem_recebida/
-- wa_freight_query/identidade_audit), porque quem consome isso é o painel admin
-- (via Edge Function com service role), não o próprio app.
create policy analytics_event_insert_own on public.analytics_event
  for insert to authenticated
  with check (actor_id = auth.uid());
