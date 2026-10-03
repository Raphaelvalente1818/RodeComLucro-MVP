// supabase/functions/wa-webhook/extracao.ts
//
// Leitura da mensagem do motorista (WhatsApp, português coloquial) via
// Claude Haiku — só entra quando a mensagem não bate os intents por regex
// (SAIR/BUSCAR/ajuda, ver index.ts). Usa "tool use" (function calling) em
// vez de pedir JSON solto: a IA só preenche campos de um schema validado,
// nunca decide o veredito nem executa nada — o motor de cálculo (calc.ts)
// continua a única fonte de verdade do resultado.
//
// 30/09/2026 — Camadas 2 e 3: a IA CLASSIFICA a intenção, lê origem e tipo
// de carga numa busca e escreve a resposta livre quando não é sobre frete.
//
// 02/10/2026 — teste do Rapha (01/10, 9 furos, ver Docs/status-sessao.md):
// - intent "cotar": rota SEM valor ("quanto posso cobrar?", "qual a
//   distância/pedágio/ANTT?") — o bot negava uma capacidade que tem;
// - intent "pergunta_calculo": pergunta sobre o último cálculo ("quanto de
//   pedágio?") — a IA recebe o último resultado como contexto e responde;
// - tipo_veiculo / numero_eixos / tipo_carroceria ditos na mensagem
//   ("truck grade baixa", "carreta LS 6 eixos") — antes eram ignorados;
// - contexto da conversa (já se apresentou? último cálculo?) pra não
//   repetir "Opa! Sou o Rode com Lucro" e pra responder acompanhamentos.
//
// Sem ANTHROPIC_API_KEY configurada: retorna null (mesmo padrão de
// enviarMensagemWhatsapp() no index.ts — feature pendente de chave, não erro).

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODELO = "claude-haiku-4-5";

export type IntentMensagem = "calcular" | "cotar" | "buscar" | "pergunta_calculo" | "pergunta_bot" | "saudacao" | "outro";

/** Tipos de carga que o motorista costuma citar numa busca; mapeados pra carroceria em index.ts. */
export type TipoCargaBusca = "container" | "frigorificada" | "granel" | "liquido" | "carga_geral" | "veiculos";

/** Mesmos valores do CHECK de caminhao_perfil.tipo_veiculo (packages/rode-calc tiposCaminhao.ts). */
export const TIPOS_VEICULO = [
  "Carreta", "Carreta LS", "Vanderléia", "Carreta 4º eixo", "Bitrem 7 eixos", "Bitrem 9 eixos", "Rodotrem",
  "Truck", "BiTruck", "Fiorino", "VLC", "3/4", "Toco",
] as const;
export type TipoVeiculoMsg = (typeof TIPOS_VEICULO)[number];

/** Mesmos valores do CHECK de caminhao_perfil.tipo_carroceria. */
export const TIPOS_CARROCERIA = [
  "Graneleiro", "Grade baixa", "Prancha", "Caçamba", "Plataforma", "Sider", "Baú", "Baú Frigorífico", "Baú Refrigerado",
  "Silo", "Cegonheiro", "Gaiola", "Tanque", "Bug Porta Container", "Munk", "Apenas Cavalo", "Cavaqueira", "Hoper",
] as const;
export type TipoCarroceriaMsg = (typeof TIPOS_CARROCERIA)[number];

/** Eixos típicos por tipo — usado quando o motorista diz o tipo mas não os eixos. */
export const EIXOS_PADRAO: Record<TipoVeiculoMsg, number> = {
  Carreta: 5, "Carreta LS": 6, "Vanderléia": 6, "Carreta 4º eixo": 6, "Bitrem 7 eixos": 7, "Bitrem 9 eixos": 9, Rodotrem: 9,
  Truck: 3, BiTruck: 4, Fiorino: 2, VLC: 2, "3/4": 2, Toco: 2,
};

/** O que o index.ts já sabe sobre essa conversa, pra IA não repetir apresentação nem recalcular o que acabou de sair. */
export interface ContextoConversa {
  /** Já mandou a apresentação pra esse número antes. */
  jaApresentado: boolean;
  /** Tem caminhão cadastrado (tipo/eixos) — se não, a IA sabe que o cálculo é genérico. */
  caminhaoCadastrado: string | null;
  /** Último cálculo/cotação desse motorista, pra responder "e o pedágio?". */
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
    quandoMinutos: number;
  } | null;
}

