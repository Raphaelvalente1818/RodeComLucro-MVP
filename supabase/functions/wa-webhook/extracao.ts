// supabase/functions/wa-webhook/extracao.ts
//
// A ÚNICA porta de entendimento do bot (consolidação de 08/10/2026).
// Toda mensagem de texto que não é comando exato (SAIR, CADASTRO, AJUDA,
// BUSCAR, VINCULAR) passa por aqui: o Haiku recebe o estado da conversa —
// o que o bot está esperando (`pendencia`), último cálculo, histórico — e
// devolve UMA estrutura: intent + dados extraídos + (se houver pendência) a
// ação que o motorista quis. O código executa; a IA nunca grava, nunca
// calcula, nunca inventa valor.
//
// Princípio (decisão do Raphael, 08/10): "IA interpreta, código executa".
// Antes havia cinco "porteiros" com regex antes da IA (onboarding, cidade
// em dúvida, origem da busca, consentimento, correção da leitura) — cada
// um com seus buracos ("tá tudo errado, só o nome está certo" caía em
// "Não entendi o campo"). Eles viraram `pendencia` + `acao`.
//
// Regras do prompt: escrever como ESPECIFICAÇÃO em seções, não como lista
// de exceções. Bug novo = cenário novo em Docs/testes-bot.md + linha na
// seção certa daqui, não um "ATENÇÃO:" no fim.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODELO = "claude-haiku-4-5";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export type IntentMensagem = "calcular" | "cotar" | "buscar" | "pergunta_calculo" | "pergunta_bot" | "saudacao" | "cadastro" | "outro";
export type TipoCargaBusca = "container" | "frigorificada" | "granel" | "liquido" | "carga_geral" | "veiculos";

export const TIPOS_VEICULO = [
  "Carreta", "Carreta LS", "Vanderléia", "Carreta 4º eixo", "Bitrem 7 eixos", "Bitrem 9 eixos", "Rodotrem",
  "Truck", "BiTruck", "Fiorino", "VLC", "3/4", "Toco",
] as const;
export type TipoVeiculoMsg = (typeof TIPOS_VEICULO)[number];

export const TIPOS_CARROCERIA = [
  "Graneleiro", "Grade baixa", "Prancha", "Caçamba", "Plataforma", "Sider", "Baú", "Baú Frigorífico", "Baú Refrigerado",
  "Silo", "Cegonheiro", "Gaiola", "Tanque", "Bug Porta Container", "Munk", "Apenas Cavalo", "Cavaqueira", "Hoper",
] as const;
export type TipoCarroceriaMsg = (typeof TIPOS_CARROCERIA)[number];

export const EIXOS_PADRAO: Record<TipoVeiculoMsg, number> = {
  Carreta: 5, "Carreta LS": 6, Vanderléia: 6, "Carreta 4º eixo": 6, "Bitrem 7 eixos": 7, "Bitrem 9 eixos": 9, Rodotrem: 9,
  Truck: 3, BiTruck: 4, Fiorino: 2, VLC: 2, "3/4": 2, Toco: 2,
};

/** O que o bot está esperando do motorista agora (no máximo uma coisa). */
export type Pendencia =
  | { tipo: "onboarding_caminhao"; etapa: "tipo" | "eixos" | "consumo"; opcoes: string[] }
  | { tipo: "cidade_em_duvida"; campo: "origem" | "destino"; texto: string; candidatos: string[] }
  | { tipo: "busca_origem"; candidatos: string[] }
  | { tipo: "consentimento_documento" }
  | { tipo: "aguardando_foto"; faltam: string }
  | { tipo: "confirmar_leitura"; documento: "cnh" | "crlv"; leitura: Record<string, string | number | null> }
  | { tipo: "tipo_veiculo_crlv"; opcoes: string[] };

export type AcaoPendencia = "nenhuma" | "escolher" | "confirmar" | "corrigir" | "reler" | "cancelar" | "pular_para_crlv" | "aceitar" | "recusar";

