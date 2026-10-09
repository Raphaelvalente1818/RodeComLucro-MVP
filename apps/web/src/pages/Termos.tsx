// apps/web/src/pages/Termos.tsx
//
// Termos de Uso (09/10/2026) — texto base, estrutura inspirada nos termos de
// marketplaces de frete do mercado (plataforma intermediária, veracidade dos
// anúncios, bloqueio por mau uso, planos e arrependimento), escrito nas nossas
// palavras e adaptado ao que o Rode com Lucro faz: cálculo, cotação, fretes
// publicados pelas empresas (Sofrete), assistente no WhatsApp, plano PRO.
// Placeholders em colchetes são do Raphael. Base pra revisão jurídica — não
// substitui advogado.

import PaginaLegal from '../components/PaginaLegal';

export const TERMOS_VERSAO = '1.0 — 09/10/2026';

export default function Termos() {
  return (
    <PaginaLegal titulo="Termos de Uso" versao={TERMOS_VERSAO}>
      <p>
        Estes termos regulam o uso do <b>Rode com Lucro</b> (aplicativo e assistente no WhatsApp) e do <b>Sofrete</b> (portal
        onde empresas publicam fretes), operados por <b>[RAZÃO SOCIAL]</b>, CNPJ <b>[CNPJ]</b> ("nós"). Ao usar qualquer um
        deles — inclusive mandando a primeira mensagem para o nosso número de WhatsApp — você concorda com estes termos e com
        a <a href="/privacidade">Política de Privacidade</a>, que faz parte deles. Se não concordar, não use o serviço.
      </p>

      <h2>1. O que o serviço é (e o que não é)</h2>
      <p>
        O Rode com Lucro é uma ferramenta de <b>apoio à decisão</b> do motorista autônomo: calcula o custo estimado de uma
        viagem com os dados do seu caminhão, compara com o valor ofertado e com o piso mínimo da ANTT, cota rotas, mostra
        fretes publicados por empresas perto de você e preenche seu cadastro a partir da foto dos seus documentos.
      </p>
      <p>
        Nós <b>não somos transportadora, agenciadora nem parte do contrato de frete</b>. Não negociamos, não intermediamos
        pagamento, não garantimos o pagamento do frete pela empresa, não verificamos a carga e não prestamos aconselhamento
        jurídico, contábil ou financeiro. O veredito ("bom", "aceitável", "ruim") é uma estimativa baseada nos números que
        você informou e em fontes públicas; a decisão de aceitar ou não um frete é sua.
      </p>

      <h2>2. Quem pode usar</h2>
      <p>
        Maiores de 18 anos. Motoristas usam o aplicativo e o WhatsApp; empresas (transportadoras, embarcadores,
        agenciadoras) usam o Sofrete para publicar fretes, após cadastro com CNPJ e aprovação nossa. A conta é pessoal e
        identificada pelo seu número de celular; você responde pelo que for feito com ela e deve nos avisar se perder o
        número.
      </p>

      <h2>3. Seus compromissos</h2>
      <ul>
        <li>Informar dados verdadeiros (caminhão, custos, documentos, cidade). Resultado bom depende de entrada boa.</li>
        <li>Não usar o serviço para fins ilícitos, não enviar documentos de terceiros sem autorização, não publicar frete falso, duplicado ou com valor abaixo do mínimo legal.</li>
        <li>Não copiar, extrair ou revender os fretes, contatos e demais dados do serviço, manualmente ou por robô; não tentar burlar limites, invadir ou sobrecarregar o sistema.</li>
        <li>Tratar com respeito as empresas e motoristas com quem entrar em contato pela plataforma.</li>
      </ul>

      <h2>4. Fretes publicados pelas empresas</h2>
      <p>
        A empresa que publica é a única responsável pela veracidade, disponibilidade e valor do frete e pelo cumprimento da
        legislação (inclusive o piso mínimo da ANTT e o CIOT). Podemos pausar ou remover anúncios incompletos, repetidos,
        suspeitos ou denunciados, e suspender a empresa. O telefone de contato exibido é o informado pela própria empresa;
        antes de fechar um frete, confirme a existência da carga, a identidade de quem contrata e as condições de pagamento.
        Nunca faça adiantamentos por pedido de desconhecidos.
      </p>

      <h2>5. Planos e pagamento</h2>
      <p>
        O uso básico é <b>gratuito</b>, com limites (por exemplo, número de consultas por dia no WhatsApp e de fretes exibidos
        por busca). O plano <b>Rode com Lucro PRO</b>, quando disponível, é uma assinatura mensal paga por cartão, cobrada pelo
        Stripe em página própria dele, que amplia esses limites conforme descrito no momento da contratação. Você pode cancelar
        a qualquer momento pelo portal do assinante (comando PLANO no WhatsApp ou botão no aplicativo); o acesso PRO segue até
        o fim do período já pago e não há cobrança seguinte. Nos primeiros 7 dias após a primeira contratação, você pode
        desistir com reembolso integral (Código de Defesa do Consumidor, art. 49). Se uma cobrança falhar, tentamos de novo por
        alguns dias e avisamos; persistindo, o plano volta ao gratuito. Preços podem ser reajustados com aviso prévio de 30
        dias, valendo a partir da renovação seguinte.
      </p>

      <h2>6. Dados, documentos e privacidade</h2>
      <p>
        O que coletamos, por quê e como apagar está na <a href="/privacidade">Política de Privacidade</a>. Em resumo: fotos de
        CNH e CRLV são lidas e descartadas na hora; não guardamos CPF; mandar <b>SAIR</b> no WhatsApp apaga sua conta e seus
        dados.
      </p>

      <h2>7. Disponibilidade e limites de responsabilidade</h2>
      <p>
        O serviço é oferecido "como está". Fazemos o possível para mantê-lo no ar e correto, mas ele depende de terceiros
        (WhatsApp/Meta, Google, Supabase, Anthropic, Stripe) e pode falhar, ficar indisponível ou apresentar imprecisão —
        distância, pedágio e piso ANTT são estimativas de fontes públicas que mudam. Na extensão permitida pela lei, não
        respondemos por lucros cessantes, prejuízos de fretes aceitos ou recusados com base nas estimativas, nem por
        negócios feitos entre motoristas e empresas. Nada aqui afasta direitos que o Código de Defesa do Consumidor garante.
      </p>

      <h2>8. Bloqueio e encerramento</h2>
      <p>
        Podemos limitar, suspender ou encerrar contas que violem estes termos, com gravidade progressiva (aviso, bloqueio
        temporário, desativação), inclusive contas ligadas por telefone, placa ou CNPJ a uma conta desativada. Você pode
        encerrar a sua a qualquer momento (SAIR no WhatsApp ou pelo aplicativo).
      </p>

      <h2>9. Propriedade intelectual</h2>
      <p>
        A marca Rode com Lucro, o Sofrete, o aplicativo, o assistente, os textos e o motor de cálculo são nossos. Você recebe
        uma licença pessoal, gratuita (ou conforme o plano), não exclusiva e revogável para usar o serviço; não pode copiar,
        modificar, fazer engenharia reversa ou criar produto derivado. Os dados que você informa continuam seus; você nos
        autoriza a usá-los para prestar o serviço e, de forma agregada e anônima, para estatísticas e melhoria.
      </p>

      <h2>10. Mudanças nestes termos</h2>
      <p>
        Podemos atualizar estes termos. Mudanças relevantes serão avisadas pelo aplicativo ou pelo WhatsApp com antecedência;
        continuar usando depois do aviso significa aceitar a nova versão. A versão vigente está sempre no topo desta página.
      </p>

      <h2>11. Lei e foro</h2>
      <p>
        Aplica-se a lei brasileira. Fica eleito o foro da comarca de <b>[CIDADE/UF]</b>, salvo o direito do consumidor de
        escolher o foro do seu domicílio. Dúvidas e solicitações: <b>[E-MAIL]</b> ou pelo nosso WhatsApp.
      </p>
    </PaginaLegal>
  );
}