export interface ExtracaoFrete {
  intent: IntentMensagem;
  /** Compatibilidade com o pipeline antigo. */
  ePedidoDeFrete: boolean;
  ePedidoDeBusca: boolean;
  origem: string | null;
  destino: string | null;
  valorFreteReais: number | null;
  voltaVazia: boolean;
  tipoCarga: TipoCargaBusca | null;
  /** Caminhão dito NA MENSAGEM ("truck grade baixa", "carreta LS 6 eixos"). Null se não citou. */
  tipoVeiculo: TipoVeiculoMsg | null;
  numeroEixos: number | null;
  tipoCarroceria: TipoCarroceriaMsg | null;
  /** pergunta_calculo / pergunta_bot / saudacao / outro: resposta pronta (uma mensagem). */
  respostaLivre: string | null;
  confiancaOrigem: number;
  confiancaDestino: number;
  confiancaValor: number;
}

const SYSTEM_PROMPT = `Você é o "Rode com Lucro", assistente no WhatsApp para caminhoneiros autônomos brasileiros. Você lê a mensagem do motorista e preenche a ferramenta "ler_mensagem". Nunca responda fora da ferramenta.

O QUE O RODE COM LUCRO FAZ:
1. AVALIA uma oferta: motorista manda rota + valor ("Sinop pra Santos, 14 mil") → custo real da viagem (diesel, Arla, pedágio, manutenção, pneus, alimentação), lucro, margem, piso mínimo ANTT e veredito (BOM / ACEITÁVEL / RUIM).
2. COTA uma rota sem valor: motorista pergunta "quanto posso cobrar de X pra Y?", "qual a distância / pedágio / piso ANTT de X pra Y?" → o sistema informa km, pedágio, custo real, piso ANTT e o valor mínimo pra ele ter a margem dele. SIM, o sistema CONSULTA distância, pedágio e tabela ANTT — nunca diga que não faz isso.
3. BUSCA cargas disponíveis perto dele ("BUSCAR", "tem carga saindo de Cuiabá?").
4. RESPONDE perguntas sobre o último cálculo que ele recebeu ("quanto de pedágio?", "e o diesel?", "quantos dias?") — os números vêm no CONTEXTO abaixo.
O cálculo usa o caminhão dele (tipo, eixos, consumo), cadastrado em 3 toques no próprio WhatsApp; se ele disser o caminhão na mensagem, o sistema usa esse. Existe um app (link vem nas respostas) com histórico e mais fretes. Pra apagar o cadastro, manda SAIR. É grátis.
O que NÃO faz: não fecha frete, não negocia com a empresa, não faz pagamento, não rastreia carga, não consulta multa/CNH/documento, não tem atendimento humano, não sabe o preço de mercado que outros estão pagando (só o custo dele e o piso ANTT).

CLASSIFIQUE em UM intent:
- "calcular": oferta concreta com VALOR em reais pra avaliar (rota + valor). Extraia origem, destino, valor_frete_reais, volta_vazia, confianças.
- "cotar": rota SEM valor — quer saber quanto cobrar, ou distância/pedágio/piso ANTT/custo de uma rota. Extraia origem e destino. Se faltar origem ou destino, deixe null (o sistema pergunta).
- "buscar": quer VER cargas disponíveis, sem valor pra avaliar. Extraia origem (de onde quer sair; "daqui" = null), destino, tipo_carga.
- "pergunta_calculo": pergunta sobre o último cálculo do CONTEXTO (pedágio, diesel, dias, margem, piso, "e se voltar vazio?", "por que ruim?"). Só se existir ultimo_calculo no contexto; senão trate como "cotar" (se tiver rota) ou "outro".
- "pergunta_bot": o que você é/faz, pra que serve, como funciona, é grátis, quem está por trás.
- "saudacao": só "oi", "bom dia", "opa", "tudo bem?", sem pedido.
- "outro": qualquer outra coisa (fora do escopo, reclamação, spam, mensagem pra outra pessoa).

CAMINHÃO NA MENSAGEM (qualquer intent): se ele citar o veículo, preencha tipo_veiculo com UM destes valores exatos: Carreta, Carreta LS, Vanderléia, Carreta 4º eixo, Bitrem 7 eixos, Bitrem 9 eixos, Rodotrem, Truck, BiTruck, Fiorino, VLC, 3/4, Toco. Sinônimos: "LS"/"carreta LS"="Carreta LS"; "bitrem"="Bitrem 7 eixos" (9 se disser 9 eixos); "truck"/"truque"="Truck"; "bitruck"="BiTruck"; "toco"="Toco"; "3/4"/"três quartos"="3/4"; "cavalo"/"carreta"/"semi-reboque"="Carreta". numero_eixos: só se ele disser o número ("6 eixos"). tipo_carroceria: UM destes, se citar: Graneleiro, Grade baixa, Prancha, Caçamba, Plataforma, Sider, Baú, Baú Frigorífico, Baú Refrigerado, Silo, Cegonheiro, Gaiola, Tanque, Bug Porta Container, Munk, Apenas Cavalo, Cavaqueira, Hoper. "palete"/"paletizado" não é carroceria (null). Nunca invente: sem menção = null.

RESPOSTA LIVRE (só pra pergunta_calculo, pergunta_bot, saudacao, outro; nos demais = null):
- Uma mensagem, até 400 caracteres, português de motorista, direto, sem formalidade, sem "como posso ajudar".
- Se o contexto diz ja_apresentado=true, NÃO se apresente de novo (não escreva "Sou o Rode com Lucro"); comece direto ("Opa!" ou direto na resposta). Só se apresente quando ja_apresentado=false.
- pergunta_calculo: responda com os NÚMEROS do contexto (ex.: "Pedágio nesse trecho: R$ 412,00, já tá dentro do custo de R$ 10.215,22"). Formato R$ 1.234,56. Não recalcule nada, não invente número que não está no contexto; se o que ele perguntou não está lá, diga que não tem essa quebra e o que tem.
- pergunta_bot/saudacao: diga o que faz (os 4 itens, resumido) e termine com UM exemplo concreto: 'manda a rota e o valor (ex.: *"Sinop pra Santos, 14 mil"*), ou só a rota pra eu cotar, ou *BUSCAR*'.
- outro: diga em uma frase que não faz isso, sem inventar, e termine com o exemplo acima.
- Spam/mensagem pra outra pessoa: "Opa! Acho que essa mensagem não era pra mim — sou um assistente pra caminhoneiro. Se quiser saber se um frete vale a pena, manda a rota e o valor."
- NUNCA termine com pergunta de sim/não ("quer testar?"). Termine com o exemplo.
- Formatação do WhatsApp: *negrito* com asterisco simples. No máximo 1 emoji.

Extração:
- origem/destino: cidade (e UF se dita), como ele escreveu — não invente UF.
- valor_frete_reais: "8 mil"→8000, "R$ 4.500"→4500, "3500 reais"→3500. null se não mencionou.
- volta_vazia: true SÓ se disser que volta vazio.
- tipo_carga (busca): container / frigorificada / granel / liquido / veiculos / carga_geral; null se não citou.
- confianca_*: 0 a 1. Em busca/pergunta/outro, 0.`;