export interface ContextoConversa {
  jaApresentado: boolean;
  primeiroNome: string | null;
  caminhaoCadastrado: string | null;
  ultimoCalculo: {
    origem: string;
    destino: string;
    distanciaKm: number;
    valorFrete: number | null;
    custoTotal: number;
    custos: Record<string, number>;
    lucro: number | null;
    margemReal: number | null;
    pisoANTT: number;
    veredicto: string | null;
    dias: number;
    eixos: number;
    voltaVazia: boolean;
    /** O que entrou na conta (08/10): pra IA responder "quanto usei de diesel?" com o dado, não com chute. */
    insumos: {
      dieselPrecoLitro: number | null;
      consumoKmPorLitro: number | null;
      manutencaoPorKm: number | null;
      pneusPorKm: number | null;
      depreciacaoPorKm: number | null;
    };
    quandoMinutos: number;
  } | null;
  /** O cálculo imediatamente anterior ao último (08/10): pra comparar "por que ficou menor?" com os dois na mão. */
  calculoAnterior: ContextoConversa["ultimoCalculo"];
  ultimaFalha: { origem: string | null; destino: string | null; motivo: string; quandoMinutos: number } | null;
  cadastroFoto: { cnhSalva: boolean; crlvSalvo: boolean } | null;
  historico: Array<{ papel: "motorista" | "bot"; texto: string }>;
  pendencia: Pendencia | null;
}

export interface Correcoes {
  nome?: string | null;
  categoria?: string | null;
  validade?: string | null;
  numero?: string | null;
  placa?: string | null;
  renavam?: string | null;
  eixos?: number | null;
  capacidade_t?: number | null;
  ano?: number | null;
  marca?: string | null;
  modelo?: string | null;
  exercicio?: number | null;
}

export interface ExtracaoFrete {
  intent: IntentMensagem;
  ePedidoDeFrete: boolean;
  ePedidoDeBusca: boolean;
  origem: string | null;
  destino: string | null;
  valorFreteReais: number | null;
  valorPorToneladaReais: number | null;
  toneladas: number | null;
  /** "diesel a 6,50", "óleo tá 7 reais": preço do litro dito na mensagem (08/10). */
  dieselPrecoLitro: number | null;
  /** "faz 2,3 por litro", "2,5 km/l": consumo dito na mensagem. */
  consumoKmPorLitro: number | null;
  voltaVazia: boolean;
  tipoCarga: TipoCargaBusca | null;
  tipoVeiculo: TipoVeiculoMsg | null;
  numeroEixos: number | null;
  tipoCarroceria: TipoCarroceriaMsg | null;
  respostaLivre: string | null;
  confiancaOrigem: number;
  confiancaDestino: number;
  confiancaValor: number;
  /** Resposta à pendência (só faz sentido quando contexto.pendencia existe). */
  acao: AcaoPendencia;
  opcaoEscolhida: string | null;
  correcoes: Correcoes | null;
}

// ---------------------------------------------------------------------------
// Prompt — especificação em seções
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Você é o "Rode com Lucro", assistente no WhatsApp para caminhoneiros autônomos brasileiros. Você lê a mensagem do motorista e preenche a ferramenta "ler_mensagem". Nunca responda fora da ferramenta. Você INTERPRETA; o sistema EXECUTA (calcula, grava, busca). Você nunca inventa número, data, placa ou cidade.

## 1. O que o Rode com Lucro faz
1. AVALIA uma oferta (rota + valor): custo real, lucro, margem, piso ANTT, veredito BOM/ACEITÁVEL/RUIM.
2. COTA uma rota sem valor: km, pedágio, custo, piso ANTT e quanto cobrar. O sistema CONSULTA distância, pedágio e ANTT — nunca diga que não faz isso.
3. BUSCA cargas perto dele ("BUSCAR", "tem carga saindo de Cuiabá?").
4. RESPONDE sobre o último cálculo (pedágio, diesel, dias, margem) com os números do contexto.
5. PREENCHE O CADASTRO pela foto/PDF da CNH (nome, categoria, validade) e do CRLV (marca, placa, eixos, capacidade) — dois documentos, uma foto cada. Não guarda foto nem CPF. Comando: CADASTRO. Não invente quantidades ("3 fotos") nem passos que não existem.
Usa o caminhão dele (cadastrado em 3 toques aqui mesmo, ou dito na mensagem). Tem app com histórico (link vem nas respostas). SAIR apaga o cadastro. É grátis.
NÃO faz: fechar frete, negociar, pagar, rastrear, consultar multa/pontos, validar documento, atendimento humano, preço de mercado.

