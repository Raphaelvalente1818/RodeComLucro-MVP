// supabase/functions/wa-webhook/documentos.ts
//
// Leitura de CNH e CRLV por foto (07/10/2026 — Docs/bot-cadastro-por-foto.md).
// Recebe a imagem em base64, manda pro Haiku com visão com um schema fechado
// e devolve SÓ os campos permitidos. A imagem não é gravada em lugar nenhum:
// entra aqui, vai pra API e morre com a requisição. CPF, RG, nascimento,
// chassi e proprietário do CRLV não existem no schema — a IA não tem onde
// colocar, então não saem daqui.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODELO = "claude-haiku-4-5";

export interface DadosCNH {
  nome: string | null;
  categoria: string | null;
  /** AAAA-MM-DD */
  validade: string | null;
  numero: string | null;
}

export type EspecieVeiculo = "caminhao_trator" | "caminhao" | "semirreboque" | "reboque" | "outro";

export interface DadosCRLV {
  marca: string | null;
  modelo: string | null;
  ano: number | null;
  placa: string | null;
  renavam: string | null;
  eixos: number | null;
  /** Capacidade de carga em toneladas (carga útil se houver; senão PBT). */
  capacidadeT: number | null;
  exercicio: number | null;
  especie: EspecieVeiculo;
  /** Texto livre da carroceria do CRLV ("GRANELEIRO", "BAU", "SIDER"...). */
  carroceria: string | null;
}

export type LeituraDocumento =
  | { tipo: "cnh"; cnh: DadosCNH }
  | { tipo: "crlv"; crlv: DadosCRLV }
  | { tipo: "ilegivel" }
  | { tipo: "outro" };

const SYSTEM_PROMPT = `Você lê fotos de documentos brasileiros de motorista de caminhão e preenche a ferramenta "ler_documento". Nunca responda fora da ferramenta.

Documentos possíveis:
- CNH (Carteira Nacional de Habilitação), física ou digital (CNH-e). Extraia: nome completo do condutor, categoria (A, B, C, D, E, AB, AC, AD, AE), validade (campo "VALIDADE"), número de registro (campo "Nº REGISTRO", 11 dígitos).
- CRLV / CRLV-e (Certificado de Registro e Licenciamento de Veículo). Extraia: marca/modelo (campo "MARCA/MODELO/VERSÃO" — separe marca e modelo), ano (ANO FAB/ANO MOD — use o ano modelo), placa, RENAVAM (campo "CÓDIGO RENAVAM", 9 a 11 dígitos), eixos (campo "EIXOS", se existir), capacidade em toneladas (prefira "CAP. CARGA" ou "CAPACIDADE"; senão PBT ou "PESO BRUTO TOTAL"; valores em kg divida por 1000), exercício (campo "EXERCÍCIO", ano), espécie/tipo (campo "ESPÉCIE/TIPO": "CAMINHÃO TRATOR" → caminhao_trator; "CAMINHÃO" → caminhao; "SEMI-REBOQUE"/"SEMIRREBOQUE" → semirreboque; "REBOQUE" → reboque; outro → outro), carroceria (campo "CARROCERIA", texto como está).

Regras:
- tipo "ilegivel": é CNH ou CRLV mas não dá pra ler os campos principais (desfocada, cortada, escura, muito pequena).
- tipo "outro": não é CNH nem CRLV (print de tela, frete, foto qualquer, outro documento).
- NUNCA extraia CPF, RG, data de nascimento, filiação, chassi, nome ou CPF/CNPJ do proprietário, endereço. Esses campos não existem na ferramenta; ignore-os.
- Não invente: campo que não está legível = null. Nome: copie como está no documento, em maiúsculas/minúsculas normais (João da Silva).
- Datas no formato AAAA-MM-DD. Placa sem hífen e em maiúsculas (ABC1D23). Renavam só dígitos.`;

const FERRAMENTA = {
  name: "ler_documento",
  description: "Campos permitidos lidos de uma CNH ou de um CRLV.",
  input_schema: {
    type: "object",
    properties: {
      tipo: { type: "string", enum: ["cnh", "crlv", "ilegivel", "outro"] },
      cnh: {
        type: ["object", "null"],
        properties: {
          nome: { type: ["string", "null"] },
          categoria: { type: ["string", "null"] },
          validade: { type: ["string", "null"] },
          numero: { type: ["string", "null"] },
        },
      },
      crlv: {
        type: ["object", "null"],
        properties: {
          marca: { type: ["string", "null"] },
          modelo: { type: ["string", "null"] },
          ano: { type: ["integer", "null"] },
          placa: { type: ["string", "null"] },
          renavam: { type: ["string", "null"] },
          eixos: { type: ["integer", "null"] },
          capacidade_t: { type: ["number", "null"] },
          exercicio: { type: ["integer", "null"] },
          especie: { type: "string", enum: ["caminhao_trator", "caminhao", "semirreboque", "reboque", "outro"] },
          carroceria: { type: ["string", "null"] },
        },
      },
    },
    required: ["tipo"],
  },
};

