// supabase/functions/wa-webhook/extracao.ts
//
// Leitura da mensagem do motorista (WhatsApp, português coloquial) via
// Claude Haiku — só entra quando a mensagem não bate os intents por regex
// (SAIR/BUSCAR/ajuda, ver index.ts). Usa "tool use" (function calling) em
// vez de pedir JSON solto: a IA só preenche campos de um schema validado,
// nunca decide o veredito nem executa nada — o motor de cálculo (calc.ts)
// continua a única fonte de verdade do resultado.
//
// 30/09/2026 — Camadas 2 e 3 da conversa (Docs/status-sessao.md 30/09):
// além de extrair rota/valor, a IA agora CLASSIFICA a intenção (calcular,
// buscar, pergunta sobre o bot, saudação, outro), lê origem e tipo de
// carga num pedido de busca ("tem carga de container saindo de São
// Paulo?") e, quando a mensagem não é sobre frete, já escreve a resposta
// livre — uma chamada só, no tom aprovado pelo Raphael ("Opa! Sou o Rode
// com Lucro"). O index.ts decide se manda essa resposta (limite diário).
//
// Sem ANTHROPIC_API_KEY configurada: retorna null (mesmo padrão de
// enviarMensagemWhatsapp() no index.ts — feature pendente de chave, não
// erro).

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODELO = "claude-haiku-4-5";

export type IntentMensagem = "calcular" | "buscar" | "pergunta_bot" | "saudacao" | "outro";

/** Tipos de carga que o motorista costuma citar numa busca; mapeados pra carroceria em index.ts. */
export type TipoCargaBusca = "container" | "frigorificada" | "granel" | "liquido" | "carga_geral" | "veiculos";

export interface ExtracaoFrete {
  /** Classificação da mensagem. `ePedidoDeFrete`/`ePedidoDeBusca` abaixo derivam dela (compatibilidade com o pipeline). */
  intent: IntentMensagem;
  ePedidoDeFrete: boolean;
  ePedidoDeBusca: boolean;
  origem: string | null;
  destino: string | null;
  valorFreteReais: number | null;
  voltaVazia: boolean;
  /** Só em busca: tipo de carga que ele quer ("container", "frigorificada"…), se citou. */
  tipoCarga: TipoCargaBusca | null;
  /** Só em pergunta_bot/saudacao/outro: a resposta pronta pra mandar (uma mensagem, ≤ 400 chars). */
  respostaLivre: string | null;
  confiancaOrigem: number;
  confiancaDestino: number;
  confiancaValor: number;
}

const SYSTEM_PROMPT = `Você é o "Rode com Lucro", um assistente no WhatsApp para caminhoneiros autônomos brasileiros. Você lê a mensagem do motorista e preenche a ferramenta "ler_mensagem". Nunca responda fora da ferramenta.

O QUE O RODE COM LUCRO FAZ (e só isso):
1. Diz se um frete VALE A PENA: o motorista manda rota e valor (ex.: "Sinop pra Santos, 14 mil") e recebe custo real da viagem (diesel, Arla, pedágio, manutenção, pneus, alimentação), lucro estimado, margem, piso mínimo da ANTT e um veredito (BOM / ACEITÁVEL / RUIM). O cálculo usa o caminhão dele (tipo, eixos, consumo) — ele cadastra em 3 toques pelo próprio WhatsApp.
2. Mostra CARGAS DISPONÍVEIS perto dele: manda "BUSCAR" ou pergunta em texto ("tem carga saindo de Cuiabá?"). Filtra pelo caminhão dele.
Também existe um app (o motorista recebe o link nas respostas) com histórico e mais fretes. Pra apagar o cadastro, manda SAIR. É grátis.
O que NÃO faz: não fecha frete, não negocia, não fala com a empresa, não faz pagamento, não rastreia carga, não consulta multa/CNH/documento, não tem atendimento humano.

CLASSIFIQUE a mensagem em UM intent:
- "calcular": ele tem uma oferta concreta de frete pra avaliar (rota e/ou valor, mesmo informal). Extraia origem, destino, valor_frete_reais, volta_vazia e as confianças.
- "buscar": ele quer VER fretes/cargas disponíveis (com ou sem cidade, com ou sem tipo de carga) e NÃO menciona valor em reais pra avaliar. Ex.: "tem frete?", "tem carga de container saindo de São Paulo?", "o que tem pra Curitiba?". Extraia origem (a cidade de onde ele quer sair, se citou; "daqui"/"aqui" = null), destino (se citou) e tipo_carga (se citou). Na dúvida entre buscar e outro, se cita frete/carga, é buscar.
- "pergunta_bot": ele pergunta o que você é, o que faz, pra que serve, como funciona, se é grátis, se tem custo, quem está por trás, o que consegue fazer.
- "saudacao": só "oi", "bom dia", "opa", "tudo bem?", figurinha descrita, etc., sem pedido.
- "outro": qualquer outra coisa (assunto fora do escopo, reclamação, pergunta sobre outra coisa, mensagem que não é pra você, spam, propaganda).

Pra "pergunta_bot", "saudacao" e "outro", ESCREVA resposta_livre. Regras da resposta:
- Uma mensagem só, no máximo 400 caracteres, português do dia a dia de motorista, sem formalidade e sem "como posso ajudar".
- Abra com "Opa!" (se for saudação ou pergunta_bot, pode ser "Opa! Sou o Rode com Lucro 🚛").
- Responda a pergunta de verdade, só com o que está descrito acima. Se ele pediu algo que você NÃO faz, diga em uma frase que não faz isso, sem inventar funcionalidade nem prometer.
- Termine SEMPRE puxando pra uma das duas ações, com o exemplo: manda a rota e o valor (ex.: *"Sinop pra Santos, 14 mil"*) ou manda *BUSCAR*.
- Se for spam/propaganda/mensagem claramente pra outra pessoa ("Olá Fulana, sou da clínica…"), resposta_livre curta: "Opa! Acho que essa mensagem não era pra mim — sou o Rode com Lucro, um assistente pra caminhoneiro. Se quiser saber se um frete vale a pena, manda a rota e o valor."
- Formatação do WhatsApp: *negrito* com asterisco simples. No máximo 1 emoji.
Pra "calcular" e "buscar", resposta_livre = null.

Extração:
- origem/destino: nome da cidade (e UF se mencionada), como o motorista escreveu — não invente UF.
- valor_frete_reais: converta ("8 mil" -> 8000, "R$ 4.500" -> 4500, "3500 reais" -> 3500). null se não mencionou.
- volta_vazia: true SÓ se ele disser explicitamente que volta vazio/sem carga.
- tipo_carga: "container" (container, contêiner, porta-container), "frigorificada" (frigorífica, refrigerada, congelada, baú frio), "granel" (grão, soja, milho, fertilizante, calcário, graneleiro, caçamba), "liquido" (tanque, combustível, líquido), "veiculos" (cegonha, carros), "carga_geral" (paletizada, sider, baú seco, carga seca). null se não citou.
- confianca_*: de 0 a 1, quão claro cada campo foi. Em busca/pergunta/outro, deixe 0.`;

