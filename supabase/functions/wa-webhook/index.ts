// supabase/functions/wa-webhook/index.ts
//
// Endpoint COMPARTILHADO por todos os módulos -wpp do Rode com Lucro. Hoje
// só o identidade usa (intents VINCULAR/DESVINCULAR — prova de posse do
// número do WhatsApp); o calc-wpp entra depois, roteando pro NLU quando
// nenhum intent conhecido bater no texto. Ver Docs/PRD-tecnico-identidade.html
// (seção "wa-webhook") pro contrato completo — este arquivo segue esse
// contrato à risca (assinatura, idempotência, transições de estado).
//
// Envio de confirmação por WhatsApp depende da chave da Meta
// (WA_ACCESS_TOKEN/WA_PHONE_NUMBER_ID), ainda sendo providenciada — até lá,
// enviarMensagemWhatsapp() só loga em vez de mandar de verdade (ver função
// abaixo). O resto do fluxo (validar assinatura, casar intent, gravar no
// banco, auditar) funciona igual, sem depender disso — só a confirmação
// visível pro motorista no canal fica pendente. Assim que a chave chegar,
// basta configurar as variáveis de ambiente — sem mudar código.
//
// Variáveis de ambiente necessárias (Supabase → Edge Functions → Secrets):
//   WA_WEBHOOK_VERIFY_TOKEN — string escolhida por nós, configurada
//     também no painel da Meta (handshake GET de verificação).
//   WA_APP_SECRET — segredo do App da Meta, usado para validar a
//     assinatura HMAC de cada POST. Sem isso configurado corretamente,
//     TODO POST é rejeitado com 403 (fail-closed, comportamento seguro
//     por padrão) — então este endpoint só aceita tráfego de verdade
//     depois que o segredo real da Meta for configurado.
//   WA_ACCESS_TOKEN / WA_PHONE_NUMBER_ID — pendentes (a "chave" sendo
//     providenciada). Opcionais por enquanto: sem eles, o envio de
//     confirmação vira só um log.
//   ANTHROPIC_API_KEY — usada por extracao.ts (Claude Haiku) pra
//     interpretar pedidos de cálculo de frete em texto livre. Opcional:
//     sem ela, qualquer mensagem sem intent reconhecido (VINCULAR/
//     DESVINCULAR) só é logada, igual era antes do calc-wpp existir.
//   NUMERO_OFICIAL_WA — número do bot (E.164 sem "+"), vai no cartão de
//     contato "Mandar pro colega" e no rodapé encaminhável do veredito.
//
// 24/09/2026 — "o número já é o cadastro" (Docs/estrategia-viral-whatsapp.md):
// número desconhecido vira conta na 1ª mensagem; conta do app sem vínculo
// é vinculada ao escrever (sem código VINCULAR); perfil do caminhão por
// botões em 3 toques; cartão de contato como objeto viral; SAIR apaga tudo.
//
// 30/09/2026 — conversa fora do roteiro (Docs/status-sessao.md 30/09):
// a IA classifica a intenção (extracao.ts); busca aceita origem e tipo de
// carga digitados e puxa o onboarding antes se não tem caminhão; mensagem
// que não é sobre frete recebe resposta livre da IA (5 por número/dia);
// conta nasce em QUALQUER primeira mensagem (garantirMotorista).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calcularFrete, tipoCargaPorCarroceria, fmtBRL, fmtPct, diasPorFaixaKm, definirTabelaANTT, montarTabelaANTT, type Custos, type LinhaTabelaANTT } from "./calc.ts";
import { extrairFreteDeTexto, EIXOS_PADRAO, TIPOS_VEICULO, type ExtracaoFrete, type TipoCargaBusca, type ContextoConversa, type TipoVeiculoMsg, type TipoCarroceriaMsg, type Pendencia, type Correcoes } from "./extracao.ts";
import { lerDocumento, bytesParaBase64, normalizarPlaca, normalizarCategoriaCNH, type DadosCNH, type DadosCRLV } from "./documentos.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WA_WEBHOOK_VERIFY_TOKEN = Deno.env.get("WA_WEBHOOK_VERIFY_TOKEN")!;
const WA_APP_SECRET = Deno.env.get("WA_APP_SECRET")!;
// Sem "!" de propósito: undefined é um estado válido (chave da Meta ainda
// não chegou) — tratado em enviarMensagemWhatsapp(), não é erro de config.
const WA_ACCESS_TOKEN = Deno.env.get("WA_ACCESS_TOKEN");
const WA_PHONE_NUMBER_ID = Deno.env.get("WA_PHONE_NUMBER_ID");
// Número oficial (E.164 sem "+") — mesmo secret do wa-vincular; aqui vai
// no cartão de contato que o motorista encaminha pro colega.
const NUMERO_OFICIAL_WA = Deno.env.get("NUMERO_OFICIAL_WA");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// 02/10: piso ANTT vigente vem do banco (RPC antt_piso_vigente), cache de 1h
// em memória da instância; sem banco, calc.ts usa a tabela embutida.
let tabelaANTTCarregadaEm = 0;
async function garantirTabelaANTT(): Promise<void> {
  if (Date.now() - tabelaANTTCarregadaEm < 60 * 60_000) return;
  try {
    const { data, error } = await supabase.rpc("antt_piso_vigente");
    if (!error && Array.isArray(data) && data.length > 0) {
      definirTabelaANTT(montarTabelaANTT(data as LinhaTabelaANTT[]));
      tabelaANTTCarregadaEm = Date.now();
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[wa-webhook] falha ao carregar tabela ANTT, usando embutida", e);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Grava em public.app_log (mesma tabela que os jobs de rollup usam) pra
// a aba "Saúde do sistema" do admin conseguir mostrar erro técnico sem
// precisar de acesso aos logs de infraestrutura (edge_logs), que só a
// Management API do Supabase enxerga — não dá pra consultar via SQL nem
// pelo app. Nunca deixa uma falha AQUI derrubar o fluxo principal.
async function logErro(source: string, message: string, context: Record<string, unknown> = {}) {
  try {
    await supabase.from("app_log").insert({ nivel: "erro", source, message, context });
  } catch {
    // melhor perder um log do que quebrar o webhook por causa dele.
  }
}

async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------
// Assinatura da Meta (HMAC-SHA256 sobre o corpo CRU, header
// "X-Hub-Signature-256: sha256=<hex>") — autentica que o POST veio mesmo
// da Meta antes de tocar em qualquer dado. `segredo` como parâmetro (em
// vez de ler WA_APP_SECRET direto) só pra a função dar pra testar
// isoladamente com um segredo de fixture, sem precisar do valor real.
// ---------------------------------------------------------------------
export async function assinaturaValida(
  corpoCru: string,
  headerAssinatura: string | null,
  segredo: string,
): Promise<boolean> {
  if (!headerAssinatura?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(corpoCru));
  const esperada = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const recebida = headerAssinatura.slice("sha256=".length);
  return esperada === recebida;
}

// ---------------------------------------------------------------------
// Instrumentação (Docs/PRD-tecnico-admin.html) — mesmo catálogo de
// event_name usado no app web (lib/track.ts), com source="whatsapp" pra
// diferenciar o canal. Só "simulation_run" por aqui: o VINCULAR não é um
// cadastro novo (o motorista já existe, criado via app na Fase 1 —
// disparar signup_completed aqui infringiria o dado, contando de novo
// alguém que já apareceu no funil pelo app). Fire-and-forget (não bloqueia
// a resposta ao motorista nem falha o webhook): erro aqui só loga, nunca
// interrompe o fluxo principal (o cálculo já aconteceu de verdade).
// ---------------------------------------------------------------------
// Funil viral (Docs/estrategia-viral-whatsapp.md §5): wa_first_contact (F0),
// simulation_run (F1), truck_profile_saved (F3), referral_shared (F6).
async function registrarEventoAnalytics(
  eventName:
    | "simulation_run"
    | "simulation_run_anonimo"
    | "signup_completed"
    | "wa_first_contact"
    | "truck_profile_saved"
    | "driver_profile_saved"
    | "referral_shared",
  actorId: string | null,
  props: Record<string, unknown>,
): Promise<void> {
  // actor_id null (evento anônimo, trial via WhatsApp sem cadastro) não
  // entra no gate de validação do MVP — v_journey_completion já filtra
  // "actor_id is not null" antes de contar jornada completa, então não
  // corrompe o funil de 160 jornadas mesmo usando o mesmo event_name.
  const { error } = await supabase.from("analytics_event").insert({
    event_name: eventName,
    actor_id: actorId,
    source: "whatsapp",
    props,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[wa-webhook] falha ao gravar analytics_event, seguindo mesmo assim", error);
  }
}

// ---------------------------------------------------------------------
// Envio pro WhatsApp — no-op logado enquanto a chave da Meta não chega.
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SIMULADOR (07/10) — testes sem WhatsApp. Números 5590XXXXXXXX não existem
// na Meta: pra eles, nada é enviado; as respostas ficam em `respostasSimuladas`
// e voltam no JSON do GET ?simular=1 (ver tratarSimulacao). Token em
// bot_config.simulacao_token (só service_role). O webhook real (POST com
// HMAC) não muda em nada.
// ---------------------------------------------------------------------------
function ehNumeroSimulado(numero: string): boolean {
  return /^5590\d{8}$/.test(numero); // DDD 90 não existe no Brasil; passa no check ^55[1-9]… de motoristas
}
type RespostaSimulada = { tipo: "texto" | "botoes" | "lista" | "contato"; texto: string; opcoes?: Array<{ id: string; titulo: string }> };
const respostasSimuladas = new Map<string, RespostaSimulada[]>();
function coletarSimulada(para: string, r: RespostaSimulada): boolean {
  if (!ehNumeroSimulado(para)) return false;
  const lista = respostasSimuladas.get(para) ?? [];
  lista.push(r);
  respostasSimuladas.set(para, lista);
  return true;
}

/** Memória curta da conversa (07/10): toda mensagem recebida e toda resposta enviada. Nunca bloqueia o fluxo. */
async function registrarConversa(fromE164: string, papel: "motorista" | "bot", texto: string): Promise<void> {
  const t = texto.trim();
  if (!t) return;
  const { error } = await supabase.from("wa_conversa").insert({ from_e164: fromE164, papel, texto: t.slice(0, 1500) });
  if (error) console.error("[wa-webhook] falha ao gravar wa_conversa", error.message);
}


/** Texto humano do botão/linha pro histórico (ids são técnicos). */
function rotuloBotao(rowId: string): string {
  const fixos: Record<string, string> = {
    "doc:ok": "Pode ler", "doc:nao": "Agora não", "doc:frete": "Era um frete", "doc:salvar": "Salvar", "doc:corrigir": "Corrigir", "doc:cancelar": "Cancelar",
    "viral:cartao": "Mandar pro colega", abrir_app: "Abrir o app",
  };
  if (fixos[rowId]) return fixos[rowId];
  if (rowId.startsWith("doc:tipo:")) return rowId.slice(9);
  if (rowId.startsWith("onb_tipo:")) return rowId.slice(9);
  if (rowId.startsWith("onb_eixos:")) return `${rowId.slice(10)} eixos`;
  if (rowId.startsWith("onb_consumo:")) return `${rowId.slice(12)} km/L`;
  if (rowId.startsWith("cidade:")) return rowId.split(":").slice(2).join(":");
  if (rowId.startsWith("busca:origem:")) { const v = rowId.split(":").slice(3).join(":"); return v === "?" ? "Outra cidade" : v; }
  if (rowId.startsWith("perfil:salvar:")) return "Salvar esse caminhão";
  return "um frete da lista";
}

async function enviarMensagemWhatsapp(paraE164: string, texto: string): Promise<void> {
  await registrarConversa(paraE164, "bot", texto);
  if (coletarSimulada(paraE164, { tipo: "texto", texto })) return;
  if (!WA_ACCESS_TOKEN || !WA_PHONE_NUMBER_ID) {
    // eslint-disable-next-line no-console
    console.log(`[wa-webhook] envio pulado (chave da Meta pendente) para=${paraE164}: ${texto}`);
    return;
  }
  try {
    const resp = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: paraE164,
        type: "text",
        text: { body: texto },
      }),
    });
    if (!resp.ok) {
      const detalhe = await resp.text();
      // eslint-disable-next-line no-console
      console.error("[wa-webhook] envio falhou", resp.status, detalhe);
      await logErro("wa-webhook.enviarMensagemWhatsapp", "Envio de WhatsApp falhou", { status: resp.status, detalhe, para: paraE164 });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[wa-webhook] envio lançou exceção", e);
    await logErro("wa-webhook.enviarMensagemWhatsapp", "Envio de WhatsApp lançou exceção", { erro: String(e), para: paraE164 });
  }
}

// ---------------------------------------------------------------------
// Lista interativa (busca de frete) — a Cloud API só aceita texto puro em
// enviarMensagemWhatsapp(); listas são um tipo à parte ("interactive"/
// "list"), com limites rígidos de tamanho por campo (title ≤24, row
// description ≤72, button ≤20) — daí o truncar() abaixo.
// ---------------------------------------------------------------------
function truncar(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

interface LinhaListaFrete {
  id: string;
  title: string;
  description: string;
}

async function enviarListaFretes(paraE164: string, linhas: LinhaListaFrete[], textoCorpo: string): Promise<void> {
  await registrarConversa(paraE164, "bot", `${textoCorpo} [lista: ${linhas.map((l) => l.title).join(" | ")}]`);
  if (coletarSimulada(paraE164, { tipo: "lista", texto: textoCorpo, opcoes: linhas.map((l) => ({ id: l.id, titulo: `${l.title} — ${l.description}` })) })) return;
  if (!WA_ACCESS_TOKEN || !WA_PHONE_NUMBER_ID) {
    // eslint-disable-next-line no-console
    console.log(`[wa-webhook] envio de lista pulado (chave da Meta pendente) para=${paraE164}: ${JSON.stringify(linhas)}`);
    return;
  }
  try {
    const resp = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: paraE164,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: textoCorpo.slice(0, 1024) },
          action: {
            button: "Ver opções",
            sections: [{ title: "Fretes compatíveis", rows: linhas }],
          },
        },
      }),
    });
    if (!resp.ok) {
      const detalhe = await resp.text();
      // eslint-disable-next-line no-console
      console.error("[wa-webhook] envio de lista falhou", resp.status, detalhe);
      await logErro("wa-webhook.enviarListaFretes", "Envio de lista WhatsApp falhou", { status: resp.status, detalhe, para: paraE164 });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[wa-webhook] envio de lista lançou exceção", e);
    await logErro("wa-webhook.enviarListaFretes", "Envio de lista WhatsApp lançou exceção", { erro: String(e), para: paraE164 });
  }
}

