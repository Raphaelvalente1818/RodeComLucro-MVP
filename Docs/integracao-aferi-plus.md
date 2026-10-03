# Rode com Lucro × Aferi+ — respostas técnicas (lado Rode com Lucro)

Escrito em 30/09/2026, olhando o código como estava naquele dia (wa-webhook v48,
sessao-wa v1). Pra colar no projeto do Aferi+. Palavras-chave pra busca: Aferi+,
Aferi, tacógrafo, Tacorrei, Lacre, convite, parceiro, ref, indicação, captação, posto.

**Contexto**: o Aferi+ é outro app da mesma casa (equipe `rode-com-lucro` na Vercel,
Supabase, React + TypeScript): painel interno de dois postos de aferição de tacógrafo
(Tacorrei, São Bernardo; Lacre, Santo André). Tem base de caminhões com placa, nome e
telefone do dono, vencimento do certificado e, pra parte deles, CPF/CNPJ, RENAVAM e
chassi. A ideia: a operadora, com o motorista na frente, aperta um botão no Aferi+ que
manda um WhatsApp com convite pro Rode com Lucro, com código único (`?ref=AB12CD`)
amarrado a caminhão, posto e operadora. O cadastro abre pré-preenchido, o motorista
confirma, e o Rode com Lucro avisa o Aferi+ que o código virou motorista. O posto é
recompensado por cadastro concluído, nunca por convite enviado. Nenhum documento vai
na mensagem; os dados só saem do Aferi+ quando o motorista clica e confirma.

**Base**: monorepo `RodeComLucro-MVP`. App em `apps/web` (React + Vite + react-router),
Supabase projeto `gastwloozlzthpqhxnzr`, Edge Functions em `supabase/functions/`, app
publicado em `https://rode-com-lucro-mvp.vercel.app`.

## 1. Tela de cadastro e parâmetros de URL

Não existe "tela de cadastro" com formulário. O cadastro é **só o telefone**, em duas
rotas públicas:

- `/entrar` (`apps/web/src/pages/Entrada.tsx`): campo único **celular** (obrigatório,
  DDD + número, salvo como E.164 sem `+`: `5511991143035`) + checkbox "Li e aceito os
  Termos de uso e a Política de privacidade" (obrigatório pra habilitar o botão) +
  escolha do canal do código (WhatsApp ou SMS).
- `/verificar` (`pages/Verificacao.tsx`): 6 dígitos. Validou → conta existe →
  redireciona pra `/` (Garagem).

Tudo o mais é **opcional e pós-login**, em telas separadas:
- `/motorista` (Meu perfil): `nome`, `cidade_base` (com lat/lng), `meta_alvo`
  (R$/mês), `cnh_numero`, `cnh_vencimento`, `exame_toxicologico_vencimento`.
- `/perfil` (Meu caminhão → tabela `caminhao_perfil`): `tipo_veiculo`,
  `tipo_carroceria`, `numero_eixos`, `marca`, `modelo`, `ano`, `valor_caminhao`
  (FIPE), consumos e custos por km, `carga_maxima_toneladas`. **Não existe coluna de
  placa nem RENAVAM hoje** (entrariam por migration).

Parâmetros de URL hoje: **só `?t=<token>`** (login mágico vindo do bot, ver §4).
**Não existe `ref`, `utm` nem código de convite na URL do app.** O único mecanismo
de indicação que existe é no **bot do WhatsApp**: uma mensagem contendo `#CODIGO`
(regex `RE_CODIGO_INDICACAO` em `supabase/functions/wa-webhook/index.ts`) grava
`motoristas.indicado_por_codigo` na criação da conta. Ou seja, um link
`https://wa.me/5511999919971?text=Quero%20calcular%20um%20frete%20%23AB12CD` já
atribui a origem hoje, sem código novo — vale como segunda porta de entrada (ver §6).

## 2. Como o cadastro é concluído

Três caminhos, todos terminando em **um usuário em `auth.users` com `phone`
confirmado**. Um trigger `handle_new_auth_user` (AFTER INSERT em `auth.users`) cria a
linha em `public.motoristas` com o **mesmo `id`**.

| Caminho | Mecanismo |
|---|---|
| App, código por SMS | `otp-solicitar` (Edge Function) → GoTrue/Twilio `signInWithOtp` → app `supabase.auth.verifyOtp({type:'sms'})` |
| App, código pelo WhatsApp | `otp-solicitar` gera o código, manda pelo template `modelo01` da Meta → app chama Edge Function `sessao-wa` `{telefone_e164, codigo}` → devolve `token_hash` → `verifyOtp({type:'magiclink'})` |
| Bot do WhatsApp | qualquer primeira mensagem → `auth.admin.createUser({phone, phone_confirm:true})` (função `garantirMotorista`) — sem OTP, a Meta já provou o número |

