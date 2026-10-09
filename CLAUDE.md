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
4. `Docs/integracao-aferi-plus.md` — integração com o Aferi+ (app irmão, postos de
   aferição de tacógrafo): convite por código, pré-cadastro, captação remunerada.
   Respostas técnicas prontas + proposta de tabela/functions. Na fila.
5. `Docs/plano-escala.md` — o que fazer quando ficar lento (capacidade atual,
   sinais e ações em ordem: tier Anthropic, Supabase Pro, verificação Meta,
   índice geográfico na busca, fila no webhook, região). Só abrir quando o sinal
   aparecer.

## O que é

App pra caminhoneiro autônomo saber se um frete vale a pena (custo real, lucro,
piso ANTT), com duas marcas e três superfícies:

- **Rode com Lucro** (motorista): PWA em `apps/web` (React/Vite) + bot WhatsApp
  (`supabase/functions/wa-webhook`). Tema escuro "asfalto e faixa amarela", fonte Barlow.
- **Sofrete** (empresa/embarcador publica fretes): portal em `apps/web/src/pages/empresa`,
  tema claro sóbrio com alternador, grafite #1C2421 + amarelo #F2B01E só em detalhe.
- **Painel admin** em `apps/web/src/admin` (moderação de fretes e empresas, funil, saúde).

Cidades digitadas no bot passam por `municipio_sugerir` (pg_trgm em
`municipios_brasil`) antes do Google — ver `corrigirCidades` em `wa-webhook/index.ts`
e `Docs/status-sessao.md` 03/10. Limiares: `LIMIAR_CIDADE_AUTO`/`FOLGA_CIDADE_AUTO`.

Motor de cálculo em `packages/rode-calc` (`@rode/calc`), fórmula do Emerson,
piso ANTT. **Tabela ANTT vigente vem do banco** (`antt_piso_tabela` via RPC
`antt_piso_vigente`; app em `lib/antt.ts`, bot em `garantirTabelaANTT`); as
constantes no código são fallback. Reajuste = INSERT com `versao` + `vigencia_inicio`
(exemplo real: `20261008180000_antt_piso_portaria_suroc_22_2026.sql`). Vigente desde
30/09/2026: **Portaria SUROC nº 22/2026** (gatilho do diesel — pode sair em qualquer
semana, não só jan/jul; conferir no ANTTlegis). `supabase/functions/wa-webhook/calc.ts`
é uma CÓPIA isomórfica dele pro Deno — se a fórmula mudar, atualizar os dois.

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
  mensagem só; nada de bot tagarela. Cota por número: `LIMITE_CONSULTAS_DIA` em
  `wa-webhook/index.ts` (hoje 20/24 h; a última consulta sai com aviso + link do app,
  depois silêncio). Raphael vai pedir pra baixar pra 5 — só trocar a constante.

## Testar o bot sem WhatsApp (simulador, 07/10)

`GET https://gastwloozlzthpqhxnzr.supabase.co/functions/v1/wa-webhook?simular=1&token=<token>&de=5590XXXXXXXX&texto=…`
(ou `&botao=<rowId>`, ou `&reset=1`). Token: `select valor from bot_config where chave='simulacao_token'`
(só service_role — ler pelo MCP). Números 5590… não vão pra Meta; as respostas voltam no JSON.
Roteiro e resultados em `Docs/testes-bot.md` — rodar depois de cada deploy, escrevendo como
caminhoneiro escreve ("truk", "qnto", "sto andre"). Foto/PDF não dá pra simular.
O Haiku recebe as últimas 8 trocas (`wa_conversa`) — a memória curta da conversa.

**Princípio do bot (08/10): IA interpreta, código executa.** Toda mensagem de texto
que não é comando exato passa por UMA chamada ao Haiku com `pendencia` (o que o bot
está esperando) e volta com intent + `acao`. Nunca colocar regex na frente da IA pra
"tratar um caso"; bug novo = cenário em `Docs/testes-bot.md` + linha na seção certa
do prompt (`extracao.ts`, escrito em seções) ou em `executarAcaoPendencia`. A IA não
grava, não calcula, não inventa valor — isso é só do código.

## Como validar

```
cd apps/web && npx tsc --noEmit --strict          # app web (0 erros é a régua)
cd supabase/functions/wa-webhook && deno check index.ts   # Edge Function
supabase functions deploy wa-webhook --no-verify-jwt       # deploy (3 arquivos; sem bundle)
```

v50–v53 foram deployadas como bundle esbuild pelo MCP do Cowork; a partir da **v54
(07/10) o bundle passou do limite do MCP (~90 KB)** e o deploy do `wa-webhook` é
SEMPRE pelo CLI, com os 4 arquivos-fonte (`index`, `calc`, `extracao`, `documentos`):

```
npx supabase@latest functions deploy wa-webhook --no-verify-jwt --project-ref gastwloozlzthpqhxnzr
```

(`npx supabase@latest login` uma vez; `config.toml` criado por `npx supabase@latest init`.)

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

## Google Play (09/10)

Guia em `Docs/play-store-twa.md` (TWA via Bubblewrap, conta de organização, domínio
próprio + `assetlinks.json`, service worker). Raphael pediu domínio/conta/D-U-N-S em
09/10; retomar quando ele avisar.

## Assinatura PRO / Stripe (09/10) — parado por decisão dos sócios

Código pronto e dormente (migration aplicada; `stripe-webhook`, `assinar`,
`wa-webhook/assinatura.ts`, `CardPro`). Sem `STRIPE_SECRET_KEY`/`STRIPE_PRICE_ID`/
`STRIPE_WEBHOOK_SECRET` nada aparece. Não deployar as duas functions novas nem abrir a
conta Stripe antes de os sócios fecharem `Docs/decisoes-pagamento-2026-10-09.xlsx`.
Detalhes e passo a passo: `Docs/pagamentos-assinatura.md`.

## Pendências abertas (ver checkpoint pra ordem)

Testes da v47 (conversa livre) e v48 (OTP WhatsApp + link mágico) com o David e o Rapha;
agendar `limpar_tokens_wa()` no pg_cron; leitura de CNH/CRLV por foto no bot (ver
checkpoint 30/09 — sem guardar imagem nem CPF); integração Aferi+ (`Docs/integracao-aferi-plus.md`); `codigo_indicacao` por
motorista; aba "Funil viral" no admin; verificar a empresa na Meta; logo do Sofrete
(4 propostas em `Docs/propostas-logo-sofrete.html`, ele ainda não escolheu);
identidade visual em Analisar/Buscar/Perfil; troca de senha no portal; hospedar a
Barlow localmente; lojas de app (Play Store via TWA primeiro; App Store só com
push/câmera — ver status-sessao 05/10); gate de validação está em 1/160 — o
gargalo é aquisição.
