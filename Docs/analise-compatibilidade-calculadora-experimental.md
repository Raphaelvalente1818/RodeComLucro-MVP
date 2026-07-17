# Análise de compatibilidade — `calculadora-experimental` × PRDs técnicos

> Repositório analisado: https://github.com/emerson1001a/calculadora-experimental (público, branch `master`, 70 commits, coautoria `raphaelvalentegomes-cyber` + `claude`). Lido via GitHub em 2026-07-16 (arquivo por arquivo — engine, types, data, utils, screens, components, `App.tsx`, `package.json`).

## 0. Achado mais importante primeiro

**Os PRDs técnicos descrevem um "protótipo mockado" (`src/lib/calc.ts`, `ProfitCalculator.tsx`, `CostBreakdown.tsx`, `VEREDITO_UI`, `explicar()`, `FRETE_DEFAULTS`, `ROTAS`) que não existe em nenhum lugar** — nem no repositório `RodeComLucro-MVP` (só tem a pasta `Docs`), nem no `calculadora-experimental`. Ou seja: os PRDs foram escritos assumindo uma base de código que é diferente da que você realmente tem. O `calculadora-experimental` é uma implementação **real, independente e mais madura** do que os PRDs presumem — com nomes de arquivo, contrato de dados e até fórmulas ligeiramente diferentes.

**Conclusão prática**: não dá para simplesmente "seguir a Etapa 1 do PRD calc-app" (que manda editar `src/lib/calc.ts`). É preciso primeiro decidir como esse código real vira a base do projeto, e depois corrigir os PRDs (ou pelo menos anotar os desvios) para refletirem a implementação verdadeira.

---

## Decisões finais (Raphael, 2026-07-17) — substituem as perguntas em aberto abaixo

Este documento foi escrito como análise/pergunta aberta. As decisões abaixo já foram tomadas e têm prioridade sobre qualquer "a decidir" mencionado nas seções seguintes:

0. **Portal (módulo B2B) segue o PRD normalmente** — nenhuma mudança de escopo aí; a menção a "portal" nas mensagens anteriores era no sentido genérico de "infraestrutura necessária para a calculadora se integrar ao projeto" (identidade + Supabase), não o módulo Portal em si.
1. **Não começamos do zero.** A missão é integrar a calculadora existente (já testada e aprovada por um motorista real — validação de campo real, não só teórica) aos PRDs, não reescrever a lógica de cálculo.
2. **Stack segue o PRD**: React + Vite PWA (offline-first, Workbox/IndexedDB), **não** adotamos Expo/React Native como app oficial (resolve a seção 6/pergunta que travava tudo). A UI do `calculadora-experimental` é referência de UX, não é portada 1:1 — precisa ser reconstruída em React web.
3. **Fórmula do ARLA 32**: a versão da calculadora é a canônica (`custoArla = (arlaPrecoPorLitro / arlaKmPorLt) * distanciaTotal`, consumo próprio independente). O PRD calc-app (`custoArla = custoDiesel * arlaPct/100`) está desatualizado e deve ser corrigido para bater com o engine real — não o contrário.
4. **Piso mínimo ANTT**: segue o desenho do PRD (tabela `antt_piso_tabela` versionada no banco por vigência, múltiplos `tipo_carga`), não o array hardcoded de "carga geral" da calculadora — mas populada com os coeficientes da calculadora, que são os corretos. **Verificado em 2026-07-17 direto no ANTTlegis (fonte oficial)**: a referência da calculadora está certa e a do PRD está desatualizada. Vigente hoje: **Portaria SUROC Nº 4/2026** (20/03/2026, reajusta o diesel de referência do cálculo para R$7,35/L por gatilho do diesel), que atualiza os coeficientes do Anexo II da **Resolução ANTT 6.076/2026** (19/01/2026, que por sua vez alterou a Resolução 5.867/2020). A "Resolução ANTT 6.034/2024" citada no texto do PRD calc-app é uma norma anterior e superada — **corrigir a referência no PRD** ao popular a tabela. Fórmula confirmada: `piso = distanciaKm × CCD + CC` (coeficiente de deslocamento + coeficiente de carga/descarga), igual ao que já está implementado em `pisoANTT.ts`. Fontes: [Portaria SUROC nº 4/2026 (ANTTlegis)](https://anttlegis.antt.gov.br/action/ActionDatalegis.php?acao=abrirTextoAto&link=S&tipo=POR&numeroAto=00000004&seqAto=000&valorAno=2026&orgao=SUROC%2FANTT%2FMT&cod_modulo=161&cod_menu=7817), [Resolução ANTT 6.076/2026 (ANTTlegis)](https://anttlegis.antt.gov.br/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=RES&numeroAto=00006076&seqAto=000&valorAno=2026&orgao=DG%2FANTT%2FMT&cod_modulo=623&cod_menu=9230).
5. **Rotas/distância**: usar a **API do Google** (Google Routes/Distance Matrix) como fonte de distância, em vez da matriz estática `distancias.ts` da calculadora e em vez das opções do PRD (OpenRouteService/HERE/Qualp). **Pedágio ainda em aberto** — API a ser pesquisada; até lá, entrada manual do motorista.
6. **Persistência/sessão/sync**: segue o PRD integralmente (Supabase Postgres+RLS, offline-first via IndexedDB, sync idempotente por UUID, módulo identidade para login/`auth.uid()`) — substitui o `AsyncStorage` isolado da calculadora, que vira só um fallback local temporário durante a migração.
7. **UX/visual segue o PRD** — a implementação visual (componentes, layout, design system) usa o padrão web do PRD, não os componentes `StyleSheet`/React Native da calculadora. As funcionalidades de produto validadas nela (modo "a negociar" com semáforo, campos adaptativos, coach marks, conselhos contextuais, auto-preenchimento de distância/diárias) são preservadas como **comportamento/lógica de UX** a reconstruir dentro do visual do PRD, não como componentes portados diretamente.

**Resumo da filosofia**: o **motor de cálculo** (`calcularFrete.ts` + fórmula do ARLA, validados com o motorista real) é a fonte de verdade a preservar ao pé da letra. Tudo ao redor dele (stack de UI, persistência, fonte de distância, versionamento do piso ANTT, visual) se adapta ao padrão unificado do projeto descrito nos PRDs.

---

## 1. Stack: divergência estrutural (a decisão mais importante)

| | PRD calc-app (documentado) | `calculadora-experimental` (real) |
|---|---|---|
| Framework | React 18 + TypeScript + **Vite**, PWA instalável | **React Native + Expo** (`expo ~52`, `react-native 0.76.9`) |
| Alvo | Web (PWA mobile-first, service worker) | Mobile nativo (iOS/Android via Expo) **+ web via `react-native-web`** (dependência já presente) |
| Offline | Service Worker (Workbox) + IndexedDB (`idb`) + Cache API, stale-while-revalidate | Nenhum service worker; sem IndexedDB. Único mecanismo é `AsyncStorage` (chave-valor simples) |
| Componentização | Tailwind + componentes web (`div`, `button`) | `StyleSheet` do React Native (`View`, `Text`, `TouchableOpacity`) — **não portável 1:1 para HTML/CSS** |
| Gráfico de custos | `recharts` (donut) | `GraficoPizza.tsx` com `react-native-svg` |

**Isso não é um detalhe de implementação — é uma escolha de arquitetura inteira.** `react-native-web` permite rodar esse código React Native também no navegador, mas isso não é a mesma coisa que a PWA Vite+Workbox que todos os 13 PRDs pressupõem (inclusive para o pacote `@rode/calc` isomórfico rodando em Edge Functions Deno, que é JS/TS puro e não depende de React de forma alguma — isso continua compatível).

**Duas rotas possíveis, com implicações bem diferentes:**
1. **Adotar Expo como o app oficial** (mobile nativo + web via react-native-web) e reescrever a seção "Stack" de todos os PRDs `-app` (calc-app, find-app, identidade, etc.) de Vite/PWA para Expo/React Native. Ganha: você já tem ~70 commits de UI funcionando, com boa UX (modo "a negociar", coach marks, campos adaptativos). Perde: todo o desenho de PWA/Service Worker/IndexedDB precisa ser refeito com as ferramentas do ecossistema Expo (`expo-sqlite` ou similar em vez de IndexedDB, estratégia de cache diferente).
2. **Manter o PRD como está (Vite PWA)** e portar só a **lógica de negócio** (a fórmula, a tabela ANTT, os presets de rota) para o novo `@rode/calc`, reconstruindo a UI do zero em React web reaproveitando as decisões de UX já validadas neste protótipo (a tela de resultado, os textos, os conselhos contextuais). Ganha: mantém a arquitetura offline-first já bem especificada nos PRDs. Perde: descarta ~70 commits de UI React Native (ainda que a lógica de negócio, que é a parte mais validada, seja preservada).

Isso é uma decisão sua — recomendo decidirmos isso explicitamente antes de tocar em código (ver pergunta ao final).

---

## 2. Motor de cálculo (`engine/calcularFrete.ts` + `engine/pisoANTT.ts`)

### 2.1 O que é equivalente
- Estrutura geral igual: `EntradaFrete → ResultadoFrete`, cálculo determinístico e puro (sem I/O), veredito em 3 níveis.
- Regra de dias por distância **bate exatamente** com a do PRD calc-app (`<=600:1, <=1200:2, <=2000:3, <=3000:4, >3000:5`) — só que aqui está na tela (`AnalisarScreen.tsx`), não no engine.
- Disclaimer do piso ANTT já implementado com o **texto quase idêntico** ao exigido no PRD: *"Estimativa com base em modelo de custo transparente. O piso ANTT é referência regulatória e o veredito não é aconselhamento."*
- Já existe um "offline banner" (`distanciaEstimada`) quando a distância vem da matriz estática local — conceito equivalente ao `origem_dado='preset'` do PRD.

### 2.2 Divergências no contrato de dados (`EntradaFrete` × `FreteInput` do PRD)
| Campo PRD (`FreteInput`) | Campo real (`EntradaFrete`/`Custos`) | Observação |
|---|---|---|
| `voltaVazia: boolean` | `tipoRetorno: 'nenhum'\|'vazio'\|'comCarga'` | **O real é mais rico** — distingue volta vazia de volta com carga paga (pedágio de volta editável). Muda a assinatura da função. |
| `consumoKmL` (1 valor) | `dieselKmPorLt` + `arlaKmPorLt` (2 valores independentes) | Divergência de fórmula, ver 2.3. |
| `arlaPct` (% do diesel) | `arlaPrecoPorLitro` / `arlaKmPorLt` (consumo próprio) | Ver 2.3 — são modelos matemáticos diferentes, não é só renome. |
| `alimentacaoDia * dias` | `alimentacao` já vem somado (dias × valor calculado na tela) + `pernoite` separado | Real distingue alimentação de pernoite/hospedagem. |
| — (não existe no PRD) | `estacionamento`, `chapa`, `pedagioVolta` | Campos novos, ausentes do modelo `caminhao_perfil`/`analise_frete` do PRD — precisam ser adicionados ao schema se forem mantidos. |
| `margemDesejadaPct` | `margemDesejada` | Equivalente, só nome. |

### 2.3 Divergência de fórmula real (não é só nome de campo) — ARLA 32
- **PRD**: `custoArla = custoDiesel * (arlaPct/100)` — ARLA como **percentual do gasto de diesel**.
- **Real**: `custoArla = (arlaPrecoPorLitro / arlaKmPorLt) * distanciaTotal` — ARLA como **consumo próprio independente** (litros/km e preço/litro do ARLA, igual ao diesel).

Isso é uma diferença de modelo, não cosmética: o resultado numérico do custo de ARLA **não bate** entre as duas versões para os mesmos dados de entrada. Como o `calculadora-experimental` foi construído com a participação do Emerson (nome do motorista de referência citado em todos os PRDs como fonte de calibração), a hipótese mais provável é que **a fórmula real (consumo independente) é a correta/calibrada**, e o texto do PRD (`arlaPct`) é uma simplificação desatualizada. Recomendo tratar `engine/calcularFrete.ts` como fonte de verdade e atualizar os PRDs, não o contrário — mas vale confirmar com o Emerson.

### 2.4 Divergência no veredito
- **PRD calc-app**: `lucro<0 OU valorFrete<piso → RUIM`; `margemReal<desejada OU pctAcimaPiso<LIMIAR_VERDE(~15%) → ACEITAVEL`; senão `BOM`.
- **Real**: `lucro<=0 OU abaixoPisoANTT → RUIM`; `margemReal>=margemDesejada → BOM`; senão `ACEITAVEL`.

Duas diferenças: (a) o real usa `lucro<=0` (inclui exatamente zero como RUIM), o PRD usa `lucro<0` (zero seria ACEITAVEL); (b) o real **não tem** o conceito de `LIMIAR_VERDE`/`pctAcimaPiso` — não existe uma faixa "aceitável mas perto do piso", é só binário lucro×margem. O real é mais simples e não precisa de calibração adicional do limiar verde — outra decisão a tomar (manter a versão simples ou implementar o refinamento do PRD).

### 2.5 Piso mínimo ANTT
- Real implementa **só carga geral** (`ANTT_CARGA_GERAL`, 7 faixas de eixo) com coeficientes citando **"Portaria SUROC Nº 4/2026"** — isso é uma fonte/vigência **diferente** da citada nos PRDs (**"Resolução ANTT 6.034/2024"**). Vale confirmar qual é a vigente hoje (2026-07-16) antes de consolidar — pode ser que a Portaria SUROC 4/2026 seja simplesmente mais recente e correta, o que tornaria a referência do PRD desatualizada.
- Fallback quando o número de eixos não está na tabela: usa o **imediatamente inferior**, com default de 5 eixos — regra específica e correta (`Res. ANTT 6.076/2026 Art. 5º §5º`), não estava detalhada nos PRDs.
- Está **hardcoded no cliente** (constante TS), não é uma tabela versionada no banco (`antt_piso_tabela` com `valido_de`/`valido_ate`) como o PRD desenha. Funciona bem para MVP mobile, mas quebra a promessa do PRD de "atualizar sem novo deploy" e de suportar múltiplos tipos de carga (granel, frigorificada, etc. — hoje só "carga geral").

### 2.6 Rotas/presets
- `data/distancias.ts`: ~1785 linhas, só `[origem, destino, distanciaKm]` **unidirecional**, sem pedágio nem dias (dias são calculados à parte na tela, pedágio é sempre digitado manualmente). O `ROTAS` do PRD calc-app presumia presets já incluindo pedágio e dias por rota — aqui não tem isso, é responsabilidade do usuário preencher pedágio.
- Não existe nenhuma chamada a API de roteirização externa (OpenRouteService/Google/HERE) — 100% dado estático local. Isso é coerente com "MVP simples, sem custo de API", mas é uma simplificação real do que o PRD desenhou (cascata API→cache→preset→manual).

---

## 3. Persistência, sessão e sync — maior gap frente ao PRD

- **Só existe uma chave `AsyncStorage`** (`perfil_caminhao_v1`) guardando o perfil do caminhão. **Não existe histórico de análises** (`analise_frete`), não existe Supabase, não existe autenticação, não existe fila de sync, não existe UUID/idempotência.
- Não há tela de Histórico — `App.tsx` só alterna entre `analisar`, `resultado` e `perfil`, tudo em memória (`useState`), perdido ao fechar o app.
- Isso é esperado — é um protótipo standalone de validação da fórmula/UX — mas é o **gap mais trabalhoso** para fechar com o PRD: todo o desenho de identidade (`motoristas`/RLS/`auth.uid()`), sync offline-first (`analise_frete`, upsert idempotente por UUID) e histórico persistente ainda precisa ser construído do zero em cima dessa base.

---

## 4. UX que já está mais madura que a descrição do PRD (vale preservar)

- Modo **"A negociar"**: calcula o frete mínimo em tempo real a partir de uma margem-alvo escolhida no slider, com semáforo VERDE/AMARELA/VERMELHA comparando contra o piso ANTT — não está descrito em nenhum PRD, é uma funcionalidade nova e boa.
- **Campos adaptativos**: só pergunta consumo de diesel/ARLA e número de eixos se não estiverem no perfil salvo — reduz fricção de digitação.
- **Coach marks**: dicas contextuais que aparecem uma vez (marcadas como vistas no `AsyncStorage`) explicando por que preencher certos campos.
- **Conselhos contextuais** no resultado (`obterConselhos`): quando a margem está abaixo do desejado, sugere o que revisar (diesel desatualizado, pedágio, manutenção) ordenado pelo maior custo — funcionalidade de produto que nenhum PRD menciona.
- Auto-preenchimento de distância (via matriz local) e de número de diárias (por faixa de km) já implementados exatamente como o PRD especifica.

Essas são decisões de produto validadas que vale **subir de volta para os PRDs** (documentar como requisito), não descartar.

---

## 5. O que falta para fechar com os PRDs do escopo do kickoff

Considerando o escopo decidido (identidade, calc-app, calc-wpp, portal, find-app, admin):

1. **Extrair o motor para `@rode/calc`** — hoje ele mora dentro do app Expo (`src/engine/`). Precisa virar pacote TS isomórfico consumível também por Edge Functions Deno (calc-wpp, find-app) — isso é possível independente da decisão de UI (Expo vs Vite), porque `calcularFrete.ts`/`pisoANTT.ts` não têm nenhuma dependência de React/React Native.
2. **Resolver a divergência de fórmula do ARLA** e do veredito (seções 2.3/2.4) com o Emerson antes de carimbar `FORMULA_VERSAO` — hoje as duas fontes (PRD × código real) descrevem contas diferentes.
3. **Decidir a stack do app** (Expo vs Vite PWA) — bloqueia a arquitetura de todos os módulos `-app`, não só calc-app.
4. **Conectar ao módulo identidade**: hoje não existe login nem `motoristas`; o perfil salvo em `AsyncStorage` precisa migrar para `caminhao_perfil` no Postgres com RLS por `auth.uid()`, seguindo o padrão de migração anônimo→conta desenhado no PRD identidade.
5. **Implementar histórico + sync offline-first idempotente** (`analise_frete`, UUID gerado no cliente, upsert merge-duplicates) — hoje não existe nenhuma persistência de resultado, só do perfil.
6. **Versionar a tabela ANTT no banco** (múltiplos tipos de carga, vigência) em vez do array hardcoded — ou aceitar conscientemente que o MVP cobre só "carga geral" por enquanto.
7. **Adicionar ao schema os campos novos e validados no protótipo**: `estacionamento`, `chapa`, `pedagioVolta`, `tipoRetorno` de 3 estados (em vez do `voltaVazia` booleano do PRD).

---

## 6. Pergunta que trava tudo o resto

A decisão da seção 1 (Expo/React Native vs Vite/PWA web) determina como todo o resto do trabalho de amanhã é organizado — inclusive se a UI existente é reaproveitada quase inteira (rota 1) ou só a lógica de negócio (rota 2). Vale decidir isso como primeiro passo do kickoff, antes de escrever qualquer linha de código novo.
