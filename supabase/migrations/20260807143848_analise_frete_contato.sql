-- =====================================================================
-- analise_frete: dados de contato de quem ofereceu o frete (empresa,
-- nome do contato, telefone/WhatsApp). Coletados num popup ao clicar
-- "Salvar análise" — ficam disponíveis ao reabrir o frete salvo (modo
-- histórico), pra o motorista achar o contato na hora de negociar/fechar.
-- =====================================================================

alter table public.analise_frete
  add column if not exists empresa_nome text,
  add column if not exists contato_nome text,
  add column if not exists contato_telefone text;
