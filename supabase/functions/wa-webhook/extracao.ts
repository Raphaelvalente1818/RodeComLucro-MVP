// supabase/functions/wa-webhook/extracao.ts
//
// Extração de dados de frete a partir de texto livre (WhatsApp) via
// Claude Haiku — só entra quando a mensagem não bate os intents por
// regex (VINCULAR/DESVINCULAR, ver index.ts). Usa "tool use" (function
// calling) em vez de pedir JSON solto: a IA só preenche campos de um
// schema validado, nunca decide o veredito nem executa nada — isso
// mantém o motor de cálculo (calc.ts) como única fonte de verdade do
// resultado, a IA só interpreta o português coloquial do motorista.
//
// Sem ANTHROPIC_API_KEY configurada: retorna null (mesmo padrão de
// enviarMensagemWhatsapp() no index.ts — feature pendente de chave, não
// erro). O TODO(calc-wpp) de "mensagem sem intent reconhecido" só é
// fechado quando essa chave existir.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODELO = "claude-haiku-4-5";

export interface ExtracaoFrete {
  ePedidoDeFrete: boolean;
  /** Pedido pra VER fretes disponíveis (busca), sem oferta concreta em mãos — mutuamente exclusivo com ePedidoDeFrete. Ver detectarIntent() em index.ts pro atalho por regex (sem custo de IA) dos gatilhos mais comuns ("BUSCAR"/"FRETES"); este campo cobre a linguagem natural que o regex não pega. */
  ePedidoDeBusca: boolean;
  origem: string | null;
  destino: string | null;
  valorFreteReais: number | null;
  voltaVazia: boolean;
  confiancaOrigem: number;
  confiancaDestino: number;
  confiancaValor: number;
}

const SYSTEM_PROMPT = `Você extrai dados de pedidos de motoristas brasileiros sobre frete rodoviário, mandados por WhatsApp em português coloquial, para o app "Rode com Lucro". Há dois tipos de pedido possíveis, mutuamente exclusivos:
(1) calcular/avaliar uma oferta de frete concreta que o motorista já tem em mãos (rota + valor);
(2) buscar/ver fretes disponíveis, sem oferta concreta ainda.

Responda SEMPRE usando a ferramenta "extrair_frete".

- e_pedido_de_frete: true só se a mensagem for claramente um pedido do tipo (1) — calcular/avaliar uma oferta concreta (rota + valor, mesmo que informal). false caso contrário.
- e_pedido_de_busca: true só se a mensagem for claramente um pedido do tipo (2) — ex.: "tem frete pra SP?", "quero ver os fretes disponíveis", "buscar frete", "tem carga saindo daqui pra Curitiba?". false caso contrário. Nunca marque e_pedido_de_frete e e_pedido_de_busca como true ao mesmo tempo.
- Se nenhum dos dois for o caso (saudação, dúvida, reclamação, outro assunto), deixe ambos false e os demais campos vazios/zerados.
- origem/destino: nome da cidade (e UF se mencionada), como o motorista escreveu — não invente UF se não foi dita.
- valor_frete_reais: converta valores em português pro número em reais (ex.: "8 mil" -> 8000, "R$ 4.500" -> 4500, "3500 reais" -> 3500). null se nenhum valor foi mencionado.
- volta_vazia: true SÓ se o motorista mencionar explicitamente que vai voltar vazio/sem carga/sem frete de volta.
- confianca_origem/confianca_destino/confianca_valor: de 0 a 1, refletindo o quão claro e inequívoco cada campo foi no texto (baixa confiança se ambíguo, abreviado demais, ou você teve que adivinhar). Pra pedidos de busca (2), pode deixar em 0 — não se aplicam.`;

const FERRAMENTA_EXTRACAO = {
  name: "extrair_frete",
  description: "Registra os dados de um pedido de cálculo ou busca de frete extraídos de uma mensagem de WhatsApp.",
  input_schema: {
    type: "object",
    properties: {
      e_pedido_de_frete: { type: "boolean" },
      e_pedido_de_busca: { type: "boolean" },
      origem: { type: ["string", "null"] },
      destino: { type: ["string", "null"] },
      valor_frete_reais: { type: ["number", "null"] },
      volta_vazia: { type: "boolean" },
      confianca_origem: { type: "number" },
      confianca_destino: { type: "number" },
      confianca_valor: { type: "number" },
    },
    required: [
      "e_pedido_de_frete",
      "e_pedido_de_busca",
      "origem",
      "destino",
      "valor_frete_reais",
      "volta_vazia",
      "confianca_origem",
      "confianca_destino",
      "confianca_valor",
    ],
  },
};

function normalizar(input: Record<string, unknown>): ExtracaoFrete {
  return {
    ePedidoDeFrete: Boolean(input.e_pedido_de_frete),
    ePedidoDeBusca: Boolean(input.e_pedido_de_busca),
    origem: typeof input.origem === "string" && input.origem.trim() ? input.origem.trim() : null,
    destino: typeof input.destino === "string" && input.destino.trim() ? input.destino.trim() : null,
    valorFreteReais: typeof input.valor_frete_reais === "number" && input.valor_frete_reais > 0 ? input.valor_frete_reais : null,
    voltaVazia: Boolean(input.volta_vazia),
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
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: texto }],
        tools: [FERRAMENTA_EXTRACAO],
        tool_choice: { type: "tool", name: "extrair_frete" },
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
