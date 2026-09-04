# Status da sessão — RODE COM LUCRO

> Última atualização: 2026-08-28. A sessão anterior (17/07) foi perdida num reset — este arquivo e `sequencia-construcao.md` foram o que permitiu retomar o contexto. Manter este hábito daqui pra frente.

## O que já está pronto (confirmado lendo o repo em 04/08)

- **`@rode/calc`** (`packages/rode-calc`): motor de cálculo fechado e testado (fórmula do Emerson, ARLA por consumo próprio, veredicto BOM/ACEITÁVEL/RUIM, piso ANTT).
- **Piso ANTT**: atualizado para a Resolução nº 6.084/2026 (commit `d7e6b19`).
- **Identidade**: 12 migrations rodadas (`motoristas`, `consentimento`, `otp_envio`, `otp_bloqueio`, `wa_vinculo`, `identidade_audit`, `identidade_config`), Edge Function `otp-solicitar` com anti-abuso (bug de auto-reforço já corrigido, commit `81291c4`).
- **route-cost**: Edge Function com distância + pedágio automático via Google Routes API, com cache (`rota_distancia_cache`).
- **calc-app**: telas Entrada, Verificação, Home, Analisar, Resultado, Perfil já existem e funcionam em React/Vite (`apps/web`). Últimos commits foram ajustes finos de UI (alinhamento de campos, layout distância/pedágio lado a lado).
- **Banco (Supabase, projeto `RodeComLucro-MVP` / ref `gastwloozlzthpqhxnzr`)**: 6 motoristas, 4 perfis de caminhão, 2 análises de frete, 45 rotas em cache — dados reais de uso, não só schema vazio.

## Onde paramos hoje (04/08)

Retomamos a ideia (combinada antes do reset) de transformar a `Home.tsx` — hoje só os botões "Analisar frete" e "Perfil do caminhão" — na tela **"Garagem"**: portal inicial pós-login com três blocos (calculadora, cadastro do caminhão, cadastro do motorista) + últimas análises.

Descobertas relevantes que embasam o design:
- A tabela `motoristas` já tem campos nunca preenchidos por nenhuma tela: `nome`, `uf_base`, `meta_alvo_centavos`, `canal_wa_ativo`. **Não existe tela de cadastro do motorista ainda.**
- Toda análise de frete já é salva silenciosamente em `analise_frete` (origem, destino, valor, veredito, data), mas isso nunca aparece na interface. Vale um bloco "últimas análises" na Garagem.

Fizemos um **mockup estático** (imagem PNG, gerado com Pillow, salvo como `garagem_mockup.png`) pra alinhar o layout antes de codar:
- Header "Garagem" + saudação + avatar.
- Status: base (UF) + WhatsApp vinculado.
- Botão grande "Analisar frete" (ação primária).
- Dois cards menores: "Perfil do caminhão" e "Meu perfil" (motorista — tela nova).
- Barra de progresso "Meta de lucro do mês".
- Lista "Últimas análises" com veredicto colorido (verde/âmbar/vermelho).

**Ainda não implementado em código** — é isso que falta decidir/fazer a seguir.

## Próximo passo

1. Validar o mockup da Garagem com o Raphael (layout aprovado? tirar/mudar algum bloco?).
2. Implementar a tela `Garagem` (substituindo `Home.tsx`), incluindo:
   - Nova tela de cadastro/edição do motorista (nome, UF, meta de lucro, vínculo WhatsApp) — não existe ainda.
   - Bloco "últimas análises" lendo de `analise_frete`.
3. Seguir o roadmap de `sequencia-construcao.md` a partir daí (Trilha C / identidade já avançada, calc-wpp e portal ainda não iniciados).

## Nota operacional: como evitar perder contexto de novo

- Este arquivo (`status-sessao.md`) e `sequencia-construcao.md` devem ser atualizados ao fim de cada sessão de trabalho relevante — é o que permite retomar depois de um reset sem repetir a conversa antiga.
- A partir de 04/08, a pasta local do projeto (`D:\RodeComLucro-MVP`) passou a ficar conectada diretamente ao Cowork, então não é mais necessário colar token do GitHub a cada sessão nova para eu ler/editar arquivos.


## ATENÇÃO para a próxima sessão

Descoberta importante ao conectar a pasta local (`D:\RodeComLucro-MVP`) ao Cowork: **ela está 30 commits atrás do GitHub** (parada em `e67c0ee`, "Extrai @rode/calc..."). Faltam nela, entre outras coisas, todas as migrations de identidade recentes, as Edge Functions, e boa parte das telas do `apps/web` que já existem no GitHub. Também há uma alteração local não commitada (`Pasta01` modificado) e arquivos não rastreados.

Antes de editar qualquer coisa na pasta local, alinhar com o Raphael como reconciliar (provavelmente um `git pull`/checkout do estado do GitHub, com cuidado para não perder nada local que só existe aí). Não fiz isso sozinho porque a última vez que "reconciliar histórico divergente" apareceu, foi tratado como decisão do Raphael (merge vs. rebase vs. force), e a pasta local teve avisos de permissão ao tocar em `.git/objects` nesta sessão — vale investigar antes de mexer.

O mockup da Garagem (`garagem_mockup.png`) foi salvo em `mockups/` na pasta local.


## Atualização — 04/08 (continuação)

**Links do projeto** (pra referência rápida em qualquer sessão futura):
- GitHub: https://github.com/Raphaelvalente1818/RodeComLucro-MVP
- App em produção (Vercel): https://rode-com-lucro-mvp.vercel.app
- Painel Vercel (deployments, exige login): https://vercel.com/rode-com-lucro/rode-com-lucro-mvp/deployments
- Supabase (banco, projeto `RodeComLucro-MVP` / ref `gastwloozlzthpqhxnzr`): https://supabase.com/dashboard/project/gastwloozlzthpqhxnzr

**Estimativa de prazo discutida** (baseada no ritmo real dos commits, não é estimativa de PM formal):
- Ritmo observado: ~20 dias corridos desde o início (15/07), 35 commits, ~14 dias de trabalho efetivo descontando o fim de semana e o hiato do reset/virtualização (28/07–02/08).
- Nesse ritmo: Fase 0 completa + Fase 1 (calc-app) ~85% pronta (falta fila offline-first e a tela Garagem/cadastro do motorista).
- Marco mais confiável pra acompanhar: **Fase 1 completa** (offline + Garagem) — estimativa de 1-2 semanas.
- MVP completo (6 módulos): estimativa de **5 a 8 semanas**, com a maior incerteza sendo o tempo de aprovação de template do WhatsApp Business pela Meta (Fase 2 / calc-wpp), não o tempo de código em si.


## Atualização — 04/08: Garagem implementada e no ar

Codei e subi a tela Garagem (commit `7063aa5`, já em `main`, Vercel deve fazer deploy automático a partir daqui):

- `Garagem.tsx` substitui `Home.tsx` na rota `/`: saudação com nome do motorista, status (UF base + WhatsApp vinculado), botão grande "Analisar frete", cards "Perfil do caminhão" e "Meu perfil", barra de meta de lucro do mês (soma o `lucro` das análises do mês corrente via `resultado_snapshot`, compara com `meta_alvo_centavos` — só aparece se a meta estiver preenchida) e lista das últimas 3 análises com veredicto colorido.
- `Motorista.tsx` (rota nova `/motorista`): cadastro de nome, UF base e meta de lucro mensal. `canal_wa_ativo`/`telefone_verificado` aparecem como status, só leitura — o vínculo real do WhatsApp continua pelo fluxo de `wa_vinculo`, não foi duplicado aqui. É sempre `update`, nunca insert (a linha em `motoristas` já existe desde o primeiro login via trigger).
- Novo `lib/motorista.ts` e três funções novas em `lib/frete.ts` (`carregarUltimasAnalises`, `carregarLucroMesAtual`, `tempoRelativo`).
- Validado com `tsc -b` + `vite build` limpos e os 21 testes do `@rode/calc` continuam passando (não mexi no motor).

**Não incluído nesta rodada** (fica pra depois, por decisão de escopo): fila offline-first (IndexedDB) — a Garagem/Motorista ainda gravam direto no Supabase, igual o resto do calc-app hoje.

**Pendência que continua em aberto**: a pasta local `D:\RodeComLucro-MVP` segue desatualizada (ver seção "ATENÇÃO" acima) — o código novo está no GitHub, mas pra rodar/ver localmente é preciso reconciliar a pasta primeiro.


## Atualização — 05/08: pasta local reconciliada (com ressalva sobre o .git)

Copiei o conteúdo atual do GitHub (`ac9f6fa`) por cima da pasta local `D:\RodeComLucro-MVP` — os arquivos agora batem 100% com o repositório (conferido com `diff -rq`), incluindo a Garagem e o cadastro do motorista.

**Como foi feito**: não usei `git pull` direto na pasta local porque o `.git` dela deu erro persistente de permissão ao criar/apagar lock files (`index.lock`, `HEAD.lock`) — parece uma limitação do jeito que essa pasta do Windows fica montada no meu sandbox, não um problema do repositório em si. Copiei os arquivos manualmente por cima (preservando tudo que já existia) e tentei sincronizar o `.git` também, mas essa parte ficou inconsistente pelo mesmo motivo.

**Ressalva importante**: os arquivos estão certos, mas o `.git` da pasta local pode estar num estado estranho (`git status` pode mostrar coisa esquisita). Pra deixar isso limpo, rode localmente (fora do Cowork, no PowerShell/CMD/terminal do Claude Code — lá não deve ter esse problema de permissão):

```
cd D:\RodeComLucro-MVP
git fetch origin
git reset --hard origin/main
```

Isso é seguro: como os arquivos já estão idênticos ao GitHub, esse comando só arruma o histórico do git, não perde nada.

**O que foi preservado e ainda está lá, fora do controle do git** (revisar e descartar quando quiser):
- `_legado-pre-sync/otp-solicitar-index-local-31jul.ts` — uma versão antiga e diferente do `otp-solicitar/index.ts`, que existia solta na pasta (não rastreada) e nunca foi commitada em lugar nenhum.
- `supabase/migrations/20260731120000_identidade_schema.sql` e `20260731120100_identidade_trigger_hook.sql` — duas migrations com nomenclatura de timestamp (padrão Supabase CLI), diferentes das migrations `000N_*.sql` que estão no GitHub. Parecem um experimento anterior abandonado — não conflitam com nada, mas valem uma checada.
- `Fontes-App/` — um clone git aninhado e desatualizado (parado em 27/07). Hoje é redundante, já que a pasta principal está atualizada; pode ser apagado.
- `mockups/` — já existia, com `garagem_mockup.png` e um `identidade-entrada-verificacao.html`.


## Atualização — 05/08: clicar numa análise recente abre o Resultado

Implementado (commit `7cc57cb`): clicar numa linha de "Últimas análises" na Garagem agora navega para `/resultado/:id` e mostra a tela de Resultado com os dados exatos daquele cálculo (custos, veredicto, detalhamento) — carregados de `resultado_snapshot`/`custos_snapshot` no banco, não recalculados. Nesse modo, o botão Salvar vira "Voltar para a Garagem" e aparece a data/hora do cálculo original.

Pasta local também sincronizada (mesmo processo manual de cópia de arquivo, pelo mesmo motivo do `.git` com lock — ver seção anterior). Rodar `git fetch && git reset --hard origin/main` localmente ainda é recomendado pra limpar o histórico do git, mas os arquivos já estão certos nos dois lugares.


## Atualização — 05/08: Número da CNH e Vencimento da CNH em "Meu perfil"

Commit `b1a031f`: dois campos novos no cadastro do motorista — `cnh_numero` (texto livre, sem validação de formato) e `cnh_vencimento` (data). Migration `0013_motoristas_cnh.sql` já aplicada direto no Supabase (projeto `gastwloozlzthpqhxnzr`) via MCP, e o arquivo commitado no repo pra manter o histórico de migrations completo. Não precisou mexer em RLS/trigger — a guarda de colunas sensíveis em `0003` é uma lista explícita e essas colunas novas não entram nela.


## Atualização — 05/08: Validade do Exame Toxicológico em "Meu perfil"

Commit seguinte ao da CNH: campo `exame_toxicologico_vencimento` (date), migration `0014` já aplicada no Supabase. Mesmo padrão dos campos de CNH — sem validação de formato, edição livre pelo motorista.


## Atualização — 05/08: autocomplete de marca/modelo no Perfil do caminhão

Commit `8e395a5`: portei o autocomplete marca→modelo da calculadora-experimental do Emerson (github.com/emerson1001a/calculadora-experimental, `src/data/caminhoes.ts` + `src/screens/PerfilCaminhaoScreen.tsx`) — catálogo de 8 marcas com seus modelos, consumo de diesel/ARLA de referência e categoria (pesado/semipesado/médio-leve). Ao digitar a marca, sugere; ao escolher e digitar o modelo, sugere filtrado; ao escolher o modelo, preenche consumo de diesel/ARLA. A manutenção por km também se ajusta sozinha pela idade do veículo (marca+modelo+ano → categoria → taxa por faixa etária), enquanto o motorista não editar na mão.

**Correção de memória importante**: o Raphael lembrava que o ANO carregava os modelos disponíveis daquela marca+ano. Fui checar o código-fonte original antes de implementar e isso não é real — o ano nunca filtrou modelos lá, só a marca filtra. O ano entra numa conta separada (auto-ajuste de manutenção por idade do veículo). Implementei o comportamento real, não a lembrança, e documentei a diferença no código (`Perfil.tsx`) e aqui.

Migration `0015`: colunas `marca`/`modelo` em `caminhao_perfil` (já aplicada no Supabase), pra lembrar a seleção da próxima vez. Catálogo vive em `packages/rode-calc/src/caminhoes.ts` (exportado pelo pacote, não só pelo app) pra poder ser reaproveitado pelo calc-wpp quando esse módulo começar.


## Atualização — 05/08: Tabela FIPE integrada (marca→modelo→ano + depreciação real)

Commit `5c7e1d1`. O Raphael pediu pra restringir os modelos por ano de fabricação (ideia original: marca → ano → modelo). Investiguei a API da FIPE (via parallelum.com.br/fipe/api, testado direto no banco com a extensão `http` antes de codar, pra confirmar o formato real das respostas — não por suposição) e a ordem real dela é marca → modelo → ano (o endpoint de modelo é quem lista os anos realmente catalogados pra aquele modelo específico; não existe um caminho marca→ano→modelo na API). Alinhei isso com ele via pergunta direta antes de construir, e ele optou por integrar a FIPE de qualquer forma (opção "maior esforço").

O que entrou:
- **Edge Function `fipe-caminhao`**: proxy pra FIPE com cache de 30 dias (`fipe_cache`), mesmo espírito do `route-cost`.
- **Perfil.tsx**: Marca (autocomplete FIPE) → Modelo (autocomplete FIPE filtrado pela marca) → Ano (select, só com os anos que a FIPE realmente cataloga pra aquele modelo — é isso que resolve o pedido original de restringir as opções).
- **Depreciação real**: ao escolher o ano, busca o valor FIPE daquele ano (autopreenche `valor_caminhao`) e do ano anterior do mesmo modelo, calcula a diferença e divide pelos km rodados por ano (campo novo, `km_rodados_ano`) — isso vira `depreciacao_por_km` de verdade, baseada em mercado, em vez de estimativa por faixa etária.
- Consumo de diesel/ARLA e a taxa de manutenção por idade continuam vindo do catálogo estático da calculadora do Emerson, agora casado por nome com o que a FIPE devolve (`encontrarModeloEstatico` em `lib/fipe.ts`) — a FIPE não tem dado de consumo de combustível, só preço.
- Tudo com fallback manual se a FIPE estiver fora do ar (nunca trava o cadastro).

Migration `0016` já aplicada no Supabase.


## Atualização — 05/08: backlog provisório dos testes (form no app + chat)

Criado um mural de backlog provisório pra Raphael e os outros 3 sócios registrarem bugs/sugestões enquanto testam o app: botão "Backlog" no header da Garagem abre um modal com Nome/Página/Problema-Sugestão/Observação e toggle Aberto↔Feito. Tudo marcado como `PROVISÓRIO` em `lib/backlog.ts`, `components/BacklogModal.tsx`, `Garagem.tsx`, `index.css` e na migration `20260805200031_backlog_provisorio_schema.sql` — apagar tudo isso (arquivos, trechos marcados e `drop table backlog_provisorio`) quando o MVP acabar.

**Combinado com o Raphael**: além desse formulário, backlog também vai ser registrado direto aqui no chat (ele me conta um problema/sugestão na conversa). Então, daqui pra frente, ao revisar/planejar backlog, considerar as DUAS fontes: (1) a tabela `backlog_provisorio` no Supabase, (2) o que foi dito nas conversas do Cowork. Vale perguntar ao Raphael se ele quer que eu também grave o que for dito em chat na mesma tabela (unificar as duas fontes), ou se prefere manter separado.

**Decisão**: unificar — backlog dito em chat vai direto pra tabela `backlog_provisorio` também (mesmo mural, sem separar por fonte).


## Atualização — 05/08: dois itens de backlog implementados

Dois pontos registrados pelo Raphael via chat, já marcados como `feito` na tabela:

1. **Valor do caminhão via FIPE nem sempre preenchia sozinho** (`Perfil.tsx`). Causa: o autofill só disparava ao escolher o ano no select dedicado "Ano de fabricação (Tabela FIPE)" — se o motorista digitasse o ano direto no campo solto "Ano do caminhão" (sem usar aquele select), o valor nunca era buscado. Corrigido extraindo a busca pra `buscarEAplicarValorAno()` e adicionando um `useEffect` que dispara sozinho assim que marca+modelo (vindos de sugestão da FIPE) e o ano batem com um ano catalogado — não importa por qual campo o ano entrou. Campo `valor_caminhao` continua editável manualmente (guard `valorEditadoManualmente` já existia).
2. **Alerta de vencimento de CNH/exame toxicológico na Garagem**: bolinha ao lado do "Olá, Nome" (âmbar se vence em até 60 dias, vermelha se já venceu), calculada a partir de `motorista.cnh_vencimento`/`exame_toxicologico_vencimento` (já carregados na Garagem). Clique abre um painel com a mensagem de cada documento vencendo/vencido e um atalho pra "Meu perfil". Não aparece nada se não houver vencimento próximo.

Validado com `tsc --noEmit` limpo. Ainda não commitado/pushado — pasta local segue com o mesmo problema de `.git` desatualizado das rodadas anteriores (ver seções acima); path recomendado é `git add` dos arquivos específicos + `git pull origin main --no-rebase` + `git push`, resolvendo conflitos manualmente se aparecerem (geralmente são só adições puras, sem conflito de conteúdo real).

**Commitado e publicado depois** (dois commits, pelo Raphael no CMD local): `04fa51e` (os dois itens acima) e `cb77b36` (ajuste visual do `<select>`, que não tinha estilo dark — ficava branco/claro, fora do padrão; adicionado `select` nativo com `appearance: none` + seta desenhada via SVG inline no `index.css`).

**Descoberta operacional**: depois do `cb77b36`, a Vercel não criou NENHUM deployment pra esse commit (nem sucesso, nem erro, nem cancelado — sumiu). Um commit vazio (`git commit --allow-empty`) pra forçar o webhook resultou em deployment `Canceled` (a Vercel pula build de commit sem mudança de arquivo relevante). Resolvido com um commit real mínimo (comentário no `index.css`) — aí sim buildou normal. Se isso acontecer de novo: checar o filtro "Status" na aba Deployments da Vercel (esconde `Canceled` por padrão) antes de assumir que o push falhou.


