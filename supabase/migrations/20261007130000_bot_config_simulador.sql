-- 07/10/2026 — Simulador do bot (testes sem WhatsApp). Pedido do Raphael:
-- "existe alguma forma de você testar o WhatsApp?". O wa-webhook aceita
-- GET ?simular=1&token=…&de=5590XXXXXXXX&texto=… — processa igual a uma
-- mensagem da Meta, mas pra números 5590… (DDD 90 não existe) não envia nada: devolve as
-- respostas no JSON. Token guardado aqui (só service_role lê — a função e
-- o MCP), pra não depender de secret nem de alguém decorar senha.
create table if not exists public.bot_config (
  chave text primary key,
  valor text not null,
  descricao text,
  updated_at timestamptz not null default now()
);

alter table public.bot_config enable row level security;
-- Sem policy: só service_role.

-- O valor é definido na aplicação da migration (não fica no repo). Se
-- precisar trocar: update bot_config set valor = '…' where chave = 'simulacao_token'.
insert into public.bot_config (chave, valor, descricao)
values ('simulacao_token', '__DEFINIDO_NA_APLICACAO__', 'Token do simulador do wa-webhook (GET ?simular=1). Números 5590XXXXXXXX (DDD 90 não existe) são simulados.')
on conflict (chave) do nothing;
