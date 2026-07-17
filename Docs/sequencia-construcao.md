# Sequência de construção — RODE COM LUCRO

> Escopo: identidade, calc-app, calc-wpp, portal (mínimo), find-app, admin. Integra o motor validado do `calculadora-experimental` (ver `analise-compatibilidade-calculadora-experimental.md` para as decisões de fórmula/stack). Substitui a "ordem sugerida" antiga do `resumo-tecnico-rode-com-lucro.md`, que não considerava a calculadora existente.

## Como pensar a ordem

Três coisas independem umas das outras e podem começar juntas amanhã (dia 1): a lógica de cálculo (não depende de banco nem de auth), a fundação de identidade (não depende de nenhum outro módulo de produto) e a infraestrutura de repositório/CI. Tudo o que vem depois (telas, WhatsApp, feed, portal, admin) depende de pelo menos uma dessas três. Por isso a sequência abaixo é em **fases com trilhas paralelas dentro de cada fase**, não uma lista estritamente sequencial.

---

## Fase 0 — Fundação (paralelizável, sem dependência entre as 3 trilhas)

**Trilha A — Infraestrutura**
1. Estrutura de repositório (monorepo): `packages/rode-calc` (o `@rode/calc`), `apps/web` (PWA), `supabase/migrations`, `supabase/functions`.
2. Projeto Supabase criado (Postgres 15, Auth, Edge Functions, Storage), variáveis de ambiente, CI básico (lint + testes).
3. Conta/API key do Google (Routes API / Distance Matrix) provisionada.

**Trilha B — `@rode/calc` (motor de cálculo)**
1. Extrair `calcularFrete.ts` + `pisoANTT.ts` do `calculadora-experimental` para `packages/rode-calc`, sem reescrever a lógica — só desacoplar de React Native.
2. Aplicar as correções já decididas: manter a fórmula do ARLA da calculadora (consumo próprio, não `arlaPct`); resolver a divergência de veredito entre calculadora (`lucro<=0`) e PRD (`lucro<0`) — **decisão pendente, ver seção "Perguntas antes de codar" abaixo**.
3. Popular `antt_piso_tabela` (schema do PRD) com os coeficientes reais da Portaria SUROC Nº 4/2026 (Anexo II da Resolução 6.076/2026) — já verificados na fonte oficial ANTTlegis. Cobrir inicialmente só "carga geral" (o que a calculadora já tinha) e desenhar o schema para os outros `tipo_carga` do PRD, mesmo que vazios por enquanto.
4. Testes de paridade (Vitest): golden tests usando os casos que o motorista real já validou na calculadora — esses viram a suíte de regressão do `FORMULA_VERSAO`.
5. Carimbar `FORMULA_VERSAO` (ex.: `'emerson-v1'` ou nome que preferir) na primeira versão estável.

**Trilha C — `identidade`**
1. Migrations: `motoristas`, `consentimento`, `otp_envio`, `otp_bloqueio`, `wa_vinculo`, `identidade_audit`, `identidade_config`.
2. Trigger `on_auth_user_created` + custom access token hook (claims `app_role`/`driver_id`/`telefone_verificado`).
3. Configurar Supabase Auth phone (provedor de SMS) + Edge Function `otp-solicitar` com o gate anti-abuso.
4. Telas Entrada/Verificação (login por telefone) — mínimo necessário para autenticar, sem o onboarding completo ainda.

**Por que essas três podem ser simultâneas**: nenhuma lê ou escreve dado gerado pela outra. `@rode/calc` é função pura. `identidade` só depende do Supabase existir (trilha A). A trilha A é pré-requisito técnico das outras duas, mas é rápida (setup, não lógica de negócio) — pode ficar pronta no primeiro dia e destravar B e C imediatamente.

---

## Fase 1 — calc-app funcional (depende da Fase 0 inteira)

Esta é a entrega que prova que a integração funciona ponta a ponta — é o módulo mais autocontido e o que já tem lógica validada.

1. Edge Function `route-cost` usando **API do Google** (decisão já tomada) para distância; pedágio fica manual por enquanto (API ainda não escolhida).
2. Schema `caminhao_perfil` / `analise_frete` (do PRD, com `user_id` referenciando `motoristas.id` da Fase 0) + RLS.
3. Reconstruir as telas (Analisar → Resultado → Perfil) em React/Vite, usando `@rode/calc` da Fase 0, reproduzindo as decisões de UX validadas na calculadora (modo "a negociar" com semáforo, campos adaptativos, conselhos contextuais, auto-preenchimento de dias por faixa de km) — mas com o visual/design system do PRD, não os componentes React Native.
4. Persistência offline-first: IndexedDB + fila de sync idempotente (UUID cliente + upsert merge-duplicates) gravando em `analise_frete`.
5. Login (telas da Fase 0/identidade) integrado ao fluxo — motorista loga, perfil e histórico ficam atrelados à conta.

