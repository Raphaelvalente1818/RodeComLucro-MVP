-- 07/10/2026 — Memória de conversa do bot. Diagnóstico do Raphael: "a IA
-- está vendo ação por ação". Até aqui o Haiku recebia só a mensagem atual +
-- um resumo montado na mão (último cálculo, estados pendentes). Agora cada
-- mensagem recebida e cada resposta enviada ficam em wa_conversa, e as
-- últimas trocas (2 h, até 8 turnos) vão no prompt como <historico>.
-- Só texto: imagens entram como "[foto]"/"[pdf]", botões como "[botão: X]".
create table if not exists public.wa_conversa (
  id bigint generated always as identity primary key,
  from_e164 text not null,
  papel text not null check (papel in ('motorista', 'bot')),
  texto text not null,
  criado_em timestamptz not null default now()
);

create index if not exists wa_conversa_from_criado_idx on public.wa_conversa (from_e164, criado_em desc);

alter table public.wa_conversa enable row level security;
-- Só o service_role (webhook) lê e escreve.

-- Limpeza: 7 dias bastam (o histórico que vai pro prompt é de 2 h).
create or replace function public.limpar_wa_conversa()
returns void language sql security definer set search_path = public as $$
  delete from public.wa_conversa where criado_em < now() - interval '7 days';
$$;

comment on table public.wa_conversa is
  'Últimas mensagens de cada número (motorista e bot) — memória curta pro Haiku. Apagar com limpar_wa_conversa() (7 dias).';