## 2. Como o motorista escreve
Sem acento, abreviado, com erro: "truk", "qnto", "saino", "sto andre", "15mil", "4,5 mil", "180 o ton". Entenda tudo isso. Copie cidades LETRA POR LETRA como ele escreveu (o sistema corrige grafia e UF) — nunca "corrija" nem acrescente acento. Se ele escreveu a UF junto ("sao carlos sp", "sto andre sp", "bom jesus pi"), mantenha a UF na cidade: "sao carlos sp" — nunca solte o "sp".

## 3. Histórico e pendência
<historico> traz as últimas trocas. A mensagem atual quase sempre responde à ÚLTIMA fala do bot — use pra entender "sim", "esse mesmo", "já mandei", "e o outro?", um número solto, um nome de cidade solto. Nunca repita apresentação ou instrução que já está no histórico.
<contexto> pode trazer "pendencia": o que o bot está ESPERANDO agora. Se a mensagem responde à pendência, preencha "acao" (seção 5) e deixe intent "outro" com resposta_livre null — o sistema responde. Se a mensagem muda de assunto (manda um frete, pergunta outra coisa), acao="nenhuma" e classifique normalmente; a pendência fica de lado.

## 4. Intent (escolha UM)
- "calcular": oferta com VALOR (rota + valor). Também recálculo: "e se pagar 3500?", "e voltando vazio?", "e com 6 eixos?" — repita origem/destino do ultimo_calculo, ponha o valor/volta/eixos novos, resposta_livre null. Nunca estime de cabeça.
- "cotar": rota SEM valor (quanto cobrar, km, pedágio, piso). Falta origem ou destino → null (o sistema pergunta).
- "buscar": quer ver cargas. origem = de onde quer sair ("daqui" = null), tipo_carga se citou. Com pendencia busca_origem, um lugar solto ("Santo André", "quero sair do ABC paulista") é buscar com origem = o lugar como escrito.
- "pergunta_calculo": pergunta sobre o ultimo_calculo (pedágio, diesel, dias, margem, piso, "por que ruim?") — só se existir ultimo_calculo. Responda com os NÚMEROS do contexto, formato R$ 1.234,56; sem recalcular; o que não está lá, diga que não tem.
  Se existe ultima_falha e ele pergunta "por que não conseguiu?": intent "outro", explique o motivo do contexto e peça a correção. Nunca "consegui sim".
- "cadastro": quer mandar foto/PDF da CNH ou CRLV, preencher/atualizar cadastro ("posso tirar foto da minha cnh?"). resposta_livre null.
- "pergunta_bot": o que você é/faz, é grátis, como funciona.
- "saudacao": três casos, três respostas:
  · ABERTURA ("oi", "bom dia", "opa", "e aí") de quem já foi apresentado → cumprimenta (com o primeiro nome, se houver) e abre as duas portas numa frase só, SEMPRE com o exemplo e a palavra *BUSCAR*: "Bom dia, Raphael! Quer ver se um frete vale a pena (ex.: *São Bernardo pra Rio, 5.600*) ou buscar carga perto de você (*BUSCAR*)?". Se há algo pendente no contexto (CRLV faltando, cálculo recente), ofereça isso no lugar de uma das portas ("Quer mandar o CRLV agora, ou tem frete pra avaliar?"). Abertura de quem NÃO foi apresentado → apresentação (seção 8).
  · FECHAMENTO/agradecimento ("vlw", "obrigado", "show", "tamo junto") → uma linha, sem porta: "Tamo junto! Qualquer frete, manda."
  · PRIMEIRO CONTATO POR INDICAÇÃO ("recebi seu contato do João", "me indicaram você", "vi seu cartão no grupo") → quem indicou (João) é OUTRA pessoa, não o motorista: comece "Opa! Que bom que o João te passou meu contato." e se apresente. Nunca chame o motorista pelo nome do indicador. Nunca é spam.
- "outro": fora do escopo, spam claramente pra outra pessoa ("oi mãe, chego às 8"), reclamação, ou resposta a pendência.

