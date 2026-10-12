# Chat interno motorista ↔ embarcador — análise prévia (12/10/2026)

Problema: o telefone do contratante só pode aparecer quando o embarcador permitir. Quando
não permitir, motorista e embarcador precisam conversar por dentro do Rode com Lucro /
Sofrete. Hoje o contato é exposto direto (`fretes_publicados.contato_telefone` → botões
"ligar" e "WhatsApp" no Buscar; texto no bot). Sem codificar nada ainda.

## Premissa que muda tudo

O motorista **está no WhatsApp**, não numa tela. Um chat que só funciona com o app aberto
morre no primeiro dia (o Zé Boléia é a prova). Então o "cliente de chat" do motorista tem
que ser o próprio bot: ele manda "tenho interesse" e recebe as respostas do embarcador como
mensagens normais do WhatsApp. O embarcador, que está no PC, usa uma caixa de entrada no
portal Sofrete. O chat interno é um **relay**: portal ⇄ banco ⇄ bot.

## Opções

| | A — Relay pelo bot (recomendada) | B — Chat em tela nos dois lados | C — Só "pedido de contato" |
|---|---|---|---|
| Motorista | Conversa pelo WhatsApp (bot), igual ao que já faz. App mostra o histórico. | Precisa abrir o PWA pra ver resposta; sem push no iPhone sem instalar. | Toca "Tenho interesse", o embarcador decide liberar o telefone; sem conversa. |
| Embarcador | Caixa de entrada no portal (tempo real) + aviso. | Idem. | Lista de interessados com "liberar meu telefone". |
| Esforço | 5–7 dias | 7–10 dias | 2 dias |
| Risco | Janela de 24 h da Meta (abaixo). | Motorista não vê a resposta. | Embarcador precisa responder um a um; sem negociação. |

**C é o mínimo viável e cabe dentro de A**: o primeiro passo do relay é exatamente
"interessado → embarcador libera telefone ou responde". Dá pra entregar C em 2 dias e
crescer pra A sem jogar nada fora.

## Como funciona (opção A)

1. Embarcador publica o frete com **"Telefone visível: sim/não"** (campo novo). Sim = como
   hoje. Não = botão vira "Tenho interesse".
2. Motorista (bot ou app) toca "Tenho interesse" e pode mandar uma linha ("tenho carreta
   sider em Itajaí, carrego amanhã"). Nasce uma `conversa` (frete + motorista + empresa).
   Só motorista **verificado** (CNH lida) abre conversa — é o filtro contra o golpe que
   infesta o concorrente.
3. Embarcador vê no portal: caixa "Interessados" por frete, com o cartão do motorista
   (nome, caminhão, eixos, cidade atual, selo verificado, indicado por quem). Responde por
   texto ou toca **"Liberar meu telefone"** (a conversa vira contato direto) ou **"Fechar
   frete com ele"**.
4. Resposta do embarcador chega ao motorista como mensagem do bot: "📩 *Transportes X*
   sobre o frete Itajaí → Jundiaí: 'Pode carregar às 7h?'". O motorista responde no
   WhatsApp e o bot roteia pra conversa.
5. App do motorista mostra o histórico (tela simples, leitura + envio) — opcional na v1.

## O que precisa ser construído

| Peça | Detalhe | Esforço |
|---|---|---|
| Banco | `fretes_publicados.telefone_visivel`; tabelas `conversa` (frete, motorista, empresa, status aberta/telefone_liberado/fechada, última mensagem) e `mensagem` (conversa, autor motorista/empresa, texto, lida, id da mensagem WA); RLS (empresa vê só as suas; motorista só as dele); índices. | 0,5 dia |
| Bot — iniciar | Botão "Tenho interesse" depois do cálculo do frete da lista (hoje é "Mandar pra um colega"; viram dois botões). Pendência nova `conversa_aberta`: o Haiku decide se o texto é resposta ao embarcador ou pedido novo (princípio "IA interpreta, código executa"). Com mais de uma conversa aberta, botões "Responder: Transportes X / Y". | 1,5 dia |
| Bot — entregar | Quando a empresa responde, o bot manda ao motorista. **Janela de 24 h da Meta**: se o motorista falou com o bot nas últimas 24 h, texto livre (R$ 0,04); se não, precisa de **template aprovado** ("Você tem resposta de {empresa} sobre o frete {rota}. Responda aqui.") — igual ao `modelo01` do OTP, categoria utilidade. Criar e aprovar na Meta (1–3 dias de espera, fora do esforço). | 1 dia + aprovação Meta |
| Portal Sofrete | Caixa "Interessados" no detalhe do frete e uma "Mensagens" geral; tempo real via Supabase Realtime (já incluído no plano); botões liberar telefone / fechar frete; contador de não lidas no menu. | 2 dias |
| Aviso ao embarcador | Ele não fica com o portal aberto. v1: e-mail (não temos envio de e-mail hoje — Resend/Supabase SMTP, 0,5 dia) ou WhatsApp pro telefone da empresa via template (mesma regra de 24 h). | 0,5–1 dia |
| App do motorista | Tela "Conversas" simples (lista + thread). Opcional na v1 — o WhatsApp já cobre. | 1 dia (depois) |
| Moderação/abuso | Só verificado inicia; limite de conversas/dia por motorista; embarcador pode bloquear; denúncia. Mínimo na v1. | 0,5 dia |
| Testes | Cenários no simulador (interesse, resposta, duas conversas, janela de 24 h, telefone liberado). | 0,5 dia |

**Total A: ~6 dias úteis** (+ espera da aprovação do template na Meta). **C sozinho: ~2
dias** (banco mínimo, botão, lista de interessados, liberar telefone, aviso).

## Custos e cuidados

- Meta: cada mensagem do bot ao motorista ~R$ 0,04; uma negociação de 10 mensagens = R$ 0,40.
  Template de utilidade fora da janela custa um pouco mais. Irrelevante por enquanto.
- O bot vira um canal de pessoa pra pessoa: entra nos Termos (mensagens guardadas, podem
  ser lidas pra moderação) e na Privacidade (quem vê o quê). Hoje os Termos não preveem.
- Golpe: é o canal que o golpista vai usar. Verificado-só-inicia e limite diário são
  obrigatórios desde a v1; "liberar telefone" é decisão do embarcador, nunca automática.
- Concorrência: o Zé Boléia esconde o telefone sempre e não dá chat de verdade. Nós
  oferecemos os dois: telefone direto quando a empresa quiser, conversa verificada quando
  não quiser. Isso continua sendo vantagem, não desvantagem.

## Recomendação

Fazer **C agora** (2 dias) quando o portal tiver empresa publicando de verdade, e evoluir
pra **A** quando a primeira empresa pedir pra conversar antes de liberar o telefone. Antes
disso, o campo `telefone_visivel` já pode entrar no portal pra começarmos a medir quantas
empresas escondem — se forem poucas, C basta por muito tempo.