// ---------------------------------------------------------------------
// Envio genérico pra Cloud API — usado pelos tipos que não são texto puro
// (botões de resposta rápida, cartão de contato). Mesmo tratamento de
// erro das funções acima.
// ---------------------------------------------------------------------
async function enviarPayloadWhatsapp(paraE164: string, corpo: Record<string, unknown>, origemLog: string): Promise<void> {
  if (coletarSimulada(paraE164, { tipo: corpo.type === "contacts" ? "contato" : "texto", texto: `[${origemLog}]` })) return;
  if (!WA_ACCESS_TOKEN || !WA_PHONE_NUMBER_ID) {
    // eslint-disable-next-line no-console
    console.log(`[wa-webhook] envio pulado (chave da Meta pendente) para=${paraE164}: ${JSON.stringify(corpo)}`);
    return;
  }
  try {
    const resp = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: paraE164, ...corpo }),
    });
    if (!resp.ok) {
      const detalhe = await resp.text();
      // eslint-disable-next-line no-console
      console.error(`[wa-webhook] ${origemLog} falhou`, resp.status, detalhe);
      await logErro(`wa-webhook.${origemLog}`, "Envio WhatsApp falhou", { status: resp.status, detalhe, para: paraE164 });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[wa-webhook] ${origemLog} lançou exceção`, e);
    await logErro(`wa-webhook.${origemLog}`, "Envio WhatsApp lançou exceção", { erro: String(e), para: paraE164 });
  }
}

/**
 * Botões de resposta rápida (interactive/button): no máximo 3, título ≤20
 * chars. É o que faz o perfil do caminhão caber em "3 toques" (ver
 * Docs/estrategia-viral-whatsapp.md). A resposta chega como
 * interactive.button_reply.id — ver extrairInteracoesLista.
 */
async function enviarBotoes(paraE164: string, texto: string, botoes: Array<{ id: string; titulo: string }>): Promise<void> {
  await registrarConversa(paraE164, "bot", `${texto} [botões: ${botoes.map((b) => b.titulo).join(" | ")}]`);
  if (coletarSimulada(paraE164, { tipo: "botoes", texto, opcoes: botoes })) return;
  await enviarPayloadWhatsapp(
    paraE164,
    {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: texto },
        action: {
          buttons: botoes.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: truncar(b.titulo, 20) } })),
        },
      },
    },
    "enviarBotoes",
  );
}

/**
 * Cartão de contato do próprio bot — o objeto viral. Botões somem quando
 * uma mensagem é encaminhada; um vCard não: o colega recebe e toca em
 * "Salvar", e o número entra na agenda com o nome certo. Ver pesquisa em
 * Docs/estrategia-viral-whatsapp.md §3.
 */
async function enviarCartaoDeContato(paraE164: string): Promise<void> {
  if (!NUMERO_OFICIAL_WA) return;
  await enviarPayloadWhatsapp(
    paraE164,
    {
      type: "contacts",
      contacts: [
        {
          name: { formatted_name: "Rode com Lucro", first_name: "Rode com Lucro" },
          phones: [{ phone: `+${NUMERO_OFICIAL_WA}`, wa_id: NUMERO_OFICIAL_WA, type: "WORK" }],
          urls: [{ url: URL_APP, type: "WORK" }],
        },
      ],
    },
    "enviarCartaoDeContato",
  );
}

// ---------------------------------------------------------------------
// Payload da Meta: entry[].changes[].value.messages[] — pode vir vazio
// (ex.: webhook de status de entrega, sem mensagem nova) ou com mais de
// uma mensagem no mesmo POST. Função pura, sem I/O — dá pra testar com
// um payload de fixture sem precisar de rede nem banco.
// ---------------------------------------------------------------------
export interface MensagemRecebida {
  waMessageId: string;
  fromE164: string;
  texto: string;
}

export function extrairMensagens(payload: unknown): MensagemRecebida[] {
  const mensagens: MensagemRecebida[] = [];
  const entradas = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entrada of entradas) {
    const changes = (entrada as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const msgs = (change as { value?: { messages?: unknown[] } })?.value?.messages ?? [];
      for (const m of msgs) {
        const msg = m as { id?: string; from?: string; type?: string; text?: { body?: string } };
        if (!msg.id || !msg.from || msg.type !== "text" || !msg.text?.body) continue;
        mensagens.push({ waMessageId: msg.id, fromE164: msg.from, texto: msg.text.body });
      }
    }
  }
  return mensagens;
}

// Imagens (07/10 — cadastro por foto, Docs/bot-cadastro-por-foto.md): só o id
// da mídia na Meta; o download acontece depois, e só com consentimento.
export interface ImagemRecebida {
  waMessageId: string;
  fromE164: string;
  mediaId: string;
  mimeType: string;
}

export function extrairImagens(payload: unknown): ImagemRecebida[] {
  const imagens: ImagemRecebida[] = [];
  const entradas = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entrada of entradas) {
    const changes = (entrada as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const msgs = (change as { value?: { messages?: unknown[] } })?.value?.messages ?? [];
      for (const m of msgs) {
        const msg = m as { id?: string; from?: string; type?: string; image?: { id?: string; mime_type?: string }; document?: { id?: string; mime_type?: string } };
        if (!msg.id || !msg.from) continue;
        // Imagem, ou documento (a CNH-e do gov.br chega como PDF — caso mais comum).
        const midia = msg.type === "image" ? msg.image : msg.type === "document" ? msg.document : null;
        if (!midia?.id) continue;
        imagens.push({ waMessageId: msg.id, fromE164: msg.from, mediaId: midia.id, mimeType: midia.mime_type ?? (msg.type === "image" ? "image/jpeg" : "application/octet-stream") });
      }
    }
  }
  return imagens;
}

// ---------------------------------------------------------------------
// Resposta de lista interativa (busca de frete, ver tratarBuscaDeFrete) —
// vem no mesmo campo value.messages[], mas com type="interactive" em vez
// de "text". row.id é o UUID do frete escolhido, ou "abrir_app" (4º item
// fixo da lista). Função separada (em vez de estender MensagemRecebida)
// pra não misturar os dois formatos de payload num único tipo.
// ---------------------------------------------------------------------
export interface InteracaoLista {
  waMessageId: string;
  fromE164: string;
  rowId: string;
}

export function extrairInteracoesLista(payload: unknown): InteracaoLista[] {
  const interacoes: InteracaoLista[] = [];
  const entradas = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entrada of entradas) {
    const changes = (entrada as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const msgs = (change as { value?: { messages?: unknown[] } })?.value?.messages ?? [];
      for (const m of msgs) {
        const msg = m as {
          id?: string;
          from?: string;
          type?: string;
          interactive?: { type?: string; list_reply?: { id?: string }; button_reply?: { id?: string } };
        };
        if (!msg.id || !msg.from || msg.type !== "interactive") continue;
        // Lista (busca de frete) e botão de resposta rápida (onboarding do
        // caminhão, "mandar pro colega") chegam no mesmo formato, só muda
        // o campo — os dois viram rowId e o roteador decide pelo prefixo.
        const rowId =
          msg.interactive?.type === "list_reply"
            ? msg.interactive.list_reply?.id
            : msg.interactive?.type === "button_reply"
              ? msg.interactive.button_reply?.id
              : undefined;
        if (!rowId) continue;
        interacoes.push({ waMessageId: msg.id, fromE164: msg.from, rowId });
      }
    }
  }
  return interacoes;
}

// ---------------------------------------------------------------------
// Status de entrega (sent/delivered/read/failed) — vem no MESMO campo
// "messages" do webhook (não existe um campo separado pra assinar),
// dentro de value.statuses[] em vez de value.messages[]. Só usado pra
// diagnóstico por enquanto (console.log/error) — não altera nenhum
// estado no banco.
// ---------------------------------------------------------------------
interface StatusRecebido {
  waMessageId: string;
  status: string;
  recipientId: string;
  erro?: unknown;
}

export function extrairStatuses(payload: unknown): StatusRecebido[] {
  const statuses: StatusRecebido[] = [];
  const entradas = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entrada of entradas) {
    const changes = (entrada as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const st = (change as { value?: { statuses?: unknown[] } })?.value?.statuses ?? [];
      for (const s of st) {
        const item = s as { id?: string; status?: string; recipient_id?: string; errors?: unknown };
        if (!item.id || !item.status) continue;
        statuses.push({ waMessageId: item.id, status: item.status, recipientId: item.recipient_id ?? "", erro: item.errors });
      }
    }
  }
  return statuses;
}

// ---------------------------------------------------------------------
// Intents roteados ANTES do NLU (sem custo de LLM — match por regex).
// Qualquer coisa que não bater um desses é "desconhecido": cai pro NLU do
// calc-wpp (tratarPedidoDeCalculo, ver abaixo), que decide via IA se é ou
// não um pedido de cálculo de frete.
// ---------------------------------------------------------------------
const RE_VINCULAR = /^vincular\s+(\d{6})$/i;
const RE_DESVINCULAR = /^desvincular$/i;
// Atalho sem custo de IA pros gatilhos mais comuns de busca de frete
// ("BUSCAR", "FRETES", "BUSCAR FRETE") — linguagem natural mais solta (ex.:
// "tem frete pra SP?") cai no NLU (extracao.ts, campo e_pedido_de_busca).
const RE_BUSCAR = /^(buscar|buscar\s+frete|fretes?)$/i;

export type IntentDetectado =
  | { tipo: "vincular"; codigo: string }
  | { tipo: "desvincular" }
  | { tipo: "buscar" }
  | { tipo: "desconhecido" };

export function detectarIntent(texto: string): IntentDetectado {
  const t = texto.trim();
  const vincular = t.match(RE_VINCULAR);
  if (vincular) return { tipo: "vincular", codigo: vincular[1] };
  if (RE_DESVINCULAR.test(t)) return { tipo: "desvincular" };
  if (RE_BUSCAR.test(t)) return { tipo: "buscar" };
  return { tipo: "desconhecido" };
}

/**
 * Prova de posse do número: casa o código de 6 dígitos com um wa_vinculo
 * pendente e, só se o número que mandou a mensagem for o mesmo cadastrado
 * pro dono do código, marca telefone_verificado=true e canal_wa_ativo=true.
 * Código de número divergente incrementa tentativas (5 tentativas revoga
 * o vínculo pendente); código expirado ou inexistente orienta reiniciar
 * pelo app. Ver Docs/PRD-tecnico-identidade.html — fluxo "Vínculo
 * app<->WhatsApp".
 */
async function tratarVincular(fromE164: string, codigo: string, waMessageId: string): Promise<void> {
  const codigoHash = await sha256Hex(codigo);
  const { data: vinculo, error } = await supabase
    .from("wa_vinculo")
    .select("id, motorista_id, tentativas, expira_em, motoristas!inner(telefone_e164)")
    .eq("codigo_hash", codigoHash)
    .eq("status", "pendente")
    .maybeSingle();

  if (error || !vinculo) {
    await enviarMensagemWhatsapp(fromE164, "Código inválido. Gere um novo código pelo app e tente de novo.");
    return;
  }

  const telefoneDono = (vinculo as unknown as { motoristas: { telefone_e164: string } }).motoristas.telefone_e164;
  const expirado = new Date(vinculo.expira_em as string).getTime() < Date.now();

  if (expirado) {
    await supabase.from("wa_vinculo").update({ status: "expirado" }).eq("id", vinculo.id);
    await enviarMensagemWhatsapp(fromE164, "Esse código expirou. Gere um novo pelo app e tente de novo.");
    return;
  }

  if (telefoneDono !== fromE164) {
    const tentativas = (vinculo.tentativas as number) + 1;
    const revogar = tentativas >= 5;
    await supabase
      .from("wa_vinculo")
      .update({ tentativas, status: revogar ? "revogado" : "pendente" })
      .eq("id", vinculo.id);
    await supabase.from("identidade_audit").insert({
      motorista_id: vinculo.motorista_id,
      evento: "wa_vinculado",
      detalhe: { ok: false, motivo: "numero_divergente", wa_message_id: waMessageId, tentativas },
    });
    await enviarMensagemWhatsapp(
      fromE164,
      revogar
        ? "Código bloqueado após várias tentativas. Gere um novo código pelo app."
        : "Esse código não é desse número. Confira e tente de novo pelo número cadastrado no app.",
    );
    return;
  }

  await supabase
    .from("motoristas")
    .update({ telefone_verificado: true, canal_wa_ativo: true })
    .eq("id", vinculo.motorista_id);
  await supabase
    .from("wa_vinculo")
    .update({ status: "verificado", verificado_em: new Date().toISOString(), wa_message_id: waMessageId })
    .eq("id", vinculo.id);
  await supabase.from("consentimento").insert({
    motorista_id: vinculo.motorista_id,
    tipo: "canal_whatsapp",
    versao: "1",
    aceito: true,
  });
  await supabase.from("identidade_audit").insert({
    motorista_id: vinculo.motorista_id,
    evento: "wa_vinculado",
    detalhe: { ok: true, wa_message_id: waMessageId },
  });
  await enviarMensagemWhatsapp(fromE164, "Número vinculado! ✅");
}

/**
 * Desliga o canal. Depois disso, mensagens desse número devem receber o
 * convite de re-vinculação e nenhum módulo -wpp deve processar escrita —
 * isso é responsabilidade de cada módulo checar canal_wa_ativo/
 * telefone_verificado antes de processar, não deste webhook.
 */
async function tratarDesvincular(fromE164: string, waMessageId: string): Promise<void> {
  const { data: motorista } = await supabase
    .from("motoristas")
    .select("id")
    .eq("telefone_e164", fromE164)
    .maybeSingle();

  if (!motorista) return; // número não cadastrado — nada a desvincular.

  await supabase
    .from("motoristas")
    .update({ telefone_verificado: false, canal_wa_ativo: false })
    .eq("id", motorista.id);
  await supabase.from("identidade_audit").insert({
    motorista_id: motorista.id,
    evento: "wa_desvinculado",
    detalhe: { wa_message_id: waMessageId },
  });
  await enviarMensagemWhatsapp(fromE164, "Número desvinculado. Pra usar de novo, vincule pelo app.");
}

// ---------------------------------------------------------------------
// Pipeline de cálculo de frete (calc-wpp) — entra quando a mensagem não
// bate VINCULAR/DESVINCULAR. Reaproveita o mesmo perfil de custos do
// caminhão que o app usa em Analisar.tsx (packages/rode-calc via
// calc.ts) e a mesma Edge Function route-cost pra distância/pedágio —
// só origem/destino/valor/volta-vazia vêm da mensagem (via extracao.ts).
// ---------------------------------------------------------------------

const CONFIANCA_MINIMA = 0.6;

/**
 * Diesel/consumo DITOS na mensagem (08/10: "São Carlos pra Goiânia 6700 com
 * diesel a 15,00" ignorava o diesel). Vale pro cálculo de agora e vira o
 * valor atual do perfil (preço muda a cada abastecida; o último dito é o
 * melhor padrão). Devolve o perfil ajustado e a nota pra resposta.
 */
async function aplicarCustosDitos(motoristaId: string | null, perfil: PerfilCusto, ex: ExtracaoFrete | null): Promise<{ perfil: PerfilCusto; nota: string | null }> {
  if (!ex || (ex.dieselPrecoLitro == null && ex.consumoKmPorLitro == null)) return { perfil, nota: null };
  const ajustado = { ...perfil };
  const partes: string[] = [];
  const patch: Record<string, number> = {};
  if (ex.dieselPrecoLitro != null) {
    ajustado.diesel_preco_por_litro = ex.dieselPrecoLitro;
    patch.diesel_preco_por_litro = ex.dieselPrecoLitro;
    partes.push(`diesel a ${fmtBRL(ex.dieselPrecoLitro)}/L`);
  }
  if (ex.consumoKmPorLitro != null) {
    ajustado.diesel_km_por_lt = ex.consumoKmPorLitro;
    patch.diesel_km_por_lt = ex.consumoKmPorLitro;
    partes.push(`${ex.consumoKmPorLitro.toLocaleString("pt-BR")} km/L`);
  }
  if (motoristaId) {
    const { data: existe } = await supabase.from("caminhao_perfil").select("user_id").eq("user_id", motoristaId).maybeSingle();
    if (existe) await supabase.from("caminhao_perfil").update(patch).eq("user_id", motoristaId);
  }
  return { perfil: ajustado, nota: `calculei com ${partes.join(" e ")}, como você disse — guardei como seu valor atual` };
}

/** "Bitrem 7 eixos" (sem repetir "de 7 eixos"), "Truck de 3 eixos", "caminhão de 5 eixos". */
function nomeVeiculo(tipo: string | null | undefined, eixos: number): string {
  if (!tipo) return `caminhão de ${eixos} eixos`;
  return /\beixos?\b/i.test(tipo) ? tipo : `${tipo} de ${eixos} eixos`;
}

const PERFIL_CUSTO_DEFAULT: PerfilCusto = {
  numero_eixos: 5,
  diesel_km_por_lt: 2.5,
  diesel_preco_por_litro: 6.1,
  arla_km_por_lt: 20,
  arla_preco_por_litro: 4.5,
  manutencao_por_km: 0.35,
  pneus_por_km: 0.12,
  depreciacao_por_km: 0.25,
  alimentacao_dia: 90,
  pernoite_dia: 0,
  estacionamento_padrao: 0,
  chapa_padrao: 0,
  margem_desejada: 20,
  tipo_carroceria: null,
};

interface PerfilCusto {
  numero_eixos: number;
  diesel_km_por_lt: number;
  diesel_preco_por_litro: number;
  arla_km_por_lt: number;
  arla_preco_por_litro: number;
  manutencao_por_km: number;
  pneus_por_km: number;
  depreciacao_por_km: number;
  alimentacao_dia: number;
  pernoite_dia: number;
  estacionamento_padrao: number;
  chapa_padrao: number;
  margem_desejada: number;
  tipo_carroceria: string | null;
}

/** Sem perfil cadastrado ainda, cai no mesmo PERFIL_DEFAULT do app (apps/web/src/lib/frete.ts) — nunca bloqueia o cálculo por falta de cadastro. */
async function buscarPerfilOuDefault(motoristaId: string): Promise<PerfilCusto> {
  const { data } = await supabase
    .from("caminhao_perfil")
    .select(
      "numero_eixos, diesel_km_por_lt, diesel_preco_por_litro, arla_km_por_lt, arla_preco_por_litro, manutencao_por_km, pneus_por_km, depreciacao_por_km, alimentacao_dia, pernoite_dia, estacionamento_padrao, chapa_padrao, margem_desejada, tipo_carroceria",
    )
    .eq("user_id", motoristaId)
    .maybeSingle();
  return (data as PerfilCusto | null) ?? PERFIL_CUSTO_DEFAULT;
}

/** Mesma conversão de apps/web/src/lib/frete.ts (perfilParaCustos) — pedagio já vem pronto em reais (truck), não em centavos (carro). */
function perfilParaCustos(perfil: PerfilCusto, dias: number, pedagioReais: number): Custos {
  return {
    dieselKmPorLt: perfil.diesel_km_por_lt,
    dieselPrecoPorLitro: perfil.diesel_preco_por_litro,
    arlaKmPorLt: perfil.arla_km_por_lt,
    arlaPrecoPorLitro: perfil.arla_preco_por_litro,
    pedagio: pedagioReais,
    alimentacao: perfil.alimentacao_dia * dias,
    pernoite: perfil.pernoite_dia * dias,
    estacionamento: perfil.estacionamento_padrao,
    chapa: perfil.chapa_padrao,
    manutencaoPorKm: perfil.manutencao_por_km,
    pneusPorKm: perfil.pneus_por_km,
    depreciacaoPorKm: perfil.depreciacao_por_km,
  };
}

interface RotaResultado {
  distanciaKm: number;
  pedagioCentavos: number | null;
  distanciaEstimada: boolean;
}

/** Chama a Edge Function route-cost (function-to-function, mesmo projeto) — service role key como Bearer satisfaz o verify_jwt=true dela. */
// 03/10: o erro genérico ("não consegui calcular a distância dessa rota")
// não dizia QUAL cidade falhou — o motorista mandava a mesma frase de novo.
function mensagemRotaNaoEncontrada(origem: string, destino: string): string {
  return `Não achei no mapa a rota *${origem} → ${destino}*. Pode ser o nome da cidade escrito diferente. Manda de novo com o estado depois da cidade, tipo *"Diadema/SP pra Coruripe/AL"*.`;
}

async function chamarRouteCost(origem: string, destino: string): Promise<RotaResultado | null> {
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/route-cost`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ origem, destino }),
    });
    if (!resp.ok) return null;
    const dados = await resp.json();
    if (typeof dados.distanciaKm !== "number") return null;
    return {
      distanciaKm: dados.distanciaKm,
      pedagioCentavos: typeof dados.pedagioCentavos === "number" ? dados.pedagioCentavos : null,
      distanciaEstimada: Boolean(dados.distanciaEstimada),
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[wa-webhook] chamada a route-cost falhou", e);
    await logErro("wa-webhook.chamarRouteCost", "Chamada a route-cost lançou exceção", { erro: String(e), origem, destino });
    return null;
  }
}

async function registrarTentativaFrete(params: {
  waMessageId: string;
  motoristaId: string | null;
  fromE164: string;
  texto: string;
  extracao: ExtracaoFrete | null;
  status:
    | "calculado"
    | "confirmacao_pendente"
    | "dado_faltando"
    | "erro_extracao"
    | "nao_vinculado"
    | "calculado_anonimo"
    | "nao_cadastrado"
    | "calculado_novo"
    | "boas_vindas"
    | "onboarding_resposta"
    | "recalculado_perfil"
    | "sair"
    | "resposta_livre"
    | "limite_diario"
    | "busca_sem_resultado"
    | "busca_origem"
    | "busca_lista"
    | "cotado"
    | "pergunta_calculo"
    | "veiculo_salvo"
    | "cidade_pendente"
    | "doc_convite"
    | "doc_lido"
    | "doc_salvo"
    | "doc_cancelado"
    | "doc_ilegivel"
    | "doc_imagem_sem_contexto";
  resultado?: unknown;
}): Promise<void> {
  const { error } = await supabase.from("wa_freight_query").insert({
    wa_message_id: params.waMessageId,
    motorista_id: params.motoristaId,
    from_e164: params.fromE164,
    texto_recebido: params.texto,
    extracao_snapshot: params.extracao ?? null,
    status: params.status,
    resultado_snapshot: params.resultado ?? null,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[wa-webhook] falha ao gravar wa_freight_query, seguindo mesmo assim", error);
    await logErro("wa-webhook.registrarTentativaFrete", "Falha ao gravar wa_freight_query", { erro: error.message, waMessageId: params.waMessageId });
  }
}

/**
 * Fallback de qualquer mensagem que não bateu VINCULAR/DESVINCULAR —
 * tenta interpretar como pedido de cálculo de frete (calc-wpp). Só
 * calcula de fato quando: (1) a IA classifica como pedido de frete de
 * verdade, (2) origem/destino/valor foram todos extraídos, (3) a
 * confiança de cada campo bate o mínimo, (4) o número já está vinculado
 * a um motorista. Qualquer coisa fora disso responde orientando o
 * motorista, sem chutar um cálculo em cima de dado incerto.
 */
// Rede de segurança pra quando a IA classifica uma mensagem genérica de
// busca (ex.: "tem frete pra mim?") como nem cálculo nem busca — já
// aconteceu em teste real (log: "mensagem sem intent reconhecido" pra
// "Tem frete para mim?"). Sem valor em reais mencionado + menciona
// frete/carga = trata como busca em vez de ficar em silêncio total, que é
// pior (motorista acha que o bot não respondeu/quebrou).
const RE_MENCIONA_FRETE_OU_CARGA = /\bfretes?\b|\bcargas?\b/i;

// =====================================================================
// "O número já é o cadastro" — Fase 1 da estratégia viral
// (Docs/estrategia-viral-whatsapp.md, aprovada pelo Raphael em 24/09).
//
// Quando um número desconhecido manda a primeira mensagem, a Meta já
// provou que o aparelho está na mão dele — exatamente o que o SMS de OTP
// tenta provar. Então a conta nasce aqui, com telefone verificado e
// WhatsApp vinculado, sem tela nenhuma. O perfil do caminhão é colhido
// por botões, em 3 toques (tipo → eixos → consumo), e ao final o mesmo
// frete é recalculado com o caminhão real — o erro da estimativa
// genérica vira o motivo do cadastro.
//
// Decisões do Raphael: aviso em uma linha no fim do veredito (+ SAIR pra
// apagar tudo, que é o direito de exclusão da LGPD); apresentação só com a
// marca; 3 toques, não mais.
// =====================================================================

const RE_CODIGO_INDICACAO = /#([a-z0-9]{2,20})/i;
const RE_SAIR = /^sair$/i;
// Só os comandos secos ("ajuda", "menu"). Perguntas em texto ("o que você
// faz?", "pra que serve?") vão pra IA (intent pergunta_bot em extracao.ts),
// que responde a pergunta de verdade em vez de cuspir o menu.
const RE_AJUDA = /^(ajuda|help|menu|comandos)\s*[?!.]*$/i;
const RE_CADASTRO = /^cadastro\s*[?!.]*$/i;

// Cota diária (02/10, decisão do Raphael): 20 consultas por número e por dia.
// Na 20ª o bot avisa e manda o link do app (abre logado, sem limite); da 21ª
// em diante, silêncio até o dia virar. Mudar aqui quando ele pedir pra baixar.
//
// 09/10 (opção A, caso do Emerson — "segunda consulta do dia" e veio o aviso):
// "hoje" era uma janela de 24 h corridas e contava bate-papo e até o bot
// perguntando "qual cidade?". Agora: dia de CALENDÁRIO em America/Sao_Paulo e
// só consulta de verdade conta — cálculo, cotação, busca que achou frete. O
// bate-papo tem o próprio limite (resposta livre, 5/dia).
const LIMITE_CONSULTAS_DIA = 20;
// Status que representam uma consulta de verdade (entram na cota).
const STATUS_CONSULTA = ["calculado", "calculado_novo", "recalculado_perfil", "calculado_anonimo", "cotado", "busca_lista"];

/** 09/10: Google só tem tarifa em rodovias cobertas; quando não vem, o custo fica sem pedágio e o motorista precisa saber. */
const NOTA_SEM_PEDAGIO = "não achei o pedágio dessa rota — o custo acima está SEM pedágio; se souber o valor, soma por fora";

/** Meia-noite de hoje em São Paulo, em ISO UTC — início do "dia" da cota. */
function inicioDoDiaSaoPaulo(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(agora);
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? "0");
  // segundos desde a meia-noite local = hora*3600 + min*60 + seg; subtrai de "agora"
  const desdeMeiaNoiteMs = ((v("hour") % 24) * 3600 + v("minute") * 60 + v("second")) * 1000 + (agora.getTime() % 1000);
  return new Date(agora.getTime() - desdeMeiaNoiteMs).toISOString();
}
const AVISO_CADASTRO = `\n\n_Seu número ficou cadastrado no Rode com Lucro. Pra apagar, manda SAIR._`;

/** Apresentação em uma mensagem só (custo pós-1/10) — usada quando a IA não responde (sem chave, erro) e nos comandos "ajuda"/"menu". */
function mensagemApresentacao(temConta: boolean): string {
  return (
    `Opa! Sou o Rode com Lucro 🚛 — faço três coisas pra você:\n\n` +
    `1️⃣ Digo se um frete *vale a pena* (custo real, lucro e piso ANTT). Manda a rota e o valor. Ex.: *"Sinop pra Santos, 14 mil"*\n\n` +
    `2️⃣ *Coto* uma rota: km, pedágio, piso ANTT e quanto cobrar. Manda só a rota. Ex.: *"Carandaí pra Piracaia"*\n\n` +
    `3️⃣ Mostro *cargas perto de você*. Manda *BUSCAR*.\n\n` +
    `Manda *CADASTRO* pra eu preencher seu perfil pela foto da CNH e do CRLV.` +
    (temConta ? `\n\n_Pra apagar seu cadastro, manda SAIR._` : "")
  );
}

/**
 * "O número já é o cadastro", versão 30/09: a conta nasce na PRIMEIRA
 * mensagem, seja ela qual for ("oi", "pra que serve", "tem carga?").
 * Decisão do Raphael. Retorna o id (ou null se a criação falhou) e se
 * acabou de ser criada — quem chama usa `novo` pra pôr o aviso LGPD.
 */
async function garantirMotorista(fromE164: string, texto: string): Promise<{ id: string | null; novo: boolean }> {
  const { data: m } = await supabase.from("motoristas").select("id").eq("telefone_e164", fromE164).maybeSingle();
  if (m) return { id: m.id, novo: false };
  const codigo = extrairCodigoIndicacao(texto);
  const id = await criarMotoristaPorWhatsapp(fromE164, codigo);
  await registrarEventoAnalytics("wa_first_contact", id, { indicado_por: codigo, texto: texto.slice(0, 120) });
  return { id, novo: true };
}

/** Quantas consultas esse número já teve respondidas nas últimas 24h (cota diária). */
async function contarConsultasHoje(fromE164: string): Promise<number> {
  const desde = inicioDoDiaSaoPaulo();
  const { count } = await supabase
    .from("wa_freight_query")
    .select("id", { count: "exact", head: true })
    .eq("from_e164", fromE164)
    .in("status", STATUS_CONSULTA)
    .gte("criado_em", desde);
  return count ?? 0;
}

/** 20ª consulta do dia: avisa e manda o app (abre logado, sem limite). */
async function avisarUltimaConsulta(fromE164: string): Promise<void> {
  const { data: m } = await supabase.from("motoristas").select("id").eq("telefone_e164", fromE164).maybeSingle();
  const link = await linkApp(m?.id ?? null, "/");
  await enviarMensagemWhatsapp(
    fromE164,
    `⚠️ Essa foi sua última consulta de hoje aqui no WhatsApp. No app você faz quantas quiser, sem limite — e já abre logado: ${link}`,
  );
}

/**
 * Camada 3: mensagem fora do roteiro (saudação, pergunta sobre o bot,
 * outro assunto, spam). A IA já escreveu a resposta em extracao.ts; aqui
 * só decide se manda (limite diário) e registra pra auditoria. Sem
 * resposta da IA, cai na apresentação fixa. Nunca fica em silêncio dentro
 * do limite.
 */
async function tratarConversaLivre(fromE164: string, texto: string, waMessageId: string, extracao: ExtracaoFrete | null, status: "resposta_livre" | "pergunta_calculo" = "resposta_livre"): Promise<void> {
  const { id: motoristaId, novo } = await garantirMotorista(fromE164, texto);
  const corpo = extracao?.respostaLivre ?? mensagemApresentacao(Boolean(motoristaId) && !novo);
  const resposta = novo && motoristaId ? corpo + AVISO_CADASTRO : corpo;
  await registrarTentativaFrete({
    waMessageId,
    motoristaId,
    fromE164,
    texto,
    extracao,
    status,
    resultado: { intent: extracao?.intent ?? null, resposta, gerada_pela_ia: Boolean(extracao?.respostaLivre) },
  });
  await enviarMensagemWhatsapp(fromE164, resposta);
}


// =====================================================================
// 02/10 — memória da conversa + caminhão dito na mensagem + cotação.
// Teste do Rapha (01/10): o bot negava capacidade que tem ("não consulto
// distância/pedágio/ANTT"), não lembrava o cálculo anterior, ignorava
// "truck grade baixa" e se apresentava toda vez. Ver Docs/status-sessao.md.
// =====================================================================