function txt(v: unknown, max = 120): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s+/g, " ");
  return s ? s.slice(0, max) : null;
}

function intEntre(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? Math.round(v) : typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function dataISO(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return v.trim();
  const br = v.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null;
}

export function normalizarPlaca(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const p = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p) ? p : null;
}

export function normalizarCategoriaCNH(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const c = v.toUpperCase().replace(/[^A-E]/g, "");
  return /^(A|B|C|D|E|AB|AC|AD|AE)$/.test(c) ? c : null;
}

function normalizar(input: Record<string, unknown>): LeituraDocumento {
  const tipo = input.tipo;
  if (tipo === "cnh") {
    const c = (input.cnh ?? {}) as Record<string, unknown>;
    return {
      tipo: "cnh",
      cnh: {
        nome: txt(c.nome, 80),
        categoria: normalizarCategoriaCNH(c.categoria),
        validade: dataISO(c.validade),
        numero: typeof c.numero === "string" ? c.numero.replace(/\D/g, "").slice(0, 11) || null : null,
      },
    };
  }
  if (tipo === "crlv") {
    const r = (input.crlv ?? {}) as Record<string, unknown>;
    const especies: EspecieVeiculo[] = ["caminhao_trator", "caminhao", "semirreboque", "reboque", "outro"];
    const cap = typeof r.capacidade_t === "number" ? r.capacidade_t : typeof r.capacidade_t === "string" ? Number(String(r.capacidade_t).replace(",", ".")) : NaN;
    return {
      tipo: "crlv",
      crlv: {
        marca: txt(r.marca, 40),
        modelo: txt(r.modelo, 60),
        ano: intEntre(r.ano, 1970, 2100),
        placa: normalizarPlaca(r.placa),
        renavam: typeof r.renavam === "string" ? (/^\d{9,11}$/.test(r.renavam.replace(/\D/g, "")) ? r.renavam.replace(/\D/g, "") : null) : null,
        eixos: intEntre(r.eixos, 2, 9),
        capacidadeT: Number.isFinite(cap) && cap > 0 && cap < 200 ? Math.round(cap * 100) / 100 : null,
        exercicio: intEntre(r.exercicio, 2000, 2100),
        especie: especies.includes(r.especie as EspecieVeiculo) ? (r.especie as EspecieVeiculo) : "outro",
        carroceria: txt(r.carroceria, 40),
      },
    };
  }
  if (tipo === "ilegivel") return { tipo: "ilegivel" };
  return { tipo: "outro" };
}

/**
 * Lê a imagem. `null` = falha técnica (sem chave, API fora) — o chamador trata
 * como "não consegui ler" sem culpar a foto.
 */
export async function lerDocumento(base64: string, mediaType: string): Promise<LeituraDocumento | null> {
  if (!ANTHROPIC_API_KEY) {
    console.log("[wa-webhook] leitura de documento pulada (ANTHROPIC_API_KEY pendente)");
    return null;
  }
  const tipoImagem = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mediaType) ? mediaType : "image/jpeg";
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
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: tipoImagem, data: base64 } },
              { type: "text", text: "Leia este documento e preencha a ferramenta." },
            ],
          },
        ],
        tools: [FERRAMENTA],
        tool_choice: { type: "tool", name: "ler_documento" },
      }),
    });
    if (!resp.ok) {
      console.error("[wa-webhook] leitura de documento falhou", resp.status, await resp.text());
      return null;
    }
    const dados = await resp.json();
    const bloco = (dados.content ?? []).find((b: { type: string }) => b.type === "tool_use");
    if (!bloco?.input) return null;
    return normalizar(bloco.input as Record<string, unknown>);
  } catch (e) {
    console.error("[wa-webhook] leitura de documento lançou exceção", e);
    return null;
  }
}

/** Converte bytes em base64 sem estourar a pilha (imagens de alguns MB). */
export function bytesParaBase64(bytes: Uint8Array): string {
  let bin = "";
  const bloco = 0x8000;
  for (let i = 0; i < bytes.length; i += bloco) {
    bin += String.fromCharCode(...bytes.subarray(i, i + bloco));
  }
  return btoa(bin);
}
