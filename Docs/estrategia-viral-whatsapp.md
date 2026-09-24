# Estratégia: do contato compartilhado ao motorista cadastrado

> 24/09/2026. Pedido do Raphael: antes de codar, estudar o que já funcionou e estruturar uma solução pra validar. Fontes da pesquisa estão citadas ao longo; os números do nosso banco são de 24/09.

## 1. Onde estamos (dados reais, não impressão)

**Sete contas, dois usuários.** Emerson e David (os sócios): 40 análises, 15 fretes realizados, 57 mensagens no bot, WhatsApp vinculado, perfil completo. As outras cinco contas: três nem verificaram o telefone; duas criaram perfil de caminhão e nunca calcularam nada. Nenhuma tem cidade base, nenhuma vinculou o WhatsApp.

**Zero compartilhamentos até hoje.** O trial pra número desconhecido existe desde 10/09 e nunca foi acionado. Ninguém de fora falou com o bot.

**O que isso diz.** O funil atual pede do amigo, em ordem: abrir um link, digitar telefone, receber SMS, digitar código, aceitar termos, cadastrar caminhão (12 campos), e depois — separadamente — mandar "VINCULAR 123456" pro WhatsApp. São **três provas de identidade** (SMS, termos, código de vínculo) pra uma pessoa que já provou quem é ao mandar a mensagem. As cinco contas paradas são o resultado.

## 2. O princípio que muda tudo: o número já é o cadastro

Quando o amigo manda a primeira mensagem, a Meta já garantiu que aquele número está na mão dele. Isso é exatamente o que o SMS de OTP tenta provar. Então:

**A primeira mensagem cria a conta.** O bot (com service role) cria o usuário no Auth com `phone` = número e `phone_confirm = true`; o trigger que já existe cria a linha em `motoristas`; e `canal_wa_ativo` nasce `true`, porque o vínculo é o próprio canal de origem. Sem SMS, sem código VINCULAR, sem tela. O amigo mandou "tem frete?" e já é motorista cadastrado — ele só não sabe ainda.