## Atualização — 06/08: Tipo de veículo e Tipo de carroceria no Perfil do caminhão

Pedido do Raphael: verificar se a calculadora-experimental do Emerson tinha campo de tipo de caminhão (porta-container, graneleiro etc.) e importar. Achei — são DOIS campos separados lá (`src/types/index.ts` + `src/screens/PerfilCaminhaoScreen.tsx` no repo do Emerson):
- **Tipo de veículo** (configuração do conjunto): Carreta, Carreta LS, Vanderléia, Carreta 4º eixo, Bitrem 7/9 eixos, Rodotrem (Pesado) · Truck, BiTruck (Médio) · Fiorino, VLC, 3/4, Toco (Leve).
- **Tipo de carroceria** (o que carrega): Graneleiro, Grade baixa, Prancha, Caçamba, Plataforma (Abertas) · Sider, Baú, Baú Frigorífico, Baú Refrigerado (Fechadas) · Silo, Cegonheiro, Gaiola, Tanque, Bug Porta Container, Munk, Apenas Cavalo, Cavaqueira, Hoper (Especiais).

Importado 1:1 (mesmos valores) pra `packages/rode-calc/src/tiposCaminhao.ts` (exportado pelo pacote, reaproveitável no calc-wpp depois). Migration `20260806162718` adiciona `tipo_veiculo`/`tipo_carroceria` (text, nullable, com check constraint da lista) em `caminhao_perfil`. `Perfil.tsx` ganhou duas seções de chips (clicável pra marcar/desmarcar, agrupado por categoria, visual novo `.chip`/`.chip-ativo` no `index.css`) entre "Apelido" e "Número de eixos" — escolher a carroceria sugere `numero_eixos` (mesmo mapeamento `eixosPorCarroceria` do Emerson), respeitando edição manual do campo.

**Importante, checado no código do Emerson antes de implementar**: esses dois campos são só perfil/UX lá — a fórmula de piso ANTT usa só `numeroEixos`, não filtra por tipo de carroceria/carga. Mantive igual aqui (`pisoANTT.ts` não mudou). Isso deixa a base pronta pro TODO que já estava registrado em `pisoANTT.ts` (tabela ANTT por tipo de carga — granel sólido, granel líquido, frigorificada, conteinerizada — que ainda não foi levantada), mas essa extensão da fórmula continua pendente, não foi feita agora.

Validado com `tsc --noEmit` limpo. Ainda não commitado/pushado.


## Atualização — 06/08: ícones nos cards da Garagem

Pedido rápido do Raphael (backlog dado direto no chat, já registrado como `feito`): nos dois cards da Garagem, trocar o texto e adicionar um ícone. `Garagem.tsx` — card "Perfil do caminhão" virou "🚛 Meu Caminhão", card "Meu perfil" virou "😊 Meu Perfil" (emoji nativo, sem lib de ícone — o projeto não usa nenhuma). `card-eyebrow` ("Caminhão"/"Perfil") ficou como estava. Validado com `tsc --noEmit` limpo.

**Ajuste em seguida, mesmo dia**: Raphael achou o emoji com "cara de rascunho" e pediu ícone mais profissional, além de tirar o `card-eyebrow` (duplicava "Caminhão"/"Perfil" com o texto novo). Troquei o emoji por SVG inline (`components/IconesCard.tsx`, `IconeCaminhao`/`IconePerfil`, estilo outline igual Lucide/Feather, sem adicionar dependência nova) e removi o `<span className="card-eyebrow">` dos dois cards — cada botão agora mostra só ícone + "Meu Caminhão" / "Meu Perfil". Classe `.card-eyebrow` ficou órfã no CSS (não usada em nenhum TSX agora), deixei por não atrapalhar — pode ser removida numa limpeza futura. Validado com `tsc --noEmit` limpo.


## Atualização — 06/08: revisão do backlog aberto + grupo 1 de ajustes rápidos

Revisei os 11 itens abertos que o Emerson tinha registrado (formulário do app), apresentei um resumo agrupado pro Raphael (Perfil do caminhão / Garagem / Cálculo de frete) com uma sugestão de ordem por tamanho/risco. Ele aprovou o grupo 1 ("rápidos, sem ambiguidade") com um ajuste — tirar o item de "KM atual do caminhão" do backlog (decidiu não fazer, não é bug de implementação).

O que entrou:
- `PERFIL_DEFAULT.km_rodados_ano`: 120.000 → **100.000** (`lib/frete.ts`), pedido do próprio Raphael.
- `Perfil.tsx`: campo **Apelido** subiu pro topo do formulário (antes era depois do Ano da FIPE) — é a identificação do caminhão pro motorista, faz sentido vir primeiro. Prepara terreno pro item "múltiplos caminhões", que o Emerson já marcou como "no futuro" (não mexi nisso agora).
- `Resultado.tsx`: **"Voltar para a Garagem"** agora aparece assim que o cálculo termina — link secundário ao lado de "Nova análise", visível tanto antes quanto depois de clicar "Salvar análise". (Primeira versão só mostrava depois de salvar; o Raphael apontou com print da tela ao vivo que precisava aparecer antes também, corrigido no mesmo dia.)
- Item "Incluir o Campo da Km atual do caminhão" **removido** (deletado, não marcado feito) do `backlog_provisorio` a pedido do Raphael.

Itens marcados `feito`: KM anual, Apelido no topo, botão Voltar pós-salvar.

**Ainda em aberto, sem decisão ainda** (grupos 2 a 4 da sugestão que passei pro Raphael): pneu por km calculado pelo nº de eixos (preciso de fórmula/referência — perguntei se pesquiso uma ou se ele passa os valores, ainda sem resposta), depreciação com fallback quando o caminhão não tem match na FIPE, alerta de troca de óleo, alertas de vencimento mais amplos na Garagem (óleo/pneus), lucro do mês por frete executado vs. salvo (precisa de conceito de "status do frete" novo no schema), formulário de empresa/contato ao salvar frete, múltiplos caminhões.

Validado com `tsc --noEmit` limpo. Ainda não commitado/pushado.


## Atualização — 06/08: "A negociar" (Frete a Combinar) em Analisar.tsx

Pedido do Raphael: verificar se a calculadora do Emerson tinha um modo de frete a combinar, e trazer o cálculo. Achei em `src/screens/AnalisarScreen.tsx` do repo do Emerson — modo "A NEGOCIAR": desativa o campo de valor, mostra um slider de margem e calcula o frete mínimo em tempo real (`custoTotal / (1 - margem/100)`), com uma zona verde/amarela/vermelha própria (comparando com o piso ANTT e com uma "margem desejada" que, no código dele, tava hardcoded em 0 — nunca puxava do perfil de verdade).

**Não portei 1:1** — simplifiquei aproveitando o que já tínhamos:
- Em vez de um slider novo "Margem alvo" duplicado, o modo "A negociar" usa o slider **"Margem desejada"** que já existe na tela — ativar o toggle e mexer nesse slider já recalcula o frete mínimo na hora, sem campo a mais.
- Em vez do sistema de zona verde/amarela/vermelha paralelo do Emerson, reaproveitei o **veredito BOM/ACEITÁVEL/RUIM** que o motor `calcularFrete` já calcula (rodando o frete mínimo como se fosse o valor ofertado) — mesmas badges/cores que já existem no resto do app, sem lógica duplicada. E, diferente do código do Emerson, aqui a margem desejada usada na comparação é a de verdade (a do formulário), não um valor fixo.

Implementado: botão "A negociar" (reaproveita a classe `.chip`/`.chip-ativo` já criada) ao lado do label "Valor do frete", desativa o input quando ativo, e mostra um painel (`negociar-painel`) com o frete mínimo calculado, o veredito e aviso se ficar abaixo do piso ANTT. `montarCustos()` foi extraído de `calcularEIr()` pra evitar duplicar a montagem do objeto de custos entre o cálculo final e o preview ao vivo (`useMemo` `resultadoNegociar`).

Item "Frete a Combinar" marcado `feito` no backlog. Validado com `tsc --noEmit` limpo. Ainda não commitado/pushado.


## Atualização — 07/08: botão "Realizado" — lucro do mês só conta frete executado

Pedido do Raphael, com print da Garagem ao vivo: o "lucro do mês" somava toda análise SALVA, mesmo que o frete nunca tivesse acontecido de verdade. Pedido específico: um botão "Realizado" em cada frete da lista, e só contar no lucro quando ele for marcado.

Implementado:
- Migration `20260807141618`: `analise_frete.realizado` (boolean, default `false`) + `realizado_em` (timestamptz, preenchido quando marca). Índice por `(user_id, realizado, created_at desc)`.
- `lib/frete.ts`: `AnaliseResumo` ganhou `realizado`; `carregarUltimasAnalises` já traz o campo; nova função `alternarRealizado(id, realizadoAtual)` faz o update; `carregarLucroMesAtual` agora filtra `.eq('realizado', true)` além do intervalo do mês.
- `Garagem.tsx`: cada item da lista "Últimas análises" ganhou um botão "Marcar como realizado" / "✓ Realizado" (pill, mesmo padrão visual do toggle do backlog) — clicar chama `alternarRealizado` e recarrega `carregarLucroMesAtual` na hora, então a barra de meta já atualiza sem precisar recarregar a página. Reestruturei o `<li>` (antes era um `<button>` só, agora é `<li>` com dois botões irmãos — não dá pra aninhar `<button>` dentro de `<button>`).

**Decisão de escopo, não perguntada explicitamente**: "lucro do mês" continua filtrando por `created_at` (quando a análise foi salva) dentro do mês corrente, E agora também por `realizado = true` — não criei um campo separado de "data que o frete foi executado". Ou seja, um frete salvo em julho e marcado como realizado em agosto ainda conta como lucro de julho, não de agosto. Se isso não for o comportamento esperado, é um ajuste pequeno (trocar o filtro pra usar `realizado_em` em vez de `created_at`).

Botão "Realizado" existe só na lista da Garagem por enquanto (não dupliquei na tela Resultado, que também mostra análises salvas em modo histórico — não foi pedido).

Validado com `tsc --noEmit` limpo.


## Atualização — 07/08: KPI "Valor do frete" na tela Resultado

Pedido do Raphael (print da tela ao vivo): faltava mostrar o valor do frete que foi informado/negociado nos KPIs do Resultado. Adicionado `resultado.entrada.valorFrete` como primeiro card, e reordenados os 6 KPIs em 3 linhas de 2 (grid já era `1fr 1fr`, só mudou a ordem):
Linha 1: Valor do frete · Lucro provável
Linha 2: Custo estimado · Margem real
Linha 3: Piso mínimo ANTT · Negocie a partir de

Validado com `tsc --noEmit` limpo.


## Atualização — 07/08: popup de contato ao salvar o frete

Pedido do Raphael, item que já estava no backlog do Emerson: ao clicar "Salvar análise", abrir um popup pedindo empresa, contato e telefone/WhatsApp de quem ofereceu o frete — pra ficar disponível quando o motorista reabrir esse frete salvo depois, pra negociar/fechar.

O que entrou:
- Migration `20260807143848`: `analise_frete.empresa_nome`, `contato_nome`, `contato_telefone` (text, nullable — nenhum é obrigatório).
- `lib/frete.ts`: `AnaliseParaSalvar`/`salvarAnalise` gravam os 3 campos; `AnaliseCompleta`/`carregarAnalisePorId` trazem de volta no modo histórico.
- `Resultado.tsx`: clicar "Salvar análise" agora abre um modal (novo, genérico — `.modal-overlay`/`.modal-card` no CSS, não confundir com o `.backlog-overlay` provisório) com os 3 campos; o botão "Salvar análise" de dentro do modal é quem de fato chama `salvarAnalise`. Cancelar ou clicar fora fecha sem salvar (bloqueado enquanto `salvando`).
- No modo histórico (`/resultado/:id`), se a análise tiver algum desses 3 campos preenchidos, aparece um bloco "Contato do frete" logo no topo, com link `tel:` e `wa.me` pro telefone (limpando tudo que não é dígito do número informado).

Item "formulário de empresa/contato ao salvar frete" marcado `feito` no backlog. Validado com `tsc --noEmit` limpo.


## Atualização — 07/08: mensagem pronta no link do WhatsApp

Pedido em seguida, mesmo dia: o link "WhatsApp" do bloco "Contato do frete" deveria abrir já com uma mensagem pronta, não uma conversa em branco. Antes de codar, alinhei o texto com o Raphael (ele aprovou):

> Olá, {nome do contato}! Aqui é o {nome do motorista}, motorista. Vi o frete de {origem} para {destino}, valor de {valor do frete}, e tenho interesse. Pode me passar mais detalhes? Preciso saber a data de coleta, o prazo de pagamento e quem fica responsável pelo pedágio. Fico no aguardo, obrigado!

Implementado em `Resultado.tsx`: `montarMensagemWhatsapp()` monta o texto (com fallback pros dois nomes — se o contato ou o motorista não tiverem nome preenchido, a frase correspondente some, sem deixar "Olá, !" quebrado) e vai como `?text=` (URL-encoded) no link `wa.me`. O nome do motorista vem de `carregarMotorista` (novo fetch nessa tela, só pra isso — o resto da tela não precisava do perfil do motorista até agora).

Validado com `tsc --noEmit` limpo. Ainda não commitado/pushado.

## Atualização — 11/08: início do portal de empresas — decisões de arquitetura + camada de compatibilidade com a Fretebras

Pesquisa (sem codar): confirmado, lendo `Docs/PRD-tecnico-portal.html` e `Docs/sequencia-construcao.md`, que o "portal de empresas" (onde transportadoras cadastram e publicam fretes) **não existe no código real** — o PRD é 100% mockado ("O protótipo está 100% mockado; este documento orienta a construção real da funcionalidade"), os caminhos que ele cita (`src/empresa/EmpresaApp.tsx`, `src/admin`) não correspondem à estrutura real (`apps/web/src/pages/*.tsx`), e não existem tabelas `companies`/`opportunities` no Supabase. O plano de fases (`sequencia-construcao.md`) já resolve o problema de ovo-e-galinha entre "portal" (quem publica) e "find-app" (quem busca): portal nasce primeiro, alimentando `opportunities` via cadastro de empresa OU inserção manual (admin) — o find-app consome dessa mesma tabela e pode nascer 1-2 semanas depois, já com dado real.

Decisão do Raphael: **dois apps distintos** (motorista e empresa), não um app só com rotas extras.

Análise de compatibilidade com a Fretebras (planilha `fretes_fretebras_800.xlsx`, 800 anúncios, 177 empresas, fornecida pelo Raphael): o campo único "Veículo" da Fretebras mistura, num só texto separado por " / ", tanto configuração de eixos (Carreta, Bitrem 7/9 eixos, Rodotrem, Truck, Toco...) quanto — potencialmente, em outras amostras — informação de carroceria; na nossa base isso é dois campos normalizados (`TipoVeiculo` e `TipoCarroceria`, já existentes em `packages/rode-calc/src/tiposCaminhao.ts`). Pra essa diferença estrutural não virar problema quando formos importar/comparar dado de fontes externas, foi criada uma camada de compatibilidade:

- **Novo arquivo** `packages/rode-calc/src/compatibilidadeExterna.ts`: exporta `normalizarVeiculoExterno(bruto: string)`, que recebe uma string externa (formato Fretebras ou similar) e devolve `{ tiposVeiculo, tiposCarroceria, naoReconhecidos }`. Quebra a string em termos (separador " / ", "," ou ";" — cuidado: a barra só conta como separador com espaço nos dois lados, senão quebraria valores legítimos tipo "3/4"), reconhece cada termo contra os enums oficiais de `tiposCaminhao.ts` (incluindo aliases pra grafias diferentes, ex: "Bitruck" da Fretebras → "BiTruck" nosso), e classifica cada termo automaticamente no grupo certo (veículo ou carroceria) — um mesmo campo externo pode conter os dois tipos misturados. Termos não reconhecidos não travam o import, só ficam marcados pra revisão manual.
- Exportado em `packages/rode-calc/src/index.ts` (`normalizarVeiculoExterno`, tipo `ResultadoNormalizacao`).
- Validado com as 45 combinações únicas reais da planilha `fretes_fretebras_800.xlsx`: 45/45 reconhecidas, 0 termos sem match, depois de corrigir um bug do regex de separador (estava quebrando "3/4" em "3" e "4").
- `tsc --noEmit` limpo em `packages/rode-calc` e em `apps/web`.

Hoje, os dados reais da Fretebras só preenchem `tiposVeiculo` (a amostra não trouxe nenhuma informação de carroceria) — `tiposCarroceria` fica vazio pra frete importado de lá, e só vem preenchido nos fretes que nascerem direto no nosso portal. Ainda não existe tabela `opportunities` nem app de empresa — isso é só a peça de tradução de dado, pronta pra quando o import começar a existir de verdade.

Ainda não commitado/pushado (junto com a atualização anterior, do WhatsApp).

## Atualização — 11/08 (2): tabela `fretes_publicados` criada + populada com dado de teste da Fretebras

Pedido do Raphael: "pode iniciar a construir a tabela de fretes" (pra depois começarmos o "busca frete" dentro do app do motorista) + "já coloque os fretes dentro da nova tabela para termos massa de dados para testar".

**Decisão de arquitetura confirmada**: dois apps distintos (motorista e empresa), não um app só com rotas extras — isso ainda não foi implementado (nenhum app de empresa existe), só a tabela compartilhada de fretes.

**Migration** `supabase/migrations/20260811150000_fretes_publicados_schema.sql`, tabela `public.fretes_publicados`:
- Campos compatíveis com a Fretebras: `empresa_nome`, `contato_nome`, `contato_telefone`, `origem_cidade`/`origem_uf`, `destino_cidade`/`destino_uf`, `valor_frete_centavos` (nullable) + `valor_a_combinar` (bool), `tipos_veiculo_aceitos` (text[]).
- Campos extras: `company_id` (uuid, **sem FK ainda** — tabela `companies` do portal de empresas não existe, isso é só a coluna preparada pra quando existir), `tipos_carroceria_aceitos` (text[], reaproveitando `TipoCarroceria` do `@rode/calc`), `peso_kg`, `distancia_km`, `data_coleta`, `pedagio_por_conta_de`, `status` (aberto/negociando/fechado/expirado), `fonte` (RODE_DIRETO/MANUAL), `dado_teste` (bool — pra marcar e conseguir apagar depois dado de teste sem misturar com frete real), `observacoes`, timestamps.
- Índices: btree em `origem_uf`/`destino_uf`/`status`, GIN em `tipos_veiculo_aceitos`/`tipos_carroceria_aceitos`.
- RLS habilitada: SELECT liberado pra qualquer usuário `authenticated` (é vitrine pública de frete, motorista logado já pode ver tudo). Escrita não tem policy pra usuário comum ainda — só `service_role` — porque não existe login de empresa pra restringir por dono.

**Import da planilha `fretes_fretebras_800.xlsx`** (800 anúncios, 177 empresas): parseado em Python replicando a mesma lógica do `normalizarVeiculoExterno` (split por " / " com espaço obrigatório, mapeamento pro enum oficial), inserido em 4 lotes de 200 via `execute_sql`. Todos marcados `fonte='MANUAL'`, `dado_teste=true` (pra poder identificar e apagar esse lote de teste antes de ir pra produção, sem tocar em frete real).

