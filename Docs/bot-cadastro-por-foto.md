# Bot WhatsApp — cadastro por foto (CNH + CRLV)

Textos aprovados pelo Raphael em 07/10/2026. Fonte da verdade pra implementação
(item 6 da fila em `status-sessao.md`). Palavras-chave: CNH, CRLV, OCR, foto,
documento, cadastro, placa, renavam, visão, Haiku.

Regras: uma mensagem por passo (custo Meta); NÃO guardar a imagem; NÃO gravar
CPF/RG/nascimento/chassi/proprietário; nome que vale é o da CNH; carreta pode
mandar cavalo e semirreboque separados; não é validação de autenticidade.
Comando pra pedir depois: **CADASTRO** (não "documentos" — não ficamos com foto).

## 1. Convite — uma vez, após o 1º cálculo com conta criada (nunca na 1ª mensagem)

> Quer que eu preencha seu cadastro sozinho? Manda uma *foto da CNH* e eu pego seu nome, categoria e validade. Depois a *foto do CRLV* do caminhão: marca, placa, eixos e capacidade.
> Eu leio e apago a foto na hora — não guardo imagem nem CPF.

Botões: `Pode ler` · `Agora não`. "Agora não" não insiste; fica disponível por `CADASTRO`
(entra na apresentação do bot).

## 2. Após "Pode ler"

> Manda a foto da CNH (frente, aberta, sem dedo em cima). Depois a do CRLV.

## 3. CNH lida

> 📄 Li na sua CNH:
> *Nome:* José Carlos da Silva
> *Categoria:* E
> *Validade:* 14/03/2029
> *Nº da CNH:* 01234567890
> Tá certo?

Botões: `Salvar` · `Corrigir` · `Cancelar`.
Se vencida, acrescenta antes do "Tá certo?": `⚠️ Essa CNH venceu em 14/03/2026.` — salva mesmo assim.

## 4. CRLV lido

> 🚛 Li no CRLV:
> *Veículo:* Scania R 450 (2019)
> *Placa:* ABC1D23
> *Eixos:* 3 · *Capacidade:* 25 t
> *Licenciamento:* 2026
> Tá certo?

Botões: `Salvar` · `Corrigir` · `Cancelar`.
Semirreboque: `*Semirreboque:* Randon Graneleiro (2018) · Placa XYZ9A87 · 3 eixos · 32 t`.

## 5. Salvou

CNH: `Pronto, José Carlos. Cadastro atualizado. Te aviso quando a CNH estiver pra vencer. Agora manda a foto do CRLV, se quiser.`

CRLV: `Pronto — Scania R 450, placa ABC1D23, salvo como seu caminhão. Os cálculos já usam ele.`

Tipo em dúvida (espécie "caminhão trator"): antes de salvar, botões `Carreta` · `Carreta LS` · `Bitrem`
com a pergunta `É uma Carreta?`.

## 6. Corrigir

> O que tá errado? Manda só o campo, tipo *"placa ABC1D23"* ou *"validade 14/03/2029"*.

Depois repete 3 ou 4 com o valor novo e os mesmos botões.

## 7. Cancelar

> Beleza, não salvei nada e a foto já foi apagada.

## 8. Não deu pra ler

> Não consegui ler. Tira de novo com o documento inteiro na tela, com luz e sem reflexo. Se preferir, manda pelo app: {link}

## 9. Imagem sem contexto (sem convite aceito, print de frete etc.)

> Recebi uma imagem. Se for sua *CNH* ou o *CRLV*, posso ler e preencher seu cadastro — não guardo a foto nem o CPF. Se for um frete, me manda em texto: rota e valor.

Botões: `Pode ler` · `Era um frete`.

## Campos gravados

- CNH → `motoristas`: `nome`, `cnh_numero`, `cnh_vencimento`, `cnh_categoria` (novo).
- CRLV → `caminhao_perfil`: `marca`, `modelo`, `ano`, `numero_eixos`, `carga_maxima_toneladas`,
  `placa`, `renavam`, `crlv_exercicio` (novos). `tipo_veiculo` só por sugestão + botão.
