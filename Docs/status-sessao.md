# Status da sessão — RODE COM LUCRO

> Última atualização: 2026-07-17. Ponto onde paramos antes do fim de semana — retomar a partir daqui na segunda-feira.

## O que já está pronto

1. **Toda a documentação foi lida e consolidada**:
   - `Docs/resumo-tecnico-rode-com-lucro.md` — base de conhecimento dos 13 PRDs + roadmap, com o escopo do kickoff (identidade, calc-app, calc-wpp, portal, find-app, admin) e a decisão de não fazer raspagem Fretebras por ora.
   - `Docs/analise-compatibilidade-calculadora-experimental.md` — comparação entre o `calculadora-experimental` (github.com/emerson1001a/calculadora-experimental) e os PRDs, com todas as decisões de arquitetura/fórmula já tomadas e o piso ANTT já verificado na fonte oficial (ANTTlegis).
   - `Docs/sequencia-construcao.md` — o plano de fases de construção (Fase 0 → Fase 3) e as decisões finais do contrato do `@rode/calc`.

2. **`@rode/calc` extraído e testado** em `packages/rode-calc/` (raiz do repo, monorepo com npm workspaces):
   - `calcularFrete.ts`, `pisoANTT.ts`, `types.ts`, `format.ts` (com `reaisToCents`/`centsToReais` para o calc-wpp), `index.ts`.
   - **21 testes passando** (Vitest) — fórmula do ARLA (consumo próprio, não % do diesel), comportamento da volta vazia, as 3 faixas do veredito, piso ANTT com fallback de eixos, roundtrip de centavos. Confirmado rodando `npm test` na raiz do projeto.
   - `packages/rode-calc/README.md` documenta a proveniência e as decisões de contrato.

## Decisões já fechadas (não precisam ser revisitadas)

- Stack: React + Vite PWA, segue o PRD (não adotamos Expo/React Native como app oficial).
- Fórmula do ARLA: a da calculadora (consumo próprio independente) é a correta; o PRD calc-app estava desatualizado.
- Veredito: lógica simples da calculadora, sem a faixa `LIMIAR_VERDE` do PRD.
- Retorno: `voltaVazia: boolean` (não o `tipoRetorno` de 3 estados da calculadora).
- Campos novos (`estacionamento`, `chapa`, `pernoite`): fazem parte do schema desde já.
- Piso ANTT: vigente é a Portaria SUROC Nº 4/2026 (Resolução 6.076/2026) — a "Resolução 6.034/2024" do PRD está desatualizada.
- Rotas: API do Google para distância; pedágio ainda sem API definida (entrada manual por enquanto).
- Persistência/sync/identidade: segue o PRD (Supabase + RLS + offline-first).
- Dados antigos da calculadora: não precisam de migração, só servem como fixture de teste se quiser.

## Onde retomar na segunda-feira

Próximo passo (Fase 0, o que falta): duas trilhas paralelas, ainda não iniciadas —
1. **Trilha C — módulo `identidade`**: migrations (`motoristas`, `consentimento`, `otp_envio`, etc.), trigger `on_auth_user_created`, custom access token hook, Edge Function `otp-solicitar` com anti-abuso, telas de login por telefone.
2. **Edge Function de rotas via API do Google** (`route-cost`), para distância — substitui a matriz estática `distancias.ts` da calculadora original.

Depois dessas duas: Fase 1 (calc-app completo — telas, persistência offline-first, schema `caminhao_perfil`/`analise_frete`).

## Nota técnica sobre esta sessão

O terminal (sandbox Linux) desta sessão ficou indisponível o tempo todo (erro `HYPERVISOR_VIRT_DISABLED`) — por isso os testes do `@rode/calc` foram rodados por você mesmo, copiando comandos que passei (`npm install` / `npm test`) no Prompt de Comando do Windows, na pasta `D:\RodeComLucro-MVP`. Se isso persistir na próxima sessão, o mesmo fluxo funciona: eu escrevo os arquivos, você roda os comandos e me manda o resultado.

## Recomendação: salvar no GitHub

Os arquivos já estão salvos na pasta do projeto (`D:\RodeComLucro-MVP`), que é onde o Windows guarda de verdade — isso não se perde. Mas o repositório também está conectado a um repositório remoto no GitHub (`Raphaelvalente1818/RodeComLucro-MVP`), e ainda não commitei/enviei nada pra lá porque meu terminal não está funcionando nesta sessão. Se quiser um backup extra no GitHub antes do fim de semana, copie e cole isto no mesmo Prompt de Comando (na pasta `D:\RodeComLucro-MVP`):

```
git add .
git commit -m "Extrai @rode/calc da calculadora validada, com testes passando"
git push
```

Isso é opcional — os arquivos já estão seguros no seu computador de qualquer forma.
