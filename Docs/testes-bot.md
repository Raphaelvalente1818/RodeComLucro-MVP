# Bateria de testes do bot (simulador)

Criado em 07/10/2026. O `wa-webhook` tem um simulador: números `5590XXXXXXXX`
(DDD 90 não existe) passam pelo pipeline inteiro — Haiku, corretor de cidade,
Google Routes, banco — mas nada vai pra Meta; as respostas voltam no JSON.
Token em `bot_config.simulacao_token` (só service_role; o Claude lê pelo MCP).

```
GET https://gastwloozlzthpqhxnzr.supabase.co/functions/v1/wa-webhook
    ?simular=1&token=<token>&de=559000000001&texto=<mensagem>
    ?simular=1&token=<token>&de=559000000001&botao=<rowId>      (toca num botão/linha)
    ?simular=1&token=<token>&de=559000000001&reset=1            (apaga a conta simulada)
```

Resposta: `{ de, enviado, respostas: [{tipo: texto|botoes|lista|contato, texto, opcoes?}], ms }`.
Foto/PDF não dá pra simular (a mídia vem da Meta) — CNH/CRLV continua teste manual.

**Regra**: rodar a bateria depois de cada deploy do bot, antes do Raphael testar.
Escrever como caminhoneiro escreve: sem acento, abreviado, com erro ("truk", "qnto", "saino").

## Roteiro (número novo: começar com reset=1)

| # | Mensagem | Esperado | 07/10 |
|---|---|---|---|
| 1 | `Oi, recebi esse contato do João da boca` | Agradece citando o João, se apresenta, exemplo; rodapé "número cadastrado" | ✅ |
| 2 | `quero uma carga` | Pede o tipo do caminhão (botões Carreta/Bitrem/Truck) | ✅ |
| 3 | botão `onb_tipo:Carreta` → `5` → `faz uns 2 e meio` | Eixos por texto; consumo 2,5; volta pra busca pedindo a cidade | ⚠️ "2 e meio" virou 2 → corrigido v61 |
| 4 | `abc paulista` | NÃO assumir Paulista/PB: botões "Paulista/PB / Outra cidade" | ❌ buscou na PB → corrigido v61 (só exato segue; corrigido = botões) |
| 5 | `frete diadema coruipe 15mil truk grade baixa vale?` | Diadema/SP → Coruripe/AL, Truck 3 eixos, veredito, nota "entendi coruipe", botão salvar caminhão | ✅ |
| 6 | `qto de pedagio?` | Valor do pedágio do último cálculo | ✅ |
| 7 | `e se eu volta vazio?` | Recalcula com volta vazia | ❌ mandou a apresentação → corrigido v61 (vira recálculo) |
| 8 | `qnto cobro de carandai pra piracaia` | Cotação com km, pedágio, custo, piso, valor sugerido | ✅ |
| 9 | `sinop pra bom jesus 10 mil` → botão `cidade:d:Bom Jesus/PI` | Botões com 3 UFs; depois calcula Sinop/MT → Bom Jesus/PI; convite do cadastro por foto | ✅ |
| 10 | `ja fez meu cadastro?` | Responde pelo estado real (aguardando "Pode ler"), sem inventar | ✅ |
| 11 | `pode le` | Registra consentimento e pede a foto | ❌ respondeu mas não registrou → corrigido v61 |
| 12 | `tem carga saino de cuiaba?` | Lista de fretes perto de Cuiabá/MT | ✅ |
| 13 | `sorocaba curitiba 8500 ta bom?` | Cálculo Sorocaba/SP → Curitiba/PR | ✅ |

## Rodada 2 (07/10, v61 no ar) — número 559000000002