type SnapshotCalculo = {
  entrada?: {
    origem?: string;
    destino?: string;
    distanciaKm?: number;
    valorFrete?: number;
    numeroEixos?: number;
    voltaVazia?: boolean;
    custos?: { dieselPrecoPorLitro?: number; dieselKmPorLt?: number; pedagio?: number; manutencaoPorKm?: number; pneusPorKm?: number; depreciacaoPorKm?: number; alimentacao?: number };
  };
  custoTotal?: number;
  custoDetalhado?: Record<string, number>;
  lucro?: number;
  margemReal?: number;
  pisoANTT?: number;
  veredicto?: string;
  cotacao?: boolean;
  dias?: number;
  criadoEm?: string;
};

/** O que a IA precisa saber antes de ler a mensagem: já apresentado? tem caminhão? último cálculo? */
async function montarContexto(fromE164: string): Promise<ContextoConversa> {
  const [{ count: apresentacoes }, { data: m }, { data: ultimos }, { data: falha }] = await Promise.all([
    supabase
      .from("wa_freight_query")
      .select("id", { count: "exact", head: true })
      .eq("from_e164", fromE164)
      .not("status", "in", "(limite_diario,nao_cadastrado)"), // qualquer conversa anterior = já se apresentou (07/10: "vlw" após 10 msgs reapresentava)
    supabase.from("motoristas").select("id").eq("telefone_e164", fromE164).maybeSingle(),
    supabase
      .from("wa_freight_query")
      .select("resultado_snapshot, criado_em")
      .eq("from_e164", fromE164)
      .in("status", ["calculado", "calculado_novo", "recalculado_perfil", "cotado"])
      .order("criado_em", { ascending: false })
      .limit(2),
    supabase
      .from("wa_freight_query")
      .select("extracao_snapshot, criado_em")
      .eq("from_e164", fromE164)
      .eq("status", "erro_extracao")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  // 03/10: "Por que não conseguiu calcular?" caía no último cálculo que deu
  // certo (horas antes) e o Haiku respondia "consegui sim!" com números de
  // outra rota. Agora a falha mais recente vai no contexto, se for posterior.
  const ultimo = ultimos?.[0] ?? null;
  const anterior = ultimos?.[1] ?? null;
  const falhaDepois = falha?.criado_em && (!ultimo?.criado_em || new Date(falha.criado_em as string) > new Date(ultimo.criado_em as string));
  const exFalha = (falha?.extracao_snapshot ?? null) as { origem?: string | null; destino?: string | null } | null;
  const ultimaFalha: ContextoConversa["ultimaFalha"] = falhaDepois
    ? {
        origem: exFalha?.origem ?? null,
        destino: exFalha?.destino ?? null,
        motivo: "não achou a rota no mapa (cidade não reconhecida ou escrita diferente)",
        quandoMinutos: Math.max(0, Math.round((Date.now() - new Date(falha!.criado_em as string).getTime()) / 60_000)),
      }
    : null;
  let caminhaoCadastrado: string | null = null;
  if (m) {
    const { data: p } = await supabase.from("caminhao_perfil").select("tipo_veiculo, numero_eixos").eq("user_id", m.id).maybeSingle();
    if (p?.tipo_veiculo) caminhaoCadastrado = `${p.tipo_veiculo} ${p.numero_eixos} eixos`;
  }
  // 08/10 (caso do Rapha): a IA disse "usei diesel a 5,87" (foi 6,10) e depois
  // inventou por que o custo caiu. Agora o contexto leva os INSUMOS do cálculo
  // (diesel, consumo, custos por km) e também o cálculo anterior, pra ela
  // comparar com dado em vez de chutar.
  const resumirCalculo = (linha: { resultado_snapshot?: unknown; criado_em?: string } | null): ContextoConversa["ultimoCalculo"] => {
    const snap = (linha?.resultado_snapshot ?? null) as SnapshotCalculo | null;
    const e = snap?.entrada;
    if (!(snap && e?.origem && e?.destino && e.distanciaKm != null && snap.custoTotal != null && snap.pisoANTT != null)) return null;
    const c = e.custos ?? {};
    return {
      origem: e.origem,
      destino: e.destino,
      distanciaKm: e.distanciaKm,
      valorFrete: snap.cotacao ? null : (e.valorFrete ?? null),
      custoTotal: snap.custoTotal,
      custos: snap.custoDetalhado ?? {},
      lucro: snap.cotacao ? null : (snap.lucro ?? null),
      margemReal: snap.cotacao ? null : (snap.margemReal ?? null),
      pisoANTT: snap.pisoANTT,
      veredicto: snap.cotacao ? null : (snap.veredicto ?? null),
      dias: snap.dias ?? diasPorFaixaKm(e.distanciaKm),
      eixos: e.numeroEixos ?? 5,
      voltaVazia: Boolean(e.voltaVazia),
      insumos: {
        dieselPrecoLitro: c.dieselPrecoPorLitro ?? null,
        consumoKmPorLitro: c.dieselKmPorLt ?? null,
        manutencaoPorKm: c.manutencaoPorKm ?? null,
        pneusPorKm: c.pneusPorKm ?? null,
        depreciacaoPorKm: c.depreciacaoPorKm ?? null,
      },
      quandoMinutos: linha?.criado_em ? Math.max(0, Math.round((Date.now() - new Date(linha.criado_em as string).getTime()) / 60_000)) : 0,
    };
  };
  const ultimoCalculo = resumirCalculo(ultimo);
  const calculoAnterior = ultimoCalculo ? resumirCalculo(anterior) : null;
  const estadoDoc = await estadoCadastroFoto(fromE164);
  let cadastroFoto: ContextoConversa["cadastroFoto"] = null;
  let primeiroNome: string | null = null;
  if (m) {
    const [{ data: mot }, { data: perf }] = await Promise.all([
      supabase.from("motoristas").select("nome, cnh_numero").eq("id", m.id).maybeSingle(),
      supabase.from("caminhao_perfil").select("placa, renavam").eq("user_id", m.id).maybeSingle(),
    ]);
    primeiroNome = mot?.nome ? String(mot.nome).trim().split(/\s+/)[0] || null : null;
    if (estadoDoc) cadastroFoto = { cnhSalva: Boolean(mot?.cnh_numero), crlvSalvo: Boolean(perf?.placa || perf?.renavam) };
  }
  const pendencia = await obterPendencia(fromE164, estadoDoc);
  const { data: conversa } = await supabase
    .from("wa_conversa")
    .select("papel, texto")
    .eq("from_e164", fromE164)
    .gte("criado_em", new Date(Date.now() - 2 * 60 * 60_000).toISOString())
    .order("criado_em", { ascending: false })
    .limit(9);
  // A última linha é a própria mensagem atual (já gravada no roteador) — sai do histórico.
  const historico = ((conversa ?? []) as Array<{ papel: "motorista" | "bot"; texto: string }>).slice(1).reverse();
  return { jaApresentado: (apresentacoes ?? 0) > 0, caminhaoCadastrado, ultimoCalculo, calculoAnterior, ultimaFalha, cadastroFoto, historico, primeiroNome, pendencia };
}

/**
 * A ÚNICA coisa que o bot está esperando agora (08/10). Prioridade: leitura
 * de documento em confirmação > tipo do cavalo > consentimento > onboarding
 * do caminhão > cidade em dúvida (1 h) > origem da busca (30 min) >
 * aguardando foto. Vai pro Haiku como `pendencia`; a resposta volta como
 * `acao` e é executada em executarAcaoPendencia. Substitui os cinco
 * "porteiros" de regex que interceptavam o texto antes da IA.
 */
async function obterPendencia(fromE164: string, estadoDoc?: EstadoCadastroFoto | null): Promise<Pendencia | null> {
  const doc = estadoDoc === undefined ? await estadoCadastroFoto(fromE164) : estadoDoc;
  if (doc?.dados && doc.tipo_doc && (doc.etapa === "confirmar" || doc.etapa === "corrigir")) {
    const d = doc.dados;
    const leitura: Record<string, string | number | null> =
      doc.tipo_doc === "cnh"
        ? { nome: d.nome ?? null, categoria: d.categoria ?? null, validade: d.validade ?? null, numero: d.numero ?? null }
        : { marca: d.marca ?? null, modelo: d.modelo ?? null, ano: d.ano ?? null, placa: d.placa ?? null, renavam: d.renavam ?? null, eixos: d.eixos ?? null, capacidade_t: d.capacidadeT ?? null, exercicio: d.exercicio ?? null, especie: d.especie ?? null };
    return { tipo: "confirmar_leitura", documento: doc.tipo_doc, leitura };
  }
  if (doc?.etapa === "tipo_veiculo") return { tipo: "tipo_veiculo_crlv", opcoes: ["Carreta", "Carreta LS", "Bitrem 7 eixos"] };
  if (doc?.etapa === "aguardando_consentimento") return { tipo: "consentimento_documento" };

  const { data: onb } = await supabase.from("wa_onboarding").select("etapa, updated_at").eq("from_e164", fromE164).maybeSingle();
  if (onb && Date.now() - new Date(onb.updated_at as string).getTime() < 60 * 60_000) {
    const etapa = onb.etapa as "tipo" | "eixos" | "consumo";
    const opcoes = etapa === "tipo" ? TIPOS_VEICULO_BOTOES.map((t) => t.titulo) : etapa === "eixos" ? ["2 a 9"] : ["km por litro, ex.: 2,5"];
    return { tipo: "onboarding_caminhao", etapa, opcoes };
  }

  const { data: ultima } = await supabase
    .from("wa_freight_query")
    .select("status, criado_em, extracao_snapshot, resultado_snapshot")
    .eq("from_e164", fromE164)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultima) {
    const idadeMin = (Date.now() - new Date(ultima.criado_em as string).getTime()) / 60_000;
    if (ultima.status === "cidade_pendente" && idadeMin < 60) {
      const res = (ultima.resultado_snapshot ?? {}) as { campo?: string; texto?: string; candidatos?: string[] };
      return { tipo: "cidade_em_duvida", campo: res.campo === "destino" ? "destino" : "origem", texto: res.texto ?? "", candidatos: res.candidatos ?? [] };
    }
    if (ultima.status === "busca_origem" && idadeMin < 30) {
      const res = (ultima.resultado_snapshot ?? {}) as { candidatos?: string[] };
      return { tipo: "busca_origem", candidatos: res.candidatos ?? [] };
    }
  }
  // "Aguardando foto" só conta se ele aceitou ler (quem tocou "Agora não" também fica nessa etapa, sem pendência real).
  if (doc?.etapa === "aguardando_foto" && (await temConsentimentoLeitura(doc.motorista_id))) {
    return { tipo: "aguardando_foto", faltam: "CNH e/ou CRLV" };
  }
  return null;
}

/** Caminhão dito na mensagem, já resolvido contra o perfil cadastrado. */
interface VeiculoDaMensagem {
  tipoVeiculo: TipoVeiculoMsg | null;
  numeroEixos: number;
  tipoCarroceria: TipoCarroceriaMsg | null;
  /** Linha pro rodapé ("calculei com Truck de 3 eixos, como você disse"). */
  nota: string;
  /** Botão pra salvar esse caminhão no perfil quando difere do cadastrado. */
  botaoSalvar: { id: string; titulo: string } | null;
  /** Acabou de criar o perfil a partir da mensagem (não precisa dos 3 toques). */
  perfilCriado: boolean;
}

/**
 * Regra (Raphael, 01/10): usa o caminhão que ele disse NESSA mensagem; se
 * não tem perfil, salva direto (sem os 3 toques); se tem perfil diferente,
 * calcula com o da mensagem e oferece um botão pra salvar. Nunca pergunta
 * o que já sabe.
 */
async function resolverVeiculoDaMensagem(motoristaId: string | null, ex: ExtracaoFrete): Promise<VeiculoDaMensagem | null> {
  if (!ex.tipoVeiculo && ex.numeroEixos == null && !ex.tipoCarroceria) return null;
  const { data: perfil } = motoristaId
    ? await supabase.from("caminhao_perfil").select("tipo_veiculo, numero_eixos, tipo_carroceria").eq("user_id", motoristaId).maybeSingle()
    : { data: null };

  const tipo = ex.tipoVeiculo ?? ((perfil?.tipo_veiculo as TipoVeiculoMsg | null) ?? null);
  const eixos = ex.numeroEixos ?? (ex.tipoVeiculo ? EIXOS_PADRAO[ex.tipoVeiculo] : (perfil?.numero_eixos as number | null) ?? 5);
  const carroceria = ex.tipoCarroceria ?? ((perfil?.tipo_carroceria as TipoCarroceriaMsg | null) ?? null);
  const descricao = `${nomeVeiculo(tipo, eixos)}${carroceria ? ` (${carroceria})` : ""}`;

  if (motoristaId && !perfil?.tipo_veiculo && tipo) {
    // Sem perfil: a mensagem vira o cadastro. Consumo/custos no default do app.
    const { error } = await supabase.from("caminhao_perfil").upsert(
      {
        user_id: motoristaId,
        apelido: tipo,
        tipo_veiculo: tipo,
        numero_eixos: eixos,
        tipo_carroceria: carroceria,
        diesel_km_por_lt: PERFIL_CUSTO_DEFAULT.diesel_km_por_lt,
        diesel_preco_por_litro: PERFIL_CUSTO_DEFAULT.diesel_preco_por_litro,
        arla_km_por_lt: PERFIL_CUSTO_DEFAULT.arla_km_por_lt,
        arla_preco_por_litro: PERFIL_CUSTO_DEFAULT.arla_preco_por_litro,
        manutencao_por_km: PERFIL_CUSTO_DEFAULT.manutencao_por_km,
        pneus_por_km: PERFIL_CUSTO_DEFAULT.pneus_por_km,
        depreciacao_por_km: PERFIL_CUSTO_DEFAULT.depreciacao_por_km,
        alimentacao_dia: PERFIL_CUSTO_DEFAULT.alimentacao_dia,
        pernoite_dia: PERFIL_CUSTO_DEFAULT.pernoite_dia,
        estacionamento_padrao: PERFIL_CUSTO_DEFAULT.estacionamento_padrao,
        chapa_padrao: PERFIL_CUSTO_DEFAULT.chapa_padrao,
        margem_desejada: PERFIL_CUSTO_DEFAULT.margem_desejada,
      },
      { onConflict: "user_id" },
    );
    if (!error) {
      await registrarEventoAnalytics("truck_profile_saved", motoristaId, { canal: "whatsapp", via: "mensagem", tipo_veiculo: tipo, eixos });
      await supabase.from("wa_onboarding").delete().eq("from_e164", (await supabase.from("motoristas").select("telefone_e164").eq("id", motoristaId).maybeSingle()).data?.telefone_e164 ?? "");
      return { tipoVeiculo: tipo, numeroEixos: eixos, tipoCarroceria: carroceria, nota: `Salvei seu ${descricao} como seu caminhão. Ajusta consumo e custos no app quando quiser.`, botaoSalvar: null, perfilCriado: true };
    }
    await logErro("wa-webhook.veiculoMensagem", "Falha ao salvar perfil a partir da mensagem", { erro: error.message, motoristaId });
  }

  const difere = perfil?.tipo_veiculo && (perfil.tipo_veiculo !== tipo || (ex.numeroEixos != null && perfil.numero_eixos !== eixos) || (ex.tipoCarroceria && perfil.tipo_carroceria !== carroceria));
  if (difere) {
    return {
      tipoVeiculo: tipo,
      numeroEixos: eixos,
      tipoCarroceria: carroceria,
      nota: `Calculei com ${descricao}, como você disse (seu cadastro é ${nomeVeiculo(perfil!.tipo_veiculo, perfil!.numero_eixos)}).`,
      botaoSalvar: { id: `perfil:salvar:${tipo}:${eixos}:${carroceria ?? ""}`, titulo: "Salvar esse caminhão" },
      perfilCriado: false,
    };
  }
  return { tipoVeiculo: tipo, numeroEixos: eixos, tipoCarroceria: carroceria, nota: "", botaoSalvar: null, perfilCriado: false };
}

/** Botão "Salvar esse caminhão" (id perfil:salvar:<tipo>:<eixos>:<carroceria>). */
async function tratarSalvarVeiculo(fromE164: string, rowId: string, waMessageId: string): Promise<void> {
  const [, , tipo, eixosTxt, carroceria] = rowId.split(":");
  const { data: m } = await supabase.from("motoristas").select("id").eq("telefone_e164", fromE164).maybeSingle();
  if (!m) return;
  const eixos = Number(eixosTxt) || 5;
  const { error } = await supabase
    .from("caminhao_perfil")
    .update({ tipo_veiculo: tipo, apelido: tipo, numero_eixos: eixos, tipo_carroceria: carroceria || null })
    .eq("user_id", m.id);
  await registrarTentativaFrete({ waMessageId, motoristaId: m.id, fromE164, texto: rowId, extracao: null, status: "veiculo_salvo" });
  if (error) {
    await logErro("wa-webhook.salvarVeiculo", "Falha ao atualizar caminhao_perfil", { erro: error.message, motoristaId: m.id });
    await enviarMensagemWhatsapp(fromE164, "Não consegui salvar agora. Tenta de novo daqui a pouco.");
    return;
  }
  await enviarMensagemWhatsapp(fromE164, `Pronto: ${tipo} de ${eixos} eixos${carroceria ? ` (${carroceria})` : ""} é seu caminhão agora. 🚛`);
}

/**
 * Cotação: rota sem valor ("quanto posso cobrar?", "qual o pedágio?").
 * Mesmo motor do veredito, mas em vez de julgar um valor, diz o mínimo
 * pra fechar a margem dele e o piso ANTT. Antes o bot negava ("não
 * calculo valor") — e tinha tudo pra responder.
 */
async function tratarCotacao(fromE164: string, texto: string, waMessageId: string, ex: ExtracaoFrete): Promise<void> {
  const { id: motoristaId, novo } = await garantirMotorista(fromE164, texto);
  const avisoNovo = novo && motoristaId ? AVISO_CADASTRO : "";

  if (!ex.origem || !ex.destino) {
    await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto, extracao: ex, status: "dado_faltando" });
    const falta = !ex.origem && !ex.destino ? "De onde pra onde? Ex.: *\"Carandaí pra Piracaia\"*" : !ex.origem ? `Saindo de onde? Ex.: *"Carandaí pra ${ex.destino}"*` : `Pra onde? Ex.: *"${ex.origem} pra Piracaia"*`;
    await enviarMensagemWhatsapp(fromE164, `Opa! Pra cotar, ${falta}` + avisoNovo);
    return;
  }

  // "coruipe" → Coruripe/AL antes de pedir a rota ao Google (03/10).
  const cidades = await corrigirCidades(fromE164, texto, waMessageId, motoristaId, ex);
  if (!cidades) return; // já perguntou (botões) ou já avisou que não achou
  ex = cidades.ex;
  const { origem, destino, nota: notaCidade } = cidades;

  const veiculo = await resolverVeiculoDaMensagem(motoristaId, ex);
  const rota = await chamarRouteCost(origem, destino);
  if (!rota) {
    await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto, extracao: ex, status: "erro_extracao" });
    await enviarMensagemWhatsapp(fromE164, mensagemRotaNaoEncontrada(origem, destino));
    return;
  }

  const custosDitos = await aplicarCustosDitos(motoristaId, motoristaId ? await buscarPerfilOuDefault(motoristaId) : PERFIL_CUSTO_DEFAULT, ex);
  const perfilBase = custosDitos.perfil;
  const perfil: PerfilCusto = veiculo
    ? { ...perfilBase, numero_eixos: veiculo.numeroEixos, tipo_carroceria: veiculo.tipoCarroceria ?? perfilBase.tipo_carroceria }
    : perfilBase;
  const { count: perfis } = motoristaId
    ? await supabase.from("caminhao_perfil").select("id", { count: "exact", head: true }).eq("user_id", motoristaId)
    : { count: 0 };
  const temPerfil = (perfis ?? 0) > 0;

  const dias = diasPorFaixaKm(rota.distanciaKm);
  const pedagioReais = rota.pedagioCentavos != null ? Math.round(rota.pedagioCentavos * (perfil.numero_eixos / 2)) / 100 : 0;
  const custos = perfilParaCustos(perfil, dias, pedagioReais);
  const tipoCarga = tipoCargaPorCarroceria(perfil.tipo_carroceria);
  // valorFrete 0 só pra extrair custo e piso; o "valor" aqui é o que ele deve cobrar.
  const base = calcularFrete({ origem: origem, destino: destino, distanciaKm: rota.distanciaKm, valorFrete: 0, voltaVazia: ex.voltaVazia, margemDesejada: perfil.margem_desejada, custos, distanciaEstimada: rota.distanciaEstimada, numeroEixos: perfil.numero_eixos, tipoCarga });
  const margem = perfil.margem_desejada;
  const valorComMargem = margem < 100 ? base.custoTotal / (1 - margem / 100) : base.custoTotal;
  const valorSugerido = Math.max(valorComMargem, base.pisoANTT);
  const abaixoPiso = valorComMargem < base.pisoANTT;

  const snapshot: SnapshotCalculo = {
    entrada: { origem: origem, destino: destino, distanciaKm: rota.distanciaKm, valorFrete: valorSugerido, numeroEixos: perfil.numero_eixos },
    custoTotal: base.custoTotal,
    custoDetalhado: { ...base.custoDetalhado },
    pisoANTT: base.pisoANTT,
    cotacao: true,
    dias,
  };
  await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto, extracao: ex, status: "cotado", resultado: snapshot });
  await registrarEventoAnalytics("simulation_run", motoristaId, { origem: origem, destino: destino, distancia_km: rota.distanciaKm, cotacao: true, valor_sugerido: valorSugerido, piso_antt: base.pisoANTT });

  const d = base.custoDetalhado;
  const descVeiculo = veiculo?.tipoVeiculo ? nomeVeiculo(veiculo.tipoVeiculo, perfil.numero_eixos) : temPerfil ? `seu caminhão (${perfil.numero_eixos} eixos)` : `carreta padrão de ${perfil.numero_eixos} eixos`;
  const resposta =
    `📍 ${origem} → ${destino}: *${rota.distanciaKm.toFixed(0)} km*${rota.distanciaEstimada ? " (estimado)" : ""}, ${dias} dia${dias > 1 ? "s" : ""} de viagem${ex.voltaVazia ? ", voltando vazio" : ""}\n` +
    `Pedágio: ${rota.pedagioCentavos == null ? "não disponível" : fmtBRL(d.pedagio)}\n` +
    `Diesel: ${fmtBRL(d.diesel)} · Arla: ${fmtBRL(d.arla)}\n` +
    `Manutenção + pneus + depreciação: ${fmtBRL(d.manutencao + d.pneus + d.depreciacao)}\n` +
    `Alimentação/pernoite: ${fmtBRL(d.alimentacao + d.pernoite)}\n` +
    `*Custo da viagem: ${fmtBRL(base.custoTotal)}*\n` +
    `Piso ANTT: ${fmtBRL(base.pisoANTT)}\n\n` +
    `💰 Pra ter ${margem.toFixed(0)}% de margem, cobre a partir de *${fmtBRL(valorSugerido)}*` +
    (abaixoPiso ? ` (o piso ANTT manda — é o mínimo legal)` : ` (acima do piso ANTT)`) +
    `\n\n_estimativa com ${descVeiculo}_` +
    (rota.pedagioCentavos == null ? `\n_${NOTA_SEM_PEDAGIO}_` : "") +
    (custosDitos.nota ? `\n_${custosDitos.nota}_` : "") +
    (notaCidade ? `\n_${notaCidade}_` : "") +
    (veiculo?.nota ? `\n_${veiculo.nota}_` : "") +
    avisoNovo;
  await enviarMensagemWhatsapp(fromE164, resposta);

  if (veiculo?.botaoSalvar) {
    await enviarBotoes(fromE164, "Quer que eu use esse caminhão nos próximos cálculos?", [veiculo.botaoSalvar]);
  } else if (motoristaId && !temPerfil && !veiculo?.perfilCriado) {
    await iniciarOnboardingCaminhao(fromE164, motoristaId, { cotacao: true, origem: origem, destino: destino, voltaVazia: ex.voltaVazia });
  }
}

