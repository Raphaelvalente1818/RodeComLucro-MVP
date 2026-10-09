# Pagamentos: assinatura do motorista por cartão (09/10/2026)

Pedido do Raphael: começar a cobrança online por cartão de crédito. Respostas dele:
quem paga é o **motorista** (plano do app/bot), **só cartão** por enquanto, e "onde
comprar" ficou pra recomendação. Pesquisa com fontes no fim.

## 1. Onde a compra acontece — a decisão que mais pesa

**Recomendação: checkout na web (página hospedada do provedor), alcançado pelo link
do bot e pelo site. O app da Google Play NÃO oferece o botão de compra.**

Motivo: pela política do Google Play, app distribuído na loja que vende conteúdo ou
serviço digital **dentro do app** tem que usar o faturamento do Google (taxa de serviço
10–15% nos primeiros US$ 1 milhão + 5% de faturamento nos países onde já existe a
"escolha de faturamento"). O programa que permite link pro próprio site ainda não
chegou ao Brasil — previsão de "resto do mundo" só em setembro/2027. A saída usada por
Netflix, Spotify e outros é o padrão **"app só consome"**: a compra acontece fora, o
app só reflete o status. Como nosso app da Play é o site (TWA), a regra prática é:

- Site aberto no navegador e no iPhone (PWA): mostra "Assinar" normalmente.
- Site aberto dentro do app da Play (dá pra detectar: `document.referrer` começa com
  `android-app://br.com.rodecomlucro.app`): esconde o botão de compra e mostra só
  "Assine pelo WhatsApp" (sem link clicável de checkout). O bot manda o link.
- O bot WhatsApp é o canal principal de venda: ao bater a cota, "Quer sem limite?
  R$ X/mês: <link do checkout>". É onde o motorista já está.

Risco: é uma zona cinzenta — o Google pode questionar. É o padrão de mercado e o
custo de errar é baixo (ajustar e resubmeter). Pagar 15–20% pro Google pra vender
pra caminhoneiro que já está no WhatsApp não faz sentido.

## 2. Provedor

| | Stripe | Asaas | Mercado Pago |
|---|---|---|---|
| Cartão nacional | 3,99% + R$ 0,39 (Billing: +0,7% do volume ou R$ 0,50 fixo, conferir) | 2,99% + R$ 0,49 | 3,99% a 4,99% |
| Repasse | D+30 | D+30 (antecipação paga) | D+30 (ou mais caro pra antecipar) |
| Mensalidade | não | não | não |
| Checkout pronto (hospedado, PCI por conta deles) | **sim, o melhor do mercado**, pt-BR | sim (link de pagamento), mais simples | sim |
| Assinatura com retentativa, troca de cartão pelo cliente, cancelamento self-service | **sim (Billing + Customer Portal)** | sim (recorrência + régua de cobrança) | sim (planos) |
| Webhooks / API / docs | **excelente** | ok | ok |
| PIX depois | sim (avulso; PIX Automático ainda raro) | sim, barato | sim, barato |
| Nota fiscal | não emite | não emite (integra com parceiros) | não emite |

**Recomendação: Stripe.** Numa mensalidade de R$ 29,90 a diferença pro Asaas é de
uns R$ 0,20 por cobrança; o que importa é o tempo de implementação e a chance de bug
num fluxo que mexe com dinheiro: Checkout hospedado (nenhum número de cartão passa
pelo nosso código), Customer Portal pronto (o motorista troca cartão e cancela
sozinho — menos suporte), retentativas automáticas, webhooks confiáveis e docs que
eu conheço de cor. Asaas é a alternativa se vocês quiserem boleto/PIX barato e
"empresa brasileira pra ligar". Mercado Pago só pela marca conhecida do motorista.

Pré-requisitos pra abrir a conta Stripe: CNPJ (ou CPF, mas melhor CNPJ), conta
bancária PJ, documento do responsável. Ativação em 1–3 dias.

## 3. Como fica no sistema (~2 dias)

