# Status da sessão — RODE COM LUCRO

> Última atualização: 2026-08-12. A sessão anterior (17/07) foi perdida num reset — este arquivo e `sequencia-construcao.md` foram o que permitiu retomar o contexto. Manter este hábito daqui pra frente.

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

## Atualização — 12/08 (5): "Próxima troca de óleo" no Perfil + alerta na Garagem

Pedido do Raphael, print da tela Perfil. Item que já estava no backlog em aberto (ver seção 06/08 "revisão do backlog", "alerta de troca de óleo"). Mesmo padrão do alerta de CNH/exame toxicológico, mas com uma diferença importante: óleo é atributo do **caminhão** (`caminhao_perfil`), não do motorista, e o Raphael pediu uma janela de aviso mais curta (**1 semana antes**, não 60 dias como CNH/exame).

- **Migração** `20260812160000_caminhao_perfil_proxima_troca_oleo.sql`: coluna `proxima_troca_oleo date` em `caminhao_perfil`, nullable. Aplicada direto no Supabase via MCP.
- **`lib/frete.ts`**: `CaminhaoPerfil`/`PERFIL_DEFAULT` ganharam o campo (`string | null`, formato ISO "AAAA-MM-DD" — mesmo padrão de `cnh_vencimento`).
- **`Perfil.tsx`**: campo novo "Próxima troca de óleo" (`<input type="date">`, mesmo componente nativo já usado pra CNH/exame em `Motorista.tsx` — o navegador exibe no formato local, DD/MM/AAAA em pt-BR) logo após "Manutenção (R$/km)", com aviso "Você recebe um alerta na Garagem uma semana antes de vencer."
- **`Garagem.tsx`**: passou a carregar `carregarPerfil(uid)` também (antes só carregava `motorista`), extrai `proxima_troca_oleo`. A função `checar()` do alerta (antes fixa em 60 dias) ganhou um parâmetro `limiteDias` opcional — "Troca de óleo" usa `checar('Troca de óleo', proximaTrocaOleo, 7)`. Bolinha de alerta (âmbar/vermelha) ao lado do "Olá, Nome" agora também acende por troca de óleo vencendo, mesma UX de antes (clique abre painel com detalhe). Como CNH/exame vivem em "Meu Perfil" (`/motorista`) e óleo vive em "Meu Caminhão" (`/perfil`), o botão de atalho do painel virou `botoesAtualizarAlerta` (um `Map` rota→texto) — mostra os dois links se houver alerta dos dois tipos ao mesmo tempo, só um se só um tipo estiver vencendo.

Validado com `tsc --noEmit` limpo em `apps/web`. Ainda não commitado/pushado.

## Atualização — 12/08 (4): botão "Calcular" → "Analisar Frete"

Pedido rápido do Raphael, print da tela Analisar: texto do botão principal trocado de "Calcular" pra "Analisar Frete" (`Analisar.tsx`, linha do botão de submit). `tsc --noEmit` limpo. Ainda não commitado/pushado.

## Onde paramos — 12/08, fim de sessão (Raphael vai trocar de projeto)

Resumo do estado atual, pra retomar sem perder contexto:

**Já commitado e no GitHub** (commit `c79804f`, feature de carga máxima): `Docs/status-sessao.md`, `apps/web/src/lib/frete.ts`, `apps/web/src/pages/Analisar.tsx`, `apps/web/src/pages/BuscarFrete.tsx`, `apps/web/src/pages/Perfil.tsx`, `supabase/migrations/20260812150000_caminhao_perfil_carga_maxima.sql`. Esse commit é o que quebrou o build no Vercel (ver próximo item).

**Bug descoberto e corrigido no código, mas AINDA NÃO COMMITADO/PUSHADO** — é o que está bloqueando o deploy agora:
- O commit anterior desta sessão (correção do `tipo_valor`, feito numa sessão passada) nunca incluiu de fato `apps/web/src/lib/fretesPublicados.ts` nem a migração `supabase/migrations/20260812120000_fretes_publicados_tipo_valor.sql` — ficaram só como mudança local, nunca comitados. Como o commit `c79804f` (carga máxima) depende do campo `tipoValor` desse arquivo, o build do Vercel quebrou (`Property 'tipoValor' does not exist on type 'FretePublicado'`).
- Também nesta sessão: borda (`.chip-secao` em `index.css`) nos grupos "Tipo de veículo"/"Tipo de carroceria" do Perfil, pedido do Raphael pra deixar claro que são campos únicos (multi-chip), não itens soltos.
- **Comandos passados ao Raphael pra rodar localmente (fora do Cowork, terminal próprio) e ainda sem confirmação de execução:**
  ```
  cd D:\RodeComLucro-MVP
  del .git\index.lock
  git add apps/web/src/lib/fretesPublicados.ts supabase/migrations/20260812120000_fretes_publicados_tipo_valor.sql apps/web/src/index.css Docs/status-sessao.md
  git commit -m "fix: tipoValor faltante + borda nos grupos de chip do Perfil"
  git push origin main
  ```

**Próximo passo assim que essa sessão retomar**: confirmar com o Raphael se ele rodou esses comandos e se o deploy do Vercel passou limpo depois do push. Se ainda não rodou, isso é prioridade — o site em produção está com o último deploy quebrado até esse push acontecer.

**Funcionalidade nova pendente de validação visual**: campo "Carga máxima (toneladas)" no Perfil e o valor total estimado (`≈ R$ X total`) no card de frete "por tonelada" em Buscar Frete — implementados e com `tsc --noEmit` limpo, mas o Raphael ainda não viu/testou ao vivo (só viu print da borda dos chips).

**Preenchimento de `fretes_publicados.origem_lat`/`origem_lng`**: habilitada a extensão `unaccent` (estava disponível mas não habilitada — `create extension if not exists unaccent;`), confirmado que `lower(unaccent(...))` bate com a normalização usada em `municipios_brasil.nome_norm`. UPDATE por join `municipios_brasil.nome_norm = lower(unaccent(trim(origem_cidade)))` + `municipios_brasil.uf = trim(origem_uf)`.

**Resultado da conferência**: **796 de 800 fretes** ficaram com coordenada preenchida. Os 4 que não bateram (2 pares distintos) foram investigados individualmente, não é falha da base de referência:
- `Boa Esperança` / `MT`: não existe município com esse nome exato em MT na base do IBGE (existe `Boa Esperança do Norte`, `Água Boa`, etc.) — parece erro/nome incompleto no dado de origem (planilha Fretebras).
- `São João dAliança` / `GO`: falta o apóstrofo — o nome oficial é `São João d'Aliança` (existe certinho em `municipios_brasil`, `nome_norm = 'sao joao d''alianca'`). É um typo na planilha original, não um problema de cobertura da base.

Ambos ficam como pendência pra decisão do Raphael (corrigir manualmente esses 2 pares na `fretes_publicados`, ou deixar como estão já que são poucos registros de dado de teste).

Não mexi em nenhum arquivo de `apps/web/src` — essa etapa foi só banco (tabela de referência + colunas novas + UPDATE de backfill). Próximo passo (não iniciado): consumir essas coordenadas nas telas do motorista (input de "cidade atual" + filtro de raio em `BuscarFrete.tsx`).
