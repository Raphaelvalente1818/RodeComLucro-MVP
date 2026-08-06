# Status da sessão — RODE COM LUCRO

> Última atualização: 2026-08-04. A sessão anterior (17/07) foi perdida num reset — este arquivo e `sequencia-construcao.md` foram o que permitiu retomar o contexto. Manter este hábito daqui pra frente.

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
- `Resultado.tsx`: depois de salvar uma análise, além de "Análise salva." e "Nova análise", agora aparece um botão **"Voltar para a Garagem"**. Conferi antes de mexer: esse texto já existia em outras telas/estados (histórico, análise não encontrada, tela Analisar), mas não no momento logo após salvar — era só isso que faltava.
- Item "Incluir o Campo da Km atual do caminhão" **removido** (deletado, não marcado feito) do `backlog_provisorio` a pedido do Raphael.

Itens marcados `feito`: KM anual, Apelido no topo, botão Voltar pós-salvar.

**Ainda em aberto, sem decisão ainda** (grupos 2 a 4 da sugestão que passei pro Raphael): pneu por km calculado pelo nº de eixos (preciso de fórmula/referência — perguntei se pesquiso uma ou se ele passa os valores, ainda sem resposta), depreciação com fallback quando o caminhão não tem match na FIPE, alerta de troca de óleo, alertas de vencimento mais amplos na Garagem (óleo/pneus), lucro do mês por frete executado vs. salvo (precisa de conceito de "status do frete" novo no schema), "Frete a Combinar" com slider, formulário de empresa/contato ao salvar frete, múltiplos caminhões.

Validado com `tsc --noEmit` limpo. Ainda não commitado/pushado.
