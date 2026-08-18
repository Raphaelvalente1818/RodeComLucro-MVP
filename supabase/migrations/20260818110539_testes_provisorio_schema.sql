-- =====================================================================
-- testes_provisorio — tabela TEMPORÁRIA pra registrar o que precisa ser
-- testado no MVP (Tela, Funcionalidade, Obs para o teste) e, depois, o
-- resultado de quem testou (Resultado do Teste, Observação do teste,
-- Aprovado). Mesmo espírito do backlog_provisorio: mural comum entre os
-- sócios testando o app, sem vínculo com o produto final — dropar esta
-- tabela (e esta migration) quando os testes acabarem.
-- Ver também: apps/web/src/lib/testes.ts e
-- apps/web/src/components/TestesModal.tsx (mesma marcação "PROVISÓRIO").
-- =====================================================================

create table if not exists public.testes_provisorio (
  id uuid primary key default gen_random_uuid(),
  -- Cadastro do que precisa ser testado.
  tela text not null,
  funcionalidade text not null,
  obs_para_teste text,
  nome_cadastro text not null,
  -- Preenchido depois, por quem executou o teste. aprovado = null enquanto
  -- pendente; true/false só depois de testado (reprovado não é erro do
  -- sistema, é um resultado válido — indica ponto a melhorar).
  resultado_teste text,
  observacao_teste text,
  aprovado boolean,
  nome_teste text,
  testado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists testes_provisorio_pendentes_idx
  on public.testes_provisorio ((aprovado is null), created_at desc);

alter table public.testes_provisorio enable row level security;

-- Compartilhada entre todos os motoristas autenticados (os sócios testando)
-- — mural comum, igual ao backlog_provisorio.
create policy testes_provisorio_select_all on public.testes_provisorio
  for select to authenticated using (true);
create policy testes_provisorio_insert_all on public.testes_provisorio
  for insert to authenticated with check (true);
create policy testes_provisorio_update_all on public.testes_provisorio
  for update to authenticated using (true) with check (true);
create policy testes_provisorio_delete_all on public.testes_provisorio
  for delete to authenticated using (true);
