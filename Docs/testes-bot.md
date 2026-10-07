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

## Pra acrescentar (próximas rodadas)
- `Quero sair do abc paulista` logo depois de "de que cidade?" (memória da pergunta).
- `nao esta certo, leu errado` / `validade 23/03/2035` depois de uma leitura (precisa de foto real).
- `sair` e voltar: conta apagada, próxima mensagem cria de novo.
- Cota diária: 21ª mensagem silenciosa, 20ª com aviso + link.
- `vc faz o que?` depois de já apresentado: não se apresenta de novo.
- `oi mãe chego as 8` (spam real): resposta curta "não era pra mim".
