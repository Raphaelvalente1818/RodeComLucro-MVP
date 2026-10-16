# Plano de execução — decisões da reunião de sócios (15/10/2026)

Regra da reunião: **tudo que não está listado abaixo foi aprovado** — a proposta "Tenho
interesse" (32 itens em `proposta-tenho-interesse.txt`, concierge só na 1ª vez, prazo de 2 h,
fallback pelo WhatsApp do motorista), a ordem do MVP (fretes vivos → pedágio do embarcador →
interesse → tô vazio → vários destinos), CNH obrigatória pra se candidatar, PRO conforme a
tabela, Comunidade com gatilho 300.

## Decisões e ajustes da reunião

| # | Decisão | O que muda no plano |
|---|---|---|
| D1 | **Marca única: SOFRETE** nos dois lados (3 × 1, Oscar contra). "Rode com Lucro" sai. | Passa a ser o 1º item de código: textos do bot, app, páginas legais, manifest, templates da Meta, nome de exibição do WhatsApp, domínio e nome do projeto na Vercel. Tudo que vier depois já nasce Sofrete. |
| D2 | Melhorar a captação da CNH (a do Rapha, por PDF, saiu ruim; a do Oscar, por foto, perfeita). | Investigar o PDF do Rapha (CNH-e do gov.br tem duas páginas e a foto pode estar na 2ª); orientar "foto da CNH aberta" como caminho principal; PDF como alternativa com dica. |
| D3 | Verificar integração com o Serasa pra situação do caminhoneiro. | **Pesquisa, não código**: API B2B do Serasa Experian exige contrato, custo por consulta e consentimento explícito do consultado (LGPD). Levantar custo e viabilidade; decidir depois. |
| D4 | Entrada do embarcador com total segurança e checagem; tabela dos embarcadores já aceitos pela Fretebras. | Cadastro da empresa ganha: CNPJ consultado na Receita (BrasilAPI, grátis), RNTRC de transportadora na ANTT, telefone com opt-in, e a lista "aceito na Fretebras" (177 anunciantes da planilha + os que o Emerson levantar) como sinal de confiança na moderação, que continua manual. |
| D5 | Verificar como a Fretebras confere se a chave PIX é da pessoa. | É a consulta ao DICT (diretório do PIX) via provedor de pagamento: devolve nome e CPF mascarado do dono da chave. Só dá pra fazer com o provedor contratado (Asaas/Pagar.me; Stripe não). Entra junto com o pagamento. |
| D6 | Robô a cada 3 h: só os fretes que entraram no intervalo; descartar os que saíram. | Depende de **como** acessamos a lista da Fretebras (os 800 vieram de planilha; o app bloqueia print). Primeiro um dia de investigação (spike) pra saber se é automatizável; se for, Edge Function agendada + `visto_em` + status `encerrado` automático. |
| D7 | Rapha vai levantar os motoristas cadastrados na Fretebras. | Aquisição; sem código. Alimenta o concierge e os convites. |
| D8 | Selfie viva só depois de 10.000 motoristas. | Sai do plano de agora. |
| D9 | Emerson renova a Fretebras. | Pré-requisito do D6 e do D4. |
| D10 | RNTRC: pedir a foto ou o número e checar na ANTT. | Item 27 confirmado; o bot aceita foto do documento da ANTT ou o número digitado. Checagem automática via API paga (fornecedor a escolher). |
| D11 | Google Play primeiro; App Store com ~10.000 motoristas. | Confirma `play-store-twa.md`. Precisa do domínio **Sofrete** (D1) antes do `assetlinks.json`. |
| D12 | "Tô vazio": perguntar onde está e pra onde vai. | O bot pergunta: localização (anexo do WhatsApp) ou cidade, e destino (UF, região ou "qualquer"). Expira em 24 h. |
| D13 | Pagamento: contratar o provedor só com a empresa aberta (~10 dias). | PRO continua dormente; conta no provedor em nome da nova empresa. Preço: Rapha propõe. |

## Pesquisas pendentes (não travam o código)

- Serasa Experian (D3): produto, custo por consulta, consentimento. Responsável: a definir.
- Fornecedor de consulta RNTRC/ANTT por API (D10) — ex.: Infosimples; custo por consulta.
- Acesso automatizável à lista de fretes da Fretebras (D6) — spike de 1 dia, depois da renovação.
- Domínio Sofrete (D1): `sofrete.com.br` / `sofrete.app` — disponibilidade e registro. O domínio pedido pro Rode com Lucro em 09/10 serve só como redirecionamento.
- Nome de exibição do WhatsApp na Meta: trocar pra "Sofrete" exige revisão da Meta (dias).