Conferência pós-import: `800` linhas, `800` com `dado_teste=true` (nenhum vazou como se fosse real), `196` com `valor_a_combinar=true` (bate com a amostra original), `177` empresas distintas (bate). `select distinct unnest(tipos_veiculo_aceitos)` retornou exatamente os 12 valores esperados do `TipoVeiculo`, sem nenhum termo quebrado — confirma que a lógica de parse (e a correção do bug do separador "3/4") está correta também fora do TypeScript.

Não mexi em nenhuma tela do app nesta etapa — só banco. Próximo passo (não iniciado): a tela "busca frete" dentro do app do motorista, consumindo essa tabela.

## Atualização — 11/08 (5): busca por raio + compatibilidade de veículo na tela Buscar Frete

Pedido do Raphael, em cima da tela anterior: "precisa ter a cidade que o motorista está e o raio que ele aceita percorrer até a cidade do frete", considerando também a compatibilidade do veículo. Antes de codar, perguntei e alinhei duas decisões (ver seção "(4)" acima pro trabalho de dados que isso disparou):

1. **Distância em linha reta (haversine)**, não rota real de rodovia — evita chamar a Google Routes API (paga, usada hoje só pro cálculo de frete individual) numa lista inteira de fretes de uma vez.
2. **"Onde estou agora" é digitado na própria tela de busca e o app lembra** — persistido em `motoristas.cidade_atual`/`uf_atual`/`cidade_atual_lat`/`cidade_atual_lng` (colunas novas, ver seção anterior), separado da `uf_base` do cadastro (que é a base fixa do motorista, não onde ele está agora).

**Novo**: `apps/web/src/lib/municipios.ts` — `buscarMunicipios(consulta)` (autocomplete por prefixo do nome normalizado contra `municipios_brasil`, debounce de 300ms no componente), `distanciaKm(lat1,lng1,lat2,lng2)` (haversine puro), `RAIOS_KM` (100/200/300/500/1000).

**`lib/motorista.ts`**: `Motorista` ganhou `cidade_atual`/`uf_atual`/`cidade_atual_lat`/`cidade_atual_lng`; nova função `salvarCidadeAtual(userId, cidade, uf, lat, lng)`. `Garagem.tsx` ajustado (objeto fallback de motorista precisava dos 4 campos novos pra bater com o tipo).

**`lib/fretesPublicados.ts`**: `FretePublicado` ganhou `origemLat`/`origemLng` (nulo pros 4 fretes sem match geográfico); removi `origemUf` dos filtros de `FiltrosFrete` (foi substituído pela busca por raio) — `destinoUf` e `tipoVeiculo` continuam. Limite padrão subiu de 40 pra 300 (o filtro de raio agora é aplicado no cliente, precisa de mais candidatos pra comparar).

**`BuscarFrete.tsx`** reescrita: campo "Minha cidade agora" com autocomplete (mesmo padrão visual `.sugestoes-box`/`.sugestao-item` já usado em Perfil.tsx pra marca/modelo do caminhão), ao selecionar já salva em `motoristas` e recarrega prefiltrada nas próximas visitas. Select de raio (só aparece depois de escolher a cidade). Cálculo de distância e filtro por raio feitos no cliente (`useMemo`, ordena por distância crescente). Mantido filtro de UF de destino e o chip "Só o meu veículo" de antes. **Novo**: badge "Compatível"/"Não aceita meu veículo" em cada frete da lista (reaproveita `badge-veredicto`/`badge-bom`/`badge-ruim` já existentes), comparando `tipo_veiculo` do perfil do motorista contra `tiposVeiculoAceitos` do frete — aparece sempre que o motorista tem `tipo_veiculo` preenchido, não só quando o filtro "só o meu veículo" está ativo. Aviso informativo quando algum frete não entrou na comparação de distância por falta de coordenada.

Validado com `tsc --noEmit` limpo em `apps/web`. Conferido no banco: `municipios_brasil` com 5.571 linhas, `fretes_publicados` com 796/800 com coordenada (bate com o relatado na etapa de dados). Ainda não commitado/pushado.

## Atualização — 11/08 (6): bug real no autocomplete de cidade — "São Paulo SP" não encontrava nada

O Raphael testou no site publicado e digitou "sao paulo sp" em "Minha cidade agora" — nenhuma sugestão aparecia, então a cidade nunca ficava selecionada, o seletor de raio nunca aparecia, e sobrava só o filtro de Destino visível (parecia que o app só perguntava o estado de destino).

Causa: `buscarMunicipios` (lib/municipios.ts) buscava `nome_norm ilike '<tudo que foi digitado>%'`, mas `nome_norm` só guarda o nome do município, sem a UF — "sao paulo sp" nunca é prefixo de "sao paulo". O placeholder do campo ("Ex.: Sinop/MT") sugeria digitar cidade+UF junto, mas a busca não sabia separar isso.

Corrigido: nova função `extrairCidadeEUf()` separa "Cidade/UF" (com barra) ou "Cidade UF" (com espaço, reconhecendo a sigla contra `UFS_BRASIL`) antes de buscar — a UF, quando reconhecida, também filtra o resultado (`eq('uf', ...)`), o que de quebra resolve a ambiguidade de cidades homônimas (existem 4 "São Paulo" no Brasil — capital/SP, e outras em RS, AM, RN). Sem UF reconhecida, continua buscando só pelo nome, como antes.

Conferido no banco que "São Paulo"/SP existe em `municipios_brasil` (lat -23.5329, lng -46.6395) e que o filtro por UF agora isola ela das outras 3 homônimas. `tsc --noEmit` limpo. Ainda não commitado/pushado.

## Atualização — 11/08 (7): botão "Analisar frete" ligando Buscar Frete → Analisar → Resultado

Pedido do Raphael: cada frete da tela Buscar Frete ganha um botão "Analisar Frete" que abre a calculadora já preenchida (origem/destino/valor) e leva junto, "em memória", os dados de contato do frete — pra quando o motorista salvar a análise, o popup de Empresa/Contato/Telefone (Resultado.tsx) já vir preenchido sozinho. Perguntei e confirmei antes de codar: quando o frete é "a combinar" (sem valor definido), a calculadora já abre com o modo "A negociar" ligado.

Implementado via estado de navegação do React Router (`navigate(..., { state: {...} })`), sem gravar nada novo no banco até o "Salvar análise" de fato acontecer:

- **`BuscarFrete.tsx`**: novo botão `.btn-frete-analisar` (pill azul) em cada card. `abrirAnalise(f)` monta `origem`/`destino` no formato "Cidade/UF", `valorFrete` (null se "a combinar"), `aNegociar` (true se "a combinar") e `contato` (empresaNome/contatoNome/contatoTelefone do frete), e navega pra `/analisar` com esse estado.
- **`Analisar.tsx`**: nova interface `EstadoBuscarFrete`; lê `location.state` uma vez só (`useState` com inicializador preguiçoso) em `estadoInicial`; `origem`/`destino`/`valorFrete`/`aNegociar` agora partem desse estado em vez de sempre vazio — o efeito de busca automática de distância (já existente) dispara sozinho porque origem/destino já vêm preenchidos. Ao calcular, `estadoInicial.contato` é repassado no `state` da navegação pra `/resultado` (a tela Analisar nunca mostra nem edita esses campos, só atravessa).
- **`Resultado.tsx`**: `EstadoRota` ganhou `contato?`; `empresaNome`/`contatoNome`/`contatoTelefone` (estado do popup "Salvar análise") agora partem de `estadoRota.contato` em vez de sempre `''` — continuam editáveis normalmente.
- **CSS**: `.btn-frete-analisar` (pill azul, mesmo tom do `.cta-frete`).

Validado com `tsc --noEmit` limpo em `apps/web`. Não mexe em nenhuma tabela/coluna nova. Ainda não commitado/pushado.

## Atualização — 11/08 (8): marcar "Frete a Combinar" ao salvar análise

Pedido do Raphael: quando o frete é salvo no modo "A negociar"/"Valor a combinar" (mesma coisa), o valor gravado é o mínimo que o motorista calculou pra bater a margem dele — não uma oferta real da empresa. Precisa ir marcado junto, senão fica parecendo que a empresa ofereceu aquele valor.

- **Migração** `20260811170000_analise_frete_valor_a_combinar.sql`: nova coluna `valor_a_combinar boolean not null default false` em `analise_frete`. Aplicada via `apply_migration` e salva no repo.
- **`lib/frete.ts`**: `AnaliseParaSalvar`, `AnaliseCompleta` e `AnaliseResumo` ganharam `valorACombinar`; `salvarAnalise`, `carregarAnalisePorId` e `carregarUltimasAnalises` gravam/leem a nova coluna.
- **`Analisar.tsx`**: `calcularEIr()` agora manda `valorACombinar: aNegociar` no `state` da navegação pra `/resultado` — reaproveita o toggle "A negociar" que já existia, sem novo controle na tela.
- **`Resultado.tsx`**: `EstadoRota` ganhou `valorACombinar`; ao salvar, o valor vai junto pro banco. Quando marcado (tanto na análise recém-calculada quanto reabrindo uma salva/histórico), aparece um aviso "Frete a combinar — este valor é o mínimo que você calculou..." acima dos KPIs, e o rótulo "Valor do frete" ganha o sufixo "(a combinar)".
- **`Garagem.tsx`**: lista de "Últimas análises" mostra "(a combinar)" ao lado do valor quando aplicável.

Validado com `tsc --noEmit` limpo em `apps/web`. Ainda não commitado/pushado.

## Atualização — 12/08: campo "tipo_valor" — corrigindo fretes "por tonelada"

Raphael perguntou onde ficava guardada a distinção entre frete "por tonelagem" e "a combinar" na tabela de fretes. Ao investigar, achei um problema real na importação original (11/08): a coluna "Valor" da planilha Fretebras trazia textos como `"R$ 285,00 (Por tonelada)"`, mas na importação eu só extraí o número e descartei o "(Por tonelada)" — resultado: **499 dos 800 fretes de teste (62%)** ficaram gravados como se o valor fosse o total do frete, quando na verdade é uma taxa por tonelada. Isso fazia o botão "Analisar Frete" calcular o lucro com um valor de frete bem menor que o real nesses casos.

Perguntei ao Raphael como corrigir; ele escolheu a opção recomendada: corrigir o armazenamento e mostrar "R$ 285,00/ton" na tela, sem tentar calcular o total automaticamente (a planilha não tem o peso da carga, então não dá pra converter por tonelada → total sozinho).

- **Migração** `20260812120000_fretes_publicados_tipo_valor.sql`: nova coluna `tipo_valor text check in ('fixo','por_tonelada')` em `fretes_publicados` (null quando `valor_a_combinar = true`).
- **Reimportação completa dos 800 fretes**: reprocessei o `fretes_fretebras_800.xlsx` original preservando o "(Por tonelada)", reaproveitando `normalizarVeiculoExterno` (zero termos não reconhecidos, mesmos 45 combos de veículo de antes) pra não perder a compatibilidade de veículo já validada. `TRUNCATE` + reinserção em 4 lotes + regeocodificação (`origem_lat`/`origem_lng` via join com `municipios_brasil`, mesmo método de antes). Conferido depois: 800 total, 196 a combinar, 499 por tonelada, 105 fixo, 45 combos de veículo, 796 com geolocalização — bate exatamente com os números originais.
- **`lib/fretesPublicados.ts`**: `FretePublicado` ganhou `tipoValor: 'fixo' | 'por_tonelada' | null`; `listarFretesAbertos` lê a nova coluna.
- **`BuscarFrete.tsx`**: valor exibido no card e na mensagem de WhatsApp ganha o sufixo "/ton" quando `tipoValor === 'por_tonelada'`. No botão "Analisar Frete", fretes por tonelada agora entram no mesmo caminho de "a combinar" (liga o modo "A negociar" da calculadora) em vez de pré-preencher "Valor do frete" com a taxa por tonelada como se fosse o total — evita um cálculo de lucro errado.

Validado com `tsc --noEmit` limpo em `apps/web`. Ainda não commitado/pushado.

## Atualização — 12/08 (3): borda nos grupos de chips do Perfil

Pedido do Raphael, com print da tela: os chips de "Tipo de veículo" e "Tipo de carroceria" pareciam itens soltos, sem deixar claro que cada bloco é um único campo. Adicionada borda arredondada (`.chip-secao` em `index.css`, `border: 1px solid #374151; border-radius: 12px; padding: 12px`) — classe já compartilhada pelos dois blocos em `Perfil.tsx`, então uma mudança só resolve os dois. Não mexe em `Resultado.tsx` (usa só `.chip-secao-titulo`, não `.chip-secao`).

## Atualização — 12/08 (2): Carga Máxima no Perfil — fecha o ciclo do frete "por tonelada"

Pedido do Raphael, em cima da correção do `tipo_valor` (seção anterior): cadastrar a **carga máxima do caminhão (toneladas)** no Perfil, pra poder converter a taxa/tonelada dos fretes `por_tonelada` em valor TOTAL estimado (taxa × carga máxima) — hoje esse cálculo não dava pra fazer porque faltava a capacidade do caminhão.

- **Migração** `20260812150000_caminhao_perfil_carga_maxima.sql`: coluna `carga_maxima_toneladas numeric(6,2)` em `caminhao_perfil`, nullable, opcional. Aplicada direto no Supabase via MCP.
- **`lib/frete.ts`**: `CaminhaoPerfil`/`PERFIL_DEFAULT` ganharam o campo.
- **`Perfil.tsx`**: campo novo "Carga máxima (toneladas)" logo após "Número de eixos".
- **`Analisar.tsx`**: objeto de perfil montado manualmente em `montarCustos()` precisou do campo novo (erro de TS pego pelo `tsc --noEmit`, corrigido com `null` — esse fluxo não usa carga máxima, só o de Buscar Frete).
- **`BuscarFrete.tsx`** (é aqui que fecha o ciclo): nova função `valorTotalEstimadoCentavos(frete, cargaMaxima)` = taxa/ton × carga máxima do perfil, só quando `tipoValor === 'por_tonelada'`. Card do frete agora mostra `≈ R$ X total (carga máx. Y ton)` ao lado da taxa, quando o motorista tem carga máxima cadastrada; sem cadastro, mostra aviso "Cadastre a carga máxima...". Botão "Analisar Frete": antes, todo frete `por_tonelada` forçava o modo "A negociar" (não tinha como saber o total); agora, com carga máxima cadastrada, pré-preenche "Valor do frete" com o total estimado (editável — é estimativa assumindo caminhão cheio, a carga real pode ser menor). Sem carga máxima cadastrada, comportamento antigo se mantém (força "A negociar").

Validado com `tsc --noEmit` limpo em `apps/web`. Ainda não commitado/pushado.

**Decisão explícita, importante**: o valor estimado assume o caminhão saindo com a carga máxima cheia — é uma aproximação pra ajudar a decisão, não um valor fechado com a empresa. O motorista sempre pode editar "Valor do frete" na tela Analisar antes de calcular, e a negociação real de peso/valor continua acontecendo por telefone/WhatsApp com o contato do frete.

## Atualização — 11/08 (3): tela "Buscar frete" no app do motorista

Pedido do Raphael: "pode seguir" (na tela busca frete, combinado na atualização anterior).

**Novo**: `apps/web/src/lib/fretesPublicados.ts` — `listarFretesAbertos(filtros, limite)` lê `fretes_publicados` (status='aberto', mais recente primeiro, limite 40), com filtros opcionais `origemUf`/`destinoUf` (`.eq`) e `tipoVeiculo` (`.contains` no array `tipos_veiculo_aceitos`). Não filtra por `dado_teste` de propósito — quando o portal de empresas existir e publicar fretes reais (`fonte='RODE_DIRETO'`) na mesma tabela, essa tela já mostra os dois juntos sem precisar mudar nada. Exporta também `UFS_BRASIL` (lista fixa das 27 UFs, pros selects de filtro).

**Novo**: `apps/web/src/pages/BuscarFrete.tsx` — carrega motorista + perfil do caminhão (pra pegar `tipo_veiculo` e nome), filtros de UF origem/destino (selects) + chip "Só o meu veículo" (só aparece se o motorista já tiver `tipo_veiculo` preenchido no Perfil), lista os fretes no mesmo estilo visual de "Últimas análises" (`.lista-analises`/`.linha-analise-item`), e por frete mostra rota, valor (ou "Valor a combinar"), empresa, tipos de veículo aceitos, e — se tiver telefone — links `tel:`/`wa.me` com mensagem pronta (`montarMensagemWhatsapp`, mesma estrutura já aprovada na tela Resultado: saudação + apresentação do motorista + origem/destino/valor + pedido de detalhes de coleta/pagamento/pedágio).

**Rota**: `/buscar-frete` adicionada em `main.tsx`. **Garagem**: novo botão "Buscar frete" (`cta-frete`, azul pra diferenciar do "Analisar frete" verde) logo abaixo do CTA de analisar.

**CSS**: `.cta-frete` (fundo azul `#1d4ed8`) e `.filtro-frete` (linha flexível pros dois selects + chip).

Validado com `tsc --noEmit` limpo em `apps/web`. Não criei nenhuma tabela/coluna nova — só leitura da `fretes_publicados` já existente. Ainda não commitado/pushado.

Em aberto pra próxima etapa (não pedido ainda): paginação/"carregar mais" (hoje corta em 40 resultados), e o lado empresa (cadastro + publicar frete) continua não iniciado — só a leitura do lado motorista existe agora.

## Atualização — 11/08 (4): dados geográficos (lat/lng) pra busca de frete por raio

Pedido do Raphael (via agente separado, só banco — nenhum arquivo de `apps/web/src` foi tocado nesta etapa): preparar a base geográfica pra futura busca de frete por raio (motorista digita a cidade onde está, escolhe um raio em km, o app calcula a distância em linha reta até a origem de cada frete). **Decisão já confirmada antes**: distância em linha reta (haversine), sem chamar API paga por busca.

**Tabela nova `public.municipios_brasil`** (migration `20260811160000_municipios_brasil_schema.sql`, aplicada como `municipios_brasil_schema`): `nome`, `nome_norm` (minúsculo, sem acento — mesmo espírito de `compatibilidadeExterna.ts`), `uf`, `latitude`, `longitude`. Índices em `(nome_norm, uf)` e `nome_norm`. RLS: SELECT liberado pra `authenticated`, mesmo padrão de `fretes_publicados`.

**Fonte do dado**: CSV público `municipios.csv` do repositório `github.com/kelvins/Municipios-Brasileiros` (dado do IBGE, mantido pela comunidade) — obtido via `git clone` (o `raw.githubusercontent.com` direto estava bloqueado pelo proxy do sandbox; `git clone https://github.com/...` funcionou normalmente). Processado em Python (normalização = NFD unicode + remoção de combining marks + minúsculo, mapeamento de `codigo_uf` de 2 dígitos pra sigla). **5.571 municípios inseridos** (5.570 municípios + Distrito Federal) — bate com o total do CSV. Inserção em 12 lotes de ~500 linhas via `execute_sql` (carga de dado, sem migration própria, mesmo padrão do seed de `fretes_publicados`).

