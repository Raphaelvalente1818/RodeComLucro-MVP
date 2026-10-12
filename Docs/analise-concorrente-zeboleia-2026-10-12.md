# Zé Boléia × Rode com Lucro — análise competitiva (12/10/2026)

Fonte: navegação logada em app.zeboleia.com.br (conta de teste nossa), site zeboleia.com.br,
Google Play. Números contados na tela em 12/10/2026 (domingo, ~15h).

## 1. O que é o Zé Boléia

"Controle de fretes para caminhoneiros": calculadora de frete contra o piso ANTT + controle de
viagens e despesas + uma **comunidade** com oito abas. App na Play Store e App Store
(package `br.zeboleia.app01`) e versão web. Marca amarela, mascote "Zé", linguagem de boleia.
Monetização visível: **Clube do Zé Boléia** (clube de descontos — posto, restaurante, oficina,
pátio — validado pela placa no caixa; cadastro grátis pelo WhatsApp, parceiro paga pra
aparecer) e banners de parceiros. Não vi assinatura paga pro motorista.

**Tamanho**: Google Play diz **50 mil+ downloads, nota 3,6 (101 avaliações)**, atualizado em
29/09/2026. O site fala em "+50.000 caminhoneiros". Foi a base real que a gente mediu:

## 2. Saúde da comunidade (contado na tela)

| Área | O que tem | Leitura |
|---|---|---|
| **Fretes** | **10 ofertas abertas** no total (rolei até o fim). 4 anunciantes: Agência Andréia Gonçalves (6), Jc Agência (2), João Cargas (1), um motorista com complemento (1). Coletas de 12 a 16/10. Texto colado do WhatsApp, com link de grupo. | **Fraco.** Dez fretes pra 50 mil downloads. Quem posta é agenciador, não embarcador. Anúncio é copiar-e-colar de grupo de WhatsApp. |
| **Tô Vazio** | **36 motoristas disponíveis**, todos com menos de 24 h (expira), com caminhão, cidade e UFs de destino; botão "Falar no WhatsApp" direto. | **Forte.** É a função mais viva: 36 caminhões reais parados num domingo. Mostra demanda do motorista por ser achado. |
| **Brique** (compra e venda) | **133 anúncios**: 94 caminhões, 39 implementos/peças. 10 nos últimos 7 dias, 23 nos últimos 30; o resto espalhado desde ~março (ninguém expira anúncio). Com fotos, preço, "aceita negociação", contato. | **Médio/forte.** Conteúdo de verdade e constante (~1 anúncio/dia), mas sem curadoria: "R$ 100", "R$ 130", km negativo, anúncios de 7 meses. |
| **Feed** | **45 posts em 17 dias** (~2,6/dia; 4 nas últimas 24 h). 13 são auto-posts de anúncio do Brique, 12 são "tô disponível em…", 4 pedidos de frete ("algum frete de Sete Lagoas?"). Engajamento quase zero (0–3 curtidas, raros comentários). Uma enquete com 35 votos. | **Fraco e revelador:** 9 menções a **golpe** em 17 dias — "golpista na área", "pede pra pagar os custos do cadastro da seguradora", "tão usando vários nomes". O golpe acontece *dentro* do app, via Tô Vazio: o golpista chama quem se declara vazio. |
| **Preços Diesel** | Aba Comunidade: **4 postos** informados (24 h, 2, 5 e 10 dias). Aba ANP: base oficial 20–26/09 com 5.037 registros, "perto de mim". | Comunidade morta; o que salva é a ANP, que é dado público. |
| **Serviços** | Mapa (Leaflet) com raio e "Resultados do Google". | É busca no Google embrulhada. |
| **Descanso** | **195 pontos**: ~130 "Certificado" (pontos de parada oficiais, semeados) + ~65 da comunidade, com comodidades em texto ("banho 10 conto se não abastecer") e nota; a maioria com 0–2 avaliações. | Semente boa + contribuição real, mas rasa. |
| **Parceiros do Zé** | "Nenhum parceiro ativo no momento." | O clube de benefícios ainda não tem parceiro no app. |
| **Eventos** | 1 evento (BlessedTruck, jan/2027, 10 interessados). | Vazio. |