## Sequência de execução (seguir na ordem)

Convenções que continuam valendo: mockup HTML em `Docs/` antes de tela nova; migrations no
repo; `tsc` e `deno check` antes de deploy; bateria do simulador depois de cada deploy do bot;
commit com lista explícita de arquivos.

### Fase 0 — Preparação (dia 1)

| Passo | O que | Entrega |
|---|---|---|
| 0.1 | Registrar o domínio Sofrete e apontar na Vercel; renomear o projeto na Vercel. | URL nova no ar, antiga redirecionando. |
| 0.2 | Pedir os templates na Meta já com o nome Sofrete: "atualização do seu interesse", "avalie a empresa", "novo interessado" (pra empresa com opt-in). Pedir a troca do nome de exibição do WhatsApp. | Protocolos abertos (1–3 dias de espera). |
| 0.3 | Emerson renova a Fretebras; Rapha começa o levantamento de motoristas; sócio responsável pelas 3 empresas piloto definido. | — |

### Fase 1 — Marca e fundações (dias 2–5)

| Passo | O que | Esforço |
|---|---|---|
| 1.1 | **Rebrand Sofrete**: `mensagemApresentacao()` e todos os textos do bot (13 ocorrências em `supabase/functions`), app (12 arquivos: título, Garagem, Entrada, legais, `index.html`, manifest, `URL_APP`), e-mails/links, `CLAUDE.md`. Período de transição no bot: "Sofrete (antigo Rode com Lucro)" por 30 dias. | 1 dia |
| 1.2 | **CNH por PDF** (D2): reproduzir com o PDF do Rapha; tratar CNH-e de 2 páginas; mensagem do bot passa a pedir "foto da CNH aberta, bem iluminada" e aceita PDF como alternativa. Cenários novos no `testes-bot.md`. | 0,5 dia |
| 1.3 | **Pedágio pago pelo embarcador**: toggle no Calcular e no perfil; no bot, "pedágio por conta deles" entendido pela IA (`extracao.ts`) e refletido no cálculo e no rodapé. | 0,5 dia |
| 1.4 | **Fretes vivos — spike** (D6): descobrir se a lista da Fretebras é acessível por automação com a conta renovada. Se sim → 1.5. Se não → importação por planilha a cada manhã pelo admin (já existe) + fretes das empresas piloto. | 1 dia |
| 1.5 | **Robô de fretes** (se viável): Edge Function agendada (pg_cron a cada 3 h), grava `fonte=FRETEBRAS`, `visto_em`; frete que some de duas rodadas seguidas vira `encerrado`. Os 810 de agosto saem do ar no primeiro ciclo. | 1–2 dias |

### Fase 2 — "Tenho interesse", etapa 1 (dias 6–11)

| Passo | O que | Esforço |
|---|---|---|
| 2.1 | **Mockups** em `Docs/`: cartão público do motorista (`/m/<código>`), página "Interesses" do admin (fila, status, operador, senha), tela "Meus interesses" do app. Aprovação pelo Raphael. | 0,5 dia |
| 2.2 | **Migration**: `interesse` (frete, motorista, empresa, senha 4 dígitos, status enviado/visto/em_contato/fechado/recusado/expirado, operador, ligado_em, cadastro_em), `motoristas.rntrc`, `motoristas.foto_caminhao_url`, `empresas.opt_in_whatsapp`, `fretes_publicados.telefone_visivel`. | 0,5 dia |
| 2.3 | **Bot**: botão "Tenho interesse" após o cálculo de frete da lista (ao lado de "Mandar pra um colega"); se não tem CNH lida → pede a foto e guarda o interesse pendente; com CNH → grava, gera a senha, responde "a empresa recebeu sua solicitação; quem te ligar com o código 7319 é a Transportes X". Empresa desconhecida → entra na fila do concierge; sem ligação em 2 h ou fora do horário → bot libera a mensagem pronta (`wa.me`) pro motorista mandar. | 1,5 dia |
| 2.4 | **Cartão público** `/m/<código>`: nome, selo verificado, caminhão, eixos, cidade atual, RNTRC (informado), foto do caminhão, nota, quem indicou; rodapé "publique seus fretes grátis na Sofrete". | 1 dia |
| 2.5 | **Admin "Interesses"** (concierge): fila por empresa, cartão do motorista, botão "liguei" com resultado, "mandar WhatsApp" (abre o WhatsApp do operador com texto pronto), indicador por operador (ligações, cadastros, fechamentos). | 1,5 dia |
| 2.6 | **App**: botão "Tenho interesse" no Buscar frete (mesmo fluxo), Termos/Privacidade com a linha do repasse de contato. | 0,5 dia |
| 2.7 | Testes no simulador + roteiro real com Rapha e uma empresa piloto. Deploy. | 0,5 dia |