**Migration** `20260811160100_fretes_publicados_geolocalizacao.sql` (aplicada como `fretes_publicados_geolocalizacao`): colunas `origem_lat`/`origem_lng` (numeric, nullable) em `fretes_publicados`.

**Migration** `20260811160200_motoristas_cidade_atual.sql` (aplicada como `motoristas_cidade_atual`): colunas `cidade_atual`, `uf_atual` (text) e `cidade_atual_lat`/`cidade_atual_lng` (numeric) em `motoristas` — pra guardar onde o motorista está agora (diferente de `uf_base`, que é a UF onde ele mora/é baseado). Nenhuma tela preenche isso ainda.

## Atualização — 13/08 (2): liga tipo_carroceria → tipo de carga ANTT automaticamente

Pedido do Raphael, execução direta da sugestão deixada na resposta anterior: em vez de deixar `tipoCarga` sempre default `'carga_geral'`, resolver automaticamente a partir do `tipo_carroceria` que o motorista já cadastra no Perfil — sem criar campo novo em tela nenhuma.

- **`packages/rode-calc/src/tipoCargaPorCarroceria.ts`** (novo): `TIPO_CARGA_POR_CARROCERIA`, mapeamento das 18 carrocerias já cadastradas (`tiposCaminhao.ts`) pros 5 tipos de carga ANTT. Critério documentado no cabeçalho do arquivo — é uma aproximação de bom senso, a ANTT não define essa correspondência oficialmente: Graneleiro/Silo/Cavaqueira/Hoper/Caçamba → `granel_solido`; Tanque → `granel_liquido`; Baú Frigorífico/Baú Refrigerado → `frigorificada`; Bug Porta Container → `conteinerizada`; todo o resto (Grade baixa, Prancha, Plataforma, Sider, Baú, Cegonheiro, Gaiola, Munk, Apenas Cavalo) → `carga_geral`, por não ter categoria ANTT própria. Função `tipoCargaPorCarroceria(carroceria)` cai em `'carga_geral'` se não houver carroceria cadastrada ou o valor não for reconhecido. `pisoANTT.ts` ganhou `TIPO_CARGA_LABEL` (rótulo em português pra UI). Exportado em `index.ts`.
- **Testes** (`test/tipoCargaPorCarroceria.test.ts`): 4 casos novos, incluindo checagem de que as 18 carrocerias de `CARROCERIAS` têm mapeamento. **32/32 testes passando** no `@rode/calc` (28 de antes + 4 novos).
- **`Analisar.tsx`**: `tipoCarga` calculado via `useMemo(() => tipoCargaPorCarroceria(perfil?.tipo_carroceria), [perfil])`, repassado nas duas chamadas a `calcularFrete` (preview "A negociar" e cálculo final). Aviso novo em "Ajustar parâmetros do caminhão e custos" — só aparece se o motorista já cadastrou carroceria no Perfil — mostrando qual tipo de carga está sendo usado e lembrando que dá pra ajustar a carroceria em "Meu Caminhão" se estiver errado.
- **`Resultado.tsx`**: KPI "Piso mínimo ANTT" ganha o tipo de carga entre parênteses (ex.: "Piso mínimo ANTT (Granel Líquido)") sempre que não for carga geral — dado já vinha em `resultado.entrada.tipoCarga`, não precisou de fetch novo.

Validado: `tsc --noEmit` limpo em `packages/rode-calc` e `apps/web`, 32/32 testes do `@rode/calc`. Ainda não commitado/pushado.

## Atualização — 13/08: fecha o TODO da Fase 0 — piso ANTT pra todos os tipos de carga

Raphael perguntou "podemos fazer a Fase 0? tem algum impecilio?" — respondi que a Fase 0 já estava praticamente pronta (identidade, `@rode/calc`, infra), faltando só um pedaço documentado desde a extração do motor (04/08): o piso ANTT só cobria "carga geral", os outros 4 tipos (granel sólido, granel líquido, frigorificada, conteinerizada) e a versão em banco (`antt_piso_tabela`, prevista no PRD original) nunca foram feitos. Ele confirmou: fechar isso, migrando pra tabela versionada no banco.

**Levantamento das taxas oficiais**: fui direto no texto publicado em `anttlegis.antt.gov.br` (Resolução ANTT Nº 6.084/2026, Anexo II, "TABELA A - TRANSPORTE RODOVIÁRIO DE CARGA LOTAÇÃO") em vez de confiar em resumo de terceiros — uma busca inicial trouxe um resumo com um coeficiente errado (R$ 782,50 de custo fixo pra 2 eixos carga geral, quando o valor real, já usado no código desde 04/08, é R$ 451,84), então fui na fonte primária conferir linha por linha. Peguei as 5 categorias "normais" da Tabela A (não perigosa/neogranel/pressurizada, nem as Tabelas B/C/D de "só veículo automotor"/"alto desempenho" — fora do escopo do que o app modela hoje).

- **`packages/rode-calc/src/pisoANTT.ts`**: reescrito. Novo tipo `TipoCarga` (`'carga_geral' | 'granel_solido' | 'granel_liquido' | 'frigorificada' | 'conteinerizada'`), uma constante de coeficientes por tipo (`ANTT_GRANEL_SOLIDO`, `ANTT_GRANEL_LIQUIDO`, `ANTT_FRIGORIFICADA`, `ANTT_CONTEINERIZADA`, mais a `ANTT_CARGA_GERAL` que já existia) e `ANTT_TABELA_A` reunindo as 5. `calcularPisoANTT(distanciaKm, numeroEixos?, tipoCarga?)` ganhou o terceiro parâmetro, default `'carga_geral'` — 100% compatível com quem já chamava só com 2 argumentos. Conteinerizada não tem coeficiente pra 2 eixos na tabela oficial (nota do Anexo II: combinação que não existe no mercado) — cai no eixo disponível mais próximo, mesma regra já usada pra "8 eixos" (Art. 5º §5º).
- **`types.ts`**: `FreteInput` ganhou `tipoCarga?: TipoCarga`. **`calcularFrete.ts`**: repassa `entrada.tipoCarga` pro `calcularPisoANTT`. **`index.ts`**: exporta os novos tipos/constantes.
- **Testes** (`test/pisoANTT.test.ts`): 7 casos novos — cada tipo de carga batendo com a tabela oficial, o caso de conteinerizada sem 2 eixos, default de `tipoCarga`, e que `ANTT_TABELA_A` bate com as constantes individuais. **28/28 testes passando** (21 antigos + 7 novos), `tsc --noEmit` limpo em `packages/rode-calc` e `apps/web`.
- **Migração** `20260813120000_antt_piso_tabela.sql`: tabela `antt_piso_tabela` (tipo_carga, numero_eixos, ccd, cc, versão, fonte, vigência), RLS com SELECT pra `authenticated`, populada com as 34 linhas (5 tipos × 7 faixas de eixo, menos a de conteinerizada/2-eixos que não existe). Aplicada direto no Supabase via MCP, conferida (34 linhas, contagem por tipo bate). **Decisão de arquitetura importante**: o motor (`@rode/calc`) continua puro — não consulta este banco em runtime, só lê as constantes em memória de `pisoANTT.ts`. A tabela é um espelho versionado pra outras partes do sistema (admin, portal) consultarem sem precisar publicar versão nova do pacote a cada reajuste da ANTT.

**Não incluído nesta rodada, decisão de escopo**: nenhuma tela ainda deixa o motorista escolher o tipo de carga — `tipoCarga` é opcional em todo lugar e continua default `'carga_geral'`, então o comportamento do app não muda até alguém decidir ligar isso em algum lugar (ex.: inferir automaticamente do `tipo_carroceria` já cadastrado no Perfil — Tanque→granel líquido, Graneleiro→granel sólido, Baú Frigorífico/Refrigerado→frigorificada, Bug Porta Container→conteinerizada). Fica como decisão em aberto pro Raphael, não é bloqueio pra fechar a Fase 0 (que é sobre o motor/dado, não sobre UX).

Ainda não commitado/pushado.

## Atualização — 12/08 (5): "Próxima troca de óleo" no Perfil + alerta na Garagem

Pedido do Raphael, print da tela Perfil. Item que já estava no backlog em aberto (ver seção 06/08 "revisão do backlog", "alerta de troca de óleo"). Mesmo padrão do alerta de CNH/exame toxicológico, mas com uma diferença importante: óleo é atributo do **caminhão** (`caminhao_perfil`), não do motorista, e o Raphael pediu uma janela de aviso mais curta (**1 semana antes**, não 60 dias como CNH/exame).

- **Migração** `20260812160000_caminhao_perfil_proxima_troca_oleo.sql`: coluna `proxima_troca_oleo date` em `caminhao_perfil`, nullable. Aplicada direto no Supabase via MCP.
- **`lib/frete.ts`**: `CaminhaoPerfil`/`PERFIL_DEFAULT` ganharam o campo (`string | null`, formato ISO "AAAA-MM-DD" — mesmo padrão de `cnh_vencimento`).
- **`Perfil.tsx`**: campo novo "Próxima troca de óleo" (`<input type="date">`, mesmo componente nativo já usado pra CNH/exame em `Motorista.tsx` — o navegador exibe no formato local, DD/MM/AAAA em pt-BR) logo após "Manutenção (R$/km)", com aviso "Você recebe um alerta na Garagem uma semana antes de vencer."
- **`Garagem.tsx`**: passou a carregar `carregarPerfil(uid)` também (antes só carregava `motorista`), extrai `proxima_troca_oleo`. A função `checar()` do alerta (antes fixa em 60 dias) ganhou um parâmetro `limiteDias` opcional — "Troca de óleo" usa `checar('Troca de óleo', proximaTrocaOleo, 7)`. Bolinha de alerta (âmbar/vermelha) ao lado do "Olá, Nome" agora também acende por troca de óleo vencendo, mesma UX de antes (clique abre painel com detalhe). Como CNH/exame vivem em "Meu Perfil" (`/motorista`) e óleo vive em "Meu Caminhão" (`/perfil`), o botão de atalho do painel virou `botoesAtualizarAlerta` (um `Map` rota→texto) — mostra os dois links se houver alerta dos dois tipos ao mesmo tempo, só um se só um tipo estiver vencendo.

Validado com `tsc --noEmit` limpo em `apps/web`. Ainda não commitado/pushado.

## Atualização — 12/08 (4): botão "Calcular" → "Analisar Frete"

Pedido rápido do Raphael, print da tela Analisar: texto do botão principal trocado de "Calcular" pra "Analisar Frete" (`Analisar.tsx`, linha do botão de submit). `tsc --noEmit` limpo. Ainda não commitado/pushado.

## Onde paramos — 13/08, fim de sessão

> Substitui a seção "Onde paramos — 12/08" abaixo (mantida só como histórico) — tudo que estava pendente lá já foi resolvido nesta sessão.

### O que fizemos (nesta sessão, 12-13/08, em ordem)

1. **Carga máxima do caminhão** (Perfil) — fecha o ciclo do frete "por tonelada": card de Buscar Frete mostra valor total estimado (taxa × carga máxima), botão "Analisar Frete" pré-preenche o valor em vez de forçar "A negociar".
2. **Borda visual** nos grupos de chip "Tipo de veículo"/"Tipo de carroceria" no Perfil (deixar claro que cada bloco é um único campo).
3. **Bug de build corrigido**: um commit de sessão anterior nunca tinha incluído de fato `lib/fretesPublicados.ts` nem a migração `tipo_valor` — ficaram só como mudança local, quebrando o deploy do Vercel quando o commit seguinte passou a depender desse campo. Corrigido e commitado.
4. **Botão "Calcular" → "Analisar Frete"** na tela Analisar (texto).
5. **"Próxima troca de óleo"** no Perfil do caminhão — alerta na Garagem uma semana antes de vencer (mesmo padrão visual do alerta de CNH/exame toxicológico, mas com janela de 7 dias e apontando pra "Meu Caminhão" em vez de "Meu Perfil").
6. **Fecha o TODO da Fase 0**: piso ANTT agora cobre os 5 tipos de carga da Tabela A (carga geral, granel sólido, granel líquido, frigorificada, conteinerizada) — coeficientes conferidos direto na fonte oficial (anttlegis.antt.gov.br, Resolução 6.084/2026), não em resumo de terceiro (que trazia um número errado). Tabela `antt_piso_tabela` criada no Supabase como espelho versionado; o motor `@rode/calc` continua puro (lê de constante em memória, não do banco).
7. **Liga `tipo_carroceria` → tipo de carga automaticamente**: `tipoCargaPorCarroceria()` novo em `@rode/calc`, mapeia as 18 carrocerias já cadastradas pros 5 tipos ANTT (ex.: Tanque→granel líquido, Baú Frigorífico→frigorificada). Sem campo novo em tela nenhuma — a tela Analisar mostra um aviso de transparência, e o Resultado mostra o tipo usado no KPI do piso ANTT.

### Estado atual (conferido agora, não presumido)