**Diagnóstico**: 50 mil downloads viraram uma comunidade onde a única coisa viva é o
motorista dizendo "tô vazio" (36/dia) e vendendo o caminhão (1/dia). Frete, que é o motivo
de existir, tem 10 ofertas, todas de agenciador. Nota 3,6 na loja combina com isso. E o
feed mostra o custo de não verificar ninguém: golpe recorrente, relatado pelos próprios
usuários, sem resposta visível da plataforma.

## 3. Funções, lado a lado

| Função | Zé Boléia | Rode com Lucro (hoje) |
|---|---|---|
| Calculadora de frete | Formulário: tipo, eixos, tipo de carga, valor, origem, **vários destinos**, diesel, Arla, consumo, chapa, estacionamento, outras, toggle "considerar pedágio". Tutorial guiado 1 de 5. Resultado vs. mínimo ANTT. **Sem** manutenção, pneu, depreciação. | Custo real completo (diesel, Arla, pedágio por eixo, manutenção, **pneus por eixo**, depreciação FIPE, alimentação/pernoite, chapa), piso ANTT do banco (Portaria vigente), veredito BOM/ACEITÁVEL/RUIM, margem desejada, "A negociar" (quanto cobrar). |
| Pelo WhatsApp | Não tem. Só app. | **Bot completo**: cálculo, cotação, busca, cadastro por foto, memória da conversa, compartilhar frete. É o nosso diferencial estrutural: o caminhoneiro não precisa instalar nada. |
| Ofertas de frete | Lista com Mínimo ANTT estimado por frete, KM editável, "Ver pedágio por eixos", **Compartilhar**, **Tenho Interesse** (abre mensagem dentro do app — não dá o telefone do contratante). Filtros por UF/região. Motorista também pode postar frete. | Busca por raio + compatibilidade de caminhão, cálculo do frete clicado com o perfil do motorista, "Só o meu veículo", contato (empresa/nome/telefone) **direto**, compartilhar com link de indicação. Portal Sofrete pra empresa publicar. Base: 810 fretes importados da Fretebras (ago/2026 — **velhos**), 3 empresas cadastradas. |
| Tô vazio / disponibilidade | Sim, 24 h, com WhatsApp direto. | Não tem. (Temos `cidade_atual` capturada pelo bot.) |
| Compra e venda | Brique, 133 anúncios com foto. | Não tem (está no plano da Comunidade, gatilho 300 motoristas). |
| Diesel | Comunidade (morta) + ANP perto de mim. | Preço do perfil + o motorista diz na mensagem ("diesel a 6,50") e o bot recalcula. Sem base ANP. |
| Pontos de parada | 195, com nota. | Não tem. |
| Controle financeiro | **Minhas Viagens**: faturamento, despesas, lucro, margem média, "Lançar despesas" por viagem, alerta de manutenção, "Compartilhar resumo", filtro semana/mês/ano. | Análises salvas, "Realizado", lucro do mês só do executado, troca de óleo/CNH/exame com alerta. Sem lançamento de despesa real por viagem. |
| Identidade | "Photo Check: CNH + selfie" → selo Verificado (opcional; nossa conta de teste não verificou e usa tudo). Perfil com seguidores, bloqueio, código de convite, até 10 telefones por conta. | CNH + CRLV lidos por foto (sem guardar imagem/CPF), indicação por colega (`indicacao`), telefone como identidade. Sem selo visível ainda. |
| Entrada | Telefone (e-mail sintético `55…@zeboleia.com.br`). | Telefone, OTP por WhatsApp/SMS, ou conta nascendo na 1ª mensagem do bot. |
| Monetização | Clube de descontos (parceiro paga) + banners. Sem assinatura. | PRO (dormente, aguardando sócios) + Sofrete pra empresa. |
| Lojas | Play + App Store. | PWA; Play via TWA em andamento. |

## 4. O que eles fazem melhor que nós (e dói)

1. **Tô Vazio.** É a função que mais vive lá e a gente não tem. Custa pouco: o bot já sabe
   `cidade_atual` e o caminhão; falta "tô vazio em X, destino Y" + lista pra quem busca.