/** Extrai "#EMERSON" do texto (link wa.me?text=...%23EMERSON) — atribuição de indicação. */
function extrairCodigoIndicacao(texto: string): string | null {
  const m = texto.match(RE_CODIGO_INDICACAO);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Cria a conta pra um número novo: usuário no Auth com phone confirmado
 * (o trigger handle_new_auth_user cria a linha em motoristas), e em
 * seguida marca telefone_verificado + canal_wa_ativo (o trigger de
 * confirmação só dispara em UPDATE de phone_confirmed_at, não em INSERT
 * já confirmado). Retorna o id ou null se falhou — nesse caso o chamador
 * cai no trial anônimo antigo, sem quebrar a resposta.
 */
async function criarMotoristaPorWhatsapp(fromE164: string, codigoIndicacao: string | null): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.createUser({
    phone: fromE164,
    phone_confirm: true,
    user_metadata: { origem_cadastro: "whatsapp" },
  });
  if (error || !data.user) {
    await logErro("wa-webhook.criarMotorista", "Falha ao criar conta pelo WhatsApp", { erro: error?.message, from: fromE164 });
    return null;
  }
  const id = data.user.id;
  const { error: upErr } = await supabase
    .from("motoristas")
    .update({
      telefone_verificado: true,
      telefone_verificado_em: new Date().toISOString(),
      canal_wa_ativo: true,
      origem_cadastro: "whatsapp",
      indicado_por_codigo: codigoIndicacao,
    })
    .eq("id", id);
  if (upErr) {
    await logErro("wa-webhook.criarMotorista", "Conta criada mas falhou ao marcar vínculo", { erro: upErr.message, id });
  }
  await registrarEventoAnalytics("signup_completed", id, { canal: "whatsapp", indicado_por: codigoIndicacao });
  return id;
}

const TIPOS_VEICULO_BOTOES: Array<{ id: string; titulo: string; eixosPadrao: number }> = [
  { id: "onb_tipo:Carreta", titulo: "Carreta", eixosPadrao: 5 },
  { id: "onb_tipo:Bitrem 7 eixos", titulo: "Bitrem", eixosPadrao: 7 },
  { id: "onb_tipo:Truck", titulo: "Truck", eixosPadrao: 3 },
];

/** Passo 2 → 3: depois do primeiro veredito, pergunta o tipo do caminhão. */
async function iniciarOnboardingCaminhao(fromE164: string, motoristaId: string, ultimoFrete: Record<string, unknown>): Promise<void> {
  // Já perguntou há pouco e ele ignorou: atualiza o frete guardado, mas não
  // repete os botões (custa mensagem e vira ruído).
  const { data: existente } = await supabase.from("wa_onboarding").select("etapa, updated_at").eq("from_e164", fromE164).maybeSingle();
  const perguntouHaPouco = existente && Date.now() - new Date(existente.updated_at as string).getTime() < 10 * 60_000;
  await supabase.from("wa_onboarding").upsert({
    from_e164: fromE164,
    motorista_id: motoristaId,
    etapa: perguntouHaPouco ? existente!.etapa : "tipo",
    ultimo_frete: ultimoFrete,
    updated_at: new Date().toISOString(),
  });
  if (perguntouHaPouco) return;
  await enviarBotoes(
    fromE164,
    "Quer o número certo pro *seu* caminhão? Me diz só o tipo:",
    TIPOS_VEICULO_BOTOES.map((t) => ({ id: t.id, titulo: t.titulo })),
  );
}

/**
 * Resposta de botão do onboarding (ids "onb_tipo:X", "onb_eixos:N",
 * "onb_consumo:N"). Salva a cada toque; no último, grava o perfil em
 * caminhao_perfil e recalcula o frete que ele tinha pedido.
 */
async function tratarRespostaOnboarding(fromE164: string, rowId: string, waMessageId: string): Promise<void> {
  const { data: onb } = await supabase.from("wa_onboarding").select("*").eq("from_e164", fromE164).maybeSingle();
  if (!onb) return; // botão velho, onboarding já concluído — ignora em silêncio

  const [chave, valor] = rowId.split(":");
  await registrarTentativaFrete({ waMessageId, motoristaId: onb.motorista_id, fromE164, texto: rowId, extracao: null, status: "onboarding_resposta" });

  if (chave === "onb_tipo") {
    const tipo = TIPOS_VEICULO_BOTOES.find((t) => t.id === rowId);
    await supabase
      .from("wa_onboarding")
      .update({ tipo_veiculo: valor, numero_eixos: tipo?.eixosPadrao ?? 5, etapa: "eixos", updated_at: new Date().toISOString() })
      .eq("from_e164", fromE164);
    const sugestao = tipo?.eixosPadrao ?? 5;
    const opcoes = [sugestao - 1, sugestao, sugestao + 1].filter((n) => n >= 2 && n <= 9);
    await enviarBotoes(fromE164, `${valor}. Quantos eixos?`, opcoes.map((n) => ({ id: `onb_eixos:${n}`, titulo: `${n} eixos` })));
    return;
  }

  if (chave === "onb_eixos") {
    await supabase
      .from("wa_onboarding")
      .update({ numero_eixos: Number(valor), etapa: "consumo", updated_at: new Date().toISOString() })
      .eq("from_e164", fromE164);
    await enviarBotoes(fromE164, "Última: ele faz mais ou menos quantos km por litro?", [
      { id: "onb_consumo:2", titulo: "Uns 2 km/L" },
      { id: "onb_consumo:2.5", titulo: "Uns 2,5 km/L" },
      { id: "onb_consumo:3", titulo: "3 ou mais" },
    ]);
    return;
  }

  if (chave === "onb_consumo") {
    const consumo = Number(valor);
    const eixos = onb.numero_eixos ?? 5;
    // Perfil mínimo: tipo, eixos e consumo do motorista; o resto no PERFIL_DEFAULT
    // (mesmos valores do app). Ele ajusta depois em "Meu Caminhão".
    const { error } = await supabase.from("caminhao_perfil").upsert(
      {
        user_id: onb.motorista_id,
        apelido: onb.tipo_veiculo,
        tipo_veiculo: onb.tipo_veiculo,
        numero_eixos: eixos,
        diesel_km_por_lt: consumo,
        diesel_preco_por_litro: PERFIL_CUSTO_DEFAULT.diesel_preco_por_litro,
        arla_km_por_lt: PERFIL_CUSTO_DEFAULT.arla_km_por_lt,
        arla_preco_por_litro: PERFIL_CUSTO_DEFAULT.arla_preco_por_litro,
        manutencao_por_km: PERFIL_CUSTO_DEFAULT.manutencao_por_km,
        pneus_por_km: PERFIL_CUSTO_DEFAULT.pneus_por_km,
        depreciacao_por_km: PERFIL_CUSTO_DEFAULT.depreciacao_por_km,
        alimentacao_dia: PERFIL_CUSTO_DEFAULT.alimentacao_dia,
        pernoite_dia: PERFIL_CUSTO_DEFAULT.pernoite_dia,
        estacionamento_padrao: PERFIL_CUSTO_DEFAULT.estacionamento_padrao,
        chapa_padrao: PERFIL_CUSTO_DEFAULT.chapa_padrao,
        margem_desejada: PERFIL_CUSTO_DEFAULT.margem_desejada,
      },
      { onConflict: "user_id" },
    );
    if (error) {
      await logErro("wa-webhook.onboarding", "Falha ao gravar caminhao_perfil", { erro: error.message, motoristaId: onb.motorista_id });
      await enviarMensagemWhatsapp(fromE164, "Não consegui salvar agora. Tenta de novo daqui a pouco.");
      return;
    }
    await supabase.from("wa_onboarding").delete().eq("from_e164", fromE164);
    await registrarEventoAnalytics("truck_profile_saved", onb.motorista_id, { canal: "whatsapp", tipo_veiculo: onb.tipo_veiculo, eixos, consumo });

    // Recalcula o frete que ele tinha pedido, agora com o caminhão dele —
    // e mostra a diferença. É o momento "ah, então era isso". Se o que
    // ele pediu antes foi uma BUSCA ("tem carga de container saindo de São
    // Paulo?"), roda a busca agora, com o caminhão que acabou de salvar.
    const f = (onb.ultimo_frete ?? {}) as {
      origem?: string;
      destino?: string;
      valorFreteReais?: number;
      voltaVazia?: boolean;
      lucroGenerico?: number;
      busca?: boolean;
      origemTexto?: string | null;
      tipoCarga?: TipoCargaBusca | null;
      cotacao?: boolean;
    };
    if (f.cotacao && f.origem && f.destino) {
      await tratarCotacao(fromE164, "(cotação pós-onboarding)", waMessageId, {
        intent: "cotar", ePedidoDeFrete: false, ePedidoDeBusca: false, origem: f.origem, destino: f.destino, valorFreteReais: null, valorPorToneladaReais: null, toneladas: null, dieselPrecoLitro: null, consumoKmPorLitro: null, acao: "nenhuma", opcaoEscolhida: null, correcoes: null,
        voltaVazia: Boolean(f.voltaVazia), tipoCarga: null, tipoVeiculo: null, numeroEixos: null, tipoCarroceria: null, respostaLivre: null,
        confiancaOrigem: 1, confiancaDestino: 1, confiancaValor: 0,
      });
      return;
    }
    if (f.busca) {
      await tratarBuscaDeFrete(fromE164, waMessageId, {
        origemTexto: f.origemTexto ?? null,
        tipoCarga: f.tipoCarga ?? null,
        prefixo: `Caminhão salvo: ${onb.tipo_veiculo} de ${eixos} eixos. 🚛 `,
        textoOriginal: "(busca pós-onboarding)",
      });
      return;
    }
    if (f.origem && f.destino && f.valorFreteReais != null) {
      await calcularEResponderFrete({
        fromE164,
        motoristaId: onb.motorista_id,
        origem: f.origem,
        destino: f.destino,
        valorFreteReais: f.valorFreteReais,
        voltaVazia: Boolean(f.voltaVazia),
        waMessageId,
        texto: "(recalculo pós-onboarding)",
        extracao: null,
        recalculoDe: f.lucroGenerico ?? null,
      });
    } else {
      await enviarMensagemWhatsapp(fromE164, `Pronto, seu ${onb.tipo_veiculo} de ${eixos} eixos ficou salvo. 🚛 Manda a próxima rota e valor que eu calculo com ele.`);
    }
    return;
  }
}

/** "SAIR": apaga a conta criada pelo WhatsApp (direito de exclusão). */
async function tratarSair(fromE164: string, waMessageId: string): Promise<void> {
  const { data: m } = await supabase.from("motoristas").select("id").eq("telefone_e164", fromE164).maybeSingle();
  if (!m) return;
  await registrarTentativaFrete({ waMessageId, motoristaId: m.id, fromE164, texto: "SAIR", extracao: null, status: "sair" });
  // auth.users cascade → motoristas, caminhao_perfil, analise_frete, wa_onboarding
  const { error } = await supabase.auth.admin.deleteUser(m.id);
  if (error) {
    await logErro("wa-webhook.sair", "Falha ao apagar conta", { erro: error.message, id: m.id });
    await enviarMensagemWhatsapp(fromE164, "Não consegui apagar agora. Tenta de novo em instantes.");
    return;
  }
  await enviarMensagemWhatsapp(fromE164, "Pronto — apaguei seu cadastro e seus dados. Se quiser voltar, é só mandar uma rota e um valor. 👋");
}


async function tratarPedidoDeCalculo(fromE164: string, texto: string, waMessageId: string): Promise<void> {
  // 08/10: sem porteiros. Tudo passa pela IA com a pendência no contexto;
  // a resposta dela (acao) é executada em despacharExtracao.
  const contexto = await montarContexto(fromE164);
  const extracao = await extrairFreteDeTexto(texto, contexto);
  if (!extracao) {
    // Sem chave da IA ou a chamada falhou: nunca silêncio — apresentação
    // fixa (e a conta nasce do mesmo jeito, é a primeira mensagem dele).
    await tratarConversaLivre(fromE164, texto, waMessageId, null);
    return;
  }
  await despacharExtracao(fromE164, texto, waMessageId, extracao, contexto.pendencia);
}

/**
 * Do intent pra frente. Separado de tratarPedidoDeCalculo (03/10) pra poder
 * reexecutar o MESMO pedido depois que o motorista toca no botão de
 * confirmação de cidade ("é Coruripe/AL?") — ver tratarEscolhaCidade.
 */
async function despacharExtracao(fromE164: string, texto: string, waMessageId: string, extracao: ExtracaoFrete, pendencia?: Pendencia | null): Promise<void> {
  // A mensagem respondeu ao que o bot estava esperando? Executa a ação e pronto.
  if (extracao.acao !== "nenhuma") {
    const p = pendencia === undefined ? await obterPendencia(fromE164) : pendencia;
    if (p && (await executarAcaoPendencia(fromE164, texto, waMessageId, extracao, p))) return;
  }

  // Pergunta sobre o último cálculo ("quanto de pedágio?"): a IA já
  // respondeu com os números do contexto — só manda (conta no limite diário).
  if (extracao.intent === "pergunta_calculo") {
    // "e se eu voltar vazio?", "e se pagar 3500?" (simulador, 07/10): a IA
    // devolve a rota do último cálculo com o valor/volta novos e sem
    // resposta — é um recálculo, não uma pergunta. Roda como "calcular".
    if (extracao.origem && extracao.destino && (extracao.valorFreteReais != null || extracao.valorPorToneladaReais != null) && (extracao.voltaVazia || extracao.dieselPrecoLitro != null || extracao.consumoKmPorLitro != null || !extracao.respostaLivre)) {
      extracao = { ...extracao, intent: "calcular", ePedidoDeFrete: true, confiancaOrigem: 1, confiancaDestino: 1, confiancaValor: 1 };
    } else if (extracao.origem && extracao.destino && extracao.voltaVazia) {
      // Último cálculo era cotação (sem valor): recota com volta vazia.
      await tratarCotacao(fromE164, texto, waMessageId, { ...extracao, intent: "cotar" });
      return;
    } else {
      if (!extracao.respostaLivre) {
        extracao = { ...extracao, respostaLivre: "Não peguei o que você quer saber do cálculo. Pergunta direto: pedágio, diesel, dias de viagem, margem ou piso ANTT?" };
      }
      await tratarConversaLivre(fromE164, texto, waMessageId, extracao, "pergunta_calculo");
      return;
    }
  }

  // "Posso tirar foto da minha CNH?" → mesmo fluxo do comando CADASTRO (07/10).
  if (extracao.intent === "cadastro") {
    await tratarComandoCadastro(fromE164, texto, waMessageId);
    return;
  }

  // Cotação: rota sem valor (ou "calcular" que veio sem valor — mesma coisa).
  // Valor (fixo ou por tonelada) presente = cálculo, mesmo que a IA tenha dito "cotar" (08/10: "190 o ton" cotava).
  if (extracao.intent === "cotar" && (extracao.valorFreteReais != null || extracao.valorPorToneladaReais != null) && extracao.origem && extracao.destino) {
    extracao = { ...extracao, intent: "calcular", ePedidoDeFrete: true, confiancaOrigem: Math.max(extracao.confiancaOrigem, 0.9), confiancaDestino: Math.max(extracao.confiancaDestino, 0.9), confiancaValor: 1 };
  }
  if (extracao.intent === "cotar" || (extracao.intent === "calcular" && extracao.valorFreteReais == null && extracao.valorPorToneladaReais == null && extracao.origem && extracao.destino)) {
    await tratarCotacao(fromE164, texto, waMessageId, extracao);
    return;
  }

  if (extracao.intent !== "calcular" && extracao.intent !== "buscar") {
    if (RE_MENCIONA_FRETE_OU_CARGA.test(texto) && extracao.valorFreteReais == null) {
      // Rede de segurança: citou frete/carga e a IA não classificou —
      // trata como busca (silêncio ou papo é pior que buscar e não achar).
      // eslint-disable-next-line no-console
      console.log(`[wa-webhook] fallback: tratando como busca (IA classificou ${extracao.intent}) de ${fromE164}: "${texto}"`);
      await tratarBuscaDeFrete(fromE164, waMessageId, { origemTexto: extracao.origem, tipoCarga: extracao.tipoCarga, textoOriginal: texto });
      return;
    }
    // Camada 3: saudação, pergunta sobre o bot, outro assunto, spam.
    await tratarConversaLivre(fromE164, texto, waMessageId, extracao);
    return;
  }

  // Busca em linguagem natural ("tem carga de container saindo de São
  // Paulo?") — com a origem e o tipo de carga que ele digitou.
  if (extracao.intent === "buscar") {
    await tratarBuscaDeFrete(fromE164, waMessageId, { origemTexto: extracao.origem, tipoCarga: extracao.tipoCarga, textoOriginal: texto });
    return;
  }

  // Cálculo. A conta já existe ou nasce agora (qualquer mensagem cria).
  const { id: motoristaId, novo } = await garantirMotorista(fromE164, texto);
  // "truck grade baixa de 15 mil": o caminhão da mensagem vale pra esse
  // cálculo (e vira o cadastro se ele não tinha nenhum).
  const veiculoMsg = await resolverVeiculoDaMensagem(motoristaId, extracao);

  // Tem conta (pelo app) e escreveu do mesmo número: a mensagem já prova
  // a posse do telefone — vincula na hora, sem código VINCULAR.
  if (motoristaId && !novo) {
    const { data: m } = await supabase.from("motoristas").select("canal_wa_ativo").eq("id", motoristaId).maybeSingle();
    if (m && !m.canal_wa_ativo) {
      const { error } = await supabase
        .from("motoristas")
        .update({ canal_wa_ativo: true, telefone_verificado: true, telefone_verificado_em: new Date().toISOString() })
        .eq("id", motoristaId);
      if (error) {
        await logErro("wa-webhook.autoVinculo", "Falha ao vincular WhatsApp automaticamente", { erro: error.message, motoristaId });
      } else {
        await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto, extracao, status: "nao_vinculado" });
      }
    }
  }

  // Valor por tonelada (07/10): × tonelagem dita, senão × capacidade do
  // cadastro; sem nenhuma das duas, pergunta quantas toneladas (a memória
  // da conversa junta a resposta com a rota e o valor/t).
  let notaTonelada: string | null = null;
  if (extracao.valorFreteReais == null && extracao.valorPorToneladaReais != null && extracao.origem && extracao.destino) {
    let ton = extracao.toneladas;
    if (ton == null && motoristaId) {
      const { data: p } = await supabase.from("caminhao_perfil").select("carga_maxima_toneladas").eq("user_id", motoristaId).maybeSingle();
      ton = p?.carga_maxima_toneladas != null ? Number(p.carga_maxima_toneladas) : null;
    }
    if (ton == null) {
      await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto, extracao, status: "dado_faltando" });
      await enviarMensagemWhatsapp(
        fromE164,
        `${fmtBRL(extracao.valorPorToneladaReais)} por tonelada — quantas toneladas você leva nessa? Manda só o número (ex.: *"32 ton"*) que eu calculo o total.` + (novo && motoristaId ? AVISO_CADASTRO : ""),
      );
      return;
    }
    const porTon = extracao.valorPorToneladaReais;
    const total = Math.round(porTon * ton * 100) / 100;
    extracao = { ...extracao, valorFreteReais: total, confiancaValor: 1 };
    notaTonelada = `${fmtBRL(porTon)}/t × ${ton} t = ${fmtBRL(total)}`;
  }

  const faltando: string[] = [];
  if (!extracao.origem) faltando.push("origem");
  if (!extracao.destino) faltando.push("destino");
  if (extracao.valorFreteReais == null) faltando.push("valor do frete");

  if (faltando.length > 0) {
    await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto, extracao, status: "dado_faltando" });
    await enviarMensagemWhatsapp(
      fromE164,
      `Opa! Pra calcular faltou: ${faltando.join(", ")}. Manda com origem, destino e valor (ex.: *"Sorocaba pra Curitiba, 8 mil"*).` +
        (novo && motoristaId ? AVISO_CADASTRO : ""),
    );
    return;
  }

  // "coruipe" → Coruripe/AL antes de pedir a rota ao Google (03/10). Se
  // ficou em dúvida, já perguntou com botões e o pedido fica guardado.
  const cidades = await corrigirCidades(fromE164, texto, waMessageId, motoristaId, extracao);
  if (!cidades) return;
  extracao = cidades.ex;
  const { origem, destino } = cidades;
  const notaCidade = [cidades.nota, notaTonelada].filter(Boolean).join("; ") || null;
  const valorFreteReais = extracao.valorFreteReais as number;

  const confiancaMinima = Math.min(extracao.confiancaOrigem, extracao.confiancaDestino, extracao.confiancaValor);
  if (confiancaMinima < CONFIANCA_MINIMA) {
    await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto, extracao, status: "confirmacao_pendente" });
    await enviarMensagemWhatsapp(
      fromE164,
      `Não entendi direito — origem "${origem}", destino "${destino}", valor R$ ${valorFreteReais}. Se estiver certo, manda de novo mais claro (ex.: "frete de ${origem} pra ${destino}, R$ ${valorFreteReais}").` +
        (novo && motoristaId ? AVISO_CADASTRO : ""),
    );
    return;
  }

  // Criação de conta falhou: trial anônimo antigo (nunca deixa sem resposta).
  if (!motoristaId) {
    await calcularEResponderFrete({ fromE164, motoristaId: null, origem, destino, valorFreteReais, voltaVazia: extracao.voltaVazia, waMessageId, texto, extracao, veiculo: veiculoMsg, notaCidade });
    return;
  }

  // Sem caminhão cadastrado (conta nova, ou mandou "oi" antes, ou veio pelo
  // app e parou no perfil): calcula com o genérico e puxa os 3 toques.
  const { count: perfis } = await supabase
    .from("caminhao_perfil")
    .select("id", { count: "exact", head: true })
    .eq("user_id", motoristaId);

  await calcularEResponderFrete({
    fromE164,
    motoristaId,
    origem,
    destino,
    valorFreteReais,
    voltaVazia: extracao.voltaVazia,
    waMessageId,
    texto,
    extracao,
    primeiroContato: novo,
    semPerfil: (perfis ?? 0) === 0,
    veiculo: veiculoMsg,
    notaCidade,
  });
}

