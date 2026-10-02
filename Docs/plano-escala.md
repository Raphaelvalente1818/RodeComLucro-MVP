# Plano de escala — o que fazer quando ficar lento

Escrito em 01/10/2026 a pedido do Raphael, pra ficar guardado até o dia em que
precisar. Palavras-chave: escala, capacidade, lentidão, usuários simultâneos,
gargalo, performance, fila, índice geográfico, PostGIS, tier, Meta, Anthropic.

Estado de referência na data: 10 motoristas, ~800 fretes abertos, banco com 21 MB,
Supabase Free (compute Nano, 60 conexões, região `ca-central-1`), wa-webhook v49.

## Capacidade hoje (sem pagar nada)

Na casa de **50–100 motoristas ativos ao mesmo tempo**; milhares cadastrados.
Primeiro gargalo num pico: limite de requisições/minuto da conta Anthropic
(~50/min em conta nova) — toda mensagem em texto livre passa pelo Haiku.

## Capacidade pagando (sem mexer em código)

**1.000–2.000 motoristas ativos no mesmo minuto**; centenas de milhares cadastrados.
Teto vira a busca de fretes em memória (item 1 abaixo). Depois do índice geográfico:
**10 mil+ simultâneos**, teto passa a ser contrato (vazão Meta, tier Anthropic).

## Ordem das ações — cada uma só quando o sinal aparecer

### 0. Antes da semeadura (Emerson/David mandando o cartão pra 15 colegas cada)
- **Anthropic**: conferir o tier da conta em console.anthropic.com → Limits. Se
  estiver em Tier 1 (~50 RPM), pré-pagar crédito pra subir de tier. Sinal de que
  faltou: linhas em `app_log` com `extração falhou 429` e motoristas recebendo a
  apresentação fixa em vez da resposta da IA.

### 1. Supabase Free → Pro + compute Small (US$ 25/mês + compute)
- Sinal: projeto pausou por inatividade; tráfego passando de 5 GB/mês; latência
  subindo no painel (Reports → Database). Também libera backups diários.
- Como: painel Supabase → Settings → Billing. Zero código.

### 2. Verificação da empresa na Meta
- Sinal: qualquer mensagem iniciada por nós (lembrete, reativação) — hoje o limite
  é 250 conversas/dia sem verificação. Com verificação: 1.000 → 10.000 → 100.000 →
  ilimitado, subindo sozinho pela qualidade do número.
- Como: Meta Business Suite → Configurações → Centro de segurança → Verificação
  da empresa (CNPJ, comprovante de endereço). Já está nas pendências do projeto.
- Vazão de resposta (janela de 24 h) não tem limite de quantidade: 80 msg/s padrão,
  até 1.000/s mediante pedido no painel da Meta.

### 3. Índice geográfico na busca de fretes (~1 dia de código)
- Sinal: `fretes_publicados` com status `aberto` passando de **5 mil**, ou a
  busca (bot ou app) demorando > 2 s. Hoje o bot lê até 2.000 fretes e o app até
  300 por busca e calculam a distância um a um em memória — `tratarBuscaDeFrete`
  em `supabase/functions/wa-webhook/index.ts` e `listaExibir` em
  `apps/web/src/pages/BuscarFrete.tsx`.
- Como: migration habilitando `earthdistance` (ou PostGIS), coluna/índice GiST em
  `(origem_lat, origem_lng)`, RPC `fretes_por_raio(lat, lng, raio_km, tipo_veiculo,
  carrocerias[])` que devolve já ordenado por distância com `limit`. Bot e app
  passam a chamar a RPC; o filtro em memória sai. Mesma lógica, mesmos nomes de
  campo — não muda nada visível.

### 4. Webhook responde 200 na hora e processa em fila (~1 tarde)
- Sinal: logs da Meta com reentrega (`wa_mensagem_recebida` rejeitando duplicata
  por `23505` com frequência) ou respostas do bot chegando em dobro/atrasadas.
  Hoje o `wa-webhook` processa tudo (IA + rota + envio, 2–5 s) antes de devolver
  200; a Meta reentrega se demorar, e a idempotência por `wa_message_id` descarta
  — não quebra, só desperdiça.
- Como: `wa-webhook` grava a mensagem crua numa tabela `wa_fila` e responde 200;
  um cron pg_cron (a cada 10 s) ou `pg_net` chama uma Edge Function
  `wa-processar` que puxa da fila com `FOR UPDATE SKIP LOCKED` e roda o que hoje
  roda inline. Vantagem extra: retentativa de verdade quando a IA ou a Meta falham.

### 5. Região do Supabase (`ca-central-1` → `sa-east-1`)
- Sinal: nenhum número — é latência fixa de ~150 ms por chamada por estar no
  Canadá. Não limita usuários, deixa tudo um pouco mais lento.
- Como: não existe "mudar região"; é criar projeto novo em São Paulo, restaurar
  backup, reapontar secrets/Vercel/Meta/Twilio. Meio dia, com janela de parada.
  **Se for fazer, fazer antes de ter volume** — depois fica cada vez mais caro.

### 6. Vários números de WhatsApp
- Sinal: vazão de um número só (mesmo com 1.000/s) ou vontade de separar por região.
- Como: a mesma conta WhatsApp Business aceita vários números; cada um tem seu
  `WA_PHONE_NUMBER_ID`. O webhook já recebe o `phone_number_id` no payload; seria
  roteá-lo por número (hoje ignora). Longe de precisar.

## O que NÃO é gargalo (não gastar tempo)
Vercel (estático em CDN), Google Routes (3.000/min + cache em `route_cost_cache`),
Edge Functions (escalam sozinhas; 500 mil chamadas/mês no Free, 2 M no Pro),
tamanho do banco (100 mil motoristas × 20 cálculos ≈ 2 GB).

## Custo que cresce com uso (decisão de produto, não de infra)
Meta ~R$ 0,04 por mensagem do bot + centavos de IA por mensagem em texto livre.
10 mil motoristas ativos × 5 mensagens/dia ≈ R$ 2 mil/dia só de Meta. O limite
de respostas livres por dia (`LIMITE_RESPOSTAS_LIVRES_DIA`, hoje 5) é a alavanca.
