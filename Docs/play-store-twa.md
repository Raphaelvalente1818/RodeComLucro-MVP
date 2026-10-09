# Rode com Lucro na Google Play — guia (09/10/2026)

Pedido do Raphael: abrir a conta no Google Play e publicar o app, que "só abre o link".
No Android isso é o caminho oficial: **Trusted Web Activity (TWA)** — um app Android
mínimo que abre o site em tela cheia, sem barra do Chrome, e que se atualiza sozinho
toda vez que o site muda (push na Vercel = app novo, sem resubmeter). Decisão de
05/10 (status-sessao) confirmada; este guia é o passo a passo.

## 0. Três decisões antes de começar

### 0.1 Conta pessoal ou de organização?

| | Pessoal | Organização (CNPJ) |
|---|---|---|
| Custo | US$ 25, uma vez | US$ 25, uma vez |
| Verificação | identidade do titular (documento + às vezes selfie) | D-U-N-S da empresa (grátis, Dun & Bradstreet; dias a semanas) + documento da empresa + identidade do responsável |
| **Teste fechado obrigatório** | **sim: 12 testadores inscritos por 14 dias seguidos** antes de poder pedir produção (contas criadas após 13/11/2023) | não (fontes secundárias; conferir no próprio Console) |
| Nome na loja | nome da pessoa | nome da empresa |
| Transferência depois | possível, burocrática | — |

**Recomendação: organização**, se vocês têm CNPJ (Sofrete/Rode com Lucro). O nome na
loja fica o da empresa, não "Raphael Valente Gomes", e não há a exigência dos 12
testadores — que, de todo modo, a gente cumpriria com a semeadura (Emerson/David → 15
colegas cada). Se o D-U-N-S atrasar, dá pra abrir pessoal e transferir depois, mas é
retrabalho. Desde 30/09/2026 o Google também exige verificação de identidade de todo
desenvolvedor novo no Brasil — vale ter RG/CNH do responsável em mãos.

### 0.2 Domínio próprio ANTES de publicar

Hoje o app vive em `rode-com-lucro-mvp.vercel.app`. A TWA é amarrada ao domínio (o
`assetlinks.json` fica nele; mudar de domínio = publicar versão nova do app e refazer
a verificação). Publicar na loja apontando pra um `.vercel.app` é ruim de imagem e
cria dívida. **Recomendação: comprar `rodecomlucro.com.br` (ou `.app`) e apontar na
Vercel antes do passo 2.** Registro.br ~R$ 40/ano; na Vercel é só adicionar o domínio
no projeto e criar o CNAME. Depois disso, atualizar `URL_APP` nas Edge Functions e nos
links do bot.

### 0.3 Service worker (offline de verdade)

O app não tem service worker: sem sinal ele nem abre (a fila offline só guarda
gravações). A TWA funciona sem SW, mas (a) o Chrome só considera "instalável" com SW,
(b) o Google Play pode enquadrar um app que é "só o site" na política de
funcionalidade mínima, e (c) caminhoneiro em posto sem sinal é o nosso cenário.
**Recomendação: adicionar `vite-plugin-pwa` (meia hora)** — cache do shell + ícones +
fontes, estratégia network-first. Entra junto com a Barlow local (pendência antiga).

## 1. Abrir a conta (Raphael, ~30 min + espera da verificação)

1. Entrar em https://play.google.com/console com a conta Google da empresa (criar uma
   `apps@…` ou usar a do Workspace; não usar conta pessoal de alguém que pode sair).
2. Escolher **Organização**. Preencher nome legal (igual ao cartão CNPJ), endereço,
   telefone, e-mail de contato (fica público na loja), site.
3. **D-U-N-S**: se não tiver, pedir grátis em https://www.dnb.com/duns (pesquisar o
   CNPJ primeiro — muitas empresas já têm). O nome no D-U-N-S tem que bater com o do
   documento da empresa; há limite de tentativas pra digitar o número.
4. Pagar US$ 25 (cartão internacional).
5. Verificação: documento da organização (cartão CNPJ/contrato social) + identidade
   do responsável. Prazo típico: 2 a 7 dias; D-U-N-S novo pode levar até 30.
6. Enquanto espera: criar a página de **Política de Privacidade** (obrigatória, URL
   pública — hoje só temos `/termos`; precisa de `/privacidade` dizendo o que
   guardamos: telefone, nome, CNH nº/validade/categoria, placa, cálculos; que não
   guardamos foto nem CPF; base LGPD; contato pra exclusão = SAIR).

## 2. Gerar o app (eu faço, ~2 h)

Ferramenta: **Bubblewrap** (do Google) — `npm i -g @bubblewrap/cli`. Pede JDK 17 e
Android SDK (ele baixa sozinho na primeira vez).

```
bubblewrap init --manifest https://rodecomlucro.com.br/manifest.webmanifest
```

Respostas que vou dar: package `br.com.rodecomlucro.app`, nome "Rode com Lucro",
cor `#0B0E0D`, ícone 512 maskable (já existe), launcher "standalone", orientação
"portrait", sem splash customizado além da cor. Ele gera o projeto Android e um
**keystore** (guardar a senha — sem ele não dá pra atualizar o app nunca mais; vai
pro cofre de senhas, não pro repo).

```
bubblewrap build
```

Sai um `app-release-bundle.aab` (é o que a Play aceita) e o `app-release-signed.apk`
(pra testar no celular por USB antes de subir).