## 5. Ação sobre a pendência (só quando contexto.pendencia existe e a mensagem responde a ela)
- onboarding_caminhao: ele responde o tipo/eixos/consumo em texto ("carreta", "6", "uns 2 e meio", "faz 2,3") → acao "escolher", opcao_escolhida = o valor normalizado (tipo exato da lista; eixos como "6"; consumo como "2.5").
- cidade_em_duvida / busca_origem: ele escolhe um candidato ou escreve outra cidade → "escolher", opcao_escolhida = o candidato exato (Nome/UF) ou a cidade como ele escreveu.
- consentimento_documento: "pode", "bora", "sim", "manda" → "aceitar"; "não", "depois", "agora não" → "recusar".
- confirmar_leitura (o bot mostrou o que leu da CNH/CRLV — valores em contexto.pendencia.leitura):
  · "tá certo", "sim", "salva", "isso" → "confirmar".
  · Ele dá o valor certo de um ou mais campos ("placa ABC1D23", "validade 23/03/2035", "o nome é João da Silva", "são 6 eixos") → "corrigir", correcoes com SÓ os campos que ele deu, no formato: validade AAAA-MM-DD, placa sem hífen maiúscula, numero só dígitos, categoria A/B/C/D/E/AB…, eixos/ano/exercicio inteiros, capacidade_t número.
  · Ele diz que está errado SEM dar o valor certo ("leu errado", "tá tudo errado", "a data tá errada, só o nome tá certo") → "reler" (o sistema pede a foto de novo). Nunca invente o valor.
  · "esquece", "cancela", "deixa pra lá" → "cancelar".
  · "vou mandar o do cavalo", "esquece a CNH, manda o CRLV", "deixa a CNH pra depois" → "pular_para_crlv".
- tipo_veiculo_crlv: ele responde Carreta / Carreta LS / Bitrem → "escolher", opcao_escolhida = o tipo exato.
- aguardando_foto não tem ação: se ele diz "já mandei" e o contexto mostra que nada foi lido, intent "outro" com resposta "Não chegou nada que desse pra ler — manda de novo, foto ou PDF". Nunca diga que já fez um cadastro que o contexto mostra como não feito; nunca diga que não lê documento.

## 6. Caminhão na mensagem (qualquer intent)
tipo_veiculo com UM valor exato: Carreta, Carreta LS, Vanderléia, Carreta 4º eixo, Bitrem 7 eixos, Bitrem 9 eixos, Rodotrem, Truck, BiTruck, Fiorino, VLC, 3/4, Toco. Sinônimos: "LS"=Carreta LS; "bitrem"=Bitrem 7 eixos (9 se disser); "truck"/"truk"/"truque"=Truck; "bitruck"=BiTruck; "cavalo"/"carreta"/"semi-reboque"=Carreta. numero_eixos só se ele disser. tipo_carroceria com UM valor exato da lista: Graneleiro, Grade baixa, Prancha, Caçamba, Plataforma, Sider, Baú, Baú Frigorífico, Baú Refrigerado, Silo, Cegonheiro, Gaiola, Tanque, Bug Porta Container, Munk, Apenas Cavalo, Cavaqueira, Hoper. "palete" não é carroceria. Sem menção = null.

## 7. Valores
valor_frete_reais: "8 mil"→8000, "4,5 mil"→4500, "R$ 4.500"→4500, "15mil"→15000. Valor POR TONELADA ("180 a tonelada", "180/t", "180 o ton") → valor_por_tonelada_reais, valor_frete_reais null. Tonelagem dita ("32 ton", "vou com 30 toneladas", ou só "37" quando o bot perguntou toneladas) → toneladas. volta_vazia true SÓ se disser que volta vazio. Preço do diesel dito ("diesel a 6,50", "óleo tá 7", "com diesel a 15,00") → diesel_preco_litro (reais por litro). Consumo dito ("faz 2,3 por litro", "2,5 km/l") → consumo_km_por_litro. "E se o diesel for 7?" / "com diesel a 6,50" sobre o último cálculo = RECÁLCULO: intent calcular, rota e valor do ultimo_calculo, diesel_preco_litro novo, resposta_livre null. confianca_* 0..1 (0 em busca/pergunta/outro).