1. **Banco**: tabela `assinatura` (`motorista_id`, `provedor`, `customer_id`,
   `subscription_id`, `plano`, `status` ativa/atrasada/cancelada/trial,
   `periodo_fim`, `created_at`); coluna `plano` derivada em `motoristas` não precisa —
   função `motorista_assinante(id)` lê a tabela.
2. **Edge Function `stripe-webhook`** (verify_jwt=false, valida assinatura do Stripe):
   `checkout.session.completed` cria/ativa; `invoice.paid` renova `periodo_fim`;
   `invoice.payment_failed` marca atrasada; `customer.subscription.deleted` cancela.
   Idempotente por `event.id`.
3. **Link de checkout**: Edge Function `assinar` cria uma Checkout Session com
   `client_reference_id = motorista_id` e `customer_email`/telefone, devolve a URL.
   O bot chama ao bater a cota (e no comando ASSINAR); o site chama no botão.
4. **Entitlement**: `LIMITE_CONSULTAS_DIA` só vale pra quem não é assinante; no app,
   o mesmo check. Nada mais muda no cálculo.
5. **Gerenciar**: comando PLANO no bot e botão no app abrem o Customer Portal
   (trocar cartão, cancelar, ver faturas).
6. **Nota fiscal**: SaaS paga ISS; o Stripe não emite NFS-e. Opções: emitir na
   prefeitura à mão enquanto for pouco, ou integrar eNotas/NFE.io (mensalidade). Falar
   com o contador antes do primeiro cliente — não sou contador.
7. **Termos**: atualizar `/termos` com o plano, cancelamento e reembolso (CDC: 7 dias
   de arrependimento em compra online).

## 4. O que falta decidir (Raphael)

- **Preço e nome do plano** (ex.: "Rode com Lucro PRO", R$ 29,90/mês). Anual com
  desconto depois.
- **O que o plano libera**: só tirar o limite de consultas no WhatsApp? Ou também
  algo no app (histórico ilimitado, fretes em primeira mão, alerta de carga)? A
  cobrança só se sustenta se o grátis tiver limite claro e o pago tiver valor claro.
- **Teste grátis**: 7 dias com cartão (Stripe faz sozinho) ou sem trial e o grátis
  é o próprio limite diário? Recomendo sem trial — o limite diário já é o "teste".
- **Quando**: a semeadura (Emerson/David → 15 colegas) ainda não aconteceu; o gate é
  1/160. Cobrar antes de ter uso é cobrar de ninguém. Sugestão: deixar o código pronto
  e ligar o botão quando houver 30–50 usuários ativos.