const FERRAMENTA_LEITURA = {
  name: "ler_mensagem",
  description: "Classifica a mensagem do motorista e extrai os dados de frete, o caminhão citado ou a resposta livre.",
  input_schema: {
    type: "object",
    properties: {
      intent: { type: "string", enum: ["calcular", "cotar", "buscar", "pergunta_calculo", "pergunta_bot", "saudacao", "outro"] },
      origem: { type: ["string", "null"] },
      destino: { type: ["string", "null"] },
      valor_frete_reais: { type: ["number", "null"] },
      volta_vazia: { type: "boolean" },
      tipo_carga: { type: ["string", "null"], enum: ["container", "frigorificada", "granel", "liquido", "carga_geral", "veiculos", null] },
      tipo_veiculo: { type: ["string", "null"], enum: [...TIPOS_VEICULO, null] },
      numero_eixos: { type: ["integer", "null"] },
      tipo_carroceria: { type: ["string", "null"], enum: [...TIPOS_CARROCERIA, null] },
      resposta_livre: { type: ["string", "null"] },
      confianca_origem: { type: "number" },
      confianca_destino: { type: "number" },
      confianca_valor: { type: "number" },
    },
    required: [
      "intent", "origem", "destino", "valor_frete_reais", "volta_vazia", "tipo_carga",
      "tipo_veiculo", "numero_eixos", "tipo_carroceria", "resposta_livre",
      "confianca_origem", "confianca_destino", "confianca_valor",
    ],
  },
};

const INTENTS: IntentMensagem[] = ["calcular", "cotar", "buscar", "pergunta_calculo", "pergunta_bot", "saudacao", "outro"];
const TIPOS_CARGA: TipoCargaBusca[] = ["container", "frigorificada", "granel", "liquido", "carga_geral", "veiculos"];

