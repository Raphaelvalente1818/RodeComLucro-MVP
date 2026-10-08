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

Detalhe visto de passagem (fila): no cenário 49 o rodapé disse "estimativa com uma carreta padrão de 3 eixos" e logo abaixo "Salvei seu Truck de 3 eixos" — o texto do rodapé usa o nome genérico quando o caminhão veio da própria mensagem.

## Pra acrescentar (próximas rodadas)
- `Quero sair do abc paulista` logo depois de "de que cidade?" (memória da pergunta).
- `nao esta certo, leu errado` / `validade 23/03/2035` depois de uma leitura (precisa de foto real).
- `sair` e voltar: conta apagada, próxima mensagem cria de novo.
- Cota diária: 21ª mensagem silenciosa, 20ª com aviso + link.
- `vc faz o que?` depois de já apresentado: não se apresenta de novo.
- `oi mãe chego as 8` (spam real): resposta curta "não era pra mim".
