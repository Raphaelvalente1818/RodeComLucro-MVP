-- Painel admin, telas Motoristas/Consultas WhatsApp/Administradores:
-- faltava RLS de leitura pra quem tem admin_user ativo. Sem isso, mesmo
-- o David/Emerson logados como admin não conseguiriam ver a lista de
-- motoristas (só a própria linha), nem wa_freight_query (RLS ligada sem
-- nenhuma policy = bloqueia geral), nem os outros admins em admin_user
-- (só a própria linha também).
create policy motoristas_select_admin
  on public.motoristas for select
  to authenticated
  using (exists (select 1 from public.admin_user au where au.user_id = auth.uid() and au.ativo));

create policy wa_freight_query_select_admin
  on public.wa_freight_query for select
  to authenticated
  using (exists (select 1 from public.admin_user au where au.user_id = auth.uid() and au.ativo));

create policy admin_user_select_admin
  on public.admin_user for select
  to authenticated
  using (exists (select 1 from public.admin_user au where au.user_id = auth.uid() and au.ativo));