function normalizar(input: Record<string, unknown>, contexto: ContextoConversa): ExtracaoFrete {
  let intent = INTENTS.includes(input.intent as IntentMensagem) ? (input.intent as IntentMensagem) : "outro";
  // pergunta_calculo sem cálculo no contexto não existe — vira "outro" (a IA já escreveu a resposta).
  if (intent === "pergunta_calculo" && !contexto.ultimoCalculo) intent = "outro";
  const tipoCarga = TIPOS_CARGA.includes(input.tipo_carga as TipoCargaBusca) ? (input.tipo_carga as TipoCargaBusca) : null;
  const tipoVeiculo = (TIPOS_VEICULO as readonly string[]).includes(input.tipo_veiculo as string) ? (input.tipo_veiculo as TipoVeiculoMsg) : null;
  const tipoCarroceria = (TIPOS_CARROCERIA as readonly string[]).includes(input.tipo_carroceria as string) ? (input.tipo_carroceria as TipoCarroceriaMsg) : null;
  const eixosBruto = typeof input.numero_eixos === "number" ? Math.round(input.numero_eixos) : null;
  const numeroEixos = eixosBruto != null && eixosBruto >= 2 && eixosBruto <= 9 ? eixosBruto : null;
  const respostaBruta = typeof input.resposta_livre === "string" ? input.resposta_livre.trim() : "";
  const conversa = intent === "pergunta_calculo" || intent === "pergunta_bot" || intent === "saudacao" || intent === "outro";
  return {
    intent,
    ePedidoDeFrete: intent === "calcular",
    ePedidoDeBusca: intent === "buscar",
    origem: typeof input.origem === "string" && input.origem.trim() ? input.origem.trim() : null,
    destino: typeof input.destino === "string" && input.destino.trim() ? input.destino.trim() : null,
    valorFreteReais: typeof input.valor_frete_reais === "number" && input.valor_frete_reais > 0 ? input.valor_frete_reais : null,
    voltaVazia: Boolean(input.volta_vazia),
    tipoCarga,
    tipoVeiculo,
    numeroEixos,
    tipoCarroceria,
    // Teto duro: o prompt pede ≤400, mas quem paga a mensagem somos nós.
    respostaLivre: conversa && respostaBruta ? respostaBruta.slice(0, 600) : null,
    confiancaOrigem: typeof input.confianca_origem === "number" ? input.confianca_origem : 0,
    confiancaDestino: typeof input.confianca_destino === "number" ? input.confianca_destino : 0,
    confiancaValor: typeof input.confianca_valor === "number" ? input.confianca_valor : 0,
  };
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

/** Contexto em texto, curto, pra ir junto da mensagem (a IA lê como dado, não como instrução). */
function descreverContexto(c: ContextoConversa): string {
  const linhas: string[] = [`ja_apresentado=${c.jaApresentado}`, `caminhao_cadastrado=${c.caminhaoCadastrado ?? "nenhum (cálculo genérico, carreta 5 eixos)"}`];
  const u = c.ultimoCalculo;
  if (u) {
    const custos = Object.entries(u.custos)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k} ${fmtBRL(v)}`)
      .join(", ");
    linhas.push(
      `ultimo_calculo (há ${u.quandoMinutos} min): ${u.origem} → ${u.destino}, ${u.distanciaKm.toFixed(0)} km, ${u.dias} dia(s), caminhão ${u.eixos} eixos; ` +
        (u.valorFrete != null ? `valor ofertado ${fmtBRL(u.valorFrete)}; ` : `sem valor (cotação); `) +
        `custo total ${fmtBRL(u.custoTotal)} (${custos}); ` +
        (u.lucro != null ? `lucro ${fmtBRL(u.lucro)}, margem ${u.margemReal?.toFixed(1)}%; ` : "") +
        `piso ANTT ${fmtBRL(u.pisoANTT)}` +
        (u.veredicto ? `; veredito ${u.veredicto}` : ""),
    );
  } else {
    linhas.push("ultimo_calculo=nenhum");
  }
  return linhas.join("\n");
}

export async function extrairFreteDeTexto(texto: string, contexto: ContextoConversa): Promise<ExtracaoFrete | null> {
  if (!ANTHROPIC_API_KEY) {
    // eslint-disable-next-line no-console
    console.log(`[wa-webhook] extração de frete pulada (ANTHROPIC_API_KEY pendente): "${texto}"`);
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
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `<contexto>\n${descreverContexto(contexto)}\n</contexto>\n<mensagem_do_motorista>\n${texto}\n</mensagem_do_motorista>`,
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
    const blocos = (dados.content ?? []) as Array<{ type: string; input?: Record<string, unknown> }>;
    const bloco = blocos.find((b) => b.type === "tool_use");
    if (!bloco?.input) return null;
    return normalizar(bloco.input, contexto);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[wa-webhook] extração lançou exceção", e);
    return null;
  }
}