Não há e-mail (usuários de telefone recebem um e-mail sintético
`<fone>@wa.rodecomlucro.app` só pra o magiclink funcionar — ignorar). Não há
"confirmação de e-mail".

**Onde considerar "cadastro concluído" pra pagar o posto** — hoje o sistema emite o
evento `signup_completed` (tabela `analytics_event`, `event_name='signup_completed'`)
no momento em que o telefone é verificado. Pra remuneração, critério um degrau acima,
porque telefone verificado é barato demais (o bot cria conta com um "oi"):

> **Captado = telefone verificado (linha em `motoristas` com
> `telefone_verificado=true`) E o motorista confirmou os dados pré-preenchidos do
> convite (nome + placa salvos).**

É um único toque em "Confirmar" na tela que vai nascer pra esse fluxo, e é o ponto
onde o Rode com Lucro avisa o Aferi+. Alternativa mais exigente: `truck_profile_saved`
(caminhão cadastrado). Deixar o critério configurável no convite (ver §6).

## 3. Onde guardar de onde o motorista veio

Já existe, parcialmente:

- `motoristas.origem_cadastro` (text) — hoje `'whatsapp'` ou null (app).
- `motoristas.indicado_por_codigo` (text) — código de quem indicou, preenchido pelo bot.
- `motoristas.codigo_indicacao` (text, unique) — código *do próprio* motorista pra
  indicar outros (ainda não gerado automaticamente).
- `analytics_event` — funil (`wa_first_contact`, `signup_completed`,
  `truck_profile_saved`, `referral_shared`), com `props` jsonb e `source`
  (`'app'`/`'whatsapp'`).

**Não existe tabela de convites.** Pro Aferi+: criar `public.convite_parceiro` (§6):
guarda o código, o parceiro/posto/operadora, o payload de pré-preenchimento, quando
foi aberto, qual `motorista_id` virou e quando foi notificado.
`motoristas.indicado_por_codigo` recebe o código e `origem_cadastro='aferi'`.

## 4. Chamadas pra fora — padrão existente

Três Edge Functions (Deno) já chamam APIs externas com segredo em variável de
ambiente (`Deno.env.get`, configurado em Supabase → Edge Functions → Secrets), sempre
**servidor-a-servidor** — o navegador nunca vê chave nenhuma:

- `route-cost` → Google Routes API (`GOOGLE_ROUTES_API_KEY`)
- `wa-webhook` / `otp-solicitar` → Meta WhatsApp Cloud API (`WA_ACCESS_TOKEN`,
  `WA_PHONE_NUMBER_ID`)
- `wa-webhook/extracao.ts` → Anthropic (`ANTHROPIC_API_KEY`)

Padrão de código: `fetch` com `Authorization: Bearer <secret>`, erro logado em
`public.app_log` via `logErro()` (aparece na aba "Saúde do sistema" do admin), nunca
derruba o fluxo principal. Functions chamadas pelo app usam `verify_jwt=true` (o app
manda a sessão do usuário); as chamadas por terceiros (Meta) usam `verify_jwt=false`
+ validação própria (HMAC).

Pro Aferi+ o encaixe natural são **dois secrets novos**: `AFERI_API_KEY` (chave
compartilhada) e `AFERI_WEBHOOK_URL` (endpoint de "captado").

## 5. Identificador estável

**`auth.users.id` = `public.motoristas.id`** (mesmo UUID, criado pelo trigger). É esse
que o Aferi+ deve guardar. Telefone **não** é estável (pode trocar, e é a chave de
login, não de identidade). Quando o motorista manda `SAIR` no bot, o `auth.users` é
apagado e tudo cascateia — o UUID some; o Aferi+ deve tratar "motorista não existe
mais" como estado possível.

## 6. Como o Rode com Lucro faria isso do jeito dele (proposta)

Preferência: o **Aferi+ empurra o pré-cadastro** pra uma tabela nossa, em vez de o
app buscar por código no Aferi+. Motivos: (a) o app roda no navegador do motorista e
não pode carregar chave do Aferi+; (b) o pré-preenchimento fica disponível mesmo se o
Aferi+ estiver fora; (c) é o padrão que o bot já usa (conta nasce a partir de um dado
externo — o número da Meta).

**Tabela** `public.convite_parceiro` (RLS ligada, sem policies — só service role):