/**
 * Cauda comum de tratarPedidoDeCalculo (texto livre) e tratarRespostaLista
 * (clique num frete da busca, ver tratarBuscaDeFrete) — a partir daqui os
 * dois fluxos convergem: já se sabe origem/destino/valor, só falta
 * calcular (route-cost + perfil de custos) e responder. `extracao`/`texto`
 * ficam null/placeholder no fluxo de lista (não veio texto livre nem
 * passou pela IA) — só usados pra auditoria em wa_freight_query.
 *
 * `motoristaId: null` é o caso do TRIAL (estratégia B, Docs/status-sessao.md
 * 10/09): número sem conta nenhuma que já mandou um pedido de frete
 * completo — calcula com o mesmo PERFIL_CUSTO_DEFAULT usado por motorista
 * vinculado sem perfil, sem tentar buscar em `caminhao_perfil` (não existe
 * user_id pra buscar), e troca o rodapé da resposta por um CTA de
 * cadastro em vez do link de histórico (que não existe sem conta).
 */
async function calcularEResponderFrete(params: {
  fromE164: string;
  motoristaId: string | null;
  origem: string;
  destino: string;
  valorFreteReais: number;
  voltaVazia: boolean;
  waMessageId: string;
  texto: string;
  extracao: ExtracaoFrete | null;
  /** Conta acabou de ser criada nesta mensagem: rodapé avisa (LGPD + SAIR) e puxa o onboarding por botões. */
  primeiroContato?: boolean;
  /** Motorista sem caminhão cadastrado (veio pelo WhatsApp e mandou "oi" antes, ou pelo app e parou no perfil): puxa o onboarding por botões. */
  semPerfil?: boolean;
  /** Recalculando o mesmo frete depois do onboarding: lucro da estimativa genérica, pra mostrar a diferença. */
  recalculoDe?: number | null;
  /** Veio de um frete publicado (clique na lista): vai pro histórico com empresa/contato e o link do app destaca esse frete. */
  fretePublicado?: { id: string; empresaNome: string | null; contatoNome: string | null; contatoTelefone: string | null } | null;
  /** Caminhão dito na mensagem (resolverVeiculoDaMensagem): sobrepõe eixos/carroceria do perfil nesse cálculo. */
  veiculo?: VeiculoDaMensagem | null;
  /** "entendi 'coruipe' como Coruripe/AL" — corrigirCidades (03/10). */
  notaCidade?: string | null;
}): Promise<void> {
  const { fromE164, motoristaId, origem, destino, valorFreteReais, voltaVazia, waMessageId, texto, extracao, primeiroContato, semPerfil, recalculoDe, fretePublicado, veiculo, notaCidade } = params;
  const anonimo = motoristaId == null;
  const puxarOnboarding = Boolean(primeiroContato || semPerfil);

  const rota = await chamarRouteCost(origem, destino);
  if (!rota) {
    await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto, extracao, status: "erro_extracao" });
    await enviarMensagemWhatsapp(fromE164, mensagemRotaNaoEncontrada(origem, destino));
    return;
  }

  // Checa `motoristaId == null` direto (em vez de usar a variável `anonimo`)
  // de propósito: é o que permite o TS estreitar `motoristaId` pra `string`
  // no branch do buscarPerfilOuDefault (ele não propaga a narrowing através
  // de uma variável booleana calculada separadamente).
  const custosDitos = await aplicarCustosDitos(motoristaId, motoristaId == null ? PERFIL_CUSTO_DEFAULT : await buscarPerfilOuDefault(motoristaId), extracao);
  const perfilBase = custosDitos.perfil;
  const perfil: PerfilCusto = veiculo
    ? { ...perfilBase, numero_eixos: veiculo.numeroEixos, tipo_carroceria: veiculo.tipoCarroceria ?? perfilBase.tipo_carroceria }
    : perfilBase;
  const dias = diasPorFaixaKm(rota.distanciaKm);
  // Mesmo ajuste carro->caminhão de Analisar.tsx: tarifa_caminhão = tarifa_carro × (eixos/2).
  const pedagioReais = rota.pedagioCentavos != null ? Math.round(rota.pedagioCentavos * (perfil.numero_eixos / 2)) / 100 : 0;
  const custos = perfilParaCustos(perfil, dias, pedagioReais);
  const tipoCarga = tipoCargaPorCarroceria(perfil.tipo_carroceria);

  const resultado = calcularFrete({
    origem,
    destino,
    distanciaKm: rota.distanciaKm,
    valorFrete: valorFreteReais,
    voltaVazia,
    margemDesejada: perfil.margem_desejada,
    custos,
    distanciaEstimada: rota.distanciaEstimada,
    numeroEixos: perfil.numero_eixos,
    tipoCarga,
  });

  await registrarTentativaFrete({
    waMessageId,
    motoristaId,
    fromE164,
    texto,
    extracao,
    status: anonimo ? "calculado_anonimo" : primeiroContato ? "calculado_novo" : recalculoDe != null ? "recalculado_perfil" : "calculado",
    resultado: { ...resultado, dias },
  });
  await registrarEventoAnalytics(anonimo ? "simulation_run_anonimo" : "simulation_run", motoristaId, {
    origem,
    destino,
    distancia_km: rota.distanciaKm,
    valor_frete: valorFreteReais,
    veredicto: resultado.veredicto,
    margem_desejada: perfil.margem_desejada,
    a_negociar: false,
    piso_antt: resultado.pisoANTT,
    abaixo_piso_antt: resultado.abaixoPisoANTT,
    lucro: resultado.lucro,
    caminhao_perfil_id: null,
  });

  const emoji = resultado.veredicto === "BOM" ? "✅" : resultado.veredicto === "ACEITÁVEL" ? "🟡" : "🔴";
  const avisoPiso = resultado.abaixoPisoANTT ? "\n⚠️ Valor abaixo do piso mínimo ANTT." : "";

  // Rodapé por situação (ver Docs/estrategia-viral-whatsapp.md §3):
  // - primeiro contato: estimativa genérica + aviso de conta criada (LGPD,
  //   com SAIR) — o gancho pro caminhão vem na mensagem de botões logo após;
  // - recálculo pós-onboarding: mostra a diferença pro genérico e avisa
  //   que o caminhão ficou salvo;
  // - motorista de sempre: link do app + rodapé encaminhável com o número
  //   do bot (o veredito é o objeto viral);
  // - anônimo (só se a criação de conta falhou): CTA de cadastro antigo.
  // (Havia aqui um rodapé fixo "Calcule o seu: +55…" pensado pra quando o
  // motorista encaminha o veredito num grupo — mas lido no próprio chat
  // com o bot ele não faz sentido. Removido em 24/09 a pedido do Raphael;
  // o compartilhamento fica só no botão explícito "Mandar pro colega".)
  const linhaCompartilhe = "";

  // 01/10: o cálculo do bot vai pro MESMO histórico do app (analise_frete)
  // — antes ficava só em wa_freight_query e a Garagem abria vazia pra quem
  // só usava o WhatsApp. Mesmo formato de montarLinhaAnalise (lib/frete.ts),
  // então Resultado.tsx renderiza por id sem adaptação.
  let analiseId: string | null = null;
  if (motoristaId) {
    analiseId = crypto.randomUUID();
    const { error: errAnalise } = await supabase.from("analise_frete").insert({
      id: analiseId,
      user_id: motoristaId,
      caminhao_perfil_id: null,
      origem,
      destino,
      distancia_km: rota.distanciaKm,
      distancia_estimada: rota.distanciaEstimada,
      volta_vazia: voltaVazia,
      valor_frete_centavos: Math.round(valorFreteReais * 100),
      margem_desejada: perfil.margem_desejada,
      numero_eixos: perfil.numero_eixos,
      custos_snapshot: custos,
      resultado_snapshot: resultado,
      veredicto: resultado.veredicto,
      formula_versao: resultado.formulaVersao,
      empresa_nome: fretePublicado?.empresaNome ?? null,
      contato_nome: fretePublicado?.contatoNome ?? null,
      contato_telefone: fretePublicado?.contatoTelefone ?? null,
      valor_a_combinar: false,
    });
    if (errAnalise) {
      await logErro("wa-webhook.analiseFrete", "Falha ao gravar analise_frete", { erro: errAnalise.message, motoristaId });
      analiseId = null;
    }
  }

  // Destino do link (decisão do Raphael, 01/10): frete da lista → busca do
  // app com esse frete destacado (ele refaz no app o gesto do WhatsApp);
  // cálculo em texto → tela de resultado com o detalhamento.
  const caminhoApp = fretePublicado
    ? `/buscar-frete?frete=${fretePublicado.id}`
    : analiseId
      ? `/resultado/${analiseId}`
      : "/buscar-frete";
  const linkBusca = await linkApp(motoristaId, caminhoApp);
  const fraseLink = fretePublicado
    ? "Esse frete e outros perto de você no app (abre já logado)"
    : "Detalhe completo desse cálculo no app (abre já logado)";
  let rodape: string;
  if (anonimo) {
    rodape =
      `(estimativa com um caminhão padrão — cadastre o seu em instantes pra ter o valor exato do SEU caminhão)\n\n` +
      `🚀 Gostou? Cadastre-se grátis: ${URL_APP}/entrar`;
  } else if (primeiroContato) {
    // Se o caminhão veio na própria mensagem ("truck grade baixa"), o
    // cálculo já usou ele — dizer "carreta padrão" aqui contradizia a linha
    // "Salvei seu Truck…" logo abaixo (testes-bot #49, 08/10).
    const comQue = veiculo?.tipoVeiculo
      ? `seu ${nomeVeiculo(veiculo.tipoVeiculo, perfil.numero_eixos)}, consumo e custos padrão`
      : `uma carreta padrão de ${perfil.numero_eixos} eixos`;
    rodape =
      `_(estimativa com ${comQue})_\n\n` +
      `Seu número ficou cadastrado no Rode com Lucro. Pra apagar tudo, manda *SAIR*. Termos: ${URL_APP}/termos`;
  } else if (semPerfil && !veiculo?.perfilCriado) {
    rodape = `_(estimativa com uma carreta padrão de ${perfil.numero_eixos} eixos — você ainda não cadastrou o seu)_`;
  } else if (veiculo?.perfilCriado) {
    rodape = `_(estimativa com ${nomeVeiculo(veiculo.tipoVeiculo, perfil.numero_eixos)}, consumo e custos padrão — ajusta no app)_\n\n📲 ${fraseLink}: ${linkBusca}`;
  } else if (recalculoDe != null) {
    const dif = resultado.lucro - recalculoDe;
    const difTxt = Math.abs(dif) < 1 ? "praticamente o mesmo" : dif > 0 ? `${fmtBRL(dif)} a mais que a estimativa` : `${fmtBRL(-dif)} a menos que a estimativa`;
    rodape =
      `Com o *seu* caminhão: ${difTxt}. 🚛 Perfil salvo.\n\n` +
      `📲 ${fraseLink}: ${linkBusca}` +
      linhaCompartilhe;
  } else {
    rodape =
      `(estimativa com base no seu perfil cadastrado no app — ${dias} dia${dias > 1 ? "s" : ""} de viagem)\n\n` +
      `📲 ${fraseLink}: ${linkBusca}` +
      linhaCompartilhe;
  }

  const resposta =
    `📦 ${origem} → ${destino} (${rota.distanciaKm.toFixed(0)} km${rota.distanciaEstimada ? ", estimado" : ""}${voltaVazia ? ", voltando vazio" : ""})\n` +
    `Valor ofertado: ${fmtBRL(valorFreteReais)}\n` +
    `Custo estimado: ${fmtBRL(resultado.custoTotal)}\n` +
    `Lucro estimado: ${fmtBRL(resultado.lucro)} (margem ${fmtPct(resultado.margemReal)})\n` +
    `Piso ANTT: ${fmtBRL(resultado.pisoANTT)}${avisoPiso}\n\n` +
    `${emoji} Veredito: ${resultado.veredicto}\n\n` +
    rodape +
    (rota.pedagioCentavos == null ? `\n_${NOTA_SEM_PEDAGIO}_` : "") +
    (custosDitos.nota ? `\n_${custosDitos.nota}_` : "") +
    (notaCidade ? `\n_${notaCidade}_` : "") +
    (veiculo?.nota ? `\n_${veiculo.nota}_` : "");

  await enviarMensagemWhatsapp(fromE164, resposta);

  // Caminhão da mensagem difere do cadastrado: oferece salvar (um toque).
  if (veiculo?.botaoSalvar) {
    await enviarBotoes(fromE164, "Quer que eu use esse caminhão nos próximos cálculos?", [veiculo.botaoSalvar]);
    return;
  }

  // Primeiro contato: emenda a pergunta do caminhão (3 toques). Guarda o
  // frete pra recalcular no fim e mostrar a diferença. Se a mensagem já
  // trouxe o caminhão (perfilCriado), não precisa dos toques.
  if (puxarOnboarding && motoristaId && !veiculo?.perfilCriado) {
    await iniciarOnboardingCaminhao(fromE164, motoristaId, { origem, destino, valorFreteReais, voltaVazia, lucroGenerico: resultado.lucro });
    return;
  }

  // Motorista já com perfil: a cada N cálculos oferece o cartão pra
  // mandar pro colega. Não em todo cálculo (vira ruído e custa mensagem
  // a partir de 1/10) — no 1º recálculo e depois a cada 5.
  // Cadastro por foto (07/10): uma vez, depois de um cálculo completo (nunca
  // na 1ª mensagem; onboarding do caminhão tem prioridade). Se mandou o
  // convite, não manda o cartão viral na mesma rodada.
  if (!anonimo && motoristaId && (await convidarCadastroPorFoto(fromE164, motoristaId, waMessageId))) return;

  if (!anonimo && motoristaId && (recalculoDe != null || (await contarCalculos(motoristaId)) % 5 === 0)) {
    await enviarBotoes(fromE164, "Conhece alguém que ia gostar de saber se o frete vale a pena?", [
      { id: "viral:cartao", titulo: "Mandar pro colega" },
    ]);
  }
}

async function contarCalculos(motoristaId: string): Promise<number> {
  const { count } = await supabase
    .from("wa_freight_query")
    .select("id", { count: "exact", head: true })
    .eq("motorista_id", motoristaId)
    .in("status", ["calculado", "calculado_novo", "recalculado_perfil"]);
  return count ?? 0;
}

/** Botão "Mandar pro colega": envia o cartão de contato do bot + instrução. */
async function tratarPedidoCartao(fromE164: string, waMessageId: string): Promise<void> {
  const { data: m } = await supabase.from("motoristas").select("id, codigo_indicacao, nome").eq("telefone_e164", fromE164).maybeSingle();
  await enviarCartaoDeContato(fromE164);
  const codigo = m?.codigo_indicacao;
  const link = NUMERO_OFICIAL_WA && codigo ? `\n\nOu manda esse link num grupo: https://wa.me/${NUMERO_OFICIAL_WA}?text=${encodeURIComponent(`Calcula um frete pra mim #${codigo}`)}` : "";
  await enviarMensagemWhatsapp(fromE164, `👆 Encaminha esse contato pro colega. Ele salva e já manda a rota e o valor.${link}`);
  if (m) await registrarEventoAnalytics("referral_shared", m.id, { via: "cartao", wa_message_id: waMessageId });
}

// ---------------------------------------------------------------------
// Busca de frete via WhatsApp (busca-wpp) — gatilho "BUSCAR"/"FRETES"
// (detectarIntent) ou linguagem natural (extracao.ts, intent "buscar").
// Sem caminhão cadastrado, colhe pelos 3 toques e busca em seguida; a
// origem pode vir digitada na mensagem (30/09) ou da cidade base do app.
// Copia isomórfica de distanciaKm (apps/web/src/lib/municipios.ts) e do
// filtro de compatibilidade por tipo_veiculo (BuscarFrete.tsx) — Edge
// Function não importa de apps/web, mesmo padrão já usado por calc.ts.
// ---------------------------------------------------------------------

const RAIO_BUSCA_MAX_RESULTADOS = 3;
const URL_APP = "https://rode-com-lucro-mvp.vercel.app";
// Mesmo pepper do otp-solicitar/sessao-wa — o hash do token de login usa ele.
const TELEFONE_PEPPER = Deno.env.get("TELEFONE_PEPPER");
const LINK_LOGIN_VALIDADE_H = 24;

/**
 * Link mágico (30/09): o motorista já provou o número ao falar com o bot;
 * o link carrega essa prova até o navegador. Token de uso único (24h) em
 * wa_login_token; a Edge Function sessao-wa troca por sessão. Sem
 * motorista (trial anônimo) ou sem pepper, devolve o link puro.
 */
async function linkApp(motoristaId: string | null, caminho: string): Promise<string> {
  const base = `${URL_APP}${caminho}`;
  if (!motoristaId || !TELEFONE_PEPPER) return base;
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(TELEFONE_PEPPER), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`login:${token}`));
  const tokenHash = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const { error } = await supabase.from("wa_login_token").insert({
    token_hash: tokenHash,
    motorista_id: motoristaId,
    expira_em: new Date(Date.now() + LINK_LOGIN_VALIDADE_H * 60 * 60_000).toISOString(),
  });
  if (error) {
    await logErro("wa-webhook.linkApp", "Falha ao gravar token de login", { erro: error.message, motoristaId });
    return base;
  }
  return `${base}${base.includes("?") ? "&" : "?"}t=${token}`;
}

function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Mesma decisão de texto de montarMensagemWhatsapp (BuscarFrete.tsx), versão curta pra caber na lista. */
function textoValorCurto(valorACombinar: boolean, valorFreteCentavos: number | null, tipoValor: string | null): string {
  if (valorACombinar || valorFreteCentavos == null) return "A combinar";
  const valor = fmtBRL(valorFreteCentavos / 100);
  return tipoValor === "por_tonelada" ? `${valor}/ton` : valor;
}

interface MotoristaBusca {
  id: string;
  canal_wa_ativo: boolean;
  cidade_base: string | null;
  uf_base: string | null;
  cidade_base_lat: number | null;
  cidade_base_lng: number | null;
}

/** Tipo de carga citado na busca → carrocerias que carregam isso (mesmos nomes de caminhao_perfil.tipo_carroceria / fretes_publicados.tipos_carroceria_aceitos). */
const CARROCERIAS_POR_TIPO_CARGA: Record<TipoCargaBusca, string[]> = {
  container: ["Bug Porta Container"],
  frigorificada: ["Baú Frigorífico", "Baú Refrigerado"],
  granel: ["Graneleiro", "Caçamba", "Silo", "Cavaqueira", "Hoper"],
  liquido: ["Tanque"],
  veiculos: ["Cegonheiro"],
  carga_geral: ["Sider", "Baú", "Grade baixa", "Prancha", "Plataforma"],
};

const NOME_TIPO_CARGA: Record<TipoCargaBusca, string> = {
  container: "container",
  frigorificada: "carga frigorificada",
  granel: "granel",
  liquido: "carga líquida",
  veiculos: "veículos",
  carga_geral: "carga geral",
};

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

interface CidadeGeo {
  nome: string;
  uf: string;
  lat: number;
  lng: number;
}

/**
 * "São Paulo", "sao paulo sp", "Cuiabá/MT", "Sinop - MT" → lat/lng via
 * municipios_brasil (mesma tabela do app). Sem UF e com homônimos, fica
 * com o primeiro — o motorista vê a cidade/UF na resposta e corrige.
 */
async function geocodificarCidade(texto: string): Promise<CidadeGeo | null> {
  const cands = await sugerirMunicipios(texto, 1);
  const c = cands[0];
  // Busca é tolerante: aceita o melhor candidato se for razoável (o
  // motorista vê "perto de Coruripe/AL" na resposta e corrige se não for).
  if (!c || c.similaridade < LIMIAR_CIDADE_AUTO) return null;
  return { nome: c.nome, uf: c.uf, lat: c.lat, lng: c.lng };
}

// ---------------------------------------------------------------------------
// Corretor de cidade (03/10/2026) — caso real: "coruipe" virou "Coruípe" na
// extração, o Google não achou rota e o bot respondeu genérico duas vezes.
// Agora origem/destino passam por municipios_brasil (pg_trgm, RPC
// municipio_sugerir) ANTES do Google:
//   - casou exato (ou erro pequeno com folga pro 2º): segue com "Cidade/UF";
//   - parecido mas em dúvida (homônimos, erro grande): pergunta com botões
//     e guarda o pedido em wa_freight_query (status cidade_pendente);
//   - nada parecido: avisa qual cidade não achou e pede com o estado.
// ---------------------------------------------------------------------------
interface CandidatoCidade extends CidadeGeo {
  similaridade: number;
}
/** Similaridade mínima pra corrigir sozinho (com folga pro segundo colocado). */
const LIMIAR_CIDADE_AUTO = 0.45;
/** Folga mínima entre 1º e 2º pra não perguntar. */
const FOLGA_CIDADE_AUTO = 0.12;
/** Abaixo disso nem sugere. */
const LIMIAR_CIDADE_SUGERIR = 0.3;
/** Homônimo que é capital ganha ("belem" = Belém/PA, não Belém/PB) — avisa em vez de perguntar. */
const CAPITAIS = new Set([
  "Rio Branco/AC", "Maceió/AL", "Macapá/AP", "Manaus/AM", "Salvador/BA", "Fortaleza/CE", "Brasília/DF", "Vitória/ES", "Goiânia/GO",
  "São Luís/MA", "Cuiabá/MT", "Campo Grande/MS", "Belo Horizonte/MG", "Belém/PA", "João Pessoa/PB", "Curitiba/PR", "Recife/PE",
  "Teresina/PI", "Rio de Janeiro/RJ", "Natal/RN", "Porto Alegre/RS", "Porto Velho/RO", "Boa Vista/RR", "Florianópolis/SC",
  "São Paulo/SP", "Aracaju/SE", "Palmas/TO",
]);
/** Apelidos que o motorista usa como se fossem cidade. */
const APELIDOS_CIDADE: Record<string, string> = {
  sp: "sao paulo/sp", sampa: "sao paulo/sp", rj: "rio de janeiro/rj", rio: "rio de janeiro/rj",
  bh: "belo horizonte/mg", poa: "porto alegre/rs", cwb: "curitiba/pr", bsb: "brasilia/df",
  floripa: "florianopolis/sc", ssa: "salvador/ba", cuiaba: "cuiaba/mt", "campo grande": "campo grande/ms",
  // Nome curto de cidade grande que bate EXATO com município pequeno homônimo
  // (08/10: "sao bernardo" virou São Bernardo/MA e listou carga no Maranhão).
  "sao bernardo": "sao bernardo do campo/sp", sbc: "sao bernardo do campo/sp",
  "sao caetano": "sao caetano do sul/sp", scs: "sao caetano do sul/sp",
  ribeirao: "ribeirao preto/sp", "rio preto": "sao jose do rio preto/sp", sjc: "sao jose dos campos/sp",
  mogi: "mogi das cruzes/sp", feira: "feira de santana/ba", "juiz": "juiz de fora/mg",
  "montes claros": "montes claros/mg", "sao luis": "sao luis/ma", "pres prudente": "presidente prudente/sp",
  "sao goncalo": "sao goncalo/rj", "nova iguacu": "nova iguacu/rj", "duque de caxias": "duque de caxias/rj",
};