**Critério de saída da Fase 1**: um motorista consegue logar por telefone, calcular um frete com distância vinda do Google, ver o veredito com piso ANTT correto, salvar offline e ver a análise sincronizada — reproduzindo (com os dados corretos) o mesmo resultado que a calculadora original dava para os casos já validados com o motorista real.

---

## Fase 2 — calc-wpp (depende da Fase 1 estar validada)

Não é tecnicamente bloqueado por completo pela Fase 1 (o motor e o schema já existem na Fase 0), mas faz sentido só entrar depois do calc-app validar o motor em produção — menos risco de descobrir um bug de fórmula em dois canais ao mesmo tempo.

1. `wa-webhook` compartilhado: os intents `VINCULAR`/`DESVINCULAR` do módulo identidade entram primeiro (prova de posse do número), o pipeline de cálculo do calc-wpp entra depois.
2. STT/NLU/extração de entidades + guardrail de confiança.
3. Templates HSM da Meta — **começar a submissão para aprovação assim que possível dentro desta fase**, o lead time de aprovação é o maior risco de cronograma do módulo, não a implementação em si.

---

## Fase 3 — Aquisição: portal mínimo + find-app (podem começar em paralelo entre si, mas depois da Fase 0)

**Portal mínimo** (o suficiente para alimentar `RODE_DIRETO`, não o PRD completo com KYC automatizado):
1. Cadastro de empresa simplificado + aprovação manual (sem `kyc-cnpj` automatizado na primeira versão).
2. CRUD de `opportunities`.

**find-app**:
1. Pipeline de coleta com fontes `RODE_DIRETO` (do portal mínimo acima) + `MANUAL` (admin) — **sem Fretebras**, conforme decidido.
2. Feed com veredito materializado usando `@rode/calc` (mesmo pacote da Fase 0).

Essas duas podem correr em paralelo *entre si*, mas o find-app só tem dado de verdade para mostrar depois que o portal mínimo começar a gerar `opportunities` — vale nascerem defasadas em ~1-2 semanas, portal primeiro.

---

## Transversal — admin (instrumentação desde o dia 1, dashboard fechado por último)

Não é uma fase isolada: `track()`/`analytics_event` precisa ser chamado por **todo módulo desde a Fase 1** (senão o gate de jornadas completas não tem dado histórico quando o admin ficar pronto). O dashboard/moderação em si (telas do admin) é o que fica para o fim, depois que os outros módulos já estão gerando evento.

---

## Decisões finais sobre o contrato do `@rode/calc` (Raphael, 2026-07-17)

1. **Veredito**: mantém a lógica simples da calculadora — `lucro<=0 OU valorFrete<piso → RUIM`; `margemReal>=margemDesejada → BOM`; senão `ACEITÁVEL`. **Não** implementa o refinamento `LIMIAR_VERDE`/`pctAcimaPiso` do PRD calc-app — essa parte do PRD fica descartada em favor do comportamento já validado com o motorista real.
2. **Tipo de retorno**: **1 booleano só**, igual ao PRD original (`voltaVazia: boolean`) — não adota o modelo de 3 estados (`nenhum`/`vazio`/`comCarga`) nem o `pedagioVolta` editável da calculadora. Consequência prática: "frete de retorno pago" (o `SimularRetornoModal` da calculadora, "e se eu pegar um frete de volta?") **não é um campo dentro da mesma análise** — vira uma segunda análise nova e independente. Isso mantém o `FreteInput` compatível com o que calc-wpp e find-app já esperam, sem precisar propagar mudança de contrato para esses PRDs.
3. **Campos novos** (`estacionamento`, `chapa`, `pernoite` separado de `alimentacao`): **entram no schema desde já** — fazem parte de `caminhao_perfil`/`analise_frete`/`Custos` do calc-app na primeira versão.
4. **Dados antigos da calculadora**: **não precisa migrar** — os registros locais (`AsyncStorage`) de quem já testou a calculadora não precisam de rota de importação para o Postgres. Só valem a pena reaproveitar como **fixtures de teste** (golden tests), não como dado de produção.

## Primeiras tarefas concretas de hoje

1. Criar a estrutura de repositório (Fase 0-A).
2. Começar a extração do engine (Fase 0-B) já com o contrato final acima: `FreteInput` com `voltaVazia: boolean` + campos novos (`estacionamento`, `chapa`, `pernoite`), fórmula do ARLA da calculadora, veredito simples sem `LIMIAR_VERDE`.
3. Trilha C (identidade) em paralelo — não depende de nenhuma das decisões acima.