2. **Vários destinos no cálculo.** Frete com 2 entregas é comum (o Brás + Ribeirão).
3. **Toggle "embarcador paga o pedágio".** Quase todo anúncio diz "+ pedágio no TAG".
   Nosso cálculo sempre soma pedágio.
4. **Compartilhar resumo do mês** (print bonito pra mandar pro grupo) — viral barato.
5. **Despesas por viagem** (lançar abastecimento, pedágio real, pernoite) — fecha o ciclo
   "calculei → rodei → ganhei de verdade quanto".
6. **Pontos de descanso com nota** — útil e simples de semear (há base pública de PPDs).
7. **Estar nas lojas** com 50 mil downloads e marca com cara de caminhoneiro.

## 5. O que nós fazemos melhor (e vale defender)

1. **WhatsApp.** Eles obrigam a instalar; nós respondemos onde o caminhoneiro já está.
2. **Cálculo honesto.** Eles comparam só com a ANTT; nós mostramos o custo real
   (manutenção, pneu por eixo, depreciação) e o lucro — o motorista descobre que um frete
   acima da ANTT pode dar prejuízo.
3. **Contato direto do frete.** Eles escondem o telefone atrás de "Tenho Interesse" (observado
   em 12/10). Isso resolve nossa decisão pendente: **mostrar o contato é vantagem
   competitiva** — desde que o anunciante seja verificado (ver 6).
4. **Verificação de verdade.** O feed deles prova o problema: golpe aplicado por dentro do
   app em quem se declara vazio. Nossa CNH lida + indicação por colega é exatamente o
   antídoto — e ninguém lá está fazendo isso.
5. **Empresa publica no portal** (Sofrete) com moderação, em vez de agenciador colando
   texto de grupo.

## 6. O que precisa entrar no MVP (proposta, em ordem)

| # | Item | Por quê | Esforço |
|---|---|---|---|
| 1 | **Fretes atuais** — os 810 da Fretebras são de agosto. Ou atualiza (robô diário, já pedido) ou esconde os velhos e mostra só os da Sofrete. | Lista velha destrói confiança mais rápido que lista curta. Carga é o gargalo deles e será o nosso (seção 7). | 1 dia (robô) |
| 2 | **Pedágio pago pelo embarcador** — toggle no app e "pedágio por conta deles" entendido pelo bot. | Quase todo frete real é "+ pedágio no TAG"; hoje superestimamos o custo. | horas |
| 3 | **"Tô vazio" no bot e no app** — "tô vazio em Itajaí, vou pro Sul" vira disponibilidade de 24 h; Sofrete e outros motoristas veem; expira sozinha. | É a função mais usada do concorrente e a gente já tem cidade, caminhão e WhatsApp. Dá à empresa (Sofrete) motivo pra entrar: ver caminhão parado perto da carga. Só depois de ter frete vivo. | 1–2 dias |
| 4 | **Vários destinos** no cálculo (app e bot: "SP pra Ribeirão e depois Brás"). | Comum em carga fracionada; o concorrente tem. | 1 dia |
| 5 | **Selo "verificado"** visível (CNH lida + indicado por alguém) no perfil, na lista de "tô vazio" e no contato do frete. | Transforma o que já fazemos em algo que o motorista e a empresa veem. Resposta direta ao golpe. | horas |
| 6 | **Compartilhar resumo** do mês/da análise como imagem pro WhatsApp. | Viral barato; eles têm. | 1 dia |
| 7 | **Despesas reais por viagem** (abasteci X, pedágio Y) fechando com o "Realizado". | Fecha o ciclo financeiro; o concorrente vende isso como principal. | 2–3 dias |

Fora do MVP (depois dos 300 motoristas / Comunidade): Brique, pontos de descanso, diesel
por posto, feed, eventos, clube de descontos.

## 7. O serviço foi pra frente? Por que não?

