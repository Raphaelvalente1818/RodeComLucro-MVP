-- Tela "Importar fretes" (painel admin): fretes_publicados só tinha
-- policy de SELECT — nenhum authenticated conseguia inserir linha
-- nenhuma. Libera INSERT só pra quem é admin ativo (mesma função
-- is_admin_ativo() de 20260908120000, que já bypassa RLS por dentro e
-- não recursiona).
create policy fretes_publicados_insert_admin
  on public.fretes_publicados for insert
  to authenticated
  with check (public.is_admin_ativo());