## 8. Resposta livre (só pergunta_calculo, pergunta_bot, saudacao, outro; nos demais null)
- Até 400 caracteres, português de motorista, direto, sem "como posso ajudar".
- Nome: se o contexto tem nome_motorista, use o primeiro nome onde uma pessoa usaria (saudação, confirmação, notícia) — não em toda frase. NUNCA apelidos ("brother", "chefe", "amigão", "parceiro").
- ja_apresentado=true → não se apresente de novo. false → "Sou o Rode com Lucro…" com o que faz (5 itens, resumido) e UM exemplo: 'manda a rota e o valor (ex.: *"Sinop pra Santos, 14 mil"*), ou só a rota pra eu cotar, ou *BUSCAR*'.
- NÚMEROS: só os que estão no contexto (ultimo_calculo, calculo_anterior e seus "insumos usados"). "Quanto usei de diesel?" → o valor em insumos. Preço do diesel na cidade, valor de mercado, dado que não está no contexto → diga que não tem e peça o dado ("manda o preço que eu recalculo"). NUNCA invente um valor nem uma causa: se ele pergunta por que um cálculo mudou, compare os dois cálculos do contexto insumo por insumo (ex.: "antes diesel R$ 6,10/L, agora R$ 6,03/L — por isso caiu R$ 25"); se não dá pra ver a diferença nos dados, diga isso.
- cadastro_por_foto no contexto e ele pergunta do cadastro ("fez?", "e o CRLV?"): responda SÓ com o que está lá — o que foi salvo e o que falta.
- Spam: "Opa! Acho que essa mensagem não era pra mim — sou um assistente pra caminhoneiro. Se quiser saber se um frete vale a pena, manda a rota e o valor."
- Nunca termine com pergunta de sim/não. *negrito* com asterisco simples. No máximo 1 emoji.`;

const FERRAMENTA_LEITURA = {
  name: "ler_mensagem",
  description: "Interpreta a mensagem do motorista: intent, dados de frete, caminhão citado, resposta livre e, se houver pendência, a ação.",
  input_schema: {
    type: "object",
    properties: {
      intent: { type: "string", enum: ["calcular", "cotar", "buscar", "pergunta_calculo", "pergunta_bot", "saudacao", "cadastro", "outro"] },
      origem: { type: ["string", "null"] },
      destino: { type: ["string", "null"] },
      valor_frete_reais: { type: ["number", "null"] },
      valor_por_tonelada_reais: { type: ["number", "null"] },
      toneladas: { type: ["number", "null"] },
      diesel_preco_litro: { type: ["number", "null"] },
      consumo_km_por_litro: { type: ["number", "null"] },
      volta_vazia: { type: "boolean" },
      tipo_carga: { type: ["string", "null"], enum: ["container", "frigorificada", "granel", "liquido", "carga_geral", "veiculos", null] },
      tipo_veiculo: { type: ["string", "null"], enum: [...TIPOS_VEICULO, null] },
      numero_eixos: { type: ["integer", "null"] },
      tipo_carroceria: { type: ["string", "null"], enum: [...TIPOS_CARROCERIA, null] },
      resposta_livre: { type: ["string", "null"] },
      confianca_origem: { type: "number" },
      confianca_destino: { type: "number" },
      confianca_valor: { type: "number" },
      acao: { type: "string", enum: ["nenhuma", "escolher", "confirmar", "corrigir", "reler", "cancelar", "pular_para_crlv", "aceitar", "recusar"] },
      opcao_escolhida: { type: ["string", "null"] },
      correcoes: {
        type: ["object", "null"],
        properties: {
          nome: { type: ["string", "null"] }, categoria: { type: ["string", "null"] }, validade: { type: ["string", "null"] }, numero: { type: ["string", "null"] },
          placa: { type: ["string", "null"] }, renavam: { type: ["string", "null"] }, eixos: { type: ["integer", "null"] }, capacidade_t: { type: ["number", "null"] },
          ano: { type: ["integer", "null"] }, marca: { type: ["string", "null"] }, modelo: { type: ["string", "null"] }, exercicio: { type: ["integer", "null"] },
        },
      },
    },
    required: [
      "intent", "origem", "destino", "valor_frete_reais", "volta_vazia", "tipo_carga",
      "tipo_veiculo", "numero_eixos", "tipo_carroceria", "resposta_livre",
      "confianca_origem", "confianca_destino", "confianca_valor", "acao",
    ],
  },
};

const INTENTS: IntentMensagem[] = ["calcular", "cotar", "buscar", "pergunta_calculo", "pergunta_bot", "saudacao", "cadastro", "outro"];
const TIPOS_CARGA: TipoCargaBusca[] = ["container", "frigorificada", "granel", "liquido", "carga_geral", "veiculos"];
const ACOES: AcaoPendencia[] = ["nenhuma", "escolher", "confirmar", "corrigir", "reler", "cancelar", "pular_para_crlv", "aceitar", "recusar"];

function normalizar(input: Record<string, unknown>, contexto: ContextoConversa): ExtracaoFrete {
  let intent = INTENTS.includes(input.intent as IntentMensagem) ? (input.intent as IntentMensagem) : "outro";
  if (intent === "pergunta_calculo" && !contexto.ultimoCalculo) intent = "outro";
  const tipoCarga = TIPOS_CARGA.includes(input.tipo_carga as TipoCargaBusca) ? (input.tipo_carga as TipoCargaBusca) : null;
  const tipoVeiculo = (TIPOS_VEICULO as readonly string[]).includes(input.tipo_veiculo as string) ? (input.tipo_veiculo as TipoVeiculoMsg) : null;
  const tipoCarroceria = (TIPOS_CARROCERIA as readonly string[]).includes(input.tipo_carroceria as string) ? (input.tipo_carroceria as TipoCarroceriaMsg) : null;
  const eixosBruto = typeof input.numero_eixos === "number" ? Math.round(input.numero_eixos) : null;
  const numeroEixos = eixosBruto != null && eixosBruto >= 2 && eixosBruto <= 9 ? eixosBruto : null;
  const respostaBruta = typeof input.resposta_livre === "string" ? input.resposta_livre.trim() : "";
  const conversa = intent === "pergunta_calculo" || intent === "pergunta_bot" || intent === "saudacao" || intent === "outro";
  // Ação só existe se há pendência; sem pendência, "nenhuma" — a IA não manda no fluxo sozinha.
  const acao = contexto.pendencia && ACOES.includes(input.acao as AcaoPendencia) ? (input.acao as AcaoPendencia) : "nenhuma";
  const correcoesBrutas = input.correcoes && typeof input.correcoes === "object" ? (input.correcoes as Record<string, unknown>) : null;
  const correcoes: Correcoes | null = correcoesBrutas
    ? {
        nome: typeof correcoesBrutas.nome === "string" ? correcoesBrutas.nome.trim().slice(0, 80) : null,
        categoria: typeof correcoesBrutas.categoria === "string" ? correcoesBrutas.categoria : null,
        validade: typeof correcoesBrutas.validade === "string" ? correcoesBrutas.validade : null,
        numero: typeof correcoesBrutas.numero === "string" ? correcoesBrutas.numero : null,
        placa: typeof correcoesBrutas.placa === "string" ? correcoesBrutas.placa : null,
        renavam: typeof correcoesBrutas.renavam === "string" ? correcoesBrutas.renavam : null,
        eixos: typeof correcoesBrutas.eixos === "number" ? Math.round(correcoesBrutas.eixos) : null,
        capacidade_t: typeof correcoesBrutas.capacidade_t === "number" ? correcoesBrutas.capacidade_t : null,
        ano: typeof correcoesBrutas.ano === "number" ? Math.round(correcoesBrutas.ano) : null,
        marca: typeof correcoesBrutas.marca === "string" ? correcoesBrutas.marca.trim().slice(0, 40) : null,
        modelo: typeof correcoesBrutas.modelo === "string" ? correcoesBrutas.modelo.trim().slice(0, 60) : null,
        exercicio: typeof correcoesBrutas.exercicio === "number" ? Math.round(correcoesBrutas.exercicio) : null,
      }
    : null;
  return {
    intent,
    ePedidoDeFrete: intent === "calcular",
    ePedidoDeBusca: intent === "buscar",
    origem: typeof input.origem === "string" && input.origem.trim() ? input.origem.trim() : null,
    destino: typeof input.destino === "string" && input.destino.trim() ? input.destino.trim() : null,
    valorFreteReais: typeof input.valor_frete_reais === "number" && input.valor_frete_reais > 0 ? input.valor_frete_reais : null,
    valorPorToneladaReais: typeof input.valor_por_tonelada_reais === "number" && input.valor_por_tonelada_reais > 0 ? input.valor_por_tonelada_reais : null,
    toneladas: typeof input.toneladas === "number" && input.toneladas > 0 && input.toneladas < 200 ? input.toneladas : null,
    dieselPrecoLitro: typeof input.diesel_preco_litro === "number" && input.diesel_preco_litro >= 2 && input.diesel_preco_litro <= 20 ? input.diesel_preco_litro : null,
    consumoKmPorLitro: typeof input.consumo_km_por_litro === "number" && input.consumo_km_por_litro >= 0.8 && input.consumo_km_por_litro <= 8 ? input.consumo_km_por_litro : null,
    voltaVazia: Boolean(input.volta_vazia),
    tipoCarga,
    tipoVeiculo,
    numeroEixos,
    tipoCarroceria,
    respostaLivre: conversa && respostaBruta ? respostaBruta.slice(0, 600) : null,
    confiancaOrigem: typeof input.confianca_origem === "number" ? input.confianca_origem : 0,
    confiancaDestino: typeof input.confianca_destino === "number" ? input.confianca_destino : 0,
    confiancaValor: typeof input.confianca_valor === "number" ? input.confianca_valor : 0,
    acao,
    opcaoEscolhida: typeof input.opcao_escolhida === "string" && input.opcao_escolhida.trim() ? input.opcao_escolhida.trim() : null,
    correcoes: acao === "corrigir" ? correcoes : null,
  };
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function descreverPendencia(p: Pendencia): string {
  switch (p.tipo) {
    case "onboarding_caminhao":
      return `pendencia=onboarding_caminhao etapa=${p.etapa} (o bot perguntou ${p.etapa === "tipo" ? "o tipo do caminhão" : p.etapa === "eixos" ? "quantos eixos" : "quantos km por litro"}; opções: ${p.opcoes.join(" | ")})`;
    case "cidade_em_duvida":
      return `pendencia=cidade_em_duvida campo=${p.campo} escrito="${p.texto}" candidatos: ${p.candidatos.join(" | ")} (o bot perguntou qual é)`;
    case "busca_origem":
      return `pendencia=busca_origem (o bot perguntou de que cidade ele quer sair${p.candidatos.length ? `; sugeriu: ${p.candidatos.join(" | ")}` : ""})`;
    case "consentimento_documento":
      return "pendencia=consentimento_documento (o bot perguntou se pode ler a foto da CNH/CRLV: botões Pode ler / Agora não)";
    case "aguardando_foto":
      return `pendencia=aguardando_foto (o bot está esperando a foto/PDF: ${p.faltam})`;
    case "confirmar_leitura":
      return `pendencia=confirmar_leitura documento=${p.documento.toUpperCase()} leitura=${JSON.stringify(p.leitura)} (botões Salvar / Corrigir / Cancelar)`;
    case "tipo_veiculo_crlv":
      return `pendencia=tipo_veiculo_crlv (o bot perguntou se o cavalo é ${p.opcoes.join(" / ")})`;
  }
}

/** Contexto em texto, curto, pra ir junto da mensagem (a IA lê como dado, não como instrução). */
function descreverContexto(c: ContextoConversa): string {
  const linhas: string[] = [
    `ja_apresentado=${c.jaApresentado}`,
    `nome_motorista=${c.primeiroNome ?? "desconhecido"}`,
    `caminhao_cadastrado=${c.caminhaoCadastrado ?? "nenhum (cálculo genérico, carreta 5 eixos)"}`,
  ];
  const descreverCalculo = (rotulo: string, u: NonNullable<ContextoConversa["ultimoCalculo"]>): string => {
    const custos = Object.entries(u.custos).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${fmtBRL(v)}`).join(", ");
    const i = u.insumos;
    const insumos = [
      i.dieselPrecoLitro != null ? `diesel ${fmtBRL(i.dieselPrecoLitro)}/L` : null,
      i.consumoKmPorLitro != null ? `${i.consumoKmPorLitro} km/L` : null,
      i.manutencaoPorKm != null ? `manutenção ${fmtBRL(i.manutencaoPorKm)}/km` : null,
      i.pneusPorKm != null ? `pneus ${fmtBRL(i.pneusPorKm)}/km` : null,
      i.depreciacaoPorKm != null ? `depreciação ${fmtBRL(i.depreciacaoPorKm)}/km` : null,
    ].filter(Boolean).join(", ");
    return (
      `${rotulo} (há ${u.quandoMinutos} min): ${u.origem} → ${u.destino}, ${u.distanciaKm.toFixed(0)} km, ${u.dias} dia(s), caminhão ${u.eixos} eixos${u.voltaVazia ? ", volta vazia" : ""}; ` +
      (u.valorFrete != null ? `valor ofertado ${fmtBRL(u.valorFrete)}; ` : `sem valor (cotação); `) +
      `custo total ${fmtBRL(u.custoTotal)} (${custos}); ` +
      (insumos ? `insumos usados: ${insumos}; ` : "") +
      (u.lucro != null ? `lucro ${fmtBRL(u.lucro)}, margem ${u.margemReal?.toFixed(1)}%; ` : "") +
      `piso ANTT ${fmtBRL(u.pisoANTT)}` +
      (u.veredicto ? `; veredito ${u.veredicto}` : "")
    );
  };
  const u = c.ultimoCalculo;
  if (u) {
    linhas.push(descreverCalculo("ultimo_calculo", u));
    if (c.calculoAnterior) linhas.push(descreverCalculo("calculo_anterior (o de antes do último)", c.calculoAnterior));
  } else {
    linhas.push("ultimo_calculo=nenhum");
  }
  if (c.ultimaFalha) {
    const f = c.ultimaFalha;
    linhas.push(`ultima_falha (há ${f.quandoMinutos} min, DEPOIS do último cálculo): tentou ${f.origem ?? "?"} → ${f.destino ?? "?"} e ${f.motivo}`);
  }
  if (c.cadastroFoto) {
    linhas.push(`cadastro_por_foto: CNH ${c.cadastroFoto.cnhSalva ? "SALVA" : "NÃO lida ainda"}; CRLV ${c.cadastroFoto.crlvSalvo ? "SALVO" : "NÃO lido ainda"}`);
  }
  if (c.pendencia) linhas.push(descreverPendencia(c.pendencia));
  return linhas.join("\n");
}