Conclusão: o **frete** não decolou — não que o produto morreu. Está vivo (atualização em
29/09, 36 "tô vazio" num domingo, anúncio novo todo dia no Brique), mas o motivo de existir
("obtenha fretes") tem 10 ofertas pra 50 mil instalações. A nota 3,6 é o retrato: muita
gente instalou, achou pouco, saiu. Download não é usuário.

Sobre o canal: o WhatsApp no Zé Boléia é só o botão "falar com o motorista" e o número do
clube. **O produto inteiro exige instalar e abrir o app.** Esse é o nosso diferencial
estrutural — e explica boa parte do que aconteceu com eles.

Motivos prováveis, na ordem de peso:

1. **Pediram pro mercado se mudar, em vez de ir onde ele está.** O frete do autônomo
   acontece nos grupos de WhatsApp. O Zé Boléia construiu uma cópia dos grupos (feed, "tô
   vazio", anúncio) e pediu que o caminhoneiro passasse a olhar outra tela. Ele olhou uma
   vez, viu menos do que já tinha no grupo, e voltou. Prova: os 10 fretes são texto copiado
   dos grupos, com o link do grupo dentro — o próprio anunciante trata o app como espelho.
2. **Marketplace de dois lados sem o lado da carga.** Tem motorista (o lado fácil: baixa de
   graça e se declara vazio), não tem embarcador. Sem embarcador, o agenciador preenche o
   vazio — e agenciador posta onde já posta. Ninguém tem motivo pra publicar carga ali
   primeiro. É exatamente o problema que a Sofrete e o robô de fretes têm que resolver pra nós.
3. **Confiança zero.** Qualquer número entra, se declara vazio e chama quem quiser. O feed
   virou mural de golpe em 17 dias. App que vira lugar de golpe perde o motorista e os
   colegas dele junto. O selo opcional não resolve: o golpista não precisa dele pra operar.
4. **Largura em vez de profundidade.** Oito abas, três vazias ou semeadas. Cada aba vazia
   diz "aqui não tem ninguém". A calculadora, que seria o núcleo, compara só com a ANTT —
   não diz se o frete dá lucro.
5. **Monetização antes da massa.** O clube de descontos precisa de parceiro pagando;
   "Parceiros do Zé: nenhum ativo". Sem receita, sem fôlego pra moderar, semear carga ou
   trazer embarcador.

O que isso muda pra nós:
- A tese fica mais forte: ficar no WhatsApp, calcular de verdade, verificar quem entra.
- A lição que mais importa é a 2: **a carga é o gargalo deles e vai ser o nosso.** Sofrete e
  robô de fretes atualizados valem mais que qualquer aba nova.
- Alerta pra nós mesmos: os 810 fretes de agosto, se o motorista perceber que são velhos,
  produzem a mesma nota 3,6. **Fretes vivos vêm antes do "tô vazio".**

Ressalva: é uma foto de domingo, do que aparece na tela. Não sabemos a receita deles nem
quantos usam o "Minhas Viagens" sem passar pela comunidade — pode ser que o produto que paga
as contas seja esse, silencioso. Mas pra decidir o nosso MVP a conclusão fica de pé: o
modelo "app com tudo dentro" não trouxe carga nem confiança; o nosso aposta nas duas.

## 8. Resumo pros sócios

O Zé Boléia tem a loja, a marca e 50 mil instalações; **não tem WhatsApp** (só app), não tem
custo real, não verifica ninguém e, com tudo isso, tem **10 fretes e 36 "tô vazio"** — a
comunidade deles imita um grupo de WhatsApp, mas obriga o caminhoneiro a sair do WhatsApp
pra usar. Observações de 12/10: (a) eles **não dão o telefone de quem contrata o
frete** — "Tenho Interesse" só abre uma mensagem no app; nós mostramos o contato direto;
(b) o WhatsApp é um diferencial enorme nosso: o caminhoneiro não instala nada e já está lá;
(c) o serviço deles **não foi pra frente no que importa** (frete), pelos motivos da seção 7.
Nosso caminho continua certo (bot no WhatsApp + cálculo honesto + verificação + indicação).
O que copiar já: **fretes atualizados**, **pedágio do embarcador** e **Tô Vazio**. O que não
copiar: feed sem moderação, oito abas vazias e contato escondido.