### Fase 3 — Sofrete, lado da empresa (dias 12–17)

| Passo | O que | Esforço |
|---|---|---|
| 3.1 | **Mockups**: cadastro reforçado, "Meus fretes" com fases, lista de interessados, lista de disponíveis. | 0,5 dia |
| 3.2 | **Entrada segura** (D4): CNPJ consultado na Receita (BrasilAPI) e preenchido; RNTRC de transportadora; WhatsApp da empresa + opt-in; flag "aceito na Fretebras" (tabela importada dos 177 + lista do Emerson) exibida na moderação. | 1,5 dia |
| 3.3 | **Fases do frete** no portal: publicado → com interessados → em negociação → fechado com fulano → carregado → entregue → avaliado; lista de interessados com cartão e senha; "fechar com fulano" avisa os demais, tira da lista e vira Realizado no app. | 2 dias |
| 3.4 | **Avisos**: na Sofrete (contador, destaque) e, pra empresa com opt-in, template "novo interessado". | 1 dia |
| 3.5 | Testes + deploy. | 0,5 dia |

### Fase 4 — Motorista: disponível, localização, níveis (dias 18–22)

| Passo | O que | Esforço |
|---|---|---|
| 4.1 | **Tô vazio** (D12): na busca, o bot pergunta "quer que as empresas te vejam?"; se sim, pede localização (anexo do WhatsApp) ou cidade, e pra onde vai (UF/região/qualquer); expira em 24 h; lista "Disponíveis" na Sofrete. App: mesma pergunta com geolocalização do navegador. | 2 dias |
| 4.2 | **Níveis de certificação**: 1 telefone → 2 CNH → 3 RNTRC + foto do caminhão → 4 frete realizado e avaliado; cartão mostra o nível; bot sugere o próximo passo quando faz sentido. | 1 dia |
| 4.3 | **RNTRC** (D10): bot aceita foto do documento da ANTT ou número digitado; checagem automática quando o fornecedor estiver contratado. | 1 dia |
| 4.4 | **Meus interesses** no app + comando INTERESSES no bot + lembrete em 24 h se a empresa não respondeu. | 1 dia |

### Fase 5 — Reputação, abuso, admin, piloto (dias 23–26)

| Passo | O que | Esforço |
|---|---|---|
| 5.1 | Avaliações dos dois lados só após frete fechado; bot pergunta 2 dias após a entrega; nota no anúncio e no cartão. | 1,5 dia |
| 5.2 | Anti-abuso: limite de interesses/dia, bloqueio pela empresa, denúncia. | 0,5 dia |
| 5.3 | Admin "Funil de fretes" (interesses, tempo de resposta, fechamentos, avaliações, por operador). | 1 dia |
| 5.4 | Bateria completa + piloto com as 3 empresas + ajustes. | 1 dia |

### Fase 6 — Lojas e pagamento (quando os pré-requisitos chegarem)

- **Google Play** (D11): com o domínio Sofrete e a conta de organização → `play-store-twa.md` (service worker, `assetlinks.json`, Bubblewrap, ficha da loja já como Sofrete).
- **PRO** (D13): empresa aberta → conta no provedor → preço do Rapha → 3 segredos → deploy de `stripe-webhook` e `assinar` → cenários 70–73. Validação do PIX (D5) entra aqui se o provedor for Asaas/Pagar.me.
- Depois: Serasa (D3, se a pesquisa fechar), selfie viva (10.000), App Store (10.000), Comunidade (300).

## Totais

Fases 1 a 5: **~26 dias úteis** de código, entregáveis por fase; a Fase 2 (dia 11) já resolve
o telefone e começa a trazer embarcador. Fase 6 depende de domínio, conta na Play, empresa
aberta e provedor.