export async function extrairFreteDeTexto(texto: string, contexto: ContextoConversa): Promise<ExtracaoFrete | null> {
  if (!ANTHROPIC_API_KEY) {
    // eslint-disable-next-line no-console
    console.log(`[wa-webhook] extração pulada (ANTHROPIC_API_KEY pendente): "${texto}"`);
    return null;
  }
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 700,
        // Cache do prompt fixo (08/10): o system é ~2.500 tokens e é a maior parte da conta;
        // com cache ele custa 10% nas chamadas seguintes (TTL 5 min, renova a cada uso).
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content:
              `<contexto>\n${descreverContexto(contexto)}\n</contexto>\n` +
              (contexto.historico.length
                ? `<historico>\n${contexto.historico.map((h) => `${h.papel === "bot" ? "BOT" : "MOTORISTA"}: ${h.texto.replace(/\s+/g, " ").slice(0, 400)}`).join("\n")}\n</historico>\n`
                : "") +
              `<mensagem_do_motorista>\n${texto}\n</mensagem_do_motorista>`,
          },
        ],
        tools: [FERRAMENTA_LEITURA],
        tool_choice: { type: "tool", name: "ler_mensagem" },
      }),
    });
    if (!resp.ok) {
      // eslint-disable-next-line no-console
      console.error("[wa-webhook] extração falhou", resp.status, await resp.text());
      return null;
    }
    const dados = await resp.json();
    const bloco = (dados.content ?? []).find((b: { type: string }) => b.type === "tool_use");
    if (!bloco?.input) return null;
    return normalizar(bloco.input as Record<string, unknown>, contexto);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[wa-webhook] extração lançou exceção", e);
    return null;
  }
}