async function sugerirMunicipios(texto: string, limite = 3): Promise<CandidatoCidade[]> {
  let t = semAcento(texto).replace(/[.,;:!?]+$/g, "");
  if (APELIDOS_CIDADE[t]) t = APELIDOS_CIDADE[t];
  // Abreviações que o motorista digita ("sto andre", "sta maria", "pto alegre", "s jose dos campos").
  t = t.replace(/\bsto\.?\s/g, "santo ").replace(/\bsta\.?\s/g, "santa ").replace(/\bpto\.?\s/g, "porto ").replace(/^s\.?\s(?=\w)/, "sao ");
  if (!t) return [];
  const { data, error } = await supabase.rpc("municipio_sugerir", { p_texto: t, p_limite: limite });
  if (error) {
    await logErro("wa-webhook.sugerirMunicipios", "RPC municipio_sugerir falhou", { erro: error.message, texto });
    return [];
  }
  return ((data ?? []) as { nome: string; uf: string; latitude: number; longitude: number; similaridade: number }[]).map((l) => ({
    nome: l.nome,
    uf: l.uf,
    lat: Number(l.latitude),
    lng: Number(l.longitude),
    similaridade: Number(l.similaridade),
  }));
}

type DecisaoCidade =
  | { tipo: "ok"; canonico: string; corrigiu: boolean }
  | { tipo: "perguntar"; candidatos: CandidatoCidade[] }
  | { tipo: "estado"; uf: string; nome: string }
  | { tipo: "nao_achou" };

/** Nome de estado escrito como se fosse cidade ("pra Minas", "saindo da Bahia"). SP/RJ ficam de fora: são capital também. */
const ESTADOS: Record<string, [string, string]> = {
  acre: ["AC", "Acre"], alagoas: ["AL", "Alagoas"], amapa: ["AP", "Amapá"], amazonas: ["AM", "Amazonas"], bahia: ["BA", "Bahia"],
  ceara: ["CE", "Ceará"], "espirito santo": ["ES", "Espírito Santo"], goias: ["GO", "Goiás"], maranhao: ["MA", "Maranhão"],
  "mato grosso": ["MT", "Mato Grosso"], "mato grosso do sul": ["MS", "Mato Grosso do Sul"], minas: ["MG", "Minas"], "minas gerais": ["MG", "Minas Gerais"],
  para: ["PA", "Pará"], paraiba: ["PB", "Paraíba"], parana: ["PR", "Paraná"], pernambuco: ["PE", "Pernambuco"], piaui: ["PI", "Piauí"],
  "rio grande do norte": ["RN", "Rio Grande do Norte"], "rio grande do sul": ["RS", "Rio Grande do Sul"], rondonia: ["RO", "Rondônia"],
  roraima: ["RR", "Roraima"], "santa catarina": ["SC", "Santa Catarina"], sergipe: ["SE", "Sergipe"], tocantins: ["TO", "Tocantins"],
  nordeste: ["--", "Nordeste"], sul: ["--", "Sul"], norte: ["--", "Norte"], "centro oeste": ["--", "Centro-Oeste"], sudeste: ["--", "Sudeste"],
};

async function decidirCidade(texto: string): Promise<DecisaoCidade> {
  const chave = semAcento(texto).replace(/^(o|a|do|da|de|no|na)\s+/, "").replace(/\/\w{2}$/, "").trim();
  const estado = ESTADOS[chave];
  if (estado) return { tipo: "estado", uf: estado[0], nome: estado[1] };
  const cands = await sugerirMunicipios(texto, 5); // 5 pra capital não ficar de fora entre homônimos
  if (cands.length === 0) return { tipo: "nao_achou" };
  const [a, b] = cands;
  const canonico = `${a.nome}/${a.uf}`;
  const exatos = cands.filter((c) => c.similaridade >= 0.999);
  if (exatos.length === 1) return { tipo: "ok", canonico, corrigiu: false };
  if (exatos.length > 1) {
    const capital = exatos.find((c) => CAPITAIS.has(`${c.nome}/${c.uf}`));
    if (capital) return { tipo: "ok", canonico: `${capital.nome}/${capital.uf}`, corrigiu: true };
    return { tipo: "perguntar", candidatos: exatos }; // homônimos sem UF e sem capital
  }
  if (a.similaridade >= LIMIAR_CIDADE_AUTO && (!b || a.similaridade - b.similaridade >= FOLGA_CIDADE_AUTO)) {
    return { tipo: "ok", canonico, corrigiu: true };
  }
  const plausiveis = cands.filter((c) => c.similaridade >= LIMIAR_CIDADE_SUGERIR);
  return plausiveis.length > 0 ? { tipo: "perguntar", candidatos: plausiveis } : { tipo: "nao_achou" };
}

/**
 * Resolve origem e destino da extração. Devolve null quando a conversa
 * ficou pendente (perguntou com botões) ou quando avisou que não achou —
 * nos dois casos já respondeu ao motorista.
 */
async function corrigirCidades(
  fromE164: string,
  texto: string,
  waMessageId: string,
  motoristaId: string | null,
  ex: ExtracaoFrete,
): Promise<{ ex: ExtracaoFrete; origem: string; destino: string; nota: string | null } | null> {
  const notas: string[] = [];
  const novo = { ...ex };
  for (const campo of ["origem", "destino"] as const) {
    const original = novo[campo];
    if (!original) continue;
    const d = await decidirCidade(original);
    if (d.tipo === "ok") {
      if (d.corrigiu) notas.push(`entendi "${original}" como ${d.canonico}`);
      novo[campo] = d.canonico;
      continue;
    }
    if (d.tipo === "estado") {
      await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto, extracao: novo, status: "dado_faltando" });
      const outro = campo === "origem" ? novo.destino : novo.origem;
      await enviarMensagemWhatsapp(
        fromE164,
        `${d.nome} é ${d.uf === "--" ? "uma região" : "um estado"} — qual cidade? Manda ex.: *"${campo === "origem" ? `Uberlândia${d.uf !== "--" ? `/${d.uf}` : ""} pra ${outro ?? "Santos"}` : `${outro ?? "Campinas"} pra Uberlândia${d.uf !== "--" ? `/${d.uf}` : ""}`}${novo.valorFreteReais ? `, ${novo.valorFreteReais} reais` : ""}"*`,
      );
      return null;
    }
    // Pendência: guarda o pedido inteiro (com o que já foi corrigido) e pergunta.
    await registrarTentativaFrete({
      waMessageId, motoristaId, fromE164, texto, extracao: novo,
      status: d.tipo === "perguntar" ? "cidade_pendente" : "erro_extracao",
      resultado: d.tipo === "perguntar" ? { campo, texto: original, candidatos: d.candidatos.slice(0, 3).map((c) => `${c.nome}/${c.uf}`) } : { campo, texto: original, motivo: "nao_achou" },
    });
    const rotulo = campo === "origem" ? "saída" : "destino";
    if (d.tipo === "perguntar") {
      await enviarBotoes(
        fromE164,
        `Não achei "${original}" exatamente. A cidade de ${rotulo} é qual dessas?`,
        d.candidatos.slice(0, 3).map((c) => ({ id: `cidade:${campo === "origem" ? "o" : "d"}:${c.nome}/${c.uf}`, titulo: `${c.nome}/${c.uf}` })),
      );
    } else {
      await enviarMensagemWhatsapp(fromE164, `Não achei nenhuma cidade parecida com "${original}". Manda de novo com o estado, tipo *"Diadema/SP pra Coruripe/AL"*.`);
    }
    return null;
  }
  return { ex: novo, origem: novo.origem as string, destino: novo.destino as string, nota: notas.length ? notas.join("; ") : null };
}

/** Toque no botão "Coruripe/AL": recupera o pedido pendente e segue de onde parou. */
async function tratarEscolhaCidade(fromE164: string, rowId: string, waMessageId: string): Promise<void> {
  const [, campoCurto, ...resto] = rowId.split(":");
  const escolhida = resto.join(":");
  const campo = campoCurto === "o" ? "origem" : "destino";
  const desde = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data: pend } = await supabase
    .from("wa_freight_query")
    .select("texto_recebido, extracao_snapshot, criado_em")
    .eq("from_e164", fromE164)
    .eq("status", "cidade_pendente")
    .gte("criado_em", desde)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ex = (pend?.extracao_snapshot ?? null) as ExtracaoFrete | null;
  if (!ex || !escolhida) {
    await enviarMensagemWhatsapp(fromE164, 'Esse pedido já expirou. Manda de novo a rota e o valor, com o estado nas cidades (ex.: *"Diadema/SP pra Coruripe/AL, 15 mil"*).');
    return;
  }
  const corrigida: ExtracaoFrete = { ...ex, [campo]: escolhida };
  await despacharExtracao(fromE164, pend!.texto_recebido as string, waMessageId, corrigida);
}

interface OpcoesBusca {
  /** Cidade de saída digitada na mensagem ("tem carga saindo de Cuiabá?"); null = cidade base do cadastro. */
  origemTexto?: string | null;
  /** Tipo de carga citado; filtra por carroceria compatível. */
  tipoCarga?: TipoCargaBusca | null;
  /** Texto pra abrir a mensagem (ex.: "Caminhão salvo: Carreta de 5 eixos. "). */
  prefixo?: string;
  /** Mensagem original, pra auditoria. */
  textoOriginal?: string;
}

/**
 * Busca de fretes. Decisões de 30/09 (Docs/status-sessao.md):
 * - a conta nasce aqui se o número for novo (qualquer mensagem cria);
 * - sem caminhão cadastrado, guarda a busca em wa_onboarding e puxa os 3
 *   toques — ao terminar, a busca roda sozinha (tratarRespostaOnboarding);
 * - origem: a que ele DIGITOU, se digitou; senão a cidade base do cadastro;
 *   sem nenhuma das duas, pergunta de que cidade quer sair.
 */
async function tratarBuscaDeFrete(fromE164: string, waMessageId: string, opcoes: OpcoesBusca = {}): Promise<void> {
  const origemTexto = opcoes.origemTexto ?? null;
  const tipoCarga = opcoes.tipoCarga ?? null;
  const textoOriginal = opcoes.textoOriginal ?? "[busca]";
  const descCarga = tipoCarga ? `carga de ${NOME_TIPO_CARGA[tipoCarga]}` : "carga";

  const { id: motoristaId, novo } = await garantirMotorista(fromE164, textoOriginal);
  if (!motoristaId) {
    // Criação de conta falhou — sem user_id não dá pra guardar onboarding nem perfil.
    await registrarTentativaFrete({ waMessageId, motoristaId: null, fromE164, texto: textoOriginal, extracao: null, status: "nao_cadastrado" });
    await enviarMensagemWhatsapp(fromE164, mensagemApresentacao(false));
    return;
  }
  const avisoNovo = novo ? AVISO_CADASTRO : "";

  const { data: motorista } = await supabase
    .from("motoristas")
    .select("id, canal_wa_ativo, cidade_base, uf_base, cidade_base_lat, cidade_base_lng")
    .eq("id", motoristaId)
    .maybeSingle<MotoristaBusca>();
  if (motorista && !motorista.canal_wa_ativo) {
    await supabase
      .from("motoristas")
      .update({ canal_wa_ativo: true, telefone_verificado: true, telefone_verificado_em: new Date().toISOString() })
      .eq("id", motorista.id);
  }

  const { data: perfil } = await supabase
    .from("caminhao_perfil")
    .select("tipo_veiculo, tipo_carroceria")
    .eq("user_id", motoristaId)
    .maybeSingle();
  const tipoVeiculo = (perfil?.tipo_veiculo as string | null) ?? null;

  // Sem caminhão: guarda o pedido e pergunta o tipo (3 toques). A busca
  // roda no fim do onboarding com o que ele pediu aqui.
  if (!tipoVeiculo) {
    await supabase.from("wa_onboarding").upsert({
      from_e164: fromE164,
      motorista_id: motoristaId,
      etapa: "tipo",
      ultimo_frete: { busca: true, origemTexto, tipoCarga },
      updated_at: new Date().toISOString(),
    });
    await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto: textoOriginal, extracao: null, status: "busca_origem" });
    const deOnde = origemTexto ? ` saindo de ${origemTexto}` : "";
    await enviarBotoes(
      fromE164,
      `Opa! ${tipoCarga || origemTexto ? `${descCarga[0].toUpperCase()}${descCarga.slice(1)}${deOnde} — tenho como buscar.` : "Tenho como buscar carga pra você."} Só preciso saber seu caminhão pra filtrar o que serve. Qual é o tipo?` +
        avisoNovo,
      TIPOS_VEICULO_BOTOES.map((t) => ({ id: t.id, titulo: t.titulo })),
    );
    return;
  }

  // Origem: digitada > cidade base > pergunta.
  let origem: CidadeGeo | null = null;
  if (origemTexto) {
    // Na busca, só casamento EXATO segue direto. "abc paulista" casava 60%
    // com Paulista/PB e buscava carga na Paraíba (simulador, 07/10) — então
    // correção ou dúvida vira pergunta com botões; nada parecido, pergunta
    // em texto. Status busca_origem mantém o contexto pra próxima mensagem.
    const decisao = await decidirCidade(origemTexto);
    if (decisao.tipo === "estado") {
      await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto: textoOriginal, extracao: null, status: "busca_origem" });
      await enviarMensagemWhatsapp(fromE164, `${decisao.nome} é ${decisao.uf === "--" ? "uma região" : "um estado"} — de qual cidade você quer sair? Manda só o nome (ex.: *"Uberlândia/MG"*).` + avisoNovo);
      return;
    }
    const cands = decisao.tipo === "nao_achou" ? [] : await sugerirMunicipios(origemTexto, 2);
    if (decisao.tipo === "ok" && !decisao.corrigiu) {
      origem = await geocodificarCidade(decisao.canonico);
    }
    if (!origem) {
      const plausiveis = cands.filter((c) => c.similaridade >= LIMIAR_CIDADE_SUGERIR);
      await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto: textoOriginal, extracao: null, status: "busca_origem", resultado: { candidatos: plausiveis.slice(0, 2).map((c) => `${c.nome}/${c.uf}`) } });
      if (plausiveis.length) {
        await enviarBotoes(
          fromE164,
          `Não achei "${origemTexto}" exatamente. Você quer sair de qual cidade?` + avisoNovo,
          [
            ...plausiveis.slice(0, 2).map((c) => ({ id: `busca:origem:${tipoCarga ?? "-"}:${c.nome}/${c.uf}`, titulo: `${c.nome}/${c.uf}` })),
            { id: `busca:origem:${tipoCarga ?? "-"}:?`, titulo: "Outra cidade" },
          ],
        );
      } else {
        await enviarMensagemWhatsapp(
          fromE164,
          `Não achei "${origemTexto}" como cidade. De qual cidade exatamente? Manda só o nome, com o estado se puder (ex.: *"Santo André/SP"*).` + avisoNovo,
        );
      }
      return;
    }
    // A cidade que ele digitou vira a "cidade atual" — é de onde a tela
    // Buscar Frete do app parte (BuscarFrete.tsx lê motoristas.cidade_atual).
    // Assim o app abre em Guarulhos, não numa busca vazia (David, 01/10).
    await supabase
      .from("motoristas")
      .update({ cidade_atual: origem.nome, uf_atual: origem.uf || null, cidade_atual_lat: origem.lat, cidade_atual_lng: origem.lng })
      .eq("id", motoristaId);
  } else if (motorista?.cidade_base_lat != null && motorista.cidade_base_lng != null && motorista.cidade_base) {
    origem = { nome: motorista.cidade_base, uf: motorista.uf_base ?? "", lat: motorista.cidade_base_lat, lng: motorista.cidade_base_lng };
  }
  if (!origem) {
    await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto: textoOriginal, extracao: null, status: "busca_origem" });
    await enviarMensagemWhatsapp(
      fromE164,
      `De que cidade você quer sair? Manda ex.: *"tem ${descCarga} saindo de Cuiabá/MT?"*\n\n_Pra não precisar dizer toda vez, cadastre sua cidade base no app: ${await linkApp(motoristaId, "/motorista")}_` +
        avisoNovo,
    );
    return;
  }

  // O limit precisa cobrir TODOS os fretes "aberto" (hoje ~800): o filtro
  // por distância roda em memória depois. Bug real de 02/09 com limit(300).
  const { data: fretesRaw, error } = await supabase
    .from("fretes_publicados")
    .select(
      "id, origem_cidade, origem_uf, origem_lat, origem_lng, destino_cidade, destino_uf, valor_frete_centavos, valor_a_combinar, tipo_valor, tipos_veiculo_aceitos, tipos_carroceria_aceitos",
    )
    .eq("status", "aberto")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error || !fretesRaw) {
    // eslint-disable-next-line no-console
    console.error("[wa-webhook] falha ao buscar fretes_publicados", error);
    await enviarMensagemWhatsapp(fromE164, "Não consegui buscar os fretes agora. Tenta de novo em instantes ou use o app.");
    return;
  }

  const carroceriasCarga = tipoCarga ? CARROCERIAS_POR_TIPO_CARGA[tipoCarga] : null;
  const compativeis = (fretesRaw as Array<Record<string, unknown>>)
    .filter((f) => {
      const tipos = (f.tipos_veiculo_aceitos as string[] | null) ?? [];
      return tipos.length === 0 || tipos.includes(tipoVeiculo);
    })
    .filter((f) => {
      if (!carroceriasCarga) return true;
      const aceitas = (f.tipos_carroceria_aceitos as string[] | null) ?? [];
      return aceitas.length === 0 || aceitas.some((c) => carroceriasCarga.includes(c));
    })
    .filter((f) => f.origem_lat != null && f.origem_lng != null)
    .map((f) => ({
      id: f.id as string,
      origemCidade: f.origem_cidade as string,
      origemUf: f.origem_uf as string,
      destinoCidade: f.destino_cidade as string,
      destinoUf: f.destino_uf as string,
      valorFreteCentavos: f.valor_frete_centavos as number | null,
      valorACombinar: Boolean(f.valor_a_combinar),
      tipoValor: (f.tipo_valor as "fixo" | "por_tonelada" | null) ?? null,
      distanciaOrigemKm: distanciaKm(origem.lat, origem.lng, f.origem_lat as number, f.origem_lng as number),
    }))
    .sort((a, b) => a.distanciaOrigemKm - b.distanciaOrigemKm)
    .slice(0, RAIO_BUSCA_MAX_RESULTADOS);

  const lugar = `${origem.nome}${origem.uf ? `/${origem.uf}` : ""}`;

  if (compativeis.length === 0) {
    await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto: textoOriginal, extracao: null, status: "busca_sem_resultado" });
    await enviarMensagemWhatsapp(
      fromE164,
      `${opcoes.prefixo ?? ""}Não achei ${descCarga} pra ${tipoVeiculo} perto de ${lugar} agora. Vou ficando de olho — tenta de novo mais tarde ou veja tudo no app: ${await linkApp(motoristaId, "/buscar-frete")}` +
        avisoNovo,
    );
    return;
  }

  // Título tem 24 chars na Meta — "Ribeirão Preto/SP → Águas…" cortava o
  // destino (print do Raphael, 30/09). O que o motorista quer ver é PRA
  // ONDE vai: título = destino; origem, valor e distância na descrição.
  const linhas: LinhaListaFrete[] = compativeis.map((f) => ({
    id: f.id,
    title: truncar(`→ ${f.destinoCidade}/${f.destinoUf}`, 24),
    description: truncar(
      `de ${f.origemCidade}/${f.origemUf} · ${textoValorCurto(f.valorACombinar, f.valorFreteCentavos, f.tipoValor)} · a ${f.distanciaOrigemKm.toFixed(0)} km`,
      72,
    ),
  }));
  linhas.push({ id: "abrir_app", title: "Abrir o app", description: "Ver todos os fretes e mais detalhes" });

  const n = compativeis.length;
  const corpo =
    `${opcoes.prefixo ?? ""}Encontrei ${n} ${n > 1 ? "opções" : "opção"} de ${descCarga} pra ${tipoVeiculo} perto de ${lugar}. Toque numa pra ver se vale a pena:` +
    avisoNovo;
  await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto: textoOriginal, extracao: null, status: "busca_lista", resultado: { origem: lugar, encontrados: n } });
  await enviarListaFretes(fromE164, linhas, corpo);
}

/**
 * Resposta a um clique na lista enviada por tratarBuscaDeFrete. "abrir_app"
 * é o 4º item fixo; qualquer outro id é o UUID de um fretes_publicados.
 * Reverifica status="aberto" (pode ter fechado entre o envio da lista e o
 * clique) antes de calcular — evita responder um cálculo de frete que já
 * saiu do ar.
 */

/** Botão "Paulista/PB" / "Outra cidade" depois de uma origem de busca em dúvida. */
async function tratarEscolhaOrigemBusca(fromE164: string, rowId: string, waMessageId: string): Promise<void> {
  const partes = rowId.split(":"); // busca:origem:<tipoCarga|->:<Nome/UF|?>
  const tipoCarga = partes[2] && partes[2] !== "-" ? (partes[2] as TipoCargaBusca) : null;
  const escolha = partes.slice(3).join(":");
  if (!escolha || escolha === "?") {
    const { data: m } = await supabase.from("motoristas").select("id").eq("telefone_e164", fromE164).maybeSingle();
    await registrarTentativaFrete({ waMessageId, motoristaId: m?.id ?? null, fromE164, texto: "[outra cidade]", extracao: null, status: "busca_origem" });
    await enviarMensagemWhatsapp(fromE164, 'De qual cidade você quer sair? Manda só o nome com o estado, ex.: *"Santo André/SP"*.');
    return;
  }
  await tratarBuscaDeFrete(fromE164, waMessageId, { origemTexto: escolha, tipoCarga, textoOriginal: `[botão: ${escolha}]` });
}