### 2.1 `assetlinks.json` (o que tira a barra do Chrome)

Arquivo em `apps/web/public/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "br.com.rodecomlucro.app",
    "sha256_cert_fingerprints": ["<SHA-256 da chave de assinatura>"]
  }
}]
```

Atenção: com **Play App Signing** (padrão), quem assina o app que vai pro celular é o
Google, com outra chave. O SHA-256 certo é o de **Play Console → Configuração → Integridade
do app → Certificado da chave de assinatura do app** — só aparece depois do primeiro
upload. Ordem: upload → copiar SHA-256 → publicar o `assetlinks.json` → testar. Pode
ter duas fingerprints no arquivo (a do Google e a do keystore local, pra testar o APK
por USB). Conferir em https://developers.google.com/digital-asset-links/tools/generator.

### 2.2 App Links pro link mágico `?t=`

O bot manda `https://…/resultado/<id>?t=<token>`. Com o `assetlinks.json` no ar e o
`intent-filter` que o Bubblewrap já gera pro domínio, o Android abre esse link **dentro
do app** (logado) em vez do navegador. Sem isso o toque no link do WhatsApp abre o
Chrome deslogado — a armadilha anotada em 05/10. Testar: tocar no link de um cálculo
do bot com o app instalado.

## 3. Ficha da loja (Raphael + eu, ~1 h)

- **Nome**: Rode com Lucro. **Descrição curta** (80): "Saiba se o frete vale a pena
  antes de aceitar — custo real, lucro e piso ANTT." **Descrição longa**: o que o
  app faz (cálculo, cotação, cargas perto, cadastro pela foto, bot no WhatsApp), pra
  quem é, grátis.
- **Ícone** 512×512 (temos). **Gráfico de destaque** 1024×500 (fazer — caminhão + faixa
  amarela + nome). **Capturas de tela**: mínimo 2 de celular (Garagem, Calcular,
  Resultado, Fretes — os prints do iPhone servem, mas o ideal é do Android).
- **Categoria**: Negócios (ou Produtividade). **Contato**: e-mail, site, política de
  privacidade.
- **Classificação de conteúdo**: questionário (sem violência, sem compras) → Livre.
- **Segurança dos dados** (formulário obrigatório): coletamos telefone, nome, dados
  da CNH e do veículo, localização aproximada (cidade digitada — não GPS), dados de
  uso; criptografados em trânsito; usuário pode pedir exclusão (SAIR / e-mail).
  Dizer a verdade aqui — reprovação por inconsistência é comum.
- **Público-alvo**: 18+. **Anúncios**: não. **Preço**: grátis.

## 4. Testar e publicar

1. **Teste interno** (até 100 e-mails, sem revisão): subir o `.aab`, instalar nos
   celulares de Raphael/Emerson/David/Rapha pela Play. Conferir: abre sem barra do
   Chrome; link `?t=` do bot abre dentro do app; ícone e splash; voltar com o botão
   do Android.
2. **Teste fechado** (se conta pessoal: 12 testadores × 14 dias; se organização, opcional
   mas recomendado): usar a semeadura — os colegas do Emerson e do David entram por
   um link de inscrição e já viram usuários reais. Vale como campanha, não só como
   exigência.
3. **Produção**: pedir acesso → revisão do Google (horas a alguns dias na primeira
   vez) → no ar. Depois disso, mudanças no site aparecem no app sem nova submissão;
   só mexer na Play de novo se mudar domínio, nome, ícone ou pedir permissões.

## 5. Riscos e como a gente lida

- **Rejeição por "funcionalidade mínima / só um webview"**: mitigado por ser PWA
  completo (offline com SW, instalável, cadastro, cálculo) e pela descrição honesta.
  Se acontecer, o recurso é responder à revisão apontando as funções.
- **Reviews públicos**: não entrar na loja antes de os testes da semeadura estarem
  limpos (decisão de 05/10 mantida). Hoje o bot está estável (v81, 69 cenários), o
  app ganhou a navegação por abas; falta o SW e o domínio.
- **Keystore perdido** = app morto. Guardar em dois lugares.
- **Apple**: fora por enquanto (diretriz 4.2); iPhone segue como PWA em tela cheia.

## Ordem sugerida

1. Raphael: domínio + conta Play (organização) + D-U-N-S — hoje, pra esperar a
   verificação em paralelo.
2. Eu: `/privacidade`, service worker + Barlow local, `assetlinks.json`, Bubblewrap,
   gráfico de destaque — 1 dia.
3. Teste interno com os 4 → fechado com a semeadura → produção.

Fontes: [Requisitos de teste para novas contas pessoais (Ajuda do Play Console)](https://support.google.com/googleplay/android-developer/answer/14151465?hl=pt-BR), [Verificação de identidade do desenvolvedor (Play Console)](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en), [Verificação de contas de organização — D-U-N-S (PDF oficial)](https://play.google.com/console/about/static/pdf/Verifying_your_Play_Console_developer_account_for_organizations.pdf), [Trusted Web Activities (developer.android.com)](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities), [Bubblewrap (GoogleChromeLabs)](https://github.com/GoogleChromeLabs/bubblewrap), [Comparativo conta pessoal × organização 2026](https://12testerhive.com/blog/google-play-personal-vs-organization-developer-account), [Verificação de desenvolvedores 2026 — prazos por país](https://testerbee.com/blog/google-play-developer-verification-2026).
