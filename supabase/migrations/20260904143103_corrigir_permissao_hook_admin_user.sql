-- Bug real em produção (04/09): custom_access_token_hook roda como o
-- papel supabase_auth_admin (chamado internamente pelo GoTrue), mas
-- 20260902182345 só deu policy de SELECT em admin_user pro papel
-- authenticated. Sem permissão, o hook quebrava com "permission denied
-- for table admin_user (SQLSTATE 42501)" em TODA emissão/renovação de
-- token — não só login novo, também refresh — causando HTTP 500 em
-- /token e /verify em loop apertado. Afetou login do David e do Emerson
-- (os dois únicos com linha em admin_user), horas depois de o hook ter
-- sido habilitado no painel. Corrigido com grant + policy dedicada pro
-- papel supabase_auth_admin.
grant usage on schema public to supabase_auth_admin;
grant select on public.admin_user to supabase_auth_admin;

create policy admin_user_select_auth_admin
  on public.admin_user for select
  to supabase_auth_admin
  using (true);