async function tratarRespostaLista(fromE164: string, rowId: string, waMessageId: string): Promise<void> {
  const { data: motorista } = await supabase
    .from("motoristas")
    .select("id, canal_wa_ativo")
    .eq("telefone_e164", fromE164)
    .maybeSingle();

  if (rowId === "abrir_app") {
    await enviarMensagemWhatsapp(fromE164, `Abra o app pra ver todos os fretes e mais detalhes (já entra logado): ${await linkApp(motorista?.id ?? null, "/buscar-frete")}`);
    return;
  }

  if (!motorista?.canal_wa_ativo) return; // defensivo — só quem está vinculado recebe a lista.

  const { data: frete } = await supabase
    .from("fretes_publicados")
    .select("id, origem_cidade, origem_uf, destino_cidade, destino_uf, valor_frete_centavos, valor_a_combinar, tipo_valor, status, empresa_nome, contato_nome, contato_telefone")
    .eq("id", rowId)
    .maybeSingle();

  if (!frete || frete.status !== "aberto") {
    await enviarMensagemWhatsapp(fromE164, 'Esse frete não está mais disponível. Manda "BUSCAR" de novo pra ver as opções atuais.');
    return;
  }

  const origem = `${frete.origem_cidade}/${frete.origem_uf}`;
  const destino = `${frete.destino_cidade}/${frete.destino_uf}`;

  if (frete.valor_a_combinar || frete.valor_frete_centavos == null) {
    await enviarMensagemWhatsapp(
      fromE164,
      `📦 ${origem} → ${destino}\nValor a combinar — abra o app pra ver os detalhes e negociar: ${await linkApp(motorista.id, "/buscar-frete")}`,
    );
    return;
  }

  // Fretes por tonelada: mesma regra do app (BuscarFrete.tsx) — só dá pra
  // estimar o total com a carga máxima do perfil do caminhão cadastrada;
  // sem isso, a taxa por tonelada crua NUNCA entra em calcularFrete().
  let valorFreteReais: number;
  if (frete.tipo_valor === "por_tonelada") {
    const { data: perfilCarga } = await supabase
      .from("caminhao_perfil")
      .select("carga_maxima_toneladas")
      .eq("user_id", motorista.id)
      .maybeSingle();
    const cargaMaxima = (perfilCarga?.carga_maxima_toneladas as number | null) ?? null;
    if (!cargaMaxima) {
      await enviarMensagemWhatsapp(
        fromE164,
        `📦 ${origem} → ${destino}\nEsse frete é por tonelada (${fmtBRL(frete.valor_frete_centavos / 100)}/ton) — cadastre a carga máxima do seu caminhão pra eu calcular o valor total: ${await linkApp(motorista.id, "/perfil")}\nEnquanto isso, abra o app pra negociar esse frete: ${URL_APP}/buscar-frete`,
      );
      return;
    }
    valorFreteReais = Math.round(frete.valor_frete_centavos * cargaMaxima) / 100;
  } else {
    valorFreteReais = frete.valor_frete_centavos / 100;
  }

  await calcularEResponderFrete({
    fromE164,
    motoristaId: motorista.id,
    origem,
    destino,
    valorFreteReais,
    voltaVazia: false,
    waMessageId,
    texto: `[busca] ${origem} -> ${destino}`,
    extracao: null,
    fretePublicado: {
      id: frete.id as string,
      empresaNome: (frete.empresa_nome as string | null) ?? null,
      contatoNome: (frete.contato_nome as string | null) ?? null,
      contatoTelefone: (frete.contato_telefone as string | null) ?? null,
    },
  });
}

// ===========================================================================
// CADASTRO POR FOTO — CNH + CRLV (07/10/2026). Textos aprovados em
// Docs/bot-cadastro-por-foto.md. Fluxo:
//   convite (1× após um cálculo) ou comando CADASTRO → "Pode ler" grava o
//   consentimento (consentimento.tipo = leitura_documento) → foto chega →
//   baixa da Meta (só com consentimento) → Haiku visão (documentos.ts) →
//   mostra o que leu + Salvar/Corrigir/Cancelar → grava só os campos
//   permitidos. A imagem nunca é gravada; CPF nunca é lido.
// Estado por número em wa_cadastro_foto (etapa, dados extraídos, media_id
// enquanto espera consentimento).
// ===========================================================================
interface EstadoCadastroFoto {
  from_e164: string;
  motorista_id: string;
  etapa: "aguardando_consentimento" | "aguardando_foto" | "confirmar" | "corrigir" | "tipo_veiculo";
  tipo_doc: "cnh" | "crlv" | null;
  dados: (DadosCNH & Partial<DadosCRLV> & { tipoVeiculo?: string | null }) | null;
  media_id: string | null;
  convidado_em: string | null;
}

const TEXTO_CONVITE_CADASTRO =
  `Quer que eu preencha seu cadastro sozinho? Manda uma *foto da CNH* e eu pego seu nome, categoria e validade. Depois a *foto do CRLV* do caminhão: marca, placa, eixos e capacidade.\n` +
  `Eu leio e apago a foto na hora — não guardo imagem nem CPF.`;
const TEXTO_PEDIR_FOTO = "Manda a foto da CNH (frente, aberta, sem dedo em cima). Depois a do CRLV.";
const TEXTO_CANCELOU = "Beleza, não salvei nada e a foto já foi apagada.";

async function estadoCadastroFoto(fromE164: string): Promise<EstadoCadastroFoto | null> {
  const { data } = await supabase.from("wa_cadastro_foto").select("*").eq("from_e164", fromE164).maybeSingle();
  return (data as EstadoCadastroFoto | null) ?? null;
}

async function gravarEstadoCadastroFoto(fromE164: string, motoristaId: string, patch: Partial<EstadoCadastroFoto>): Promise<void> {
  const { error } = await supabase
    .from("wa_cadastro_foto")
    .upsert({ from_e164: fromE164, motorista_id: motoristaId, etapa: "aguardando_foto", ...patch, updated_at: new Date().toISOString() }, { onConflict: "from_e164" });
  if (error) await logErro("wa-webhook.cadastroFoto", "Falha ao gravar estado", { erro: error.message, fromE164 });
}

async function temConsentimentoLeitura(motoristaId: string): Promise<boolean> {
  const { data } = await supabase
    .from("consentimento")
    .select("aceito")
    .eq("motorista_id", motoristaId)
    .eq("tipo", "leitura_documento")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Boolean(data?.aceito);
}

async function registrarConsentimentoLeitura(motoristaId: string, waMessageId: string): Promise<void> {
  // O próprio consentimento é o registro (quem, quando, versão); o wa_message_id fica em wa_freight_query.
  const { error } = await supabase.from("consentimento").insert({ motorista_id: motoristaId, tipo: "leitura_documento", versao: "1", aceito: true });
  if (error) await logErro("wa-webhook.cadastroFoto", "Falha ao gravar consentimento", { erro: error.message, motoristaId, waMessageId });
}

/** Convite único, depois de um cálculo completo. True se mandou (o chamador pula o cartão viral). */
async function convidarCadastroPorFoto(fromE164: string, motoristaId: string, waMessageId: string): Promise<boolean> {
  const estado = await estadoCadastroFoto(fromE164);
  if (estado?.convidado_em) return false;
  if (await temConsentimentoLeitura(motoristaId)) return false;
  const { data: m } = await supabase.from("motoristas").select("nome, cnh_numero").eq("id", motoristaId).maybeSingle();
  if (m?.nome && m?.cnh_numero) return false; // já tem cadastro — não precisa
  await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "aguardando_consentimento", convidado_em: new Date().toISOString() });
  await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto: "[convite cadastro por foto]", extracao: null, status: "doc_convite" });
  await enviarBotoes(fromE164, TEXTO_CONVITE_CADASTRO, [
    { id: "doc:ok", titulo: "Pode ler" },
    { id: "doc:nao", titulo: "Agora não" },
  ]);
  return true;
}

/** Comando CADASTRO: com consentimento pede a foto; sem, manda o convite. */
async function tratarComandoCadastro(fromE164: string, texto: string, waMessageId: string): Promise<void> {
  const { id: motoristaId, novo } = await garantirMotorista(fromE164, texto);
  if (!motoristaId) return;
  if (await temConsentimentoLeitura(motoristaId)) {
    await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "aguardando_foto", media_id: null, dados: null, tipo_doc: null });
    await enviarMensagemWhatsapp(fromE164, TEXTO_PEDIR_FOTO + (novo ? AVISO_CADASTRO : ""));
    return;
  }
  await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "aguardando_consentimento", convidado_em: new Date().toISOString() });
  await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto, extracao: null, status: "doc_convite" });
  await enviarBotoes(fromE164, TEXTO_CONVITE_CADASTRO + (novo ? AVISO_CADASTRO : ""), [
    { id: "doc:ok", titulo: "Pode ler" },
    { id: "doc:nao", titulo: "Agora não" },
  ]);
}

/** Baixa a mídia da Meta (2 passos: id → url assinada → bytes). Nada é gravado. */
async function baixarMidiaMeta(mediaId: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!WA_ACCESS_TOKEN) return null;
  try {
    const meta = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, { headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}` } });
    if (!meta.ok) {
      await logErro("wa-webhook.baixarMidia", "Meta não devolveu a url da mídia", { status: meta.status, detalhe: await meta.text() });
      return null;
    }
    const info = (await meta.json()) as { url?: string; mime_type?: string; file_size?: number };
    if (!info.url) return null;
    if ((info.file_size ?? 0) > 8 * 1024 * 1024) return null; // foto de celular fica bem abaixo; PDF do gov.br tem ~300 KB
    const bin = await fetch(info.url, { headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}` } });
    if (!bin.ok) return null;
    return { bytes: new Uint8Array(await bin.arrayBuffer()), mime: info.mime_type ?? "image/jpeg" };
  } catch (e) {
    await logErro("wa-webhook.baixarMidia", "Download da mídia lançou exceção", { erro: String(e) });
    return null;
  }
}

/** Foto chegou. Com consentimento, lê; sem, guarda o id e pergunta (msg 9). */
const MIMES_LEGIVEIS = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

async function tratarImagemRecebida(img: ImagemRecebida): Promise<void> {
  const { id: motoristaId } = await garantirMotorista(img.fromE164, "[imagem]");
  if (!motoristaId) return;
  if (!MIMES_LEGIVEIS.includes(img.mimeType)) {
    await registrarTentativaFrete({ waMessageId: img.waMessageId, motoristaId, fromE164: img.fromE164, texto: `[arquivo ${img.mimeType}]`, extracao: null, status: "doc_ilegivel", resultado: { motivo: "tipo_nao_suportado" } });
    await enviarMensagemWhatsapp(img.fromE164, "Esse arquivo não deu pra abrir. Manda a CNH ou o CRLV como *foto* (JPG/PNG) ou *PDF* — a CNH digital do gov.br em PDF funciona.");
    return;
  }
  if (await temConsentimentoLeitura(motoristaId)) {
    await processarImagemDocumento(img.fromE164, motoristaId, img.mediaId, img.waMessageId);
    return;
  }
  await gravarEstadoCadastroFoto(img.fromE164, motoristaId, { etapa: "aguardando_consentimento", media_id: img.mediaId });
  await registrarTentativaFrete({ waMessageId: img.waMessageId, motoristaId, fromE164: img.fromE164, texto: "[imagem sem consentimento]", extracao: null, status: "doc_imagem_sem_contexto" });
  await enviarBotoes(
    img.fromE164,
    "Recebi uma imagem. Se for sua *CNH* ou o *CRLV*, posso ler e preencher seu cadastro — não guardo a foto nem o CPF. Se for um frete, me manda em texto: rota e valor.",
    [
      { id: "doc:ok", titulo: "Pode ler" },
      { id: "doc:frete", titulo: "Era um frete" },
    ],
  );
}

function fmtDataBRdoc(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function textoConfirmacaoDoc(estado: EstadoCadastroFoto): string {
  const d = estado.dados ?? ({} as NonNullable<EstadoCadastroFoto["dados"]>);
  if (estado.tipo_doc === "cnh") {
    const vencida = d.validade && d.validade < new Date().toISOString().slice(0, 10);
    return (
      `📄 Li na sua CNH:\n` +
      `*Nome:* ${d.nome ?? "—"}\n` +
      `*Categoria:* ${d.categoria ?? "—"}\n` +
      `*Validade:* ${fmtDataBRdoc(d.validade ?? null)}\n` +
      `*Nº da CNH:* ${d.numero ?? "—"}\n` +
      (vencida ? `⚠️ Essa CNH venceu em ${fmtDataBRdoc(d.validade ?? null)}.\n` : "") +
      `Tá certo?`
    );
  }
  const veic = [d.marca, d.modelo].filter(Boolean).join(" ") || "—";
  const ano = d.ano ? ` (${d.ano})` : "";
  if (d.especie === "semirreboque" || d.especie === "reboque") {
    return (
      `🚛 Li no CRLV:\n` +
      `*Semirreboque:* ${veic}${d.carroceria ? ` ${d.carroceria}` : ""}${ano} · Placa ${d.placa ?? "—"} · ${d.eixos ?? "—"} eixos · ${d.capacidadeT ?? "—"} t\n` +
      `*Licenciamento:* ${d.exercicio ?? "—"}\n` +
      `Tá certo?`
    );
  }
  return (
    `🚛 Li no CRLV:\n` +
    `*Veículo:* ${veic}${ano}\n` +
    `*Placa:* ${d.placa ?? "—"}\n` +
    `*Eixos:* ${d.eixos ?? "—"} · *Capacidade:* ${d.capacidadeT ?? "—"} t\n` +
    `*Licenciamento:* ${d.exercicio ?? "—"}\n` +
    `Tá certo?`
  );
}

const BOTOES_CONFIRMAR_DOC = [
  { id: "doc:salvar", titulo: "Salvar" },
  { id: "doc:corrigir", titulo: "Corrigir" },
  { id: "doc:cancelar", titulo: "Cancelar" },
];

async function processarImagemDocumento(fromE164: string, motoristaId: string, mediaId: string, waMessageId: string): Promise<void> {
  const midia = await baixarMidiaMeta(mediaId);
  const leitura = midia ? await lerDocumento(bytesParaBase64(midia.bytes), midia.mime) : null;
  const link = await linkApp(motoristaId, "/motorista");
  if (!leitura || leitura.tipo === "ilegivel") {
    await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto: "[imagem]", extracao: null, status: "doc_ilegivel" });
    await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "aguardando_foto", media_id: null });
    await enviarMensagemWhatsapp(fromE164, `Não consegui ler. Tira de novo com o documento inteiro na tela, com luz e sem reflexo. Se preferir, manda pelo app: ${link}`);
    return;
  }
  if (leitura.tipo === "outro") {
    await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto: "[imagem]", extracao: null, status: "doc_ilegivel", resultado: { motivo: "nao_e_documento" } });
    await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "aguardando_foto", media_id: null });
    await enviarMensagemWhatsapp(fromE164, "Isso não parece uma CNH nem um CRLV. Manda a foto do documento inteiro, aberto. Se for um frete, me manda em texto: rota e valor.");
    return;
  }
  const dados = leitura.tipo === "cnh" ? { ...leitura.cnh } : { nome: null, categoria: null, validade: null, numero: null, ...leitura.crlv };
  const estado: EstadoCadastroFoto = { from_e164: fromE164, motorista_id: motoristaId, etapa: "confirmar", tipo_doc: leitura.tipo, dados, media_id: null, convidado_em: null };
  await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "confirmar", tipo_doc: leitura.tipo, dados, media_id: null });
  await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto: "[imagem]", extracao: null, status: "doc_lido", resultado: { tipo: leitura.tipo, campos_lidos: Object.entries(dados).filter(([, v]) => v != null).map(([k]) => k) } });
  await enviarBotoes(fromE164, textoConfirmacaoDoc(estado), BOTOES_CONFIRMAR_DOC);
}

/** Carroceria do CRLV (texto livre) → valor da lista do app. */
function carroceriaDoCRLV(texto: string | null): TipoCarroceriaMsg | null {
  if (!texto) return null;
  const t = semAcento(texto);
  const mapa: Array<[RegExp, TipoCarroceriaMsg]> = [
    [/frigor|refriger/, "Baú Frigorífico"],
    [/bau|furgao/, "Baú"],
    [/sider/, "Sider"],
    [/granel/, "Graneleiro"],
    [/tanque/, "Tanque"],
    [/cacamba|bascul/, "Caçamba"],
    [/prancha/, "Prancha"],
    [/plataforma/, "Plataforma"],
    [/grade baixa|carga seca|aberta/, "Grade baixa"],
    [/cegonh/, "Cegonheiro"],
    [/silo/, "Silo"],
    [/cont[aê]iner|porta.?cont/, "Bug Porta Container"],
    [/gaiola|boiadeir/, "Gaiola"],
    [/munk|guindaste/, "Munk"],
  ];
  for (const [re, v] of mapa) if (re.test(t)) return v;
  return null;
}

/** Grava a leitura confirmada. Devolve a mensagem de "pronto" (ou pede o tipo do caminhão). */
async function salvarLeituraDoc(fromE164: string, estado: EstadoCadastroFoto, waMessageId: string): Promise<void> {
  const motoristaId = estado.motorista_id;
  const d = estado.dados ?? ({} as NonNullable<EstadoCadastroFoto["dados"]>);

  if (estado.tipo_doc === "cnh") {
    const patch: Record<string, unknown> = {};
    if (d.nome) patch.nome = d.nome;
    if (d.numero) patch.cnh_numero = d.numero;
    if (d.validade) patch.cnh_vencimento = d.validade;
    if (d.categoria) patch.cnh_categoria = d.categoria;
    const { error } = await supabase.from("motoristas").update(patch).eq("id", motoristaId);
    if (error) {
      await logErro("wa-webhook.cadastroFoto", "Falha ao salvar CNH", { erro: error.message, motoristaId });
      await enviarMensagemWhatsapp(fromE164, "Não consegui salvar agora. Tenta de novo daqui a pouco.");
      return;
    }
    await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto: "[salvar cnh]", extracao: null, status: "doc_salvo", resultado: { tipo: "cnh", campos: Object.keys(patch) } });
    await registrarEventoAnalytics("driver_profile_saved", motoristaId, { canal: "whatsapp", via: "cnh_foto", campos: Object.keys(patch) });
    await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "aguardando_foto", tipo_doc: null, dados: null });
    const primeiroNome = d.nome ? d.nome.split(" ")[0] : null;
    await enviarMensagemWhatsapp(fromE164, `Pronto${primeiroNome ? `, ${primeiroNome}` : ""}. Cadastro atualizado. Te aviso quando a CNH estiver pra vencer. Agora manda a foto do CRLV, se quiser.`);
    return;
  }

  // CRLV
  const { data: perfil } = await supabase.from("caminhao_perfil").select("tipo_veiculo, numero_eixos, tipo_carroceria").eq("user_id", motoristaId).maybeSingle();
  const especie = d.especie ?? "outro";
  let tipoVeiculo: string | null = d.tipoVeiculo ?? perfil?.tipo_veiculo ?? null;
  if (!tipoVeiculo && especie === "caminhao") {
    tipoVeiculo = d.eixos === 2 ? "Toco" : d.eixos === 4 ? "BiTruck" : "Truck";
  }
  if (!tipoVeiculo && especie === "caminhao_trator") {
    // Cavalo mecânico: Carreta, Carreta LS ou Bitrem — não dá pra saber pelo CRLV do cavalo.
    await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "tipo_veiculo" });
    await enviarBotoes(fromE164, "É uma Carreta?", [
      { id: "doc:tipo:Carreta", titulo: "Carreta" },
      { id: "doc:tipo:Carreta LS", titulo: "Carreta LS" },
      { id: "doc:tipo:Bitrem 7 eixos", titulo: "Bitrem" },
    ]);
    return;
  }

  const patch: Record<string, unknown> = {};
  const ehReboque = especie === "semirreboque" || especie === "reboque";
  if (!ehReboque) {
    if (d.marca) patch.marca = d.marca;
    if (d.modelo) patch.modelo = d.modelo;
    if (d.ano) patch.ano = d.ano;
    if (d.placa) patch.placa = d.placa;
    if (d.renavam) patch.renavam = d.renavam;
    if (d.exercicio) patch.crlv_exercicio = d.exercicio;
    if (tipoVeiculo) {
      patch.tipo_veiculo = tipoVeiculo;
      patch.apelido = [d.marca, d.modelo].filter(Boolean).join(" ") || tipoVeiculo;
    }
    if (especie === "caminhao_trator") {
      // eixos/capacidade do cavalo não são os do conjunto — vêm do CRLV do semirreboque
      if (!perfil?.numero_eixos || perfil.numero_eixos === 5) patch.numero_eixos = EIXOS_PADRAO[(tipoVeiculo as TipoVeiculoMsg) ?? "Carreta"] ?? 5;
    } else {
      if (d.eixos) patch.numero_eixos = d.eixos;
      if (d.capacidadeT) patch.carga_maxima_toneladas = d.capacidadeT;
    }
  } else {
    const carroceria = carroceriaDoCRLV(d.carroceria ?? null);
    if (carroceria) patch.tipo_carroceria = carroceria;
    if (d.capacidadeT) patch.carga_maxima_toneladas = d.capacidadeT;
    // Eixos do conjunto dependem do cavalo + semirreboque; fica o do tipo
    // escolhido (Carreta 5, LS 6, Bitrem 7) — não mexe aqui.
    if (d.exercicio && !perfil) patch.crlv_exercicio = d.exercicio;
  }

  const base = perfil
    ? {}
    : {
        diesel_km_por_lt: PERFIL_CUSTO_DEFAULT.diesel_km_por_lt,
        diesel_preco_por_litro: PERFIL_CUSTO_DEFAULT.diesel_preco_por_litro,
        arla_km_por_lt: PERFIL_CUSTO_DEFAULT.arla_km_por_lt,
        arla_preco_por_litro: PERFIL_CUSTO_DEFAULT.arla_preco_por_litro,
        manutencao_por_km: PERFIL_CUSTO_DEFAULT.manutencao_por_km,
        pneus_por_km: PERFIL_CUSTO_DEFAULT.pneus_por_km,
        depreciacao_por_km: PERFIL_CUSTO_DEFAULT.depreciacao_por_km,
        alimentacao_dia: PERFIL_CUSTO_DEFAULT.alimentacao_dia,
        pernoite_dia: PERFIL_CUSTO_DEFAULT.pernoite_dia,
        estacionamento_padrao: PERFIL_CUSTO_DEFAULT.estacionamento_padrao,
        chapa_padrao: PERFIL_CUSTO_DEFAULT.chapa_padrao,
        margem_desejada: PERFIL_CUSTO_DEFAULT.margem_desejada,
        numero_eixos: 5,
        apelido: tipoVeiculo ?? "Caminhão",
        tipo_veiculo: tipoVeiculo,
      };
  const { error } = await supabase.from("caminhao_perfil").upsert({ user_id: motoristaId, ...base, ...patch }, { onConflict: "user_id" });
  if (error) {
    await logErro("wa-webhook.cadastroFoto", "Falha ao salvar CRLV", { erro: error.message, motoristaId });
    await enviarMensagemWhatsapp(fromE164, "Não consegui salvar agora. Tenta de novo daqui a pouco.");
    return;
  }
  await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto: "[salvar crlv]", extracao: null, status: "doc_salvo", resultado: { tipo: "crlv", especie, campos: Object.keys(patch) } });
  await registrarEventoAnalytics("truck_profile_saved", motoristaId, { canal: "whatsapp", via: "crlv_foto", especie, campos: Object.keys(patch) });
  await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "aguardando_foto", tipo_doc: null, dados: null });
  const veic = [d.marca, d.modelo].filter(Boolean).join(" ");
  await enviarMensagemWhatsapp(
    fromE164,
    ehReboque
      ? `Pronto — semirreboque${patch.tipo_carroceria ? ` ${patch.tipo_carroceria}` : ""}${d.placa ? `, placa ${d.placa}` : ""}, salvo no seu caminhão. Os cálculos já usam ele.`
      : `Pronto — ${veic || tipoVeiculo || "caminhão"}${d.placa ? `, placa ${d.placa}` : ""}, salvo como seu caminhão. Os cálculos já usam ele.`,
  );
}


