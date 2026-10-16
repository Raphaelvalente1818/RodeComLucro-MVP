# ATA — Reunião de sócios

**Data:** 15 de outubro de 2026 (noite)
**Participantes:** sócios — Raphael, Rapha, David e Oscar [confirmar presentes]. Emerson citado com encargo.
**Pauta:** apresentação `apresentacao-socios-2026-10-v4.pptx` (16 slides) — onde estamos, benchmark dos concorrentes (Zé Boléia e Fretebras), o problema do contato do embarcador, a solução "Tenho interesse", o MVP em ordem, os pontos da reunião prévia, o PRO, o que fica pra depois e as decisões.
**Documentos de apoio:** `analise-concorrente-zeboleia-2026-10-12.pdf`, `proposta-tenho-interesse.txt` (32 itens), `decisoes-pagamento-2026-10-09.xlsx`.

Regra registrada pelos sócios: **tudo o que foi apresentado e não consta nos ajustes da seção 3 está aprovado.**

## 1. Contexto apresentado

- Estado: bot no WhatsApp (v88), app com barra de abas, Sofrete (portal da empresa) e painel admin no ar; 21 motoristas, 112 consultas no bot, 87 análises no app; gate de validação 1/160. Diagnóstico: o gargalo é aquisição; os 810 fretes da base são importados de agosto.
- Benchmark Zé Boléia (12/10): 50 mil downloads, nota 3,6; 10 fretes abertos, 36 "tô vazio", 133 anúncios, 9 relatos de golpe em 17 dias; só app, sem WhatsApp; contato escondido atrás de chat. Conclusão: o frete deles não decolou — app que pede pro mercado sair do WhatsApp, sem embarcador, sem verificação.
- Benchmark Fretebras, lado do motorista (13/10): só app nativo, verificação pesada (ANTT, CNH, endereço, PIX, selfie), carteira com antecipação e garantia, VIP equivalente ao nosso PRO, chat interno, bloqueio de print.
- Problema: o telefone do contratante só pode aparecer com autorização do embarcador; chat interno foi descartado.

## 2. Deliberações — APROVADO

1. **Fluxo "Tenho interesse"** conforme a proposta de 32 itens: botão no WhatsApp e no app; CNH lida por foto obrigatória antes de o interesse valer (selo "Verificado"); cartão público do motorista; senha de identificação (modelo iFood) que a empresa usa ao ligar; avaliação dos dois lados só após frete fechado, grátis; níveis de certificação em vez de pedir tudo de uma vez; localização pontual (não rastreio); anti-abuso; lembrete em 24 h.
2. **Concierge na primeira vez**: empresa que ainda não nos conhece recebe ligação de um operador nosso (fila no painel admin, indicador por operador no modelo Aferi+) antes de qualquer WhatsApp; prazo de 2 h em horário comercial; passado o prazo ou fora do horário, o bot libera a mensagem pronta pro motorista mandar do WhatsApp dele. A partir do segundo interesse a empresa já é conhecida e o aviso é automático (Sofrete + WhatsApp com opt-in). **Nunca mandar mensagem do número oficial pra empresa sem opt-in.**
3. **Ordem do MVP**: fretes vivos → pedágio pago pelo embarcador → "Tenho interesse" etapa 1 → etapas 2 a 5 (fases do frete na Sofrete, disponível na busca, localização, níveis, RNTRC, avaliações, admin) → depois dos 300 motoristas: Comunidade.
4. **PRO** conforme a tabela de 09/10: motorista paga; mensal; sem trial; libera fretes ilimitados, primeira mão e WhatsApp sem limite; grátis cai pra 5 consultas/dia; só cartão; compra fora do app da Play; cobrança só depois da semeadura. (Preço e provedor: ver ajustes 13 e 14.)
5. **O que fica pra depois** com gatilho: Comunidade dos Caminhoneiros (300 motoristas), Google Play (domínio + conta), App Store (ver ajuste 11).
6. Posição competitiva: manter o WhatsApp como canal principal, o cálculo de custo real e o contato direto quando a empresa permitir; não copiar chat interno, bloqueio de print nem carteira financeira.

## 3. Ajustes e condicionantes deliberados

1. **Marca única: SOFRETE** nos dois lados (motorista e embarcador); "Rode com Lucro" deixa de ser usado. Votação 3 × 1, Oscar contrário. O rebrand é o primeiro item de código.
2. **Captação da CNH**: melhorar a leitura por PDF (a CNH do Rapha, enviada em PDF, foi mal lida; a do Oscar, por foto, foi perfeita).
3. **Serasa**: verificar a possibilidade de consultar a situação do caminhoneiro. Pesquisa de viabilidade, custo e consentimento antes de qualquer código.
4. **Entrada do embarcador** com segurança e checagem total; montar tabela dos embarcadores já aceitos pela Fretebras, dado o rigor deles.
5. **Chave PIX**: verificar como a Fretebras confere se a chave pertence à pessoa (consulta ao diretório do PIX via provedor de pagamento) — entra junto com o pagamento.
6. **Robô de fretes** a cada 3 horas: só os fretes que entraram no intervalo; descartar os que saíram. Antes, verificar se o acesso à lista é automatizável.
7. **Motoristas da Fretebras**: o Rapha vai levantar os cadastrados lá (aquisição).
8. **Selfie com prova de vida** só depois de 10.000 motoristas.
9. **Fretebras**: o Emerson renova a conta (pré-requisito dos itens 4 e 6).
10. **RNTRC**: solicitar a foto ou o número e checar na ANTT.
11. **Lojas**: Google Play primeiro; App Store quando houver ~10.000 motoristas.
12. **"Tô vazio"**: perguntar ao motorista onde está e pra onde vai.
13. **Meio de pagamento**: aguardar a abertura da empresa (~10 dias) pra contratar o provedor já no nome dela.
14. **Preço do VIP/PRO**: o Rapha vai propor.

## 4. Encargos

| Quem | O quê | Prazo |
|---|---|---|
| Emerson | Renovar a Fretebras | imediato |
| Rapha | Levantar motoristas cadastrados na Fretebras; propor o preço do VIP/PRO | próxima reunião |
| Raphael | Domínio Sofrete; templates e nome de exibição na Meta; abertura da empresa; seguir o plano de execução; **trazer as 3 primeiras empresas pra Sofrete (piloto)** | em andamento |
| Emerson | Pesquisar o Serasa (produto, custo por consulta, consentimento) | próxima reunião |
| [definir] | Fornecedor de consulta RNTRC/ANTT por API | [definir] |

## 5. Próximos passos

Plano de execução em fases em `Docs/plano-execucao-2026-10.md`: Fase 0 (domínio, Meta, Fretebras) → Fase 1 (rebrand Sofrete, CNH por PDF, pedágio do embarcador, spike do robô) → Fase 2 ("Tenho interesse" etapa 1) → Fase 3 (Sofrete empresa) → Fase 4 (tô vazio, níveis, RNTRC) → Fase 5 (avaliações, abuso, admin, piloto) → Fase 6 (Google Play, PRO). Estimativa: ~26 dias úteis de código pras fases 1 a 5.

**Próxima reunião:** [definir] — pauta sugerida: preço do VIP/PRO (Rapha), empresas piloto, resultado das pesquisas (Serasa, RNTRC, robô).