Fontes: [Stripe — preços Brasil](https://stripe.com/pricing), [Stripe — métodos locais](https://stripe.com/pricing/local-payment-methods), [Stripe × Mercado Pago, taxas e prazo (QUASA, 08/10/2026)](https://quasa.io/pt/media/stripe-ou-mercado-pago-o-prazo-de-recebimento-vira-parte-da-taxa), [Asaas — taxas de assinatura](https://central.ajuda.asaas.com/hc/pt-br/articles/31997100041371-Quais-s%C3%A3o-as-taxas-para-criar-cobran%C3%A7as-por-assinatura-recorrentes), [Comparativo de gateways 2026 (Mind Group)](https://mindconsulting.com.br/2026/07/gateways-pagamento-online-brasil-comparativo-2026/), [Ranking de taxas 2026 (Kataly)](https://www.kataly.com.br/blog/ranking-taxas-gateways-pagamento-2026-benchmark), [Google — escolha de faturamento e taxas (blog oficial, jun/2026)](https://android-developers.googleblog.com/2026/06/play-expanded-billing.html), [Google Play — sistemas alternativos de faturamento (ajuda)](https://support.google.com/googleplay/android-developer/topic/16471708?hl=pt-BR), [Olhar Digital — Google reduz taxas da Play Store (24/06/2026)](https://olhardigital.com.br/2026/06/24/pro/google-derruba-taxa-de-30-da-play-store-apos-pressao-da-epic-e-redesenha-cobranca-no-android/).


## 5. Decisão e implementação (09/10, tarde)

**Raphael aprovou**: Stripe, sem trial, PRO libera fretes ilimitados, fretes em
primeira mão e WhatsApp sem limite (o grátis vai pra 5 consultas/dia ou menos).
Números adotados (mudam em `wa-webhook/assinatura.ts` e `apps/web/src/lib/assinatura.ts`,
constante `PRO`): lista do bot 3 (grátis) / 9 (PRO); app 5 (grátis) / todos (PRO);
primeira mão = publicado há menos de 2 h. Preço e nome vivem no Stripe (sugestão:
"Rode com Lucro PRO", R$ 29,90/mês).

**O que está pronto (código)**:
- Migration `20261009150000_assinatura_pro.sql` (aplicada): `assinatura`, `stripe_evento`,
  `motorista_assinante(uuid)` — fonte única do "é PRO?".
- Edge Function `stripe-webhook` (verify_jwt=false; valida a assinatura HMAC do Stripe;
  idempotente): checkout.session.completed, customer.subscription.*, invoice.paid,
  invoice.payment_failed → tabela `assinatura`.
- Edge Function `assinar` (verify_jwt=true): devolve URL do Checkout (não assinante)
  ou do Customer Portal (assinante) pro usuário do JWT.
- Bot (`wa-webhook/assinatura.ts`): comandos **PRO / ASSINAR / ASSINATURA / PLANO** e a
  intent `assinar` da IA ("quanto custa o pro?", "como cancelo?") → vende (preço lido do
  Stripe + link do Checkout) ou gerencia (link do Portal). Assinante não tem cota; o
  aviso da última consulta oferece o PRO; na busca, grátis vê 3 e perde os de
  primeira mão (com aviso "🔒 mais N só no PRO"), PRO vê 9 e tudo. Sem as chaves do
  Stripe, "PRO" responde "ainda não está disponível" — nada quebra.
- App: `lib/assinatura.ts`, `components/CardPro.tsx` na Garagem (Assinar / Gerenciar;
  dentro do app da Play mostra "manda PRO no WhatsApp" em vez do botão), `BuscarFrete`
  com limite de 5 e primeira mão + aviso 🔒.

**O que falta (Raphael, no Stripe — modo teste primeiro)**:
1. Criar conta em https://dashboard.stripe.com (CNPJ, conta PJ, documento). Pode
   começar no **modo teste** antes da ativação.
2. Produtos → "Rode com Lucro PRO" → preço recorrente mensal R$ 29,90 → copiar o
   **Price ID** (`price_…`).
3. Desenvolvedores → Chaves → copiar a **chave secreta** (`sk_test_…` no teste,
   `sk_live_…` depois).
4. Desenvolvedores → Webhooks → adicionar endpoint
   `https://gastwloozlzthpqhxnzr.supabase.co/functions/v1/stripe-webhook` com os eventos
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`,
   `invoice.payment_failed` → copiar o **segredo de assinatura** (`whsec_…`).
5. Configurações → Billing → **Customer Portal**: ativar, permitir cancelar e trocar
   método de pagamento.
6. Me passar os três valores (ou gravar você mesmo):
   `npx supabase@latest secrets set STRIPE_SECRET_KEY=sk_… STRIPE_PRICE_ID=price_… STRIPE_WEBHOOK_SECRET=whsec_… --project-ref gastwloozlzthpqhxnzr`
7. Teste: no simulador/WhatsApp manda **PRO**, abre o link, cartão de teste
   `4242 4242 4242 4242` (qualquer validade futura, CVC 123) → webhook grava → "PRO"
   de novo mostra "Você é PRO". Depois trocar as chaves pelas `live`.

Fora do código: contador (NFS-e/ISS) e `/termos` com o plano e o arrependimento de 7 dias.