// ---------------------------------------------------------------------------
// AÇÕES SOBRE A PENDÊNCIA (08/10) — a IA disse o que o motorista quis; aqui
// o código executa, validando cada valor. Devolve true se tratou.
// ---------------------------------------------------------------------------
function normalizarOpcaoVeiculo(opcao: string): TipoVeiculoMsg | null {
  const o = semAcento(opcao);
  const exato = TIPOS_VEICULO.find((t) => semAcento(t) === o);
  if (exato) return exato;
  if (/bitrem/.test(o)) return /9/.test(o) ? "Bitrem 9 eixos" : "Bitrem 7 eixos";
  if (/\bls\b/.test(o)) return "Carreta LS";
  if (/truck|truk|truque/.test(o)) return "Truck";
  if (/bitruck/.test(o)) return "BiTruck";
  if (/carreta|cavalo/.test(o)) return "Carreta";
  if (/toco/.test(o)) return "Toco";
  if (/3\/4|tres quartos/.test(o)) return "3/4";
  return null;
}

/** Aplica correções ditas pelo motorista sobre a leitura pendente, validando formato. Devolve o que não deu pra usar. */
function aplicarCorrecoes(dados: NonNullable<EstadoCadastroFoto["dados"]>, c: Correcoes): { dados: NonNullable<EstadoCadastroFoto["dados"]>; rejeitados: string[] } {
  const d = { ...dados };
  const rejeitados: string[] = [];
  if (c.nome) d.nome = c.nome;
  if (c.categoria) {
    const v = normalizarCategoriaCNH(c.categoria);
    if (v) d.categoria = v; else rejeitados.push("categoria");
  }
  if (c.validade) {
    const iso = c.validade.match(/^\d{4}-\d{2}-\d{2}$/) ? c.validade : (() => { const m = c.validade!.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; })();
    if (iso) d.validade = iso; else rejeitados.push("validade");
  }
  if (c.numero) {
    const n = c.numero.replace(/\D/g, "");
    if (n.length >= 9 && n.length <= 11) d.numero = n; else rejeitados.push("número");
  }
  if (c.placa) {
    const p = normalizarPlaca(c.placa);
    if (p) d.placa = p; else rejeitados.push("placa");
  }
  if (c.renavam) {
    const r = c.renavam.replace(/\D/g, "");
    if (/^\d{9,11}$/.test(r)) d.renavam = r; else rejeitados.push("renavam");
  }
  if (c.eixos != null) { if (c.eixos >= 2 && c.eixos <= 9) d.eixos = c.eixos; else rejeitados.push("eixos"); }
  if (c.capacidade_t != null) { if (c.capacidade_t > 0 && c.capacidade_t < 200) d.capacidadeT = c.capacidade_t; else rejeitados.push("capacidade"); }
  if (c.ano != null) { if (c.ano >= 1970 && c.ano <= 2100) d.ano = c.ano; else rejeitados.push("ano"); }
  if (c.marca) d.marca = c.marca;
  if (c.modelo) d.modelo = c.modelo;
  if (c.exercicio != null) { if (c.exercicio >= 2000 && c.exercicio <= 2100) d.exercicio = c.exercicio; else rejeitados.push("licenciamento"); }
  return { dados: d, rejeitados };
}

async function executarAcaoPendencia(fromE164: string, texto: string, waMessageId: string, ex: ExtracaoFrete, p: Pendencia): Promise<boolean> {
  const acao = ex.acao;
  const opcao = ex.opcaoEscolhida;

  if (p.tipo === "onboarding_caminhao" && acao === "escolher" && opcao) {
    if (p.etapa === "tipo") {
      const tipo = normalizarOpcaoVeiculo(opcao);
      if (!tipo) return false;
      await tratarRespostaOnboarding(fromE164, `onb_tipo:${tipo}`, waMessageId);
      return true;
    }
    const n = Number(String(opcao).replace(",", ".").replace(/[^\d.]/g, ""));
    if (p.etapa === "eixos" && n >= 2 && n <= 9) { await tratarRespostaOnboarding(fromE164, `onb_eixos:${Math.round(n)}`, waMessageId); return true; }
    if (p.etapa === "consumo" && n >= 1 && n <= 6) { await tratarRespostaOnboarding(fromE164, `onb_consumo:${n}`, waMessageId); return true; }
    return false;
  }

  if (p.tipo === "cidade_em_duvida" && acao === "escolher" && opcao) {
    await tratarEscolhaCidade(fromE164, `cidade:${p.campo === "origem" ? "o" : "d"}:${opcao}`, waMessageId);
    return true;
  }

  if (p.tipo === "busca_origem" && acao === "escolher" && opcao) {
    await tratarBuscaDeFrete(fromE164, waMessageId, { origemTexto: opcao, textoOriginal: texto });
    return true;
  }

  if (p.tipo === "consentimento_documento") {
    if (acao === "aceitar") { await tratarBotaoCadastroFoto(fromE164, "doc:ok", waMessageId); return true; }
    if (acao === "recusar") { await tratarBotaoCadastroFoto(fromE164, "doc:nao", waMessageId); return true; }
    return false;
  }

  if (p.tipo === "tipo_veiculo_crlv" && acao === "escolher" && opcao) {
    const tipo = normalizarOpcaoVeiculo(opcao);
    if (!tipo) return false;
    await tratarBotaoCadastroFoto(fromE164, `doc:tipo:${tipo}`, waMessageId);
    return true;
  }

  if (p.tipo === "confirmar_leitura") {
    const estado = await estadoCadastroFoto(fromE164);
    if (!estado?.dados || !estado.tipo_doc) return false;
    const motoristaId = estado.motorista_id;
    if (acao === "confirmar") { await tratarBotaoCadastroFoto(fromE164, "doc:salvar", waMessageId); return true; }
    if (acao === "cancelar") { await tratarBotaoCadastroFoto(fromE164, "doc:cancelar", waMessageId); return true; }
    if (acao === "reler") {
      await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto, extracao: null, status: "doc_cancelado", resultado: { tipo: estado.tipo_doc, motivo: "reler" } });
      await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "aguardando_foto", tipo_doc: null, dados: null, media_id: null });
      await enviarMensagemWhatsapp(fromE164, `Beleza, descartei essa leitura. Manda a ${estado.tipo_doc === "cnh" ? "CNH" : "CRLV"} de novo — foto mais perto, com luz e sem reflexo, ou o PDF.`);
      return true;
    }
    if (acao === "pular_para_crlv") {
      await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto, extracao: null, status: "doc_cancelado", resultado: { tipo: estado.tipo_doc, motivo: "pular_para_crlv" } });
      await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "aguardando_foto", tipo_doc: null, dados: null, media_id: null });
      await enviarMensagemWhatsapp(fromE164, "Beleza, deixa a CNH pra depois. Manda o CRLV do caminhão (foto ou PDF).");
      return true;
    }
    if (acao === "corrigir" && ex.correcoes) {
      const { dados, rejeitados } = aplicarCorrecoes(estado.dados, ex.correcoes);
      await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "confirmar", dados });
      await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto, extracao: null, status: "doc_lido", resultado: { correcao: Object.keys(ex.correcoes).filter((k) => (ex.correcoes as Record<string, unknown>)[k] != null) } });
      const aviso = rejeitados.length ? `Não consegui usar o que você mandou pra ${rejeitados.join(", ")} — confere o formato.\n\n` : "";
      await enviarBotoes(fromE164, aviso + textoConfirmacaoDoc({ ...estado, dados }), BOTOES_CONFIRMAR_DOC);
      return true;
    }
    return false;
  }

  return false;
}

async function tratarBotaoCadastroFoto(fromE164: string, rowId: string, waMessageId: string): Promise<void> {
  const estado = await estadoCadastroFoto(fromE164);
  const { data: m } = await supabase.from("motoristas").select("id").eq("telefone_e164", fromE164).maybeSingle();
  const motoristaId = estado?.motorista_id ?? m?.id ?? null;
  if (!motoristaId) return;

  if (rowId === "doc:ok") {
    if (!(await temConsentimentoLeitura(motoristaId))) await registrarConsentimentoLeitura(motoristaId, waMessageId);
    if (estado?.media_id) {
      await processarImagemDocumento(fromE164, motoristaId, estado.media_id, waMessageId);
    } else {
      await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "aguardando_foto", media_id: null });
      await enviarMensagemWhatsapp(fromE164, TEXTO_PEDIR_FOTO);
    }
    return;
  }
  if (rowId === "doc:nao") {
    await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "aguardando_foto", media_id: null, dados: null, tipo_doc: null });
    return; // não insiste; CADASTRO traz de volta
  }
  if (rowId === "doc:frete") {
    await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "aguardando_foto", media_id: null });
    await enviarMensagemWhatsapp(fromE164, 'Beleza. Me manda o frete em texto: rota e valor, ex.: *"Sinop pra Santos, 14 mil"*.');
    return;
  }
  if (!estado?.dados || !estado.tipo_doc) {
    await enviarMensagemWhatsapp(fromE164, "Essa leitura já expirou. Manda a foto de novo.");
    return;
  }
  if (rowId === "doc:salvar") {
    await salvarLeituraDoc(fromE164, estado, waMessageId);
    return;
  }
  if (rowId === "doc:corrigir") {
    await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "corrigir" });
    await enviarMensagemWhatsapp(fromE164, 'O que tá errado? Manda só o campo, tipo *"placa ABC1D23"* ou *"validade 14/03/2029"*.');
    return;
  }
  if (rowId === "doc:cancelar") {
    await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto: "[cancelar leitura]", extracao: null, status: "doc_cancelado", resultado: { tipo: estado.tipo_doc } });
    await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "aguardando_foto", tipo_doc: null, dados: null, media_id: null });
    await enviarMensagemWhatsapp(fromE164, TEXTO_CANCELOU);
    return;
  }
  if (rowId.startsWith("doc:tipo:")) {
    const tipo = rowId.slice("doc:tipo:".length);
    const dados = { ...estado.dados, tipoVeiculo: tipo };
    await gravarEstadoCadastroFoto(fromE164, motoristaId, { etapa: "confirmar", dados });
    await salvarLeituraDoc(fromE164, { ...estado, dados }, waMessageId);
  }
}



let tokenSimulacaoCache: { valor: string; em: number } | null = null;
async function tokenSimulacao(): Promise<string | null> {
  if (tokenSimulacaoCache && Date.now() - tokenSimulacaoCache.em < 10 * 60_000) return tokenSimulacaoCache.valor;
  const { data } = await supabase.from("bot_config").select("valor").eq("chave", "simulacao_token").maybeSingle();
  if (!data?.valor) return null;
  tokenSimulacaoCache = { valor: data.valor as string, em: Date.now() };
  return data.valor as string;
}

/**
 * GET ?simular=1&token=…&de=5590XXXXXXXX&(texto=…|botao=<rowId>|reset=1)
 * Monta o mesmo payload que a Meta mandaria e roda o pipeline inteiro
 * (Haiku, cidades, cálculo, banco). As respostas voltam no JSON em vez de
 * irem pro WhatsApp. `reset=1` apaga a conta simulada (como o SAIR) e a
 * memória de conversa, pra começar do zero.
 */
async function tratarSimulacao(url: URL): Promise<Response> {
  const token = url.searchParams.get("token") ?? "";
  const esperado = await tokenSimulacao();
  if (!esperado || token !== esperado) return json({ erro: "token_invalido" }, 403);
  const de = url.searchParams.get("de") ?? "";
  if (!ehNumeroSimulado(de)) return json({ erro: "numero_simulado_invalido", dica: "use 5590 + 8 dígitos (DDD 90 não existe)" }, 400);

  if (url.searchParams.get("reset") === "1") {
    const { data: m } = await supabase.from("motoristas").select("id").eq("telefone_e164", de).maybeSingle();
    if (m) await supabase.auth.admin.deleteUser(m.id);
    await supabase.from("wa_conversa").delete().eq("from_e164", de);
    await supabase.from("wa_cadastro_foto").delete().eq("from_e164", de);
    await supabase.from("wa_onboarding").delete().eq("from_e164", de);
    await supabase.from("wa_freight_query").delete().eq("from_e164", de);
    respostasSimuladas.delete(de);
    return json({ ok: true, reset: de, tinhaConta: Boolean(m) });
  }

  const texto = url.searchParams.get("texto");
  const botao = url.searchParams.get("botao");
  if (!texto && !botao) return json({ erro: "faltou_texto_ou_botao" }, 400);
  const id = `sim-${crypto.randomUUID()}`;
  const mensagem = botao
    ? { id, from: de, type: "interactive", interactive: { type: "button_reply", button_reply: { id: botao, title: rotuloBotao(botao) } } }
    : { id, from: de, type: "text", text: { body: texto } };
  const payload = { entry: [{ changes: [{ value: { messages: [mensagem] } }] }] };

  respostasSimuladas.delete(de);
  const inicio = Date.now();
  await processarPayload(payload);
  const respostas = respostasSimuladas.get(de) ?? [];
  respostasSimuladas.delete(de);
  return json({ de, enviado: botao ? `[botão: ${rotuloBotao(botao)}]` : texto, respostas, ms: Date.now() - inicio });
}

Deno.serve(async (req: Request) => {
  try {
    return await tratarRequisicao(req);
  } catch (e) {
    // Rede de segurança: qualquer exceção não tratada em algum ponto do
    // fluxo acima virava um 500 sem deixar rastro (edge_logs não é
    // consultável nem por SQL nem pelo app — só pela Management API).
    // Agora pelo menos fica registrado em app_log pra aparecer na aba
    // "Saúde do sistema" do admin.
    // eslint-disable-next-line no-console
    console.error("[wa-webhook] exceção não tratada no handler", e);
    await logErro("wa-webhook.handler", "Exceção não tratada no handler", { erro: String(e) });
    return json({ erro: "erro_interno" }, 500);
  }
});

async function tratarRequisicao(req: Request): Promise<Response> {
  // Handshake de verificação da Meta (configurado uma vez, no painel do
  // WhatsApp Business — GET com hub.mode/hub.verify_token/hub.challenge).
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("simular") === "1") return await tratarSimulacao(url);
    const modo = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (modo === "subscribe" && token === WA_WEBHOOK_VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") return json({ erro: "method_not_allowed" }, 405);

  // A assinatura é sobre o corpo CRU — precisa ler como texto ANTES de
  // fazer JSON.parse (perderia os bytes exatos se lesse como .json() direto).
  const corpoCru = await req.text();
  const valida = await assinaturaValida(corpoCru, req.headers.get("x-hub-signature-256"), WA_APP_SECRET);
  if (!valida) return json({ erro: "assinatura_invalida" }, 403);

  let payload: unknown;
  try {
    payload = JSON.parse(corpoCru);
  } catch {
    return json({ erro: "body_invalido" }, 400);
  }
  // 08/10: responde 200 pra Meta NA HORA e processa em segundo plano. Antes,
  // IA + rota + envio (3–8 s) aconteciam antes do 200; se a conexão caía no
  // meio, a função era cortada (vimos no simulador: cálculo gravado, resposta
  // nunca enviada) e a Meta reentregava. A idempotência por wa_message_id
  // continua valendo. Simulador segue síncrono (precisa das respostas).
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(
      processarPayload(payload).catch(async (e) => {
        console.error("[wa-webhook] exceção no processamento em segundo plano", e);
        await logErro("wa-webhook.background", "Exceção no processamento em segundo plano", { erro: String(e) });
      }),
    );
    return json({ recebido: true, background: true });
  }
  return await processarPayload(payload);
}

/** Tudo que acontece com um payload da Meta já validado (também usado pelo simulador). */
async function processarPayload(payload: unknown): Promise<Response> {
  await garantirTabelaANTT();

  // Diagnóstico: status de entrega (sent/delivered/read/failed) de
  // mensagens que NÓS enviamos — não tem relação com processar mensagem
  // recebida, só loga pra dar visibilidade de falha de envio (ver
  // extrairStatuses acima).
  for (const s of extrairStatuses(payload)) {
    if (s.status === "failed") {
      // eslint-disable-next-line no-console
      console.error("[wa-webhook] status=failed", JSON.stringify(s));
      await logErro("wa-webhook.statusEntrega", "Meta reportou falha de entrega", { status: s });
    } else {
      // eslint-disable-next-line no-console
      console.log(`[wa-webhook] status=${s.status} wa_message_id=${s.waMessageId} para=${s.recipientId}`);
    }
  }

  const mensagens = extrairMensagens(payload);

  for (const msg of mensagens) {
    const intent = detectarIntent(msg.texto);

    // Idempotência: a Meta reentrega webhook em timeout/erro — sem isso,
    // uma reentrega reprocessaria o mesmo intent. Insert com PK em
    // wa_message_id: se já existe, o insert falha por conflito e a gente
    // pula (não é um erro real, é o caminho esperado numa reentrega).
    const { error: dupError } = await supabase
      .from("wa_mensagem_recebida")
      .insert({ wa_message_id: msg.waMessageId, from_e164: msg.fromE164, intent: intent.tipo });
    if (dupError) {
      if (dupError.code === "23505") continue; // já processada
      // eslint-disable-next-line no-console
      console.error("[wa-webhook] falha ao registrar idempotência, processando mesmo assim", dupError);
    }
    await registrarConversa(msg.fromE164, "motorista", msg.texto);

    // Cota diária (ver LIMITE_CONSULTAS_DIA). SAIR passa sempre.
    const usadas = RE_SAIR.test(msg.texto.trim()) ? 0 : await contarConsultasHoje(msg.fromE164);
    if (usadas >= LIMITE_CONSULTAS_DIA) {
      await registrarTentativaFrete({ waMessageId: msg.waMessageId, motoristaId: null, fromE164: msg.fromE164, texto: msg.texto, extracao: null, status: "limite_diario" });
      // eslint-disable-next-line no-console
      console.log(`[wa-webhook] cota diária atingida para ${msg.fromE164}: "${msg.texto}"`);
      continue;
    }

    if (RE_SAIR.test(msg.texto.trim())) {
      await tratarSair(msg.fromE164, msg.waMessageId);
    } else if (RE_CADASTRO.test(msg.texto.trim())) {
      await tratarComandoCadastro(msg.fromE164, msg.texto, msg.waMessageId);
    } else if (RE_AJUDA.test(msg.texto.trim())) {
      // "ajuda"/"menu" — apresentação fixa, sem IA (conta nasce se for novo).
      const { id, novo } = await garantirMotorista(msg.fromE164, msg.texto);
      await registrarTentativaFrete({ waMessageId: msg.waMessageId, motoristaId: id, fromE164: msg.fromE164, texto: msg.texto, extracao: null, status: "boas_vindas" });
      await enviarMensagemWhatsapp(msg.fromE164, mensagemApresentacao(Boolean(id) && !novo) + (novo && id ? AVISO_CADASTRO : ""));
    } else if (intent.tipo === "vincular") {
      await tratarVincular(msg.fromE164, intent.codigo, msg.waMessageId);
    } else if (intent.tipo === "desvincular") {
      await tratarDesvincular(msg.fromE164, msg.waMessageId);
    } else if (intent.tipo === "buscar") {
      await tratarBuscaDeFrete(msg.fromE164, msg.waMessageId, { textoOriginal: msg.texto });
    } else {
      await tratarPedidoDeCalculo(msg.fromE164, msg.texto, msg.waMessageId);
    }

    // Era a última da cota: avisa uma vez e aponta pro app.
    if (usadas + 1 >= LIMITE_CONSULTAS_DIA && (await contarConsultasHoje(msg.fromE164)) >= LIMITE_CONSULTAS_DIA) {
      await avisarUltimaConsulta(msg.fromE164);
    }
  }

  // Respostas de lista (clique num frete da busca ou em "Abrir o app") —
  // mesmo payload de mensagens, tipo "interactive" em vez de "text", por
  // isso um laço separado com sua própria checagem de idempotência.
  // Fotos (CNH/CRLV). Mesma idempotência. Não entram na cota diária: a
  // leitura custa IA, mas é rara e já tem o funil de consentimento.
  for (const img of extrairImagens(payload)) {
    const { error: dupError } = await supabase
      .from("wa_mensagem_recebida")
      .insert({ wa_message_id: img.waMessageId, from_e164: img.fromE164, intent: "imagem" });
    if (dupError) {
      if (dupError.code === "23505") continue;
      // eslint-disable-next-line no-console
      console.error("[wa-webhook] falha ao registrar idempotência (imagem), processando mesmo assim", dupError);
    }
    await registrarConversa(img.fromE164, "motorista", img.mimeType === "application/pdf" ? "[mandou um PDF]" : "[mandou uma foto]");
    await tratarImagemRecebida(img);
  }

  const interacoes = extrairInteracoesLista(payload);
  for (const it of interacoes) {
    const { error: dupError } = await supabase
      .from("wa_mensagem_recebida")
      .insert({ wa_message_id: it.waMessageId, from_e164: it.fromE164, intent: "lista_resposta" });
    if (dupError) {
      if (dupError.code === "23505") continue; // já processada
      // eslint-disable-next-line no-console
      console.error("[wa-webhook] falha ao registrar idempotência (lista), processando mesmo assim", dupError);
    }
    // Roteia pelo prefixo do id: onboarding do caminhão, pedido do cartão
    // de contato, ou (sem prefixo) clique num frete da lista de busca.
    await registrarConversa(it.fromE164, "motorista", `[tocou no botão: ${rotuloBotao(it.rowId)}]`);
    if (it.rowId.startsWith("onb_")) {
      await tratarRespostaOnboarding(it.fromE164, it.rowId, it.waMessageId);
    } else if (it.rowId === "viral:cartao") {
      await tratarPedidoCartao(it.fromE164, it.waMessageId);
    } else if (it.rowId.startsWith("cidade:")) {
      await tratarEscolhaCidade(it.fromE164, it.rowId, it.waMessageId);
    } else if (it.rowId.startsWith("doc:")) {
      await tratarBotaoCadastroFoto(it.fromE164, it.rowId, it.waMessageId);
    } else if (it.rowId.startsWith("busca:origem:")) {
      await tratarEscolhaOrigemBusca(it.fromE164, it.rowId, it.waMessageId);
    } else if (it.rowId.startsWith("perfil:salvar:")) {
      await tratarSalvarVeiculo(it.fromE164, it.rowId, it.waMessageId);
    } else {
      await tratarRespostaLista(it.fromE164, it.rowId, it.waMessageId);
    }
  }

  // A Meta espera 200 rápido — se demorar ou der erro, ela reentrega.
  // Sempre 200 aqui, mesmo pra mensagem sem intent: já é o comportamento
  // esperado (cai pro NLU depois), não uma falha do webhook.
  return json({ recebido: mensagens.length + interacoes.length });
}
