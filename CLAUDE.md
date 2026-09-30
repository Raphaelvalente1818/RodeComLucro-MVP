# Rode com Lucro / Sofrete — guia pro Claude Code

Lido automaticamente ao abrir esta pasta. Migrado do Cowork em 30/09/2026 (o Cowork
descontinuou tarefas em pasta local em 06/10/2026). Tudo que importa está aqui no repo.

## Comece por aqui

1. **`Docs/status-sessao.md`** é a fonte da verdade do estado do projeto. Leia a
   ÚLTIMA seção "CHECKPOINT" antes de fazer qualquer coisa — ela diz onde paramos e
   o que vem a seguir. Ao encerrar uma sessão de trabalho, acrescente um checkpoint
   novo no fim do arquivo (o Raphael sempre pede "salve o projeto" antes de sair).
2. `Docs/estrategia-viral-whatsapp.md` — a "missão vital" atual: fazer um contato
   compartilhado virar motorista cadastrado. Princípio aprovado: **o número já é o
   cadastro** (conta criada na 1ª mensagem do WhatsApp, sem OTP nem código VINCULAR).
3. `Docs/sequencia-construcao.md` e os `Docs/PRD-tecnico-*.html` — contratos
   funcionais. O PRD define o que cada tela faz; NÃO define visual.

## O que é

App pra caminhoneiro autônomo saber se um frete vale a pena (custo real, lucro,
piso ANTT), com duas marcas e três superfícies:

- **Rode com Lucro** (motorista): PWA em `apps/web` (React/Vite) + bot WhatsApp
  (`supabase/functions/wa-webhook`). Tema escuro "asfalto e faixa amarela", fonte Barlow.
- **Sofrete** (empresa/embarcador publica fretes): portal em `apps/web/src/pages/empresa`,
  tema claro sóbrio com alternador, grafite #1C2421 + amarelo #F2B01E só em detalhe.
- **Painel admin** em `apps/web/src/admin` (moderação de fretes e empresas, funil, saúde).

Motor de cálculo em `packages/rode-calc` (`@rode/calc`), fórmula do Emerson,
piso ANTT. `supabase/functions/wa-webhook/calc.ts` é uma CÓPIA isomórfica dele
pro Deno — se a fórmula mudar, atualizar os dois.

## Infra

- Supabase, projeto `gastwloozlzthpqhxnzr`. Migrations em `supabase/migrations/`
  (sempre salvar o `.sql` no repo, mesmo quando aplicada por outro caminho).
- Edge Functions: `wa-webhook` (verify_jwt=false — webhook público da Meta, valida
  HMAC), `sessao-wa` (verify_jwt=false — troca código do WhatsApp ou token do link
  mágico por sessão), `otp-solicitar`, `route-cost`, `wa-vincular` (verify_jwt=true).
  Secrets em Edge Functions → Secrets: `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`,
  `NUMERO_OFICIAL_WA` (=5511999919971), `WA_APP_SECRET`, `WA_WEBHOOK_VERIFY_TOKEN`,
  `ANTHROPIC_API_KEY`, `GOOGLE_ROUTES_API_KEY`, `TELEFONE_PEPPER` (HMAC de telefone,
  código OTP e token de login — compartilhado por otp-solicitar, sessao-wa e wa-webhook).
  Template de OTP na Meta: `modelo01` (pt_BR, Autenticação).
- Deploy do app: Vercel, https://rode-com-lucro-mvp.vercel.app (push em `main` publica).
- Meta cobra ~R$ 0,04 por mensagem do bot a partir de 1/10/2026 — responder em uma
  mensagem só; nada de bot tagarela.

## Como validar

```
cd apps/web && npx tsc --noEmit --strict          # app web (0 erros é a régua)
cd supabase/functions/wa-webhook && deno check index.ts   # Edge Function
```

Se `@rode/calc` não resolver, apague `node_modules` na raiz, em `apps/web` e em
`packages/rode-calc` e rode `npm install` de novo (aconteceu em 10/09).

## Regras que o Raphael pediu

- Comandos de terminal em blocos separados (ele copia e cola).
- Mockup HTML navegável em `Docs/` ANTES de codar tela nova; ele aprova pelo deploy
  e por prints do iPhone. Nunca desenhar direto no código.
- Decisões de produto: apresentar como opções com recomendação, não decidir sozinho.
- Pesquisar (com fontes) antes de propor estratégia.
- Paleta: amarelo = marca e ação; verde/laranja/vermelho = exclusivos de veredito/status.
  Cores só via variáveis CSS no `:root` de `apps/web/src/index.css` — nunca hex solto.
- Português, direto, sem enrolação.

## Pendências abertas (ver checkpoint pra ordem)

Testes da v47 (conversa livre) e v48 (OTP WhatsApp + link mágico) com o David e o Rapha;
agendar `limpar_tokens_wa()` no pg_cron; leitura de CNH/CRLV por foto no bot (ver
checkpoint 30/09 — sem guardar imagem nem CPF); `codigo_indicacao` por
motorista; aba "Funil viral" no admin; verificar a empresa na Meta; logo do Sofrete
(4 propostas em `Docs/propostas-logo-sofrete.html`, ele ainda não escolheu);
identidade visual em Analisar/Buscar/Perfil; troca de senha no portal; hospedar a
Barlow localmente; gate de validação está em 1/160 — o gargalo é aquisição.
