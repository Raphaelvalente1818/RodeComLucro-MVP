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