| # | Mensagem | Esperado | Resultado |
|---|---|---|---|
| 14 | `blz` | Apresentação curta + rodapé cadastro | ✅ |
| 15 | `vc faz oq?` | Diz o que faz sem se apresentar de novo | ✅ |
| 16 | `sp x rj 4,5 mil bitrem` | SP→RJ, R$ 4.500, Bitrem 7 eixos salvo como caminhão | ✅ (nota dizia "Bitrem 7 eixos de 7 eixos" → corrigido v62) |
| 17 | `e se pagar 3500?` | Recalcula com 3.500 | ❌ "não peguei" → corrigido v62 (rota+valor sem resposta = recálculo); ✅ reconferido na v62 ("e se pagarem 9 mil nesse bh salvador?") |
| 18 | `tem carga no abc paulista?` | Botões Paulista/PB · Paulista/PE · Outra cidade (não assume) | ✅ |
| 19 | botão Outra cidade → `sto andre` | Botões Santo André/SP · /PB | ✅ (v62: "sto"→"santo", "sta", "pto", "s " expandidos antes do trigram) |
| 20 | botão Santo André/SP | Lista de 3 fretes perto de Santo André | ✅ |
| 21 | `e se eu volta vazio de sp pro rio?` | Recálculo pelo motor com volta vazia | ⚠️ Haiku respondeu calculando de cabeça → corrigido v62; ✅ reconferido ("e voltando vazio?" → custo R$ 10.357, lucro negativo). v63: cabeçalho diz "voltando vazio"; volta vazia sobre COTAÇÃO (sem valor) recota (antes caía em "não peguei") |
| 22 | `oi mae chego as 8 pode deixar a janta` | "não era pra mim", curto | ✅ |
| 23 | `cadastro` → `bora` | Convite; "bora" registra consentimento (conferido em `consentimento`) e pede a foto | ✅ |
| 24 | `sair` → `piso antt de bh pra salvador carreta ls` | Apaga; mensagem seguinte cria conta de novo e cota BH→Salvador com Carreta LS | ✅ |

## Rodada 3 (07/10, v63 no ar) — número 559000000003

| # | Mensagem | Esperado | Resultado |
|---|---|---|---|
| 25 | `tenho um frete de goiania` → `pra fortaleza` → `pagam 14 mil` | Mensagem picada em 3: pede destino, cota, depois calcula com 14 mil (memória) | ✅ (onboarding mandou os botões 2× → v64 não repete em 10 min) |
| 26 | `cuiaba santos soja 180 a tonelada bitrem graneleiro` (com onboarding pendente) | Calcular por tonelada | ❌ engolido como resposta "Bitrem" do onboarding → v64: só resposta curta (≤4 palavras) conta como onboarding; frase longa com caminhão encerra o onboarding |
| 27 | `cuiaba santos soja 180 a tonelada graneleiro` | 180/t × capacidade (ou pergunta toneladas) | ❌ ignorou o valor, cotou → v64: `valor_por_tonelada` + `toneladas` na extração; sem capacidade pergunta "quantas toneladas?" |
| 28 | `manaus pra belem 20 mil` | Belém/PA direto (capital), rota 3.045 km | ⚠️ perguntou PB/AL/PA → v64: homônimo capital ganha e avisa |
| 29 | `vlw irmao` | Uma linha, sem apresentação | ❌ reapresentou → v64: qualquer conversa anterior = já apresentado; agradecimento = resposta de uma linha |
| 30 | "Bitrem 7 eixos de 7 eixos" | Nome sem redundância em todas as mensagens | v64: `nomeVeiculo()` |

**Reconferência na v64** (559000000003/04): "valeu parceiro, show" → "Tamo junto! Qualquer frete, manda." ✅ · "rondonopolis santos soja 190 o ton" → pergunta toneladas → "37" → R$ 7.030 ✅ · "goiania pra belem 12 mil" → Belém/PA direto com aviso ✅ · frete longo com "bitrem graneleiro 32 ton" com onboarding pendente → calcula e salva o caminhão ✅. v65: rodapé de caminhão recém-criado pela mensagem deixa de dizer "perfil cadastrado no app".

## Rodada 4 (07/10, v64 no ar)

| # | Mensagem | Esperado | Resultado |
|---|---|---|---|
| 31 | `TENHO FRETE DE CAMPINAS PRA MINAS 6 MIL` | Maiúsculas ok; "Minas" é estado → pergunta a cidade em MG | ❌ ofereceu "Minas Novas/MG" → v65: nomes de estado/região viram pergunta "Minas é um estado — qual cidade?" (cálculo e busca) |
| 32 | 20ª consulta do dia (`qto deu de diesel?`) | Responde + aviso "última consulta de hoje" com link logado | ✅ |
| 33 | 21ª (`e o pedagio?`) | Silêncio | ✅ |
| 34 | `SAIR` com a cota estourada | Apaga mesmo assim | ✅ (cota continua contando pelo número depois — não zera com SAIR, de propósito) |

## Rodada 5 (08/10, v66 — consolidação "IA interpreta, código executa")

Estado "CNH lida, esperando confirmação" montado direto no banco (559000000005) — as frases do Raphael de 07/10 à noite:

| # | Mensagem | Esperado | Resultado |
|---|---|---|---|
| 35 | `Tá tudo errado a data o número, só meu nome está correto` | Descarta a leitura e pede foto nova (sem inventar valor) | ✅ |
| 36 | `Esquece a cnh, vou mandar o documento do cavalo` | Deixa a CNH pra depois e espera o CRLV | ✅ |
| 37 | `a validade certa eh 23/03/2035 e a categoria eh E` | Corrige só esses dois campos e reapresenta com botões | ✅ |
| 38 | `agora sim, pode salvar` | Salva | ✅ |
| 39 | `quero uma carga` → `carreta ls` → `6` → `faz uns 2 e meio` | Onboarding inteiro por texto (inclusive "Carreta LS", que os botões não têm) | ✅ |
| 40 | `sto andre sp` | Busca em Santo André/SP | ✅ |
| 41 | `sinop pra bom jesus 10 mil` → `o do piaui` | Escolhe Bom Jesus/PI pelo texto, sem botão | ✅ |
| 42 | `pode le sim` | Registra consentimento e pede a foto | ✅ |
| 43 | `frete campinas pra minas 6 mil vale?` | "Minas é um estado — qual cidade?" | ✅ |

## Rodada 6 (08/10, regressão completa na v66/v67 antes de avisar o Rapha) — números 06/07/08

22 cenários das rodadas 1–4 reexecutados: 19 ✅ de primeira. Falhas e correções (v67/v68):

| # | Mensagem | Problema | Correção |
|---|---|---|---|
| 44 | `Oi, recebi esse contato do João da boca` | "Valeu, João!" — chamou o motorista pelo nome do indicador (regressão da reescrita do prompt) | exemplo explícito + "quem indicou é outra pessoa" (seção 4) ✅ reconferido |
| 45 | `rondonopolis santos soja 190 o ton` | IA extraiu 190/t mas rotulou "cotar"; o código cotou sem valor | regra no código: valor (fixo ou /t) presente = calcular ✅ reconferido ("e se pagar 200 o ton?" lembrou 37 t) |
| 46 | `tem carga no abc paulista?` → `nenhuma, sao bernardo` | casou exato com **São Bernardo/MA** e listou carga no Maranhão | apelidos de cidade grande com nome curto (São Bernardo do Campo, São Caetano do Sul, Ribeirão Preto, Rio Preto, Mogi, Feira, SJC…) ✅ reconferido. Fila: população IBGE em `municipios_brasil` pra desempatar de verdade |
| 47 | `bom dia` (já apresentado) | "Bom dia, Tamo junto - qualquer frete, manda" — fechamento no lugar de abertura (achado do Raphael) | seção 4: abertura abre as duas portas com exemplo e *BUSCAR*; fechamento continua uma linha |
| 48 | mensagem longa de cálculo com cliente desconectando | função cortada no meio: cálculo gravado, resposta nunca enviada | v68: responde 200 pra Meta na hora e processa com `EdgeRuntime.waitUntil` (simulador segue síncrono) |

## Rodada 7 (08/10, v70 — diesel e consumo ditos na mensagem) — número 559000000009

Achado do Raphael pelo WhatsApp: "São Carlos SP para Goiânia 6700 com diesel a 15,00" ignorava o diesel; "diesel a 6,50" voltava o mesmo valor. Correção: `diesel_preco_litro` e `consumo_km_por_litro` na extração → `aplicarCustosDitos` ajusta o perfil do cálculo e grava em `caminhao_perfil` ("guardei como seu valor atual").

| # | Mensagem | Esperado | Resultado |
|---|---|---|---|
| 49 | `sao carlos sp pra goiania 6700 com diesel a 15,00 truck grade baixa` | Calcula com diesel a 15 (custo alto), nota "calculei com diesel a R$ 15,00/L" | ✅ custo R$ 4.974,91 |
| 50 | `e se o diesel for 6,50?` | Recalcula a mesma rota com 6,50 | ✅ custo R$ 2.700,65, lucro R$ 3.999 |

Detalhe visto de passagem: no cenário 49 o rodapé disse "estimativa com uma carreta padrão de 3 eixos" e logo abaixo "Salvei seu Truck de 3 eixos" — o rodapé do primeiro contato usava o nome genérico mesmo quando o caminhão veio da própria mensagem. **Corrigido na v71** e reconferido: "estimativa com seu Truck de 3 eixos, consumo e custos padrão" ✅.

