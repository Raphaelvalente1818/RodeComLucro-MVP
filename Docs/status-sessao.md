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
