# Comunidade dos Caminhoneiros — premissas e decisão de interligar

Resumo de 09/10/2026 (Raphael + Claude) pra discussão com o Rapha. Base: a "Comunidade
Escolar" (comunidade-escolar-rode-com-lucro.vercel.app), feita pra ser replicada em escolas
e igrejas, personalizada pro mundo do caminhão.

## O que é

Um lugar fechado, só de caminhoneiros verificados, onde cada um tem sua página e seus
anúncios, pede e dá indicação (mecânico, borracheiro, posto, agregado, caminhão à venda),
avalia serviço com nota e marca encontro na estrada. Não é OLX nem Mercado Livre: aqui tem
pessoa, confiança e quem indicou.

## Premissas

1. **Login único** — a conta do Rode com Lucro (telefone) é a conta da comunidade.
2. **Lançar depois de 300 motoristas** — antes disso é cidade fantasma.
3. **Verificação em duas camadas** — CNH lida por foto (já existe no bot) + recomendação de
   um colega (tabela `indicacao`, já existe). Recomendação fortalece as "estrelas".
4. **Só caminhoneiro** — atmosfera e interesses do caminhão; oficina, seguradora e revenda
   entram como anunciantes, não como membros.
5. **Grátis pra entrar, ler, pedir indicação, avaliar e anunciar o básico.** Decidido em
   09/10: comunidade não fica atrás do PRO.
6. **Receita**: propaganda paga de empresas (oficina, pneu, seguro, revenda) + PRO libera
   destaque (anúncio no topo, página com selo, mais anúncios).
7. **Pedido de indicação é o coração** — "alguém conhece borracheiro em Uberaba?" com
   resposta gravada, nota e quem indicou.
8. **Encontro** — quem está na mesma cidade/posto hoje (usa a `cidade_atual` que o bot já
   captura), encontros em eventos.

## Ajustes propostos pelo Claude (pra bater o martelo)

- Estrela com lastro: recomendação pesa pelo peso de quem recomenda (CNH lida, fretes
  calculados, indicações feitas). Sem isso vira panelinha.
- Avaliação só depois de contato pela plataforma (pediu o telefone do mecânico → dias
  depois "como foi?"). É o que a OLX não consegue copiar.
- Semente antes de abrir: 50 anúncios e 100 indicações reais plantados por nós.

## Vantagens de interligar os dois projetos

- **Segundo loop viral** — anúncio e pedido de indicação são o que mais se encaminha em
  grupo de WhatsApp; reaproveita o link `wa.me/<bot>?text=... #<quem indicou>` do frete.
- **Confiança vira produto** — golpe de caminhão usado é epidemia (anúncio clonado, falso
  intermediário). "Anúncio do Zé, CNH conferida, indicado pelo Emerson" é diferencial real.
- **Motivo pra abrir o app sem frete** — retenção; hoje o motorista só entra pra calcular.
- **Receita que não depende do PRO** — propaganda paga.
- **Mesma fundação** — conta, CNH, indicação, cidade atual já existem; não se reconstrói nada.
- **Canal pra Sofrete** — embarcador e marcas falando com motorista verificado.

## Desvantagens / riscos

- **Foco** — o gargalo hoje é aquisição (gate 1/160). Comunidade amplifica, não resolve.
- **Cidade fantasma** — abrir cedo demais queima a primeira impressão. Daí o gatilho de 300.
- **Moderação** — golpe de frete e de caminhão aparece no primeiro mês; precisa denúncia e
  banimento rápidos, e alguém olhando.
- **LGPD** — avaliação pública de pessoa física e página de membro exigem regra nos Termos;
  continuamos sem guardar CPF nem imagem de documento.
- **Dois produtos pra manter** — se a comunidade virar outro app com outro login, concorre
  com a nossa própria atenção. Só faz sentido com login único e mesma base.
- **Semente** — sem anúncio ninguém compartilha anúncio; o começo é trabalho manual nosso.

## Ordem proposta

1. Agora: nada no app. Fechar o viral em curso (compartilhar frete acabou de subir).
2. Em paralelo, na Comunidade Escolar: "organização" genérica e validação de membro
   trocável (escola valida por lista; caminhoneiro por CNH + indicação). Serve pras
   escolas e pra nós.
3. Com 300 motoristas e a comunidade com diretório e anúncios funcionando: aba "Colegas"
   no app, mesmo login, mesmas categorias de caminhão, anúncio compartilhável pelo WhatsApp.