| 51 | `sao carlos sp pra goiania 6700 com diesel a 15 truck grade baixa vale?` (v71) | São Carlos/SP direto (a UF veio na mensagem) | ⚠️ perguntou SP ou SC — o Haiku soltou o "sp" desta vez (no #49 tinha mantido). Prompt seção 2: "se ele escreveu a UF junto, mantenha" → v72 ✅ reconferido na v73 (São Carlos/SP direto). Bônus: piso ANTT já na Portaria SUROC 22/2026 — R$ 4.031,98 (era 3.951,71 na 6.084) |

## Rodada 8 (08/10 à noite, v74 — IA inventando número) — caso real do Rapha

Linha do tempo (554199871818): cálculo pela lista (SBC → Aparecida de Goiânia, R$ 8.000, 6 eixos) com diesel **6,10** do perfil; "Quanto tá o diesel em Santo André?" → IA: "usei **5,87**" (inventado); "atualiza, diesel 6,03" → recálculo certo (custo 3.776 → 3.751, porque 6,03 < 6,10); "como o custo foi menor?" → IA inventou causa ("diesel subiu de 2.225 pra 2.200"). **Motor certo, IA errada 2×.** v74: contexto leva `insumos` (diesel, km/L, custos por km) e `calculo_anterior`; prompt seção 8: só número do contexto, comparação insumo por insumo.

| # | Mensagem | Esperado | Resultado |
|---|---|---|---|
| 52 | cálculo → `quanto vc usou de diesel?` | Cita o valor dos insumos (ex.: R$ 6,10/L), sem inventar | ✅ "Usei R$ 2.225,77 em diesel. Consumo 2,5 km/L, preço R$ 6,10/L — uns 365 litros" |
| 53 | `atualiza que o diesel aqui ta 6,03` → `por que o custo ficou menor?` | Recalcula; depois compara: "antes 6,10, agora 6,03, por isso caiu R$ 25" | ✅ "O diesel *desceu*, não subiu. Antes 6,10, agora 6,03 … economizou R$ 25,55, exatamente a diferença (3.776,30 → 3.750,76)" |
| 54 | `quanto ta o diesel em santo andre?` | "Não tenho preço de posto; manda o preço que eu recalculo" | ✅ |

## Rodada 9 (09/10, v75 — cota diária, opção A) — caso real do Emerson

"Segunda consulta do dia e veio 'última de hoje'": a janela era 24 h corridas (ontem 10:02 → hoje 08:05 ainda contava) e contava bate-papo e "qual cidade?" (11 cálculos + 5 respostas livres + 4 cidade_pendente = 20). v75: dia de calendário em São Paulo; só `calculado*`, `cotado` e `busca_lista` (status novo — a busca que acha frete não gravava linha) contam.

| # | Mensagem | Esperado | Resultado |
|---|---|---|---|
| 55 | número 11: cálculo + cotação + pergunta + "vlw" + "abc paulista?" (qual cidade) + busca com lista | Cota = 3 (cálculo, cotação, busca_lista); pergunta, bate-papo e "qual cidade?" não contam | ✅ v77 conferido no banco com a mesma query do bot. Emerson hoje: 2 cálculos = 2 de 20 (liberado) |
| 57 | `manaus pra boa vista 9 mil` (rota sem pedágio no Google) | Resposta traz "não achei o pedágio dessa rota — o custo está SEM pedágio"; na cotação, linha "Pedágio: não disponível" | ✅ v77 (Manaus→Boa Vista 747 km e cotação Porto Velho→Rio Branco) |
| 56 | Virada da meia-noite (SP) | Contador zera | conferido na função (`inicioDoDiaSaoPaulo`: 11:30Z → 03:00Z do dia; 02:30Z → 03:00Z do dia anterior) ✅ |

## Rodada 10 (09/10, v76 — eixos são do CONJUNTO)

Pedido do Raphael: "o caminhoneiro pode responder o número de eixos da carreta, pensando na parte de trás" (o Rapha fez isso em 08/10: "só a carreta tem 3 eixos, o conjunto é LS 6"). Mudou: pergunta do onboarding ("Quantos eixos tem o conjunto todo (cavalo + carreta), contando tudo?"; Truck: "o caminhão"), prompt (eixos sempre do conjunto; parte só → null / explica e pede o total), pendência, confirmação do CRLV ("3 eixos (só da carreta)"), rótulos do app (Perfil e Calcular).

| # | Mensagem | Esperado | Resultado |
|---|---|---|---|
| 58 | `quero uma carga` → botão Carreta | Pergunta "Quantos eixos tem o conjunto todo (cavalo + carreta), contando tudo?" com 4/5/6 | ✅ v80 |
| 59 | na etapa eixos: `a carreta tem 3` | Não grava 3; explica que conta tudo junto (LS 6, simples 5, bitrem 7) e pede o total | ✅ v80 "Preciso do total junto: se a carreta tem 3, quantos eixos o cavalo tem? Aí soma e manda o número" → "então são 6" seguiu pro consumo |
| 60 | `só a carreta ou o conjunto todo?` | Mesma explicação, sem gravar | (coberto pelo 59) |
| 61 | `sp pro rio 4500 carreta ls 6 eixos` | numero_eixos 6 | ✅ (onboarding por texto "carreta ls 6 eixos" na regressão) |

## Rodada 11 (09/10, v76 — foto = autorização; "Está correto / Corrigir")

Pedido do Raphael: não perguntar "Pode ler?" depois que a foto chegou (a autorização está implícita no envio); a pergunta é "Está correto?" com botões *Está correto* / *Corrigir*; em Corrigir, pedir o que está errado e o valor certo. Mudou: `tratarImagemRecebida` registra o consentimento com a própria foto como evidência e lê na hora (status `doc_imagem_sem_contexto` deixa de existir no fluxo); botões 2 em vez de 3 (cancelar continua por texto); ação nova `campo_errado` (ele diz o campo sem o valor → bot pergunta o valor, sem descartar a leitura; `reler` só pra "tá tudo errado").

| # | Mensagem | Esperado | Resultado |
|---|---|---|---|
| 62 | foto da CNH sem ter falado nada antes (manual — Rapha) | Lê direto, sem "Pode ler?"; mostra a leitura com *Está correto* / *Corrigir* | manual |
| 63 | botão Corrigir | "Me diz o que está errado e o valor certo…" | manual |
| 64 | (leitura pendente) `o nome ta errado` | Pergunta "Qual é o nome certo?" — não pede foto nova | ❌ v80: parser não aceitava `campo_errado` (caiu na apresentação) → v81 ✅ "Beleza. Qual é o *nome* certo? Manda só o valor." |
| 65 | (leitura pendente) `ta tudo errado` | Descarta e pede a foto de novo | ✅ v81 |
| 66 | (leitura pendente) `a validade certa eh 23/03/2035` | Corrige só a validade e reapresenta com os 2 botões | ✅ v81 (corrigiu o nome e reapresentou com *Está correto* / *Corrigir*) |

## Rodada 12 (09/10, v76 — apresentação é texto fixo)

Print do Rapha (08/10 18:58): "Ola" → a IA escreveu a apresentação de cabeça: "**Evalio** se um frete vale a pena", "**coto** rotas sem valor". Mudou: na primeira saudação/pergunta sobre o bot o código manda `mensagemApresentacao()` (a mesma do AJUDA, revisada); a IA só devolve `nome_indicador` quando ele chega por indicação e o código monta "Opa! Que bom que o João te passou meu contato." + apresentação.

| # | Mensagem | Esperado | Resultado |
|---|---|---|---|
| 67 | número novo: `Ola` | Apresentação fixa (1️⃣ 2️⃣ 3️⃣ + foto da CNH/CRLV), sem texto da IA | ✅ v80 |
| 68 | número novo: `Oi, recebi esse contato do João da boca` | "Opa! Que bom que o João te passou meu contato." + apresentação fixa | ✅ v80 |
| 69 | já apresentado: `bom dia` | Continua a abertura curta da IA com exemplo e *BUSCAR* (cenário 47) | ✅ v81 "Bom dia! Tem frete novo pra avaliar ou quer *BUSCAR* carga perto de você?" |

## Regressão completa — 09/10, v81 (pedido do Raphael: "rodar a bancada")

Números 12–15. Reexecutados: 5 (coruipe/truck), 6 (pedágio), 7 (volta vazia), 17 (e se pagar 18 mil — manteve a volta vazia do recálculo anterior, correto), 8 (cotação Carandaí→Piracaia), 9+41 (Bom Jesus → "o do piaui"), 27 (190 o ton → 14 t), 28 (Belém capital), 31 (Minas é estado), 22 (spam), 47 (bom dia), 29 (vlw), 25 (frete picado em 3 — cotou e depois calculou com 14 mil), 18–20 (abc paulista → onboarding → São Bernardo do Campo/SP com 3 fretes), clique na lista (SBC→Aparecida), 24 (SAIR). **Todos ✅.** Mais os de hoje: 55, 57, 58–61, 64–69.

Melhoria vista de passagem (fila, não é regressão): "carreta ls 6 eixos faz uns 2 e meio" numa mensagem só, durante o onboarding, só aproveitou o tipo e perguntou eixos e consumo de novo — o onboarding podia pegar os três de uma vez.

## Rodada 13 (09/10, v78 — assinatura PRO)

| # | Mensagem | Esperado | Resultado |
|---|---|---|---|
| 70 | `PRO` (sem chaves do Stripe) | "O plano PRO ainda não está disponível — em breve…" | pendente de deploy |
| 71 | `quanto custa o pro?` | intent assinar → mesma resposta do comando | pendente de deploy |
| 72 | `PRO` (com chaves de teste) | Preço lido do Stripe + link do Checkout; depois de pagar com 4242…, `PRO` → "Você é PRO, renova em …" + link do portal | aguardando conta Stripe |
| 73 | busca com fretes publicados há < 2 h, sem PRO | Lista sem eles + "🔒 Mais N … só no PRO" | aguardando frete novo no banco |

## Rodada 14 (09/10, v79 — compartilhar frete com um colega)

Pedido do Raphael ("última de hoje"): compartilhar um frete; o colega, mesmo sem conta, entra e recebe o frete. WhatsApp não deixa a gente iniciar conversa sem opt-in, então o fluxo tem **um toque** do colega: mensagem pronta pra encaminhar → link `wa.me/<bot>?text=FRETE <código> #<indicador>` → ele envia → conta nasce, indicação gravada (`indicacao`), frete calculado pelo mesmo caminho do clique na lista. Migration `20261009200000` (código de 5 letras por frete, `codigo_indicacao` preenchido pra todos os motoristas + trigger, tabela `indicacao`).

| # | Mensagem | Esperado | Resultado |
|---|---|---|---|
| 74 | clique num frete da lista | Depois do cálculo, botão "Mandar pra um colega" | ✅ v84 — botão `frete:share:82PUW` |
| 75 | botão Mandar pra um colega | Mensagem pronta (rota · valor · tipos + link wa.me com FRETE <cod> #<ref>) + "👆 Encaminha…" | ✅ v84 — `wa.me/5511999919971?text=FRETE%2082PUW%20%23P3JP5Y` |
| 76 | número NOVO: `FRETE 82PUW #GTDGKY` | "Opa! … um colega te mandou esse frete" + cálculo SBC→Aparecida + convite do caminhão; linha em `indicacao` (indicador = Emerson) | ✅ v84 (Opa + cálculo + `indicacao` com indicador Emerson, `indicado_por_codigo=GTDGKY`) — **mas** o rodapé dizia "com base no seu perfil cadastrado no app" e não puxou o onboarding do caminhão: `tratarRespostaLista` nunca passava `semPerfil` (bug antigo do clique na lista). Corrigido e reconfirmado na v85 ✅: rodapé "carreta padrão de 5 eixos — você ainda não cadastrou o seu" + botões Carreta/Bitrem/Truck |
| 77 | `FRETE ZZZZZ` (não existe) | "Esse frete já foi fechado ou saiu do ar… manda BUSCAR" | ✅ v84 |
| 78 | mesmo número manda `FRETE …` de novo com outro #ref | Não cria segunda indicação (unique por indicado) | ✅ v84 — `FRETE 82PUW #P3JP5Y` calculou de novo, `indicacao` continua 1 linha (GTDGKY) |
| 79 | motorista com perfil clica num frete da lista no 5º cálculo | Só o botão "Mandar pra um colega" (do frete); o cartão genérico "Mandar pro colega" (vCard, a cada 5 cálculos) não sai na mesma rodada | print do Emerson 09/10: saíram os dois → corrigido na v86 (`fretePublicado?.codigo` encerra antes do cartão) |

## Pra acrescentar (próximas rodadas)
- `Quero sair do abc paulista` logo depois de "de que cidade?" (memória da pergunta).
- `nao esta certo, leu errado` / `validade 23/03/2035` depois de uma leitura (precisa de foto real).
- `sair` e voltar: conta apagada, próxima mensagem cria de novo.
- Cota diária: 21ª mensagem silenciosa, 20ª com aviso + link.
- `vc faz o que?` depois de já apresentado: não se apresenta de novo.
- `oi mãe chego as 8` (spam real): resposta curta "não era pra mim".