Daí em diante, cadastro é conversa: uma pergunta por vez, salvando a cada resposta. O app entra depois, por um link que já abre logado. Isso segue a evidência: cada campo a mais num formulário derruba 4–7% da conclusão, e 70% das pessoas preferem responder um chatbot a preencher formulário ([NN/g via Conferbot](https://www.conferbot.com/blog/chatbot-vs-forms), [estudo revisado por pares](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9606606/)).

## 3. A jornada do amigo, mensagem por mensagem

**Passo 0 — como o contato chega.** Duas formas, ambas nativas do WhatsApp:

- **Cartão de contato (vCard).** Depois de cada cálculo, o bot oferece "Mandar pro colega". Ao tocar, o bot envia o *próprio cartão de contato* — mensagem tipo `contacts` da API ([doc Meta](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/contacts-messages/)). O motorista encaminha esse cartão; o colega toca em "Salvar" e o número entra na agenda com o nome "Rode com Lucro". Nada de copiar número.
- **Link com código de indicação.** `wa.me/5511999919971?text=Calcula%20um%20frete%20pra%20mim%20%23EMERSON` — o texto pré-preenchido é permitido e oficial ([FAQ WhatsApp](https://faq.whatsapp.com/5913398998672934)). O `#EMERSON` chega no webhook e vira atribuição da indicação sem infraestrutura nova. É o que o motorista cola em grupo de frete.

**Passo 1 — primeira mensagem (qualquer coisa).** Conta criada por baixo dos panos. Resposta em **uma mensagem só**:

> Opa! Sou o Rode com Lucro, o calculador de frete do Emerson e do David. Me manda a rota e o valor que eu digo se vale a pena. Ex.: *"Sinop pra Santos, 14 mil"*.

Se a primeira mensagem já tiver rota e valor (o caso do amigo que recebeu "manda aí que ele calcula"), pula direto pro passo 2.

**Passo 2 — o cálculo (o momento de valor).** Estimativa com caminhão genérico, veredito, e o gancho:

> ✅ **Bom frete** — sobra uns R$ 2.700 depois de diesel, pedágio e manutenção.
> *(estimativa com carreta padrão de 5 eixos)*
>
> Quer o número certo pro **seu** caminhão? Me diz só o tipo:
> [Carreta] [Bitrem] [Truck] [Outro]

Botões de resposta rápida. Uma pergunta. O motorista responde tocando.

**Passo 3 — perfil em três toques.** Tipo → eixos (botões) → consumo aproximado (botões: "2 km/L", "2,5", "3", "não sei"). Cada resposta é salva na hora em `caminhao_perfil`. Depois do terceiro toque, o bot **recalcula o mesmo frete** com os dados dele e mostra a diferença:

> Com o seu Bitrem de 7 eixos fazendo 2,2 km/L, o lucro real é **R$ 1.980** (não R$ 2.700). Ainda vale, mas negocia a partir de R$ 12.400.
> Seu caminhão ficou salvo. 🚛

Isso é o que o PRD chama de "cadastro" pro gate de validação: perfil com tipo, eixos e consumo. Aconteceu inteiro no chat, em menos de um minuto, sem sair do WhatsApp.

**Passo 4 — o app, quando fizer sentido.** Só depois do primeiro cálculo com caminhão próprio, e por motivo concreto:

> Quer ver os fretes que estão pagando bem perto de você? Abre aqui, já entra sem senha:
> [Ver fretes perto de mim]

O botão é um **link mágico**: abre o PWA já autenticado como aquele número. Sem OTP, sem tela de login. O app vira o lugar de histórico, busca por raio com mapa, e completar o resto (CNH, cidade base) quando o motorista quiser.

**Passo 5 — fechar o ciclo.** Todo veredito termina com:

> Manda esse cálculo pra um colega? 👉 *Calcule o seu: +55 11 99991-9971*

E o botão "Mandar pro colega" (o vCard). O Farmer.Chat, bot pra agricultores de baixa renda digital, mediu 79% dos usuários repassando as respostas pra outros — a viralidade veio da utilidade da resposta, não de prêmio ([Digital Green / 60 Decibels](https://www.digitalgreen.org/farmerchat)).

## 4. O que a Meta permite, custa e limita (estado em set/2026)

- **Janela de 24h.** Dentro dela, mensagem livre. Fora, só template aprovado. Cada mensagem do motorista reabre a janela ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)).
- **Custo muda em 1º de outubro.** Hoje as respostas dentro da janela são grátis. A partir de 1/10/2026 cada mensagem do bot custa ~US$ 0,0068 (≈ R$ 0,04) ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages)). Uma jornada completa de 6 mensagens = **R$ 0,25 por motorista novo**. Barato — mas mata a ideia de bot tagarela. Por isso a regra "uma mensagem, um veredito".
- **Limite de número novo: 250 conversas/dia iniciadas pelo negócio; 2.000 com a empresa verificada.** Respostas dentro da janela **não contam** — o viral inbound não bate nesse teto ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)). Verificar a empresa na Meta é tarefa desta semana.
- **Botões e templates.** Até 10 botões; URL com variável (serve pro link mágico); 1 botão de Flow ([360dialog](https://docs.360dialog.com/docs/resources/templates/template-elements)). Botões **somem** quando a mensagem é encaminhada — por isso o vCard é o objeto viral, não uma mensagem com botão.
- **WhatsApp Flows.** Formulário nativo dentro do chat, sem custo próprio ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/llms.txt)). Candidato a experimento contra a sequência de botões.
- **Opt-in.** Receber mensagem do motorista **não** é opt-in pra mandar mensagem fora da janela. Precisa de consentimento explícito ([Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in)). Sem isso, não há "lembrete" no dia seguinte.
- **Qualidade.** Bloqueios e denúncias derrubam a nota e travam o tier ([Meta](https://www.facebook.com/business/help/896873687365001)). Spam em grupo é o jeito mais rápido de perder o número.
- **LGPD.** Número de quem escreveu pode ser guardado pra atender e evitar abuso; usar pra campanha sem opt-in viola finalidade ([Sinch](https://sinch.com/pt/blog/protecao-de-dados-pelo-whatsapp/)). Política de privacidade precisa citar o canal.

## 5. Como saber se funcionou: o funil e as metas

| Etapa | Evento | Meta pra validar |
|---|---|---|
| F0 | Número desconhecido manda mensagem | — (é o topo) |
| F1 | Recebeu um veredito | ≥ 85% de F0 |
| F2 | Respondeu a 1ª pergunta do caminhão | ≥ 50% de F1 |
| F3 | Perfil mínimo salvo (tipo + eixos + consumo) | ≥ 35% de F1 |
| F4 | Abriu o app pelo link mágico | ≥ 25% de F3 |
| F5 | Fez 2º cálculo em até 7 dias | ≥ 30% de F3 |
| F6 | Indicou alguém (vCard enviado ou `#código` chegou) | K ≥ 0,4 |

**K** = novos motoristas trazidos por motorista, na média. Abaixo de 0,4 o viral não sustenta sozinho e precisa de outra fonte; acima de 1 cresce sozinho. O Nubank chegou a 80–90% de aquisição por boca a boca sem pagar nada, com escassez e produto bom ([Growth Leaders](https://growthleaders.academy/blog/como-o-nubank-saiu-de-uma-garagem-e-conquistou-48m-de-clientes/)).

Tudo isso já é medível com o `analytics_event` que existe — a diferença é que, com conta criada na primeira mensagem, o `actor_id` deixa de ser nulo e o motorista novo entra no gate de validação (160 jornadas) desde o primeiro "oi".

**Semente.** Viral com zero não anda. Emerson e David mandam o cartão pra 15 colegas cada = 30 no F0. Em duas semanas dá pra ler F1–F5 com alguma confiança; F6 precisa de mais tempo.

## 6. Experimentos, do mais barato ao mais caro

1. **Conta na primeira mensagem + resposta única com botão de caminhão.** Sem isso nada do resto funciona. É o experimento zero.
2. **vCard "Mandar pro colega" após o veredito.** Mede F6 de forma limpa.
3. **Código `#NOME` no wa.me** pra grupos. Mede de onde vem cada novo número.
4. **Perfil por botões vs. WhatsApp Flow** (metade de cada). Mede F2→F3.
5. **Link mágico vs. link pra tela de entrada.** Mede F4. Hipótese forte: o link normal perde a maioria.
6. **Texto do gancho** ("Quer o número certo pro seu caminhão?" vs. "Sua carreta é diferente dessa. Me diz qual é."). Barato, roda em paralelo.
7. **Opt-in + lembrete no dia seguinte** (template utility, R$ 0,04) pra quem parou em F1/F2. Só depois do opt-in existir.
8. **Prova social** ("O Emerson e mais 23 motoristas de Sinop usam"). Hipótese sem evidência específica pra caminhoneiro — testar por último.

O que **não** vamos fazer agora: pagar por indicação. Onde funcionou (Buser R$ 15, Uber) havia transação pra ancorar; aqui a recompensa é acesso e utilidade. Fica na gaveta pra quando houver frete fechado pelo app.

## 7. O que codar, em ordem

**Fase 1 — antes de 1º de outubro (a cobrança por mensagem começa).**
- `wa-webhook`: número desconhecido → `auth.admin.createUser({phone, phone_confirm: true})` → trigger cria motorista → marcar `canal_wa_ativo`. Guardar `#código` de indicação em `motoristas.indicado_por`.
- Resposta única com veredito + botões de tipo de caminhão (interactive reply buttons, já usamos lista no busca-wpp).
- Máquina de estados do perfil por chat: `wa_onboarding` (número, etapa, respostas parciais). Três etapas. Recalcula ao final.
- Mensagem `contacts` (vCard) no botão "Mandar pro colega".
- Eventos F0–F6 no `analytics_event` com `actor_id` preenchido.
- Aba no admin: funil viral (os 7 números acima), por semana e por indicador.
- Verificar a empresa no Meta Business.

**Fase 2 — semanas seguintes.**
- Link mágico: Edge Function `wa-link-app` gera token de uso único; o PWA troca por sessão. (Decisão técnica em aberto: Supabase não emite magic link por telefone; opções são e-mail sintético `{numero}@wa.rodecomlucro.app` + `generateLink`, ou o app disparar `signInWithOtp` e a própria function confirmar. Resolver na implementação.)
- Opt-in explícito com botão; template utility de lembrete.
- WhatsApp Flow de cadastro pra comparar com botões.

**Fase 3 — com dado.**
- Prova social, urgência (frete expira), reputação. Só o que os números pedirem.

## 8. Riscos e como tratar

- **Conta criada sem consentimento explícito.** Mitigar: o próprio veredito diz "seu caminhão ficou salvo; pra apagar, manda SAIR". Termos e privacidade linkados na primeira resposta. Comando SAIR apaga tudo (já existe `/apagar-conta` no PRD).
- **Spam em grupos derruba o número.** O motorista compartilha, não o bot. Nunca mandar mensagem iniciada pelo negócio sem opt-in. Monitorar a nota de qualidade toda semana no admin.
- **Custo pós-outubro.** R$ 0,25 por motorista novo a 6 mensagens. Com 1.000 motoristas/mês, R$ 250. Aceitável; o admin mostra o gasto estimado.
- **Número genérico dá veredito errado.** A estimativa com carreta padrão pode errar pra cima ou pra baixo. Por isso a primeira resposta diz "estimativa" e o gancho é justamente corrigir com o caminhão real — o erro vira o motivo do cadastro.
- **Colega manda áudio.** Hoje ignoramos. Transcrição (Whisper) é barata e caminhoneiro manda áudio; entra na fase 2 se F0 mostrar áudio relevante.

## 9. Resumo em uma frase

Parar de pedir pro amigo se cadastrar e passar a cadastrá-lo sem ele perceber, na conversa que ele já começou — e dar a ele o motivo de compartilhar (o veredito) e a ferramenta (o cartão de contato) no mesmo lugar.
