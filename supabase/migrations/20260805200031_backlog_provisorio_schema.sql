-- =====================================================================
-- backlog_provisorio — tabela TEMPORÁRIA para os 4 sócios registrarem
-- bugs/sugestões durante os testes do MVP. Sem vínculo com o produto
-- final: dropar esta tabela (e esta migration) quando o teste acabar.
-- Ver também: apps/web/src/lib/backlog.ts e
-- apps/web/src/components/BacklogModal.tsx (mesma marcação "PROVISÓRIO").
-- =====================================================================

create table if not exists public.backlog_provisorio (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  pagina text not null,
  problema_sugestao text not null,
  observacao text,
  status text not null default 'aberto' check (status in ('aberto', 'feito')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists backlog_provisorio_status_created_idx
  on public.backlog_provisorio (status, created_at desc);

alter table public.backlog_provisorio enable row level security;

-- Compartilhada entre todos os motoristas autenticados (os 4 sócios) —
-- não é "por usuário" como as outras tabelas, é um mural comum.
create policy backlog_provisorio_select_all on public.backlog_provisorio
  for select to authenticated using (true);
create policy backlog_provisorio_insert_all on public.backlog_provisorio
  for insert to authenticated with check (true);
create policy backlog_provisorio_update_all on public.backlog_provisorio
  for update to authenticated using (true) with check (true);
create policy backlog_provisorio_delete_all on public.backlog_provisorio
  for delete to authenticated using (true);
