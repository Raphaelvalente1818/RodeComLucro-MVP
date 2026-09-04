-- Primeiros dois admins do painel, a pedido do Raphael: David
-- (5511991143035) e Emerson (5511997510976), ambos com papel 'admin'
-- (acesso total). user_id copiado de auth.users pelo telefone E.164 —
-- gravado aqui como valor fixo (não por lookup dinâmico) porque é seed
-- de dado real, não schema.
insert into public.admin_user (user_id, role, ativo)
values
  ('ca7a67a8-98cb-4312-8f55-06d331486c01', 'admin', true), -- David, 5511991143035
  ('72828dfe-e563-4c4f-9bc7-7c7c8fbbd63b', 'admin', true)  -- Emerson, 5511997510976
on conflict (user_id) do nothing;