```
codigo          text primary key        -- 'AB12CD', gerado pelo Aferi+
parceiro        text not null           -- 'aferi'
posto           text                    -- 'tacorrei' | 'lacre'
operadora       text                    -- id/nome no Aferi+
telefone_e164   text not null           -- 5511999999999
dados           jsonb not null          -- {nome, placa, marca, modelo, ano, renavam?}
expira_em       timestamptz not null    -- ex.: 7 dias
aberto_em       timestamptz             -- 1º clique no link
motorista_id    uuid references motoristas(id) on delete set null
concluido_em    timestamptz             -- critério "captado" atingido
notificado_em   timestamptz             -- Aferi+ avisado com sucesso
criado_em       timestamptz default now()
```

**Edge Function `parceiro-convite`** (`verify_jwt=false`, exige header `x-api-key` =
`AFERI_API_KEY`): `POST { codigo, posto, operadora, telefone_e164, dados, expira_em }`
→ upsert. Devolve o link pronto: `https://rode-com-lucro-mvp.vercel.app/entrar?ref=AB12CD`.
O Aferi+ manda esse link no WhatsApp dele.

**No app** (rota `/entrar?ref=AB12CD`, código novo, pequeno): o app chama uma Edge
Function `convite-abrir` (`verify_jwt=false`, só lê pelo código) que devolve **apenas
o que não é sensível**: telefone já preenchido (o motorista não digita nada), nome,
placa. Marca `aberto_em`. Ele pede o código pelo WhatsApp → verifica → cai numa tela
"Confira seus dados" com nome/placa/marca/modelo pré-preenchidos → **Confirmar**. Ao
confirmar: `motoristas.nome`, `origem_cadastro='aferi'`,
`indicado_por_codigo='AB12CD'`; `caminhao_perfil` com placa/marca/modelo/ano; linha
em `consentimento` (`tipo='termos_uso'`); e chama a Edge Function
**`convite-concluir`** (`verify_jwt=true`).

**Avisar de volta**: `convite-concluir` grava `motorista_id` + `concluido_em` e faz
`POST AFERI_WEBHOOK_URL` com `{ codigo, motorista_id, concluido_em }` e header
`x-api-key`. Se falhar, `notificado_em` fica null e um cron (pg_cron já existe no
projeto) reenvia. Não usar trigger de banco pra HTTP (pg_net não está habilitado e a
retentativa fica ruim) nem webhook do Supabase Auth (dispara em "usuário criado", que
é cedo demais e não sabe do convite).

**Segunda porta, sem tela nova**: o mesmo código funciona no bot. Link
`https://wa.me/5511999919971?text=Calcula%20um%20frete%20pra%20mim%20%23AB12CD` → a
conta nasce com `indicado_por_codigo='AB12CD'` hoje mesmo. Só falta o
`convite-concluir` ser disparado também pelo bot quando o caminhão for salvo pelos 3
toques. Bom pra motorista que não quer abrir app.

## 7. Consentimento / LGPD — o que existe e o que o Aferi+ precisa respeitar

- Aceite de Termos e Política: checkbox obrigatório em `/entrar` (links `/termos` e
  `/privacidade`). **Hoje é só trava de tela — não é persistido.** A tabela
  `public.consentimento (motorista_id, tipo, versao, aceito, ip_hash, user_agent,
  created_at)` existe com `tipo ∈ {termos_uso, politica_privacidade,
  persistencia_historico, canal_whatsapp}`, mas só `canal_whatsapp` é gravado (no
  vínculo por código). No fluxo do convite, gravar `termos_uso` +
  `politica_privacidade` no "Confirmar".
- Bot: aviso em uma linha no primeiro contato ("Seu número ficou cadastrado… Pra
  apagar, manda SAIR") — SAIR apaga tudo (direito de exclusão).
- **CPF: o Rode com Lucro não tem coluna de CPF e não precisa dele pra nada do
  produto.** Recomendação forte: o Aferi+ **não envia CPF** no `dados` do convite.
  Some o problema de "quando entregar CPF". Se um dia for necessário (ex.: emissão
  fiscal), só depois do aceite gravado e via campo próprio.
- Telefone e placa: o motorista está na frente da operadora e vai receber o link no
  próprio celular — a prova de posse do número acontece no OTP. O que vale registrar
  no Aferi+ é que a operadora obteve o "sim" verbal antes de apertar o botão (opt-in
  pra receber a mensagem; o resto do consentimento é dado pelo próprio motorista no app).

## Esforço (lado Rode com Lucro)

1 migration, 3 Edge Functions pequenas (`parceiro-convite`, `convite-abrir`,
`convite-concluir`), tela "Confira seus dados" (com mockup antes, como sempre) e o
gancho no bot — na casa de 2 dias. Status: **na fila** (ver checkpoint em
`status-sessao.md`), ainda não iniciado.