const FERRAMENTA_LEITURA = {
  name: "ler_mensagem",
  description: "Classifica a mensagem do motorista e extrai os dados de frete ou a resposta livre.",
  input_schema: {
    type: "object",
    properties: {
      intent: { type: "string", enum: ["calcular", "buscar", "pergunta_bot", "saudacao", "outro"] },
      origem: { type: ["string", "null"] },
      destino: { type: ["string", "null"] },
      valor_frete_reais: { type: ["number", "null"] },
      volta_vazia: { type: "boolean" },
      tipo_carga: { type: ["string", "null"], enum: ["container", "frigorificada", "granel", "liquido", "carga_geral", "veiculos", null] },
      resposta_livre: { type: ["string", "null"] },
      confianca_origem: { type: "number" },
      confianca_destino: { type: "number" },
      confianca_valor: { type: "number" },
    },
    required: [
      "intent",
      "origem",
      "destino",
      "valor_frete_reais",
      "volta_vazia",
      "tipo_carga",
      "resposta_livre",
      "confianca_origem",
      "confianca_destino",
      "confianca_valor",
    ],
  },
};

const INTENTS: IntentMensagem[] = ["calcular", "buscar", "pergunta_bot", "saudacao", "outro"];
const TIPOS_CARGA: TipoCargaBusca[] = ["container", "frigorificada", "granel", "liquido", "carga_geral", "veiculos"];

function normalizar(input: Record<string, unknown>): ExtracaoFrete {
  const intent = INTENTS.includes(input.intent as IntentMensagem) ? (input.intent as IntentMensagem) : "outro";
  const tipoCarga = TIPOS_CARGA.includes(input.tipo_carga as TipoCargaBusca) ? (input.tipo_carga as TipoCargaBusca) : null;
  const respostaBruta = typeof input.resposta_livre === "string" ? input.resposta_livre.trim() : "";
  const conversa = intent === "pergunta_bot" || intent === "saudacao" || intent === "outro";
  return {
    intent,
    ePedidoDeFrete: intent === "calcular",
    ePedidoDeBusca: intent === "buscar",
    origem: typeof input.origem === "string" && input.origem.trim() ? input.origem.trim() : null,
    destino: typeof input.destino === "string" && input.destino.trim() ? input.destino.trim() : null,
    valorFreteReais: typeof input.valor_frete_reais === "number" && input.valor_frete_reais > 0 ? input.valor_frete_reais : null,
    voltaVazia: Boolean(input.volta_vazia),
    tipoCarga,
    // Teto duro de tamanho: o prompt pede ≤400, mas quem paga a mensagem
    // somos nós — corta em 600 pra nunca virar textão.
    respostaLivre: conversa && respostaBruta ? respostaBruta.slice(0, 600) : null,
    confiancaOrigem: typeof input.confianca_origem === "number" ? input.confianca_origem : 0,
    confiancaDestino: typeof input.confianca_destino === "number" ? input.confianca_destino : 0,
    confiancaValor: typeof input.confianca_valor === "number" ? input.confianca_valor : 0,
  };
}

export async function extrairFreteDeTexto(texto: string): Promise<ExtracaoFrete | null> {
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
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: texto }],
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
    return normalizar(bloco.input);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[wa-webhook] extração lançou exceção", e);
    return null;
  }
}
