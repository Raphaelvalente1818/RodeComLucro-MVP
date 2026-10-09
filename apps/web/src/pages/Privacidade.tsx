// apps/web/src/pages/Privacidade.tsx
//
// Política de Privacidade (09/10/2026) — texto base escrito a partir do que o
// sistema REALMENTE faz (ver Docs/status-sessao.md). Placeholders em colchetes
// são do Raphael. Rota pública /privacidade, fora da barra de abas. Obrigatória
// pra Google Play (Docs/play-store-twa.md) e pro Stripe. Base pra revisão
// jurídica — não substitui advogado.

import PaginaLegal from '../components/PaginaLegal';

export const PRIVACIDADE_VERSAO = '1.0 — 09/10/2026';

export default function Privacidade() {
  return (
    <PaginaLegal titulo="Política de Privacidade" versao={PRIVACIDADE_VERSAO}>
      <p>
        Esta política explica quais dados o <b>Rode com Lucro</b> coleta, por que coleta, com quem compartilha e como você
        controla isso. Ela vale para o aplicativo (rode-com-lucro-mvp.vercel.app), para o assistente no WhatsApp e para o
        portal Sofrete. O controlador dos dados é <b>[RAZÃO SOCIAL]</b>, CNPJ <b>[CNPJ]</b>, com sede em <b>[ENDEREÇO]</b>.
        Contato do encarregado de dados (DPO): <b>[E-MAIL]</b>.
      </p>

      <h2>1. Quais dados coletamos</h2>
      <p>
        <b>Para criar e identificar sua conta:</b> seu número de telefone celular. No WhatsApp, a conta nasce na primeira
        mensagem que você manda para o nosso número; no aplicativo, pelo código de verificação enviado por WhatsApp ou SMS.
        Não pedimos senha.
      </p>
      <p>
        <b>Que você nos informa:</b> nome, cidade base, cidade onde está agora, dados do caminhão (tipo, eixos, carroceria,
        marca, modelo, ano, placa, RENAVAM, ano do licenciamento, capacidade) e custos operacionais (preço do diesel, consumo,
        manutenção, pneus, depreciação, alimentação, pernoite, margem desejada), além da validade da CNH, categoria, número
        da CNH e validade do exame toxicológico, se você quiser receber alertas de vencimento.
      </p>
      <p>
        <b>Lidos da foto da CNH e do CRLV, quando você envia:</b> apenas nome, categoria, validade e número da CNH; marca,
        modelo, ano, placa, RENAVAM, eixos, capacidade, carroceria e ano de exercício do CRLV. <b>A imagem é processada e
        descartada na hora — não guardamos a foto.</b> Não lemos nem guardamos CPF, RG, filiação, chassi, endereço ou foto
        do rosto. Enviar o documento é a sua autorização para essa leitura.
      </p>
      <p>
        <b>Gerados pelo uso:</b> as rotas e valores que você pede para calcular, o resultado de cada cálculo (custo, lucro,
        piso ANTT, veredito), as buscas de frete, as mensagens trocadas com o assistente no WhatsApp (guardadas por até 7 dias
        para o assistente lembrar a conversa) e registros técnicos de uso (data, hora, tela ou comando usado, erros).
      </p>
      <p>
        <b>Pagamento (plano PRO, quando disponível):</b> os dados do cartão são informados diretamente ao Stripe, em página
        dele; nunca passam pelos nossos servidores. Guardamos apenas o identificador do cliente, o status da assinatura e as
        datas de cobrança.
      </p>
      <p>
        <b>Não coletamos</b> localização por GPS (a cidade é a que você digita), contatos do seu telefone, nem dados de
        terceiros além do nome e telefone de contato dos fretes publicados pelas empresas no Sofrete.
      </p>

      <h2>2. Para que usamos</h2>
      <p>
        Para calcular se um frete vale a pena com os custos do seu caminhão; cotar rotas; mostrar fretes publicados perto de
        você e compatíveis com seu veículo; preencher seu cadastro pela foto dos documentos; avisar sobre vencimento de CNH,
        exame e licenciamento; manter o histórico das suas análises; operar o plano PRO; medir o uso e corrigir erros do
        serviço; e cumprir obrigações legais. Base legal: execução do serviço que você pediu (art. 7º, V, LGPD), legítimo
        interesse em melhorar e proteger o serviço (art. 7º, IX) e, para a leitura de documentos, o seu consentimento
        (art. 7º, I), registrado no momento do envio da foto.
      </p>

      <h2>3. Com quem compartilhamos</h2>
      <p>Não vendemos seus dados. Usamos fornecedores que processam dados em nosso nome, só para o serviço funcionar:</p>
      <ul>
        <li><b>Supabase</b> (banco de dados e autenticação; servidores no Canadá).</li>
        <li><b>Vercel</b> (hospedagem do aplicativo).</li>
        <li><b>Meta / WhatsApp Business</b> (envio e recebimento das mensagens no WhatsApp e do código de verificação).</li>
        <li><b>Anthropic</b> (inteligência artificial que interpreta suas mensagens e lê a foto dos documentos; não usa seus dados para treinar modelos).</li>
        <li><b>Google</b> (distância e pedágio da rota — recebe apenas as cidades de origem e destino).</li>
        <li><b>Stripe</b> (cobrança do plano PRO, quando disponível).</li>
      </ul>
      <p>
        Alguns desses fornecedores ficam fora do Brasil; a transferência internacional é feita com base em cláusulas
        contratuais e nos padrões de segurança deles (art. 33, LGPD). Também podemos compartilhar dados se a lei ou uma
        autoridade exigir.
      </p>
      <p>
        <b>Fretes publicados por empresas:</b> ao analisar ou abrir um frete, você vê o nome da empresa e o telefone de contato
        que ela publicou. Nós não informamos à empresa quem visualizou o frete.
      </p>

      <h2>4. Por quanto tempo guardamos</h2>
      <p>
        Enquanto sua conta existir. Mensagens do WhatsApp usadas como memória do assistente: 7 dias. Códigos de verificação e
        links de acesso: minutos ou horas, conforme o caso. Registros técnicos: até 12 meses. Dados de cobrança: pelo prazo
        fiscal exigido em lei (5 anos). Depois da exclusão da conta, mantemos apenas o que a lei obriga.
      </p>

      <h2>5. Seus direitos e como exercer</h2>
      <p>
        Você pode confirmar o que temos, acessar, corrigir, pedir a exclusão, a portabilidade e revogar consentimentos
        (art. 18, LGPD). <b>Para apagar tudo, basta mandar a palavra SAIR para o nosso número no WhatsApp</b> — conta,
        caminhão, cálculos e cadastro são apagados na hora. No aplicativo, use "Apagar dados" em Caminhão, ou escreva para{' '}
        <b>[E-MAIL]</b>. Respondemos em até 15 dias. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>6. Segurança</h2>
      <p>
        Dados trafegam criptografados (HTTPS). O acesso ao banco é restrito por regras que só permitem a cada motorista ver os
        próprios dados. Fotos de documentos não são armazenadas. Mesmo assim, nenhum sistema é 100% seguro; se houver incidente
        que afete você, avisaremos conforme a lei.
      </p>

      <h2>7. Crianças e adolescentes</h2>
      <p>O serviço é para motoristas profissionais e destina-se a maiores de 18 anos.</p>

      <h2>8. Mudanças nesta política</h2>
      <p>
        Quando mudar algo relevante, avisaremos pelo aplicativo ou pelo WhatsApp e atualizaremos a versão no topo desta
        página. O uso continuado após o aviso significa que você está de acordo.
      </p>
    </PaginaLegal>
  );
}