**Tudo commitado E publicado** — `git fetch` + comparação `origin/main...HEAD` deu 0 à frente / 0 atrás, ou seja, a pasta local, o GitHub e (presumivelmente) o deploy do Vercel estão sincronizados no commit `1704731`. Não consegui confirmar o status do deploy pela API da Vercel nesta sessão (a integração MCP disponível aqui está ligada a outro projeto, `tacorrei-app`, não ao `rode-com-lucro-mvp`) — vale um olhar rápido no [painel Vercel](https://vercel.com/rode-com-lucro/rode-com-lucro-mvp/deployments) pra confirmar visualmente que o build do commit `1704731` passou limpo.

**Testes**: 32/32 passando em `@rode/calc` (`npx vitest run`). `tsc --noEmit` limpo em `apps/web` e `packages/rode-calc`.

**Testado ao vivo pelo Raphael**: só a borda dos chips (viu print). Carga máxima, troca de óleo, botão "Analisar Frete" e o piso ANTT por tipo de carga foram implementados e validados por tipo/build, mas ainda não conferidos na tela pelo Raphael.

### Para onde vamos (retomando o mapeamento de gaps do MVP, feito em 12/08)

Da Fase 0 (fundação), só falta official-check periódico do reajuste ANTT (não existe processo automático — combinar se isso é um lembrete manual recorrente ou algo a automatizar depois). Fora isso, Fase 0 está fechada.

Prioridades em aberto, sem ordem definida ainda — retomar com o Raphael:
- **Fase 1 (calc-app)**: falta a fila offline-first (IndexedDB) — hoje tudo grava direto no Supabase, sem funcionar sem internet.
- **Fase 2 (calc-wpp)**: não iniciada. Maior risco de prazo é a aprovação de templates HSM pela Meta — vale começar a submissão cedo, antes mesmo do resto estar pronto.
- **Fase 3 (portal + find-app)**: só a leitura existe (Buscar Frete), com dado de teste da Fretebras. Portal de empresas (cadastro, aprovação manual, CRUD de oportunidades) não foi iniciado.
- **Admin/instrumentação**: nenhum módulo chama `analytics_event`/`track()` ainda — dívida que cresce com o tempo.

## Onde paramos — 12/08, fim de sessão (histórico, já resolvido — ver seção acima)

**Funcionalidade nova pendente de validação visual**: campo "Carga máxima (toneladas)" no Perfil e o valor total estimado (`≈ R$ X total`) no card de frete "por tonelada" em Buscar Frete — implementados e com `tsc --noEmit` limpo, mas o Raphael ainda não viu/testou ao vivo (só viu print da borda dos chips).

**Preenchimento de `fretes_publicados.origem_lat`/`origem_lng`**: habilitada a extensão `unaccent` (estava disponível mas não habilitada — `create extension if not exists unaccent;`), confirmado que `lower(unaccent(...))` bate com a normalização usada em `municipios_brasil.nome_norm`. UPDATE por join `municipios_brasil.nome_norm = lower(unaccent(trim(origem_cidade)))` + `municipios_brasil.uf = trim(origem_uf)`.

**Resultado da conferência**: **796 de 800 fretes** ficaram com coordenada preenchida. Os 4 que não bateram (2 pares distintos) foram investigados individualmente, não é falha da base de referência:
- `Boa Esperança` / `MT`: não existe município com esse nome exato em MT na base do IBGE (existe `Boa Esperança do Norte`, `Água Boa`, etc.) — parece erro/nome incompleto no dado de origem (planilha Fretebras).
- `São João dAliança` / `GO`: falta o apóstrofo — o nome oficial é `São João d'Aliança` (existe certinho em `municipios_brasil`, `nome_norm = 'sao joao d''alianca'`). É um typo na planilha original, não um problema de cobertura da base.

Ambos ficam como pendência pra decisão do Raphael (corrigir manualmente esses 2 pares na `fretes_publicados`, ou deixar como estão já que são poucos registros de dado de teste).

Não mexi em nenhum arquivo de `apps/web/src` — essa etapa foi só banco (tabela de referência + colunas novas + UPDATE de backfill). Próximo passo (não iniciado): consumir essas coordenadas nas telas do motorista (input de "cidade atual" + filtro de raio em `BuscarFrete.tsx`).

## Atualização — 13/08 (2): fila offline-first — fecha a Fase 1

Depois de confirmar o checkpoint da sessão anterior (código e deploy sincronizados, commit `1704731`), perguntei ao Raphael qual frente entrar em seguida. Sugeri não priorizar Admin/instrumentação (dívida sem prazo, ainda com poucos usuários testando) e sim duas coisas com relógio correndo: fechar a Fase 1 (offline-first) e começar a submissão de template do calc-wpp na Meta cedo (aprovação é o gargalo, não o código). Ele escolheu começar pela Fase 1.

Antes de codar, perguntei o alcance: só a fila de "Salvar análise" (o que o próprio código já previa desde a extração do `@rode/calc`) ou fila genérica pra toda gravação do app. Raphael pediu uma estimativa de esforço antes de decidir — expliquei que o grosso do trabalho é construir a fila em si (não escala por tela) e ele optou pelo escopo completo. Incluí também, por conta própria, um problema relacionado mas diferente: se o motorista abre o app já sem sinal, `carregarPerfil` falhava e a calculadora caía nos custos genéricos (`PERFIL_DEFAULT`) em vez dos custos reais do caminhão — isso dava um veredito calculado errado sem avisar que era estimativa. Resolvido junto, como cache de leitura (problema distinto de fila de escrita).

**Novo `apps/web/src/lib/filaOffline.ts`** — motor genérico de fila offline via IndexedDB:
- `registrarExecutor(tipo, fn)`: cada módulo de domínio (`lib/frete.ts`, `lib/motorista.ts`) ensina a fila a reenviar seu tipo de gravação, sem `filaOffline.ts` precisar conhecer `analise_frete`/`motoristas` — evita dependência circular.
- `gravarOuEnfileirar(tipo, payload, idFila?)`: tenta gravar na hora; se `navigator.onLine` for `false` ou a chamada lançar exceção (rede caiu no meio), guarda no IndexedDB em vez de propagar erro. Erro *real* do servidor (RLS, validação — não exceção de rede) continua sendo um erro de verdade, não é mascarado como "salvo offline".
- `processarFila()`: reenvia os itens pendentes na ordem de criação; item que falhar de novo fica na fila (com contagem de tentativas) em vez de ser descartado — preferível a perder silenciosamente uma análise que o motorista já achou que tinha salvo.
- Sincroniza sozinho: no evento `online` do navegador, na carga do módulo (cobre reabrir o app já com sinal depois de ter ficado offline) e por um `setInterval` de 30s (o evento `online` nem sempre é confiável).
- Evento customizado `rode:fila-offline-mudou` no `window`, disparado sempre que a fila muda — é o que a Garagem escuta pra atualizar o aviso sem precisar de F5.
- `idFila` explícito por chamador (ex: `analise_frete_realizado:${id}`, `motoristas_editar:${userId}`) — reenviar a mesma chave sobrescreve em vez de duplicar (ex: motorista marca/desmarca "Realizado" duas vezes sem sinal → só o último estado desejado é sincronizado, não cada clique).

**Gravações plugadas na fila** (`lib/frete.ts`, `lib/motorista.ts`): `salvarAnalise`, `alternarRealizado`, `salvarPerfil`, `salvarCidadeAtual`, `salvarMotorista`. Cada função manteve a mesma assinatura pública (só `salvarAnalise` ganhou um campo novo no retorno, `enfileirado: boolean`).

**`Resultado.tsx`**: `salvar()` agora lê `enfileirado`; a mensagem de sucesso muda pra "Análise salva no aparelho — sem sinal agora, vai pro Supabase sozinha assim que a conexão voltar." quando aplicável, em vez do "Análise salva." genérico.

**Novo `apps/web/src/lib/cacheLocal.ts`** — cache simples via `localStorage` (só a leitura mais recente, sobrescrita a cada sucesso, sem versionamento/expiração). `carregarPerfil` (`lib/frete.ts`) agora: se `navigator.onLine` for `false` ou a chamada falhar por rede, cai pro cache local em vez de retornar `null` (que fazia `Analisar.tsx` usar `PERFIL_DEFAULT`). Se estiver online e o Supabase responder com sucesso, atualiza o cache.

**`Garagem.tsx`**: novo aviso "N alteração(ões) aguardando conexão — vai sincronizar sozinho assim que voltar o sinal", lido de `contarPendentes()` no carregamento e atualizado ao vivo pelo evento `rode:fila-offline-mudou`.

**Validação**: `tsc --noEmit` limpo em `apps/web`, 32/32 testes do `@rode/calc` continuam passando (não mexi no motor). Como IndexedDB não roda nesta ferramenta de terminal, escrevi um smoke test isolado (Node + `fake-indexeddb`, arquivo temporário, apagado depois de rodar) cobrindo 6 cenários: enfileira offline, enfileira quando a chamada falha mesmo online, chave repetida sobrescreve em vez de duplicar, erro real do servidor fica na fila (não é descartado), e a fila esvazia sozinha assim que o executor volta a funcionar. Os 6 bateram como esperado.

**Fora do escopo desta rodada, decisão explícita**: login/OTP (sempre precisa de rede, não faz sentido enfileirar) e as buscas de FIPE/distância (route-cost) — já tinham fallback manual antes desta sessão, funcionam diferente de uma fila de gravação pendente. Cache de leitura ficou só no Perfil do caminhão (o que afeta a correção do cálculo); não estendi pra `motoristas`/Garagem (nome, meta, últimas análises) — isso é sobre a tela abrir com algo pra mostrar, não sobre calcular errado, então fica como possível próximo passo se o Raphael quiser.

## Atualização — 17/08: paginação "Ver mais" nas Últimas análises

Pedido do Raphael, a partir de um print da Garagem em produção: a lista "Últimas análises" sempre mostrava só 3 e não dava pra ver fretes mais antigos. Adicionado um botão "Ver mais" que busca mais 5 por clique, acrescentando à lista já carregada (sem recarregar as 3 primeiras, sem paginação por página separada).

**`apps/web/src/lib/frete.ts`**: `carregarUltimasAnalises(userId, limite, offset)` ganhou o parâmetro `offset` (default 0) e trocou `.limit(limite)` por `.range(offset, offset + limite - 1)` — mesma query, agora capaz de pular o que já foi mostrado.

**`apps/web/src/pages/Garagem.tsx`**: carga inicial continua pedindo 3 (`TAMANHO_LOTE_INICIAL`); guarda `userId` (precisa pra paginar depois) e `temMaisAnalises` (true se a última leva veio cheia — sinal de que pode ter mais no banco). Botão "Ver mais" aparece só quando `temMaisAnalises`, some sozinho quando uma leva de 5 (`TAMANHO_LOTE_SEGUINTE`) volta incompleta (chegou ao fim). `carregarMaisAnalises()` busca com offset = `analises.length` e concatena ao estado existente; `carregandoMais` evita duplo clique.

**Validação**: `tsc --noEmit` limpo em `apps/web`.

## Atualização — 17/08 (2): filtro "Só realizados" nas Últimas análises

Pedido do Raphael logo em seguida, olhando a mesma tela: um botão ao lado de "Últimas análises" pra mostrar só os fretes marcados como realizado — os que realmente entram na conta do "lucro do mês" (diferente dos calculados/salvos mas não executados). Perguntou sugestão de nome; optei por "Só realizados" (fica claro que é um toggle liga/desliga, não uma tela de filtro separada).

**`apps/web/src/pages/Garagem.tsx`**: novo estado `apenasRealizados`; `analisesExibidas` filtra a lista já carregada em memória (não refaz busca no Supabase — o filtro é só visual sobre o que já veio pela paginação). Texto do botão vira "✓ Só realizados" quando ativo. Se o filtro estiver ligado e não sobrar nenhum item entre os já carregados, mostra aviso sugerindo isso (em vez de lista vazia sem explicação) — nesse caso o botão "Ver mais" (que ignora o filtro ao buscar) ajuda a achar mais realizados mais antigos.

**`apps/web/src/index.css`**: `.ultimas-analises-topo` virou flex-row (h2 + botão lado a lado); botão reaproveita o mesmo visual de pílula do "Realizado"/"Marcar como realizado" de cada linha (`.filtro-realizados-on/off`), pra manter consistência visual.

**Validação**: `tsc --noEmit` limpo em `apps/web`.

## Atualização — 17/08 (3): correção do filtro "Só realizados" — busca no banco, não só no que já tava na tela

Raphael testou e achou o bug: o filtro só escondia/mostrava dentro do que já tinha sido carregado por `carregarUltimasAnalises` (3 iniciais + o que veio via "Ver mais"). Um frete realizado mais antigo, ainda atrás do "Ver mais", ficava invisível pro filtro — parecia que só trazia "os realizados que estão listados".

**Correção**: o filtro agora busca direto no Supabase, em vez de filtrar em memória.

**`apps/web/src/lib/frete.ts`**: extraído `mapAnaliseResumo` (helper compartilhado, evita duplicar o mapeamento linha→`AnaliseResumo`) e nova `carregarAnalisesRealizadasDoMes(userId)` — mesmo critério de `carregarLucroMesAtual` (`realizado = true` + `created_at` dentro do mês corrente), sem paginação, porque a meta é exatamente isso: todos os realizados do mês, não só uma amostra.

**`apps/web/src/pages/Garagem.tsx`**: `apenasRealizados` (o toggle) agora dispara `alternarFiltroRealizados()`, que busca `carregarAnalisesRealizadasDoMes` só ao ligar o filtro (estado `analisesRealizadas` guarda o resultado; `carregandoRealizados` mostra "Carregando…" no botão e esconde a lista por um instante). `analisesExibidas` passa a ser `analisesRealizadas` (quando ligado) em vez de um `.filter()` sobre `analises`. O botão "Ver mais" some enquanto o filtro está ligado (não faz sentido paginar uma lista que já veio inteira do banco). Marcar/desmarcar "Realizado" com o filtro ligado também refaz essa busca, pra tirar/incluir o item certo na hora.

**Validação**: `tsc --noEmit` limpo em `apps/web`.

## Atualização — 18/08: botão "Testes" (provisório) — mural de casos de teste

Pedido do Raphael, olhando o botão "Backlog" já existente: um segundo botão, "Testes", pra registrar o que precisa ser testado e depois o resultado. Mesmo espírito do Backlog (mural comum entre os sócios, PROVISÓRIO — remover antes de produção), mas com um fluxo em duas etapas por pessoas diferentes: alguém cadastra o caso; o testador escolhe um pendente, executa e registra o resultado.

Segui o padrão que o Raphael pediu e completei com o que faltava pra fechar o fluxo:
- **Cadastro** (como pedido): Tela, Funcionalidade, Obs para o teste — mais **Nome de quem cadastrou** (pra saber quem pediu o teste, mesmo padrão de accountability do campo "Nome" do Backlog).
- **Resultado** (como pedido): Resultado do Teste, Observação do teste, Aprovado — mais **Nome de quem testou** e a data/hora do teste (`testado_em`), pelo mesmo motivo.
- **Aprovado** virou um campo `boolean | null`: `null` enquanto pendente, `true`/`false` depois de testado — reprovado é tratado como resultado válido (o Raphael notou que o teste "pode não ser positivo, indicando ponto a melhorar"), não como erro.
- Adicionei também **"Reabrir"** num teste já feito — volta pra fila de pendentes, útil depois de corrigir algo e querer testar de novo, sem precisar cadastrar tudo de novo.

**Nova tabela `testes_provisorio`** (migration `20260818140000_testes_provisorio_schema.sql`, aplicada via MCP do Supabase): mesma RLS "mural comum" do `backlog_provisorio` (select/insert/update/delete liberado pra qualquer autenticado, sem filtro por usuário).

**Novo `apps/web/src/lib/testes.ts`**: `listarTestes()` (pendentes primeiro, mais antigos primeiro — testar na ordem que entrou; testados depois), `criarTeste()`, `registrarResultadoTeste()`, `reabrirTeste()`.

**Novo `apps/web/src/components/TestesModal.tsx`**: modal com formulário de cadastro (colapsado por padrão, "+ Cadastrar o que precisa ser testado"), lista dividida em "A testar" e "Testados". Cada pendente tem um botão "Testar" que abre um formulário inline (resultado, observação, Aprovado/Reprovado como dois botões, nome) — só um por vez. Reaproveita boa parte do visual/classes do BacklogModal (`.backlog-overlay`, `.backlog-modal`, `.backlog-item`, `.backlog-form`), com um bloco novo de CSS só pro que é específico do fluxo de teste.

**`apps/web/src/pages/Garagem.tsx`**: botão "Testes" empilhado em cima do "Backlog" no header (`.garagem-header-botoes-provisorios`, coluna com os dois).

**Validação**: `tsc --noEmit` limpo em `apps/web`.

## Atualização — 18/08 (2): botão "Apagar dados do caminhão" no Perfil

Pedido do Raphael: botão no Perfil do caminhão pra limpar os dados quando o motorista trocar de caminhão, com confirmação antes de executar. Ele adiantou que "os dados pré-preenchidos vão continuar aparecendo depois da tela limpa" — confirmei olhando o código: as sugestões de marca/modelo/ano vêm ao vivo da Tabela FIPE (`lib/fipe.ts` + cache `fipe_cache`, tabela à parte, não ligada ao perfil do usuário), então nada precisa ser feito à parte — o autocomplete continua funcionando normal pro caminhão novo depois de limpar.

**Decisão de escopo**: "apagar" reseta o perfil pra `PERFIL_DEFAULT` — a mesma constante já usada quando o motorista nunca cadastrou um caminhão. Optei por isso em vez de tentar separar campo por campo o que é "do caminhão" vs "preferência do motorista" (ex.: margem desejada, alimentação/dia): `PERFIL_DEFAULT` já é o estado "zerado" testado e usado no resto do app, reaproveitar evita inventar uma política nova de reset parcial.

**`apps/web/src/pages/Perfil.tsx`**: novo botão vermelho "Apagar dados do caminhão" (classe `.botao-perigo`, nova em `index.css`) abaixo de "Salvar perfil". Ao clicar, abre modal de confirmação (reaproveita `.modal-overlay`/`.modal-card`, mesmo padrão do popup de contato em `Resultado.tsx`) explicando o que é limpo e que análises salvas não são afetadas (o `custos_snapshot` de cada análise é uma cópia própria, independente do perfil atual). Confirmando, `apagarDados()` chama `salvarPerfil(userId, PERFIL_DEFAULT, perfilId)` — mesma linha do banco (mesmo `id`), sem apagar de fato a linha — e reseta o form local e as flags de "editado manualmente" (marca/modelo/valor/depreciação/eixos), pra o form voltar a se comportar como um cadastro novo (autofill de novo ativo).

**Validação**: `tsc --noEmit` limpo em `apps/web`.

## Atualização — 18/08 (3): preço do diesel visível na tela Analisar

Pedido do Raphael: o "Preço diesel (R$/L)" pesa muito no custo total, mas estava escondido dentro do accordion "Ajustar parâmetros do caminhão e custos" — fácil de esquecer de atualizar antes de calcular (o diesel muda de preço por região/posto, viagem a viagem).

**`apps/web/src/pages/Analisar.tsx`**: campo "Preço diesel (R$/L)" saiu de dentro do accordion e passou a ficar direto no fluxo principal, lado a lado com "Dias de viagem" (mesmo layout `.linha-campos` já usado em Distância/Pedágio). Adicionei um aviso logo abaixo lembrando de conferir o preço antes de calcular. "Consumo diesel (km/L)" continua no accordion — isso é característica do caminhão (muda pouco), diferente do preço por litro (muda toda hora).

**Validação**: `tsc --noEmit` limpo em `apps/web`.

## Atualização — 18/08 (4): campo "Relevância" em Buscar Frete

Pedido do Raphael: campo "Relevância" ao lado de "Só o meu veículo", com opções pro caminhoneiro escolher a ordem da lista — exemplos dados: "Distância da minha cidade", "Valor do Frete".

**Decisão de escopo**: implementei como um select de critério único ("ordenar por"), não uma lista de prioridades arrastável — os dois exemplos dados são naturalmente excludentes como critério de ordenação (a lista é ordenada por um dos dois de cada vez), e é consistente com os outros filtros da tela (Raio, Destino), que já são selects simples.

**`apps/web/src/pages/BuscarFrete.tsx`**: novo select "Relevância" com "Distância da minha cidade" (padrão — mesmo comportamento de sempre) e "Valor do frete" (maior primeiro). Nova `valorComparavelCentavos()`: fretes fixos usam o valor direto; fretes "por tonelada" usam o total estimado (taxa × carga máxima do Perfil) em vez da taxa crua, pra não comparar grandezas diferentes; sem carga máxima cadastrada (ou frete "a combinar"), o frete fica sem valor comparável e vai pro fim da lista nessa ordenação. Filtro por raio (quando a cidade está preenchida) continua se aplicando igual, independente da relevância escolhida — só muda a ordem de exibição.

**Validação**: `tsc --noEmit` limpo em `apps/web`.

## Atualização — 18/08 (5): início da Fase 2 (calc-wpp) — esqueleto do wa-webhook

Perguntei ao Raphael se dava pra seguir com o calc-wpp mesmo com a chave da Meta (WhatsApp Cloud API) ainda sendo providenciada. Sim: só o envio de mensagem de verdade e a submissão dos templates HSM dependem dela — o resto (webhook recebendo e processando, gravação no banco, auditoria) não. Ele escolheu começar pelo esqueleto do `wa-webhook` + os intents `VINCULAR`/`DESVINCULAR` do módulo identidade (que o roadmap já apontava como primeira peça da Fase 2, por serem pré-requisito dos demais intents -wpp).

Segui à risca o contrato já escrito em `Docs/PRD-tecnico-identidade.html` (seção "wa-webhook" e "Vínculo app<->WhatsApp") — não improvisei o formato.

**Decisão-chave pra não travar na chave**: `enviarMensagemWhatsapp()` é uma função separada — se `WA_ACCESS_TOKEN`/`WA_PHONE_NUMBER_ID` não estiverem configurados (que é o caso agora), ela só loga em vez de chamar a API da Meta, sem lançar erro. Todo o resto do fluxo (validar assinatura, casar o intent, gravar em `motoristas`/`wa_vinculo`/`identidade_audit`/`consentimento`) roda normal e sem depender disso. Quando a chave chegar, é só configurar as duas variáveis de ambiente — nenhum código muda.

**Nova tabela `wa_mensagem_recebida`** (migration `20260818121738_wa_mensagem_recebida_schema.sql`): idempotência genérica por `wa_message_id` (PK) — a Meta reentrega webhook em timeout/erro; sem isso, uma reentrega reprocessaria o mesmo intent. Dedup acontece uma vez só, no topo do webhook, antes de rotear pro intent — pensado pra já servir os intents do calc-wpp quando entrarem, não só VINCULAR/DESVINCULAR.

**Novo `supabase/functions/wa-webhook/index.ts`**:
- `GET` — handshake de verificação da Meta (`hub.mode`/`hub.verify_token`/`hub.challenge`), comparado contra `WA_WEBHOOK_VERIFY_TOKEN`.
- `POST` — lê o corpo cru (a assinatura é sobre os bytes exatos, por isso `.text()` antes de `JSON.parse`), valida `X-Hub-Signature-256` (HMAC-SHA256 com `WA_APP_SECRET`) — sem assinatura válida, 403 sem tocar em nada (fail-closed: sem `WA_APP_SECRET` configurado, todo POST é rejeitado, então o endpoint só aceita tráfego de verdade depois que o segredo real da Meta entrar).
- `extrairMensagens()` — parser puro do formato `entry[].changes[].value.messages[]` da Meta; ignora webhooks de só-status (sem mensagem) e mensagens não-texto.
- `detectarIntent()` — regex `VINCULAR <código de 6 dígitos>` / `DESVINCULAR`, case-insensitive, sem custo de LLM (o NLU do calc-wpp entra depois, só pro que não bater nenhum desses).
- `tratarVincular()` — casa o código (SHA-256, sem pepper — código de curta duração já protegido por TTL de 10min + limite de 5 tentativas) com um `wa_vinculo` pendente; só confirma (`telefone_verificado=true`, `canal_wa_ativo=true`, grava consentimento `canal_whatsapp`, audita `wa_vinculado`) se o número que mandou a mensagem for o mesmo dono do código. Número divergente incrementa tentativas (revoga na 5ª); código expirado ou inexistente orienta reiniciar pelo app.
- `tratarDesvincular()` — zera `telefone_verificado`/`canal_wa_ativo` do motorista dono do número, audita `wa_desvinculado`.

**Validação**: sem `deno` disponível neste ambiente, testei as funções puras (`assinaturaValida`, `extrairMensagens`, `detectarIntent` — 20 asserções) via Node/tsx, com o import da Meta trocado por um stub local numa cópia temporária do arquivo (apagada depois) — mesmo approach do smoke test da fila offline (13/08). Todas passaram. `tratarVincular`/`tratarDesvincular` (que tocam o banco) foram revisadas linha a linha contra o PRD, mas não testadas automaticamente — não tenho como rodar `deno test` nem simular o Postgres aqui. `tsc --noEmit` limpo em `apps/web` (não afeta o Edge Function, que é Deno, mas confirma que nada mais quebrou). Suíte do `@rode/calc` continua 32/32.

**Deploy**: função publicada no Supabase (`wa-webhook`, `verify_jwt: false` — importante: precisa ser `false` porque a Meta não manda JWT do Supabase, autentica só por HMAC; as outras functions do projeto têm `verify_jwt: true` porque são chamadas pelo próprio app logado). Não consegui testar ao vivo com `curl` daqui (rede do sandbox não alcança `*.supabase.co`) — só a validação local das funções puras.

**Pendente de configuração** (Supabase → Edge Functions → Secrets), nenhuma delas bloqueada pela chave da Meta ainda faltando:
- `WA_WEBHOOK_VERIFY_TOKEN` — qualquer string escolhida por nós, usada nos dois lados (aqui e no painel da Meta).
- `WA_APP_SECRET` — esse sim precisa vir da Meta (segredo do App) — sem ele, o endpoint rejeita tudo com 403 (comportamento correto até lá).
- `WA_ACCESS_TOKEN` / `WA_PHONE_NUMBER_ID` — a "chave" propriamente dita, pendente. Sem elas, `enviarMensagemWhatsapp()` só loga.

**Fora do escopo desta rodada, decisão explícita**: Edge Function `wa-vincular` (gera o código de 6 dígitos + deep link `wa.me/...`) ainda não existe — sem ela, o fluxo só é testável inserindo um `wa_vinculo` de fixture direto no banco (mesma estratégia de teste que o próprio PRD descreve: "fixtures de webhook assinadas"). NLU/extração de frete do calc-wpp também não entrou — todo texto que não for VINCULAR/DESVINCULAR cai num TODO que só loga, sem responder nada ainda.

Commitado e publicado (`c4deaec`).

## Onde paramos — 18/08, fim de sessão

**Tudo commitado E publicado** — `git fetch` + `origin/main...HEAD` deu 0 à frente / 0 atrás no commit `c4deaec`. `tsc --noEmit` limpo (`apps/web`), 32/32 testes do `@rode/calc` passando.

**O que foi feito hoje, em ordem** (detalhes de cada um nas seções "Atualização — 18/08 (N)" acima):

1. **Fechei a Fase 1 (offline-first)** — fila de gravação via IndexedDB (`lib/filaOffline.ts`) plugada em `salvarAnalise`, `alternarRealizado`, `salvarPerfil`, `salvarMotorista`, `salvarCidadeAtual`; cache de leitura do perfil do caminhão (`lib/cacheLocal.ts`) pra calculadora não cair em custos genéricos sem sinal; indicador de pendência + reenvio automático na Garagem.
2. **Paginação "Ver mais"** nas Últimas análises da Garagem (carrega 5 por vez).
3. **Filtro "Só realizados"** nas Últimas análises — corrigido no mesmo dia pra buscar do banco (todos os realizados do mês) em vez de só filtrar o que já tava paginado na tela.
4. **Botão "Testes" (provisório)** — mural de casos de teste pros sócios (cadastro + resultado), mesmo espírito do Backlog, pra remover antes de produção.
5. **Botão "Apagar dados do caminhão"** no Perfil, com confirmação — reseta pra `PERFIL_DEFAULT`, pra quando o motorista trocar de caminhão.
6. **Preço do diesel** saiu do accordion "Ajustar parâmetros" e ficou visível direto na tela Analisar, ao lado de "Dias de viagem".
7. **Campo "Relevância"** em Buscar Frete — ordenar por distância ou por valor do frete.
8. **Comecei a Fase 2 (calc-wpp)**: esqueleto do `wa-webhook` publicado no Supabase (handshake da Meta, verificação de assinatura HMAC, idempotência, intents `VINCULAR`/`DESVINCULAR` do módulo identidade) — funciona sem a chave da Meta ainda não provisionada; só o envio de confirmação por WhatsApp fica em modo log até ela chegar.

**Incidente do meio do dia, resolvido**: uma migration minha (`testes_provisorio`) tinha nome de arquivo local diferente da versão que o Supabase realmente registrou — isso derrubou uma checagem do GitHub (ficou parecendo "problema no GitHub") e, coincidentemente, a Vercel também não pegou aquele push (webhook perdido, sem relação direta). Corrigido renomeando o arquivo pra bater com a versão real; documentado em detalhe na seção "Atualização — 18/08 (correção)" acima, pra não repetir o mesmo erro (sempre conferir a versão exata que o `apply_migration` do Supabase atribuiu antes de nomear o arquivo local).

## Atualização — 18/08 (6): wa-vincular + botão "Vincular WhatsApp" no app

Raphael avisou que já tem uma chave provisória da Meta (a ser configurada no Supabase depois) e pediu pra seguir. Completei o outro lado do fluxo de vínculo: até aqui só o `wa-webhook` sabia CONFIRMAR um `VINCULAR <código>`; faltava quem GERA esse código — sem isso, só dava pra testar inserindo fixture direto no banco.

**Novo `supabase/functions/wa-vincular/index.ts`** (`verify_jwt: true` — diferente do wa-webhook, este é chamado pelo próprio app logado, não pela Meta): motorista autenticado pede um vínculo, a function gera um código de 6 dígitos, grava `wa_vinculo` pendente (TTL 10min, revogando qualquer pendente anterior — só o último código vale), aplica rate-limit próprio (5 pedidos/hora por motorista) e devolve `{wa_link, expira_em}`. `motorista_id` vem sempre do claim `sub` do JWT (decodificado direto, sem round-trip ao GoTrue — a plataforma já validou assinatura/expiração antes de invocar a function) — nunca do body, pra ninguém gerar código pra conta alheia. Precisa de `NUMERO_OFICIAL_WA` configurado (E.164 sem "+") pra montar o link — sem isso, responde 503 (config pendente, não erro).

**`apps/web/src/lib/motorista.ts`**: nova `iniciarVinculoWhatsapp()`, chama a function e trata os erros (429 limite, 503 não configurado, 401 sessão expirada) no mesmo padrão já usado em `Entrada.tsx`/`otp-solicitar` (status HTTP em `error.context`).

**`apps/web/src/pages/Motorista.tsx`** ("Meu Perfil"): quando `canal_wa_ativo` é falso, aparece "Vincular WhatsApp" — ao clicar, gera o código e troca pelo botão "Abrir WhatsApp e enviar código" (link `wa.me` com a mensagem pronta) + aviso do horário de expiração + opção de gerar outro código.

**Validação**: testei as funções puras do wa-vincular (extração do `sub` do JWT, geração do código de 6 dígitos, hash) via Node/tsx — 10 asserções, todas passando, mesma estratégia do wa-webhook (stub do import da Meta, apagado depois). `tsc --noEmit` limpo em `apps/web`. Não testei o fluxo ponta a ponta de verdade (precisa da Meta configurada) — isso fica pra quando `WA_APP_SECRET`/`WA_WEBHOOK_VERIFY_TOKEN`/`NUMERO_OFICIAL_WA`/`WA_ACCESS_TOKEN`/`WA_PHONE_NUMBER_ID` forem configurados no Supabase (combinado que o Raphael faz isso "no final").

**Fora do escopo**: "Desvincular" pelo app (o PRD prevê os dois caminhos — pelo WhatsApp, já funciona via `wa-webhook`; pelo app, precisaria de uma function própria já que `canal_wa_ativo` só muda via service_role) não entrou nesta rodada.

Ainda não commitado/pushado.

### Para retomar amanhã (atualizado depois do wa-vincular)

Nada quebrado, nada pendente de decisão — é só continuar. Pontas soltas, se quiser puxar por aí:
- **calc-wpp**: os dois lados do vínculo WhatsApp estão prontos (`wa-vincular` gera o código, `wa-webhook` confirma) mas não testados ponta a ponta de verdade — falta configurar no Supabase `WA_WEBHOOK_VERIFY_TOKEN`, `WA_APP_SECRET`, `NUMERO_OFICIAL_WA`, `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID` (a chave provisória do Raphael) e testar o fluxo real: abrir "Meu Perfil" → "Vincular WhatsApp" → mandar a mensagem → conferir se o badge vira "vinculado". Depois disso, falta "Desvincular" pelo app (hoje só funciona mandando DESVINCULAR pelo WhatsApp) e o NLU/extração de frete por texto do calc-wpp em si.
- **Templates HSM da Meta**: ainda não rascunhados — vale começar o texto mesmo sem a aprovação, pra não perder tempo depois.
- **Admin/instrumentação**: `analytics_event`/`track()` continua em zero, dívida que só cresce.
- **Fase 3 (portal + find-app)**: não iniciada.
- **Acesso da Vercel**: a integração do Cowork só enxerga o projeto `aferimais`, não o `rode-com-lucro-mvp` — tentamos reconectar hoje e não resolveu; sem isso não dá pra checar deploy/build direto por aqui, só pelo painel manualmente.

## Atualização — 25/08: vínculo WhatsApp ao vivo + calc-wpp (NLU via IA)

Raphael configurou os 5 secrets da Meta no Supabase (`WA_WEBHOOK_VERIFY_TOKEN`, `WA_APP_SECRET`, `NUMERO_OFICIAL_WA`, `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`). Testamos o fluxo real de ponta a ponta pela primeira vez hoje.

**Dois bugs reais encontrados e corrigidos no caminho:**
1. **Handshake de verificação da Meta voltava 403** mesmo com o `WA_WEBHOOK_VERIFY_TOKEN` certo configurado — causa: a function já estava com uma instância "quente" rodando com o valor antigo (ou vazio) da env var em memória; secrets novos só entram numa instância nova. Corrigido republicando a function (mesmo código, forçando um cold start) — confirmado via `query_logs`: `GET 200` na tentativa seguinte da Meta.
2. **`WA_APP_SECRET` divergente** — todo `POST` (mensagem real chegando) caía com 403 "assinatura inválida", mesmo depois do handshake ok. O valor salvo no Supabase não batia com a "Chave secreta do aplicativo" real da Meta (Configurações do app → Básico → precisa clicar "Mostrar"). Raphael reconferiu e resalvou o valor certo — próxima mensagem (`VINCULAR 959377`) processou com sucesso: `wa_vinculo` marcado `verificado` às 20:27, confirmado direto no banco.

**Bug secundário, não bloqueante**: o link `wa.me` gerado pelo app dava 404 no navegador do computador — o `NUMERO_OFICIAL_WA` tinha sido salvo com espaços (`"1 555 677 1876"`) em vez de só dígitos (`"15556771876"`). Não afeta o WhatsApp do celular (resolve mesmo com espaço), só o link web. Raphael corrigiu o secret.

**calc-wpp — NLU de texto livre (pedido explícito do Raphael pra começar a codificar agora, decisão de arquitetura via pergunta direta: texto livre com IA, não comando estruturado nem fluxo guiado passo a passo).**

Até aqui, qualquer mensagem que não fosse `VINCULAR`/`DESVINCULAR` só caía num TODO que logava e não respondia nada. Isso foi fechado:

- **`supabase/functions/wa-webhook/calc.ts`** (novo): cópia isomórfica fiel do motor `@rode/calc` (`calcularFrete`, `calcularPisoANTT`, `tipoCargaPorCarroceria`, `fmtBRL`/`fmtPct`, `diasPorFaixaKm`) pro runtime Deno — o pacote workspace-local não é importável direto numa Edge Function (não está publicado nem servido via esm.sh). Validei que a cópia bate 100% com o pacote original rodando a mesma entrada nos dois e comparando a saída (`custoTotal`, `lucro`, `pisoANTT`, `veredicto` idênticos).
- **`supabase/functions/wa-webhook/extracao.ts`** (novo): `extrairFreteDeTexto()` chama a API da Anthropic (Claude Haiku 4.5) com "tool use" (function calling) — a IA só preenche um JSON validado (`origem`, `destino`, `valor_frete_reais`, `volta_vazia`, `e_pedido_de_frete`, confiança 0-1 por campo), nunca decide o veredito nem executa nada; o motor de cálculo continua sendo a única fonte de verdade do resultado. Sem `ANTHROPIC_API_KEY` configurada, retorna `null` (mesmo padrão "no-op logado" do `enviarMensagemWhatsapp()` sem chave da Meta) — não bloqueia nada, só fica pendente.
- **`supabase/functions/wa-webhook/index.ts`**: nova `tratarPedidoDeCalculo()` no lugar do TODO — extrai via IA; se não for pedido de frete (saudação, outro assunto), só loga como antes; se for, exige motorista vinculado (`canal_wa_ativo`), depois origem+destino+valor completos, depois confiança mínima (0.6) em cada campo — qualquer coisa faltando ou incerta responde orientando o motorista em vez de chutar um cálculo. Passando em tudo isso: busca o `caminhao_perfil` do motorista (cai no mesmo `PERFIL_DEFAULT` do app se não tiver cadastro), chama a Edge Function `route-cost` (function-to-function, service role key como Bearer) pra distância/pedágio, roda `calcularFrete()` e responde por WhatsApp com o resultado (custo, lucro, margem, piso ANTT, veredito).
- **Nova tabela `wa_freight_query`** (migration `20260825203627_wa_freight_query_schema.sql`): audita toda tentativa de cálculo — texto recebido, JSON extraído pela IA, status (`calculado`/`confirmacao_pendente`/`dado_faltando`/`erro_extracao`/`nao_vinculado`), resultado. RLS habilitado, sem policy pra `authenticated` (só service_role), mesmo padrão de `wa_mensagem_recebida`.

**Custo da IA**: Claude Haiku 4.5 (~$1/milhão tokens entrada, $5/milhão saída) — cada extração fica bem abaixo de 1 centavo de real por pedido, mensagem curta + JSON pequeno de resposta.

**Validação**: `calc.ts` comparado lado a lado com `packages/rode-calc/src` (mesma entrada, mesma saída, via `tsx`). `index.ts`/`extracao.ts`/`calc.ts` typecheckados juntos com `tsc --strict` usando um shim local do `Deno` global e um stub do import do supabase-js (sem `deno` instalado neste ambiente, mesma limitação de sempre) — limpo, sem erros. Não testei o fluxo de IA ao vivo (precisa da `ANTHROPIC_API_KEY`, ainda não configurada) nem `route-cost`/banco de verdade (sem acesso de rede a `*.supabase.co` daqui) — revisão manual linha a linha contra o PRD calc-wpp e contra `Analisar.tsx`/`lib/frete.ts` (mesma fórmula de ajuste de pedágio carro→caminhão, mesmo `PERFIL_DEFAULT`, mesma regra de dias por faixa de km).

**Pendente**: configurar `ANTHROPIC_API_KEY` no Supabase (Edge Functions → Secrets) pra ativar de fato — até lá, qualquer mensagem sem intent reconhecido continua só logando, como estava antes. Depois disso, testar o fluxo real: mandar algo como "frete de Sorocaba pra Curitiba, 8 mil reais" pro WhatsApp vinculado e conferir a resposta.

Ainda não commitado/pushado.

## Atualização — 26/08: calc-wpp ao vivo — cálculo funciona, envio da resposta bloqueado pela Meta

Raphael configurou a `ANTHROPIC_API_KEY` (Anthropic Console) e testou o fluxo real pela primeira vez. O cálculo funcionou perfeitamente desde a primeira tentativa (extração via IA, `route-cost`, `calcularFrete`, tudo certo — confirmado por linhas em `wa_freight_query` com `status: "calculado"` e `resultado_snapshot` completo), mas nenhuma resposta chegava no WhatsApp do motorista. Dois problemas em sequência:

**1. `WA_PHONE_NUMBER_ID` estava com o valor errado.** Todo envio (inclusive a confirmação de VINCULAR) falhava com erro da Graph API: `"Object with ID '3395526617320804' does not exist..."` (code 100, subcode 33). O valor configurado era o **WhatsApp Business Account ID (WABA ID)**, não o **Phone Number ID** — a Meta mostra os dois na mesma tela (API Setup) e são fáceis de confundir. Raphael corrigiu pro valor certo (`1278342878694005`) e reconferiu o `WA_ACCESS_TOKEN` (chegou a aparecer um 401 "cannot parse access token" no Postman por espaço extra colado no valor). Republiquei a function pra forçar um cold start pegar os secrets novos.

  *Nota de segurança*: o Raphael colou o `WA_ACCESS_TOKEN` em texto puro no chat duas vezes durante esse diagnóstico. Já usado, mas fica registrado aqui: **recomendo regenerar esse token na Meta quando os testes terminarem**, já que ficou exposto no histórico da conversa.

  *Incidente à parte, já corrigido na hora*: numa tentativa de forçar o redeploy pra pegar os secrets novos, publiquei sem querer uma versão da function com conteúdo placeholder (sem handler de verdade) — percebi na hora, conferi que os arquivos originais no disco estavam intactos e republiquei o código certo em seguida. Sem impacto real, mas registrando pela transparência.

**2. Depois de corrigir o Phone Number ID, o envio parou de dar erro — mas a mensagem continuava não chegando no celular, sem nenhum erro logado no momento do envio.** A causa só apareceu depois: o webhook não tinha visibilidade sobre o *status de entrega* (delivered/failed), só sobre o resultado imediato da chamada HTTP à Graph API (que retornava sucesso). Adicionei `extrairStatuses()` em `wa-webhook/index.ts` — os status de entrega chegam pelo mesmo campo `messages` do webhook já assinado (dentro de `value.statuses[]`, não existe um campo separado tipo "message_status" pra assinar à parte, como cheguei a supor errado antes de conferir com o Raphael). Republicando com esse log, o próximo teste revelou o erro real:

  **Erro 130497 — "Business account is restricted from messaging users in this country."** A Meta está bloqueando o envio de mensagens pro Brasil nessa conta, independente de ser número de teste ou não (não tem relação com o limite de 5 números do modo desenvolvimento, que já estava resolvido). Causa mais comum: perfil incompleto no Business Manager (endereço/telefone/site) ou necessidade de verificação da empresa. Raphael já completou o perfil do Business Manager, mas o erro **persistiu num novo teste (14:04h)** — a mensagem que a Meta mostrou avisa que a reavaliação pode levar de 1 a 2 dias. Combinado: ele vai testando de vez em quando enquanto isso não resolve sozinho.

**Estado atual**: pipeline de cálculo 100% funcional (extração IA → rota → cálculo → auditoria em `wa_freight_query`) — só a etapa final de envio da resposta por WhatsApp está bloqueada, por restrição de país da Meta, não por bug de código. `index.ts` tem uma versão nova (log de status de entrega) já publicada no Supabase (v25) mas **ainda não commitada/pushada**.

**Pendente**:
- Aguardar a Meta liberar o envio pro Brasil (1-2 dias, checando de vez em quando) e então confirmar entrega ponta a ponta de verdade.
- Se não desbloquear sozinho, iniciar verificação da empresa (Business Verification, CNPJ) no Business Manager.
- Regenerar `WA_ACCESS_TOKEN` (exposto em texto puro no chat) depois que os testes terminarem.
- Commitar/pushar o `index.ts` novo (log de status de entrega via `extrairStatuses()`).
- **Nova pista, ainda não investigada**: log das 21:04h mostra um erro diferente do 130497 — `"envio falhou 401 {Authentication Error, code 190, OAuthException}"`. Isso é token inválido/expirado (diferente de bloqueio de país) — vale conferir se o `WA_ACCESS_TOKEN` provisório expirou (tokens de teste da Meta costumam durar ~24h) antes de assumir que o problema todo é só o 130497.

## Atualização — 26/08 (2): início do painel admin — camada de instrumentação (track/analytics_event)

Raphael perguntou se dava pra avançar pro painel admin (Docs/PRD-tecnico-admin.html) enquanto o desbloqueio do WhatsApp na Meta não resolve. Sim: são frentes independentes, e não tinha mais nada a fazer no calc-wpp até a Meta responder. Alinhei que "ir pro admin" não significa construir as 11 telas do dashboard agora — o próprio PRD deixa isso pra depois ("dashboard fechado por último"); o primeiro passo real é a camada de instrumentação (`track()`/`analytics_event`), que está zerada desde a Fase 1 e é pré-requisito de tudo que o admin vai mostrar.

**Versão MVP simplificada em relação ao PRD**: sem particionamento mensal, sem `journey_definition`/rollups/pg_cron ainda — só a captura de eventos, que precisa rodar desde já pra existir histórico quando o resto for construído.

**Migration `20260826210825_analytics_event_schema.sql`**: tabela `analytics_event` (event_name, actor_id, source app|whatsapp, props jsonb, idempotency_key opcional, occurred_at/created_at) + índices por (event_name, occurred_at) e (actor_id, occurred_at). RLS habilitada, mesmo padrão de `caminhao_perfil`/`analise_frete` (`0008_calc_app_schema.sql`): usuário autenticado só insere evento em nome de si mesmo (`actor_id = auth.uid()`); sem policy de select pra `authenticated` — só service_role lê (é o painel admin, via Edge Function, que vai consumir isso depois).

**`apps/web/src/lib/track.ts`** (novo): SDK fino, `track(eventName, props)`. Diferente das gravações de negócio (`lib/frete.ts`, fila offline), analytics é fire-and-forget — nunca `await` bloqueando UI, falha em silêncio (só `console.error`) se der erro. Catálogo de eventos (`EventName`) segue a seção 11 do PRD: `signup_completed`, `truck_profile_saved`, `freight_search`, `simulation_run`, `freight_accepted`, `opportunity_engaged`. (`expense_logged` do PRD não entrou — não existe funcionalidade de lançamento de gasto avulso no app hoje, confirmei por busca no código antes de instrumentar algo que não existe.)

**Pontos instrumentados no app web** (mapeados um por um antes de editar, comparando contra o PRD que foi escrito pra um protótipo mockado com nomes de arquivo diferentes dos reais):
- `Verificacao.tsx` (`confirmar`) — `signup_completed`, só quando `auth.users.created_at` é muito recente (< 15s), pra distinguir conta nova de login de retorno (a API não devolve essa flag direto).
- `Perfil.tsx` (`salvar`) — `truck_profile_saved`, com `primeiro_cadastro` calculado a partir de `perfilId`. Não instrumentei `apagarDados()` (mesma função `salvarPerfil` por baixo) pra não contar reset como cadastro novo.
- `BuscarFrete.tsx` — `freight_search` no `useEffect` que busca (dispara também na carga inicial, aceitável pro MVP); `opportunity_engaged` em `abrirAnalise()` (ação `analisar`) e nos links "Ligar"/"WhatsApp" (ação `ligar`/`whatsapp`).
- `Analisar.tsx` (`calcularEIr`) — `simulation_run` logo após `calcularFrete()`, antes do `navigate` — captura toda simulação calculada, mesmo as que o motorista não salva.
- `Garagem.tsx` (`alternarRealizadoEAtualizarLucro`) — `freight_accepted`, só quando o toggle está *marcando* como realizado (não ao desmarcar).

**Canal WhatsApp**: `wa-webhook/index.ts` ganhou `registrarEventoAnalytics()`, chamado só em `simulation_run` (dentro de `tratarPedidoDeCalculo`, no mesmo ponto onde grava `wa_freight_query`), com `source: "whatsapp"`. Decisão explícita: **não** disparei `signup_completed` no VINCULAR — o motorista já existe (foi criado no cadastro via app), então contar o vínculo como "cadastro" infringiria o dado do funil, duplicando alguém que já apareceu pelo app.

**Erro meu, corrigido na hora**: ao montar o payload do primeiro deploy do `wa-webhook` instrumentado, digitei errado o catch de `extracao.ts` (troquei `console.error("...", e)` por uma referência a `resp.text()` fora de escopo — `resp` não existe se o próprio `fetch` lançar exceção, o que quebraria esse catch em produção). O arquivo local sempre esteve correto; o erro foi só no conteúdo que mandei pro deploy (v27). Percebi comparando com o arquivo em disco, corrigi e republiquei (v28) com o conteúdo certo.

**Validação**: `npx tsc --noEmit` limpo em `apps/web`. `wa-webhook` (`index.ts`+`calc.ts`+`extracao.ts`) validado com o mesmo shim local de sempre (`Deno` global + stub do supabase-js) rodando `tsc --strict` — limpo, sem erros, repetido depois da correção do v28.

**Estado atual**: instrumentação publicada e ativa (Supabase, `wa-webhook` v28) e presente localmente no app web — ainda não commitada/pushada. Sem tráfego real ainda pra confirmar eventos chegando em `analytics_event` (mas a mesma lógica de RLS/insert já é usada em outras tabelas do projeto, baixo risco).

**Pendente**: telas do painel admin em si (as 11 views, RLS por papel, rollups/pg_cron) ficam pra uma etapa seguinte — combinado que instrumentação vem primeiro pra já existir dado quando o dashboard for construído.

## Atualização — 27/08: causa raiz do bloqueio 130497 encontrada — número americano vs. destinatário brasileiro

O bloqueio de país continuou depois da verificação da empresa (Business Verification concluída em 26/08) — o que descartou a hipótese de "falta verificar" e obrigou a investigar mais fundo.

**Causa raiz confirmada** (via fórum oficial de desenvolvedores da Meta, resposta de um BSP parceiro — 360dialog): a Meta tem uma restrição deliberada de mensageria cross-country — números de WhatsApp Business registrados nos **EUA (+1)** são bloqueados de enviar mensagem pra usuários no **Brasil (+55)**, a menos que a conta atinja um volume de ~100 mil conversas iniciadas pela empresa em 24h (inviável nessa fase do projeto). O `NUMERO_OFICIAL_WA`/`WA_PHONE_NUMBER_ID` configurado era um número americano (`+15556771876`) tentando mandar mensagem pro celular brasileiro do Raphael — exatamente o cenário do bug relatado por outros desenvolvedores no mesmo fórum. Isso explica por que nem a correção do `WA_PHONE_NUMBER_ID`/WABA-ID nem a verificação da empresa resolveram: nenhum dos dois tinha relação com a causa real.

**Solução**: registrar um número de telefone **brasileiro** como número oficial do WhatsApp Business, em vez do americano. Raphael optou por um chip novo dedicado à empresa (nunca teve WhatsApp pessoal ativo) em vez do celular pessoal, pra não perder o WhatsApp normal desse número. Passo a passo dado: WhatsApp Manager → Números de telefone → Adicionar número → verificação por SMS/ligação → novo Phone Number ID gerado → atualizar `WA_PHONE_NUMBER_ID`/`NUMERO_OFICIAL_WA` no Supabase.

**Confirmado funcionando**: log das 19:57 mostra `status=sent` seguido de `status=delivered` pro número de teste (5511997510976) — primeira entrega bem-sucedida desde o início dessa investigação. Nenhum erro 130497 depois da troca de número.

**Estado do calc-wpp**: pipeline completo (extração IA → rota → cálculo → resposta por WhatsApp) agora ponta a ponta funcional, incluindo a entrega. Falta só confirmar um teste com pedido de cálculo de verdade (ex.: "frete de Sorocaba pra Curitiba, 8 mil reais") pra fechar a validação — o último teste enviado ("Tem frete para mim?") não é um pedido de frete, então corretamente não gerou resposta (caiu em "sem intent reconhecido", comportamento esperado).

**Pendente**: regenerar `WA_ACCESS_TOKEN` antigo (foi exposto em texto puro no chat, já trocado pelo token de 60 dias do System User — mas o valor antigo nunca foi formalmente revogado na Meta). Investigar se o erro 401 "Authentication Error" (code 190) do dia 26/08 era só o token temporário vencendo, ou algo mais — não deve mais acontecer com o token de System User de 60 dias, mas vale monitorar.

## Atualização — 28/08: cidade base do motorista (pré-requisito pra busca de frete via WhatsApp)

Raphael pediu pra planejarmos "buscar frete pelo WhatsApp" (lista de até 3 fretes compatíveis com o caminhão/perfil, clicáveis, mais um botão de abrir o app — sempre incentivando ir pro app sem obrigar). Antes de codar, levantei considerações (duplicação de lógica de filtro/distância no wa-webhook, mensagem de lista vs botão de link são tipos diferentes no WhatsApp, precisa reconhecer uma 3ª intenção via IA além de calcular/nada, o que fazer quando falta perfil/cidade). Duas decisões confirmadas com o Raphael: (1) uma mensagem só, lista com 4º item "Abrir app" (mais simples, ainda que o toque nesse item não abra link direto); (2) se faltar perfil do caminhão ou cidade base, só orienta a cadastrar — não tenta buscar sem filtro.

No meio dessa conversa, surgiu uma lacuna: `cidade_atual` (usada hoje pro raio de busca em Buscar Frete) só existe depois que o motorista usa aquela tela pelo menos uma vez — não tem de onde vir uma localização pra quem nunca abriu Buscar Frete, o que enfraquecia o gate "cadastre no app" da busca por WhatsApp. Raphael pediu pra resolver isso primeiro: trocar o campo "UF base" (só sigla, digitado à mão) do cadastro do motorista por uma "cidade base" completa (nome + UF + lat/lng), usando o mesmo autocomplete de cidade que já existe em Buscar Frete — assim a localização já vem preenchida desde o cadastro inicial, sem depender de nenhuma outra tela.

**Migration `20260828123654_motoristas_cidade_base.sql`**: `motoristas` ganha `cidade_base text`, `cidade_base_lat numeric`, `cidade_base_lng numeric` — mesmo padrão de nome já usado por `cidade_atual`/`uf_atual`/etc. (`20260811160200_motoristas_cidade_atual.sql`). `uf_base` (já existente, `char(2)`) continua sendo gravada junto, pra não quebrar quem já lia só ela (ex.: `Garagem.tsx`).

**`apps/web/src/lib/motorista.ts`**: `Motorista`/`FormMotorista` ganham os 3 campos novos; `motoristaParaForm`, `carregarMotorista` (select) e o executor `motoristas_editar` (update) atualizados em conjunto.

**`apps/web/src/pages/Motorista.tsx`**: campo "UF base" (input de texto livre, 2 letras) virou "Cidade base" — mesmo autocomplete debounced de `BuscarFrete.tsx` (`buscarMunicipios` de `lib/municipios.ts`), reaproveitando as classes CSS `sugestoes-box`/`sugestao-item` já existentes. Cadastro antigo (só com `uf_base`, sem cidade) mostra a UF no campo mas não marca como "selecionado" — precisa escolher uma cidade da lista pra completar com lat/lng.

**`apps/web/src/pages/Garagem.tsx`**: exibição da base atualizada de `Base: {uf_base}` pra `Base: {cidade_base} - {uf_base}` quando a cidade estiver cadastrada (fallback pro comportamento antigo se só tiver UF).

**Validação**: `npx tsc --noEmit` limpo em `apps/web`.

**Pendente**: a busca de frete via WhatsApp em si (a feature que motivou essa mudança) ainda não foi codificada — combinado que primeiro fechamos a cidade base, agora a base pra localização (preferindo `cidade_atual` se existir — mais recente/precisa — com fallback pra `cidade_base` quando não) fica pronta pra ser usada por ela. Ainda não commitado/pushado.

## Atualização — 28/08 (2): busca de frete via WhatsApp (busca-wpp) — feature completa, publicada (v33)

Com a cidade base pronta, implementei a feature em si: motorista manda "BUSCAR" (ou "FRETES", ou linguagem natural tipo "tem frete pra SP?") e recebe uma lista de até 3 fretes compatíveis com o caminhão dele, clicáveis, mais um 4º item "Abrir o app" — igual combinado nas duas decisões da conversa anterior (mensagem única com lista; sem cadastro completo, só orienta e não busca nada degradado).

**`supabase/functions/wa-webhook/extracao.ts`**: `ExtracaoFrete` ganhou `ePedidoDeBusca: boolean`, mutuamente exclusivo com `ePedidoDeFrete` — mesmo campo do tool schema/system prompt do Claude Haiku já usado pra classificar pedidos de cálculo, sem custo de IA extra (mesma chamada). Cobre a linguagem natural que o atalho por regex não pega (ex.: "tem frete pra Curitiba?").

**`supabase/functions/wa-webhook/index.ts`**:
- `detectarIntent()` ganhou o atalho `RE_BUSCAR` (/^(buscar|buscar frete|fretes?)$/i) — zero custo de IA pros gatilhos mais comuns, cai no NLU só pra frases mais soltas.
- `tratarBuscaDeFrete()`: busca o motorista (precisa `canal_wa_ativo`), o `tipo_veiculo` do `caminhao_perfil`, e a localização (`cidade_atual_lat/lng` com fallback pra `cidade_base_lat/lng`). Se faltar tipo de veículo OU localização, manda mensagem explicando a vantagem de cadastrar no app (fretes já filtrados pro caminhão específico, a partir da cidade base, no raio de preferência) e **não busca nada** — sem fallback degradado, decisão já confirmada antes. Com os dois presentes, busca `fretes_publicados` (status=aberto), filtra por `tipos_veiculo_aceitos` (compatível se a lista aceitar o tipo do motorista ou estiver vazia), calcula distância até a origem de cada frete com uma cópia isomórfica de `distanciaKm` (mesma fórmula de haversine de `apps/web/src/lib/municipios.ts` — Edge Function não importa do app), ordena por distância e pega os 3 mais próximos.
- `enviarListaFretes()`: novo tipo de envio (`enviarMensagemWhatsapp` só mandava texto puro) — mensagem `interactive`/`list` com até 4 linhas (3 fretes + "Abrir o app"), respeitando os limites de tamanho da Cloud API (title ≤24 caracteres, description ≤72) via `truncar()`.
- `extrairInteracoesLista()`: novo parser pro payload de resposta de lista (`type: "interactive"`, `interactive.type: "list_reply"`) — extrai o `id` da linha clicada (UUID do frete, ou `"abrir_app"`).
- `tratarRespostaLista()`: trata o clique. `"abrir_app"` responde só com o link do app. Um UUID reverifica `status='aberto'` no banco (pode ter fechado entre o envio da lista e o clique) e calcula o frete de verdade — reaproveitando a mesma cauda de `tratarPedidoDeCalculo` (route-cost, perfil de custos, `calcularFrete`, resposta formatada), agora extraída pra uma função compartilhada `calcularEResponderFrete()`. Fretes com `tipo_valor='por_tonelada'` seguem a mesma regra do app (`BuscarFrete.tsx`): só calcula o total se o motorista tiver `carga_maxima_toneladas` cadastrada no perfil — sem isso, orienta a cadastrar em vez de usar a taxa crua (que nunca pode entrar em `calcularFrete` como se fosse o valor total).
- `Deno.serve`: processa mensagens de texto (fluxo já existente) e, separadamente, as interações de lista — cada uma com sua própria checagem de idempotência em `wa_mensagem_recebida` (mesmo padrão, `intent: "buscar"` ou `"lista_resposta"`).

**Sem migration nova**: só reaproveita colunas que já existiam (`motoristas.cidade_base*`/`cidade_atual*`, `caminhao_perfil.tipo_veiculo`/`carga_maxima_toneladas`, `fretes_publicados.*`).

**URL do app**: fixei `https://rode-com-lucro-mvp.vercel.app` como constante (`URL_APP`) no `index.ts` — não existe hoje nenhuma env var pra isso, só estava documentada aqui no status-sessao.md.

**Validação**: `wa-webhook` (`index.ts`+`extracao.ts`+`calc.ts`) validado com o mesmo shim local de sempre (`Deno` global + stub encadeável do supabase-js, ajustado pra implementar `PromiseLike` de verdade — a versão anterior do shim não tipava `await` corretamente) rodando `tsc --strict` — limpo, sem erros.

**Publicado**: `wa-webhook` v33 (deploy direto via MCP do Supabase, mesmo padrão das correções do calc-wpp — `verify_jwt=false`, igual já estava). Ainda não testado com tráfego real (precisa de um motorista vinculado com `tipo_veiculo` e cidade cadastrados, e de fretes reais compatíveis em `fretes_publicados` pra aparecer algo na lista).

**Pendente**: teste ponta a ponta real (mandar "BUSCAR" pelo WhatsApp vinculado e conferir a lista/clique); código local (`extracao.ts`/`index.ts`) ainda não commitado/pushado — comandos abaixo.

## Atualização — 02/09: dois bugs encontrados no primeiro teste real da busca de frete — corrigidos (v34)

Raphael testou de verdade: os 3 fretes chegaram, mas de uma praça errada; ao clicar num frete, veio corretamente um link pro app (esse frete era "a combinar" ou "por tonelada sem carga máxima" — casos que orientam a abrir o app em vez de calcular), mas o link abriu na Garagem em vez da tela certa.

**Causa 1 — praça errada**: `tratarBuscaDeFrete` estava priorizando `cidade_atual` sobre `cidade_base`, copiando a mesma prioridade que `BuscarFrete.tsx` usa no app. Investigando os dados do motorista de teste (`SELECT` direto no Supabase), `cidade_atual` estava em "Caxias do Sul/RS" — resto de algum teste antigo na tela Buscar Frete do app — enquanto `cidade_base` (cadastro real, Meu perfil) era "Ribeirão Preto/SP". Como `cidade_atual` não tem timestamp/expiração nenhuma (confirmado: a tabela `motoristas` só tem um `updated_at` de linha inteira, não por coluna), esse valor ficou "preso" indefinidamente e nunca foi visível pro motorista que estava desatualizado. Isso também diverge do que foi pedido originalmente ("partindo da cidade que ele cadastrou como base"). **Correção**: `tratarBuscaDeFrete` agora usa só `cidade_base` — nunca `cidade_atual`. Documentado como decisão consciente: se no futuro quisermos usar "onde o motorista está agora" via WhatsApp, o jeito certo é dar uma data de validade pra esse campo (ou perguntar a localização a cada busca), não reaproveitar o campo do app como está hoje.

**Causa 2 — link caindo na Garagem**: `URL_APP` era só o domínio raiz (`https://rode-com-lucro-mvp.vercel.app`), sem rota — por isso todo link caía na tela inicial (`/`, Garagem). **Correção**: cada mensagem agora aponta pra rota certa — `/buscar-frete` (ver todos os fretes / negociar "a combinar" / clique no "Abrir o app"), `/perfil` (cadastrar carga máxima pra fretes por tonelada, ou tipo do caminhão), `/motorista` (cadastrar cidade base).

**Validação**: mesmo shim local (`Deno` global + stub encadeável do supabase-js) rodando `tsc --strict` — limpo.

**Publicado**: `wa-webhook` v34.

**Pendente**: novo teste real (BUSCAR → conferir se os fretes agora batem com Ribeirão Preto/SP → clicar num frete e conferir os links); código local ainda não commitado/pushado — comandos abaixo (substituem os da seção anterior, que ainda não tinham sido rodados).

## Atualização — 02/09 (2): 404 em /buscar-frete — faltava rewrite de SPA na Vercel

Depois da correção dos links (seção anterior), Raphael testou e o link pra `/buscar-frete` deu 404. Causa: o app é uma SPA (Vite + react-router-dom, `BrowserRouter`) e a Vercel não tinha nenhum `vercel.json`/rewrite configurado — sem isso, ela tenta servir o path literal como arquivo estático (`/buscar-frete`), não encontra, e devolve 404, em vez de servir `index.html` e deixar o react-router-dom decidir a rota no navegador. Isso afeta **qualquer** link direto pra uma rota que não seja `/` (inclusive os que acabei de adicionar: `/perfil`, `/motorista`).

Confirmado com o Raphael que o **Root Directory** do projeto na Vercel é `apps/web` (Settings → Build and Deployment) — por isso o `vercel.json` precisa ficar dentro de `apps/web/`, não na raiz do monorepo.

**`apps/web/vercel.json`** (novo arquivo):
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Publicação**: diferente do `wa-webhook` (Edge Function, publicada via MCP do Supabase), o app web é deployado pela própria Vercel a partir do push no GitHub — não tem deploy manual meu aqui. Assim que o commit for pushado, a Vercel builda e publica sozinha.

**Pendente**: confirmar que o 404 sumiu depois do push (testar abrindo `https://rode-com-lucro-mvp.vercel.app/buscar-frete` direto na URL, e o link mandado pelo WhatsApp de novo).

## Atualização — 02/09 (3): busca de frete silenciosa em texto vago — corrigida (v35)

Segundo teste real, com Emerson e David testando juntos: "Buscar frete" (gatilho por regex) funcionava pros dois, mas a frase natural "Tem frete para mim?" só respondia pro David — pro Emerson, nada voltava, sem erro nenhum aparente.

**Causa raiz** (confirmada via logs do Supabase, `function_logs`, não por suposição): a extração por IA (Claude Haiku, `extracao.ts`) classificou a mensagem do Emerson como nem pedido de cálculo (`e_pedido_de_frete=false`) nem pedido de busca (`e_pedido_de_busca=false`) — log exato: `mensagem sem intent reconhecido de 5511997510976: "Tem frete para mim?"` às 13:55:57. Ou seja, o webhook recebeu a mensagem, processou normalmente, e decidiu (errado) que não era sobre frete — então não respondeu nada. Confirmei que os cadastros dos dois motoristas (David e Emerson) estão completos e ativos no canal, então não era problema de cadastro; a causa foi mesmo uma classificação imprecisa da IA numa frase genérica.

**Correção (duas partes, ambas em `supabase/functions/wa-webhook/`)**:

1. `extracao.ts` — prompt do sistema reforçado: exemplos explícitos de pedidos genéricos de busca ("tem frete pra mim?", "tem frete disponível?", "tem carga?") e uma regra de desempate — na dúvida entre "busca genérica" e "nenhum dos dois", se a mensagem menciona a palavra frete/carga, classificar como busca (silêncio total é pior que buscar e não achar nada).
2. `index.ts` — rede de segurança adicional, sem custo extra de IA: se a IA devolver os dois campos como `false` mas o texto claramente menciona "frete"/"carga" (regex `/\bfretes?\b|\bcargas?\b/i`) sem mencionar valor em reais, trata como pedido de busca mesmo assim, em vez de ficar em silêncio.

Validado localmente (tsc --noEmit --strict, shim Deno) antes de publicar. Publicado como `wa-webhook` v35 via deploy da Edge Function.

**Não corroborado tecnicamente**: o relato de que a mesma frase funcionava pro David — não achei nenhum log de "mensagem sem intent reconhecido" pro número dele na janela investigada. Não tenho uma explicação confirmada pra essa diferença; a correção acima resolve o problema pro caso comprovado (Emerson) e deve cobrir frases genéricas parecidas de qualquer motorista.

**Pendente**: pedir pro Emerson testar de novo "Tem frete para mim?" (e variações parecidas) depois do deploy, pra confirmar na prática.

## Atualização — 02/09 (4): busca ainda trazia Ribeirão Preto pro David mesmo com cidade_base=Guarulhos — causa real encontrada (v36)

Depois da correção anterior (usar `cidade_base`), o David testou de novo já com `cidade_base` = Guarulhos/SP (confirmado no banco) e a busca voltou a trazer fretes de Ribeirão Preto — o mesmo sintoma, mas com a causa raiz anterior já eliminada. Precisei investigar mais fundo.

**Causa raiz real**: a query de `tratarBuscaDeFrete` busca os fretes "aberto" (`order by created_at desc, limit 300`) e só DEPOIS, em memória, filtra por compatibilidade de veículo e ordena por distância até o motorista. O banco tem ~800 fretes "aberto" hoje, todos importados em poucos lotes que compartilham o mesmo `created_at` (mesmo timestamp, até o microssegundo). Quando muitas linhas empatam no campo usado pro `ORDER BY`, o Postgres **não garante** uma ordem estável de desempate — ou seja, a cada chamada o `limit(300)` podia trazer um recorte diferente e arbitrário dos 800, e nada garantia que os fretes de fato mais próximos do motorista (nesse caso, opções perto de Guarulhos/São Paulo, a ~15-25km) entrassem nesse recorte. Quando não entravam, a distância era calculada só entre o que sobrou no recorte — e aí sim Ribeirão Preto (a ~285km) podia aparecer como "mais próximo" disponível, mesmo sem ser o mais próximo de verdade.

Confirmei isso rodando a mesma query em SQL direto: com o recorte de 300, um teste trouxe fretes de São Paulo/Arujá (15-25km, os de fato mais próximos) e outro trouxe Ribeirão Preto (285km) — dependendo só de como o banco decidiu desempatar o `created_at`, sem nenhuma mudança nos dados.

**Correção**: aumentei o `limit(300)` pra `limit(2000)` em `supabase/functions/wa-webhook/index.ts` (`tratarBuscaDeFrete`) — folga confortável acima do volume atual (~800), garantindo que TODOS os fretes "aberto" entrem na comparação de distância antes de escolher os 3 mais próximos. Comentário explicando o motivo deixado no código, pra não reintroduzir um limit baixo aqui no futuro sem essa ressalva.

Publicado como `wa-webhook` v36. Validado localmente (tsc --noEmit --strict) antes do deploy.

**Pendente**: pedir pro David testar "BUSCAR" de novo — agora deve trazer opções perto de Guarulhos/São Paulo, não mais Ribeirão Preto.

## Checkpoint — 02/09: início do painel admin (backend fase 1 pronto, aguardando aprovação do mockup)

Ponto exato onde paramos, salvo a pedido do Raphael pra retomar depois:

Backend está no ar: `admin_user`/`audit_log`/`app_log`, o hook de `app_role` no JWT, `journey_definition` (gate 160), e os rollups de KPI/funil/veredito já rodando de verdade e agendados via `pg_cron` (15-30 min). Os números do mockup mostrado (visual, não neste arquivo) são reais, direto do banco.

Dois pontos antes de seguir pro frontend de verdade:

Primeiro, o mockup — é essa a direção (cartões de KPI + gate de validação em destaque + funil + veredito)? Pode ajustar layout, densidade, cores antes de virar código de verdade.

Segundo, um detalhe descoberto construindo isso: o "cadastro" do funil hoje usa `truck_profile_saved` (cadastrar o caminhão), porque não existe evento de `signup_completed` disparado ainda — e por isso a jornada completa (`journey_definition` v1) também não inclui esse passo. Isso significa que o gate de 160 está calibrado só com o que já existe. No futuro dá pra adicionar um evento de cadastro de conta pra deixar o funil mais fiel.

Falta ainda: habilitar o hook `custom_access_token_hook` nas configurações de Auth do Supabase (é um passo manual no painel — Authentication → Hooks —, não dá pra fazer via SQL/MCP).

**Atualização**: `admin_user` já populada — 11997510976 (David) e 11991143035 (Emerson) cadastrados como papel `admin` (acesso total, a pedido do Raphael). Só falta o passo manual do hook acima pra esse papel aparecer de fato no JWT deles.

**Migrations aplicadas nesta fase** (ainda não commitadas/pushadas — rodar `supabase db pull` ou copiar as migrations locais antes do próximo commit, já que foram aplicadas direto via MCP): `admin_auth_e_rollups` (admin_user, audit_log, app_log, custom_access_token_hook, journey_definition, v_journey_completion, agg_validation, agg_kpi_daily, mv_funnel_daily, agg_veredito + funções refresh_*), correções de ambiguidade de coluna no funil e do nome do campo `veredicto` (não `veredito`), e o agendamento de 4 jobs `pg_cron`.

**Próximo passo ao retomar**: mostrar este texto de novo pro Raphael, esperar feedback do mockup, resolver os dois pendentes (hook no painel + admin_user), só então começar o frontend (`src/admin/AdminApp.tsx` do zero — não existe ainda neste código, diferente do que o PRD original supõe).

## Atualização — 02/09 (5): link do app em toda resposta de cálculo (v37/v38)

Pedido do Raphael: toda resposta de cálculo de frete (texto livre tipo "frete de X pra Y, R$ Z" ou clique num item da lista de busca) deveria terminar com o link do app, pra o motorista sempre ter essa porta visível — não só nas mensagens de "faltou cadastro".

Adicionada uma linha final em `calcularEResponderFrete` (função compartilhada pelos dois fluxos) com `📲 Veja o histórico completo e mais fretes no app: {URL_APP}/buscar-frete`.

**Nota de qualidade**: publiquei isso primeiro como v37, mas errei uma colagem no `extracao.ts` (bloco `catch` referenciando uma variável fora de escopo, o que quebraria silenciosamente a extração por IA sempre que a chamada à API desse erro de rede). Percebi antes de reportar como concluído, corrigi e republiquei como v38 com o `extracao.ts` correto. v37 nunca foi comunicada como pronta — v38 é a versão válida.

## Atualização — 04/09: bug real no `custom_access_token_hook` quebrando login do David e do Emerson (corrigido)

Depois de habilitado o hook (passo manual no painel, já feito pelo Raphael), David e Emerson relataram login falhando: código "expirado" mesmo digitado na hora, e numa segunda tentativa o SMS "nem foi enviado".

**Causa raiz**: erro meu na migration `admin_auth_e_rollups` — o `custom_access_token_hook` roda como o papel `supabase_auth_admin` (chamado internamente pelo GoTrue), mas eu só cobri o RLS/GRANT de `admin_user` pro papel `authenticated`. Sem permissão de leitura, o hook quebrava em **toda** emissão/renovação de token (login novo e refresh) com `permission denied for table admin_user (SQLSTATE 42501)`, e o Auth respondia HTTP 500 em `/token` e `/verify`. Confirmado nos logs (`auth_logs`): dezenas de falhas em loop apertado pras duas contas entre 12h e 14h30 (04/09) — o loop de retry provavelmente também esgotou o limite de reenvio de SMS, explicando o "código nem enviado" na segunda tentativa.

**Correção** (migration `corrigir_permissao_hook_admin_user`, aplicada via MCP):
```sql
grant usage on schema public to supabase_auth_admin;
grant select on public.admin_user to supabase_auth_admin;

create policy admin_user_select_auth_admin
  on public.admin_user for select
  to supabase_auth_admin
  using (true);
```

Validado nos logs: a partir de 14:31 (04/09) o hook passou a rodar com sucesso (`"msg":"Hook ran successfully"`) pras duas contas, sem mais erro 500. Raphael confirmou que os dois conseguiram entrar.

**Atualização**: migrations regularizadas — os 7 arquivos aplicados via MCP (`admin_auth_e_rollups`, as 3 correções, o agendamento do `pg_cron`, o seed do `admin_user` e o fix de permissão do hook) foram copiados pra `supabase/migrations/` com o nome/versão exata do banco, staged, prontos pra commit.

## Atualização — 04/09 (2): evento `signup_completed` no funil (gate de validação ainda não mudou)

Item que tinha ficado pendente no checkpoint de 02/09: "o cadastro do funil usa `truck_profile_saved` porque não existe `signup_completed` disparado ainda".

Ao investigar pra corrigir, descobri que **isso já não era mais verdade** — o evento `signup_completed` já está implementado e é emitido de verdade em `Verificacao.tsx` desde o commit `70ec7c4` (heurística: `auth.users.created_at` menos de 15s no passado = conta nova). Só nunca tinha nenhuma linha em `analytics_event` porque nenhum cadastro novo aconteceu desde que essa instrumentação foi ao ar — os únicos motoristas de teste (David, Emerson etc.) já existiam antes disso. Não faltava código, faltava uso no funil/gate.

**O que mudei** (migration `20260904150000_funil_cadastro_conta_signup.sql`):
- Funil (`mv_funnel_daily`/`refresh_mv_funnel_diario`): acrescentei o estágio `cadastro_conta` (`signup_completed`) **antes** de `cadastro` (que passa a significar só "cadastrou o caminhão", `truck_profile_saved`) — não substituí, complementei, pra não perder a granularidade entre "criou conta" e "cadastrou o caminhão". Já rodou: hoje mostra `cadastro_conta=0`, `cadastro=1` (esperado, dado o motivo acima).
- Gate de validação (`journey_definition`): criei a **v2**, incluindo `signup_completed` nos eventos obrigatórios — mas **deixei inativa de propósito**. Ativar agora reseta o que já contava pro gate na v1 (hoje: base=2, completos=1) pra 0, porque nenhum motorista existente tem `signup_completed`. Com só 6 motoristas cadastrados no total o impacto de ativar já é baixo, mas é decisão de negócio (o que conta como "jornada completa" do MVP), não só técnica.

**Pendente**: Raphael decidir se/quando ativar a v2 do `journey_definition` (`update public.journey_definition set active = false where version = 1; update public.journey_definition set active = true where version = 2;` — a unique index já garante só uma ativa por vez).

Mockup mostrado de novo (com os números atuais, já incluindo `cadastro_conta`) — aprovado ("manda bala"). Partindo pro frontend do `AdminApp.tsx`.

## Atualização — 04/09 (3): regressão séria no `custom_access_token_hook` — claims de motorista comum sumiram

Antes de codar o frontend, revisei o hook de novo (pra entender exatamente o que `app_role` carrega) e achei um bug bem mais sério que o de permissão corrigido mais cedo hoje: a migration `20260902182345_admin_auth_e_rollups` fez `create or replace function custom_access_token_hook`, e isso **substituiu por inteiro** a função original (`0004_identidade_access_token_hook.sql`), que injeta `app_role='driver'`, `driver_id`, `telefone_verificado` e `quarentena` no JWT de **todo motorista**, não só admins — `apps/web/src/pages/Garagem.tsx` lê `claims.telefone_verificado` de verdade ao montar o cache local.

Ou seja: desde 02/09, todo motorista comum (não-admin) vem recebendo um JWT sem essas 4 claims, silenciosamente — a função não quebra, só não seta mais isso. Corrigido (migration `20260904151500_corrigir_regressao_hook_claims_motorista.sql`) juntando as duas responsabilidades numa função só: claims de motorista pra todo mundo (como antes) + `app_role` de `admin_user` por cima, quando existir.

Aproveitei o mesmo lote pra corrigir 2 achados do advisor de segurança (`get_advisors`) que vieram do trabalho do painel admin: `v_journey_completion` sem `security_invoker=true` (rodava com privilégio do dono, ignorando RLS se algum dia ganhasse GRANT pra anon/authenticated — hoje não tinha, mas ficou certo) e as 4 funções `refresh_*` com EXECUTE aberto pra `anon`/`authenticated` por padrão (revogado — só o `pg_cron`, que roda como `postgres`, precisa chamar).

**Lição**: `create or replace function` em nome de função pré-existente substitui a definição inteira — preciso checar se já existe algo com aquele nome antes de reescrever, não só assumir que é novo.

## Atualização — 04/09 (4): frontend do painel admin — `AdminApp.tsx` (tela Visão geral)

Primeira versão do frontend, seguindo o mockup aprovado. Decisões:

- **Sem camada de Edge Function `/admin/*`** como o PRD original desenha — o painel lê direto via cliente Supabase (`apps/web/src/data/admin.ts`), a RLS de cada tabela (`admin_user` ativo) já resolve a autorização. Revisitar só se o painel ganhar ações de escrita (moderação) que precisem de auditoria centralizada além do `audit_log`.
- **Rota `/admin`** (`apps/web/src/admin/AdminApp.tsx`), registrada em `main.tsx`. Guarda de acesso: decodifica `app_role` do JWT (`decodeClaims`, já existente) e só carrega dados se for `admin`/`operacao`/`suporte` — sem papel válido, mostra "Acesso restrito" sem nem tentar buscar dado nenhum.
- **Layout**: gate de validação em destaque (progresso visual até 160), 4 KPIs, funil (5 estágios, incluindo o `cadastro_conta` novo) e distribuição de veredito — tudo espelhando o mockup. CSS novo em `index.css` sob prefixo `admin-`, reaproveitando cores/classes já existentes (`badge-bom`/`badge-ruim`, `barra-progresso`) — única tela do app que não é mobile-first (`max-width: 880px`), porque quem usa é o Raphael/sócios no navegador, não motorista no celular.
- Validado com `tsc --noEmit --strict` e `vite build` (ambos limpos).

**Pendente**: só a tela "Visão geral" estava pronta neste ponto — ver próxima atualização.

## Atualização — 04/09 (5): painel admin completo até onde tem dado real

Pedido do Raphael: codar todas as páginas até o fim. Como o PRD original tem 11 telas e várias dependem de módulos que não existem (embarcadores/empresas, parceiros, agregados de WhatsApp, view financeira com k-anonimato, Sentry), perguntei e ele confirmou: só as telas com dado real hoje, nada de placeholder vazio.

**Reestruturado**: `AdminApp.tsx` virou `AdminLayout.tsx` (guarda de acesso + navegação por abas) + `admin/pages/*.tsx` (uma por tela), evitando duplicar a checagem de `app_role`. Rotas aninhadas em `main.tsx` (`/admin`, `/admin/motoristas`, etc.).

**5 telas no ar**, todas só leitura (sem RPC de escrita ainda):
- **Visão geral** (já existia) — gate, KPIs, funil, veredito.
- **Motoristas** — lista paginada (30/página) com busca por nome/telefone/cidade, status, WhatsApp vinculado, vencimento de CNH, último login.
- **Fretes publicados** — lista paginada do marketplace (`fretes_publicados`, hoje só import Fretebras), busca + filtro por status.
- **Consultas via WhatsApp** — auditoria de `wa_freight_query`, linha expansível mostrando o snapshot de extração (o que a IA entendeu) e o resultado calculado — útil pra depurar resposta errada sem abrir o banco.
- **Administradores** — lista de `admin_user` cruzada com nome/telefone de `motoristas`. Gestão de papel continua manual (banco), sem self-service.
- **Auditoria** — duas abas: "Jobs de rollup" (`app_log`, tem dado real dos `pg_cron`) e "Ações administrativas" (`audit_log`, hoje sempre vazio — RPCs de moderação do PRD ainda não foram construídas, só a tabela existe; a tela já avisa isso em vez de parecer quebrada).

**RLS que faltava** (migration `20260904153000_rls_admin_leitura_motoristas_wa_admins.sql`): `motoristas`, `wa_freight_query` e `admin_user` só tinham policy de "ver a própria linha" — sem policy de leitura ampla pra quem é admin, nem o David/Emerson conseguiriam ver a lista de outros motoristas. Adicionadas as 3 policies faltantes (mesmo padrão `exists (select 1 from admin_user ...)` já usado nas tabelas de agregado).

Validado com `tsc --noEmit --strict` e `vite build` (limpos, 115 módulos).

**Pendente**: as 6 telas restantes do PRD (moderação com ação de escrita, embarcadores/empresas, parceiros, WhatsApp agregado além da auditoria, financeiro/LGPD com k-anonimato, Sentry) ficam pra quando os módulos que as alimentam existirem — decisão confirmada com o Raphael.
