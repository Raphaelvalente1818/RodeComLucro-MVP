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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { calcularFrete, tipoCargaPorCarroceria, fmtBRL, fmtPct, diasPorFaixaKm, type Custos } from "./calc.ts";
import { extrairFreteDeTexto, type ExtracaoFrete } from "./extracao.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WA_WEBHOOK_VERIFY_TOKEN = Deno.env.get("WA_WEBHOOK_VERIFY_TOKEN")!;
const WA_APP_SECRET = Deno.env.get("WA_APP_SECRET")!;
// Sem "!" de propósito: undefined é um estado válido (chave da Meta ainda
// não chegou) — tratado em enviarMensagemWhatsapp(), não é erro de config.
const WA_ACCESS_TOKEN = Deno.env.get("WA_ACCESS_TOKEN");
const WA_PHONE_NUMBER_ID = Deno.env.get("WA_PHONE_NUMBER_ID");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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
async function registrarEventoAnalytics(
  eventName: "simulation_run",
  actorId: string,
  props: Record<string, unknown>,
): Promise<void> {
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
async function enviarMensagemWhatsapp(paraE164: string, texto: string): Promise<void> {
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
      // eslint-disable-next-line no-console
      console.error("[wa-webhook] envio falhou", resp.status, await resp.text());
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[wa-webhook] envio lançou exceção", e);
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

async function enviarListaFretes(paraE164: string, linhas: LinhaListaFrete[], totalCompativeis: number): Promise<void> {
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
          body: {
            text: `Encontrei ${totalCompativeis} frete${totalCompativeis > 1 ? "s" : ""} compatível${totalCompativeis > 1 ? "eis" : ""} com seu caminhão perto de você. Toque numa opção pra ver o cálculo completo:`,
          },
          action: {
            button: "Ver opções",
            sections: [{ title: "Fretes compatíveis", rows: linhas }],
          },
        },
      }),
    });
    if (!resp.ok) {
      // eslint-disable-next-line no-console
      console.error("[wa-webhook] envio de lista falhou", resp.status, await resp.text());
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[wa-webhook] envio de lista lançou exceção", e);
  }
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
          interactive?: { type?: string; list_reply?: { id?: string } };
        };
        if (!msg.id || !msg.from || msg.type !== "interactive") continue;
        const rowId = msg.interactive?.list_reply?.id;
        if (msg.interactive?.type !== "list_reply" || !rowId) continue;
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
    return null;
  }
}

async function registrarTentativaFrete(params: {
  waMessageId: string;
  motoristaId: string | null;
  fromE164: string;
  texto: string;
  extracao: ExtracaoFrete | null;
  status: "calculado" | "confirmacao_pendente" | "dado_faltando" | "erro_extracao" | "nao_vinculado";
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

async function tratarPedidoDeCalculo(fromE164: string, texto: string, waMessageId: string): Promise<void> {
  const extracao = await extrairFreteDeTexto(texto);
  if (!extracao) {
    // Sem chave da IA configurada, ou a chamada falhou de verdade — mesmo
    // comportamento de antes do calc-wpp existir: só loga, sem responder.
    // eslint-disable-next-line no-console
    console.log(`[wa-webhook] mensagem sem intent reconhecido de ${fromE164}: "${texto}"`);
    return;
  }

  if (!extracao.ePedidoDeFrete && !extracao.ePedidoDeBusca) {
    if (RE_MENCIONA_FRETE_OU_CARGA.test(texto) && extracao.valorFreteReais == null) {
      // eslint-disable-next-line no-console
      console.log(`[wa-webhook] fallback: tratando como busca (IA não classificou) de ${fromE164}: "${texto}"`);
      await tratarBuscaDeFrete(fromE164, waMessageId);
      return;
    }
    // De fato não é sobre frete (saudação, outro assunto etc.) — só loga.
    // eslint-disable-next-line no-console
    console.log(`[wa-webhook] mensagem sem intent reconhecido de ${fromE164}: "${texto}"`);
    return;
  }

  // Linguagem natural de busca que o atalho por regex (detectarIntent) não
  // pegou — ex.: "tem frete pra SP?". Mesmo handler do gatilho direto.
  if (extracao.ePedidoDeBusca && !extracao.ePedidoDeFrete) {
    await tratarBuscaDeFrete(fromE164, waMessageId);
    return;
  }

  const { data: motorista } = await supabase
    .from("motoristas")
    .select("id, canal_wa_ativo")
    .eq("telefone_e164", fromE164)
    .maybeSingle();

  if (!motorista?.canal_wa_ativo) {
    await registrarTentativaFrete({ waMessageId, motoristaId: motorista?.id ?? null, fromE164, texto, extracao, status: "nao_vinculado" });
    await enviarMensagemWhatsapp(
      fromE164,
      "Pra calcular fretes por aqui, primeiro vincule seu WhatsApp pelo app (Meu perfil → Vincular WhatsApp).",
    );
    return;
  }

  const faltando: string[] = [];
  if (!extracao.origem) faltando.push("origem");
  if (!extracao.destino) faltando.push("destino");
  if (extracao.valorFreteReais == null) faltando.push("valor do frete");
  if (faltando.length > 0) {
    await registrarTentativaFrete({ waMessageId, motoristaId: motorista.id, fromE164, texto, extracao, status: "dado_faltando" });
    await enviarMensagemWhatsapp(
      fromE164,
      `Faltou informar: ${faltando.join(", ")}. Manda de novo com origem, destino e valor do frete (ex.: "frete de Sorocaba pra Curitiba, 8 mil reais").`,
    );
    return;
  }

  // Narrowing explícito pro TS — a checagem de `faltando` acima já garante
  // que os três campos estão preenchidos, mas TS não propaga isso pra
  // propriedades de objeto através de `await`s seguintes.
  const origem = extracao.origem as string;
  const destino = extracao.destino as string;
  const valorFreteReais = extracao.valorFreteReais as number;

  const confiancaMinima = Math.min(extracao.confiancaOrigem, extracao.confiancaDestino, extracao.confiancaValor);
  if (confiancaMinima < CONFIANCA_MINIMA) {
    await registrarTentativaFrete({ waMessageId, motoristaId: motorista.id, fromE164, texto, extracao, status: "confirmacao_pendente" });
    await enviarMensagemWhatsapp(
      fromE164,
      `Não entendi direito — origem "${origem}", destino "${destino}", valor R$ ${valorFreteReais}. Se estiver certo, manda de novo mais claro (ex.: "frete de ${origem} pra ${destino}, R$ ${valorFreteReais}").`,
    );
    return;
  }

  await calcularEResponderFrete({
    fromE164,
    motoristaId: motorista.id,
    origem,
    destino,
    valorFreteReais,
    voltaVazia: extracao.voltaVazia,
    waMessageId,
    texto,
    extracao,
  });
}

/**
 * Cauda comum de tratarPedidoDeCalculo (texto livre) e tratarRespostaLista
 * (clique num frete da busca, ver tratarBuscaDeFrete) — a partir daqui os
 * dois fluxos convergem: já se sabe origem/destino/valor, só falta
 * calcular (route-cost + perfil de custos) e responder. `extracao`/`texto`
 * ficam null/placeholder no fluxo de lista (não veio texto livre nem
 * passou pela IA) — só usados pra auditoria em wa_freight_query.
 */
async function calcularEResponderFrete(params: {
  fromE164: string;
  motoristaId: string;
  origem: string;
  destino: string;
  valorFreteReais: number;
  voltaVazia: boolean;
  waMessageId: string;
  texto: string;
  extracao: ExtracaoFrete | null;
}): Promise<void> {
  const { fromE164, motoristaId, origem, destino, valorFreteReais, voltaVazia, waMessageId, texto, extracao } = params;

  const rota = await chamarRouteCost(origem, destino);
  if (!rota) {
    await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto, extracao, status: "erro_extracao" });
    await enviarMensagemWhatsapp(fromE164, "Não consegui calcular a distância dessa rota agora. Tenta de novo em instantes ou use o app.");
    return;
  }

  const perfil = await buscarPerfilOuDefault(motoristaId);
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

  await registrarTentativaFrete({ waMessageId, motoristaId, fromE164, texto, extracao, status: "calculado", resultado });
  await registrarEventoAnalytics("simulation_run", motoristaId, {
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
  const resposta =
    `📦 ${origem} → ${destino} (${rota.distanciaKm.toFixed(0)} km${rota.distanciaEstimada ? ", estimado" : ""})\n` +
    `Valor ofertado: ${fmtBRL(valorFreteReais)}\n` +
    `Custo estimado: ${fmtBRL(resultado.custoTotal)}\n` +
    `Lucro estimado: ${fmtBRL(resultado.lucro)} (margem ${fmtPct(resultado.margemReal)})\n` +
    `Piso ANTT: ${fmtBRL(resultado.pisoANTT)}${avisoPiso}\n\n` +
    `${emoji} Veredito: ${resultado.veredicto}\n\n` +
    `(estimativa com base no seu perfil cadastrado no app — ${dias} dia${dias > 1 ? "s" : ""} de viagem)`;

  await enviarMensagemWhatsapp(fromE164, resposta);
}

// ---------------------------------------------------------------------
// Busca de frete via WhatsApp (busca-wpp) — gatilho "BUSCAR"/"FRETES"
// (detectarIntent) ou linguagem natural (extracao.ts, ePedidoDeBusca).
// Sempre incentiva o app: se faltar tipo de veículo ou localização,
// orienta a cadastrar (com o motivo) e NÃO busca nada — sem fallback
// degradado, pra não ensinar o motorista a ignorar o cadastro no app.
// Copia isomórfica de distanciaKm (apps/web/src/lib/municipios.ts) e do
// filtro de compatibilidade por tipo_veiculo (BuscarFrete.tsx) — Edge
// Function não importa de apps/web, mesmo padrão já usado por calc.ts.
// ---------------------------------------------------------------------

const RAIO_BUSCA_MAX_RESULTADOS = 3;
const URL_APP = "https://rode-com-lucro-mvp.vercel.app";

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

async function tratarBuscaDeFrete(fromE164: string, waMessageId: string): Promise<void> {
  const { data: motorista } = await supabase
    .from("motoristas")
    .select("id, canal_wa_ativo, cidade_base, uf_base, cidade_base_lat, cidade_base_lng")
    .eq("telefone_e164", fromE164)
    .maybeSingle<MotoristaBusca>();

  if (!motorista?.canal_wa_ativo) {
    await enviarMensagemWhatsapp(
      fromE164,
      "Pra buscar fretes por aqui, primeiro vincule seu WhatsApp pelo app (Meu perfil → Vincular WhatsApp).",
    );
    return;
  }

  const { data: perfil } = await supabase
    .from("caminhao_perfil")
    .select("tipo_veiculo")
    .eq("user_id", motorista.id)
    .maybeSingle();
  const tipoVeiculo = (perfil?.tipo_veiculo as string | null) ?? null;

  // Sempre a cidade_base (cadastrada em Meu perfil) — igual ao pedido
  // original ("partindo da cidade que ele cadastrou como base"). NÃO usa
  // cidade_atual: esse campo só existe se o motorista já usou o Buscar
  // Frete no app, não tem timestamp/expiração, e fica "preso" na última
  // cidade digitada indefinidamente — testado e confirmado que isso gera
  // busca na praça errada quando o motorista testou uma cidade qualquer
  // uma vez e nunca mais atualizou.
  const lat = motorista.cidade_base_lat;
  const lng = motorista.cidade_base_lng;
  const cidadeOrigem = motorista.cidade_base;
  const ufOrigem = motorista.uf_base;

  if (!tipoVeiculo || lat == null || lng == null) {
    // Cada campo mora numa tela diferente: tipo de veículo é do caminhão
    // (Perfil, /perfil), cidade base é do motorista (Meu perfil, /motorista)
    // — manda o link certo pra cada um em vez de jogar tudo no domínio raiz.
    const faltando: string[] = [];
    if (!tipoVeiculo) faltando.push(`o tipo do seu caminhão (Meu caminhão: ${URL_APP}/perfil)`);
    if (lat == null || lng == null) faltando.push(`sua cidade base (Meu perfil: ${URL_APP}/motorista)`);
    await enviarMensagemWhatsapp(
      fromE164,
      `Pra eu buscar fretes compatíveis com você, falta cadastrar: ${faltando.join(" e ")}.\n\n` +
        "Vale a pena: pelo app os fretes já vêm filtrados pro seu caminhão específico, a partir da cidade que você escolher como base, no raio de atuação que você preferir — sem precisar digitar nada toda vez. 🚛",
    );
    return;
  }

  // O limit aqui precisa cobrir TODOS os fretes "aberto" (hoje ~800), não um
  // recorte arbitrário: o filtro por distância roda em memória DEPOIS dessa
  // busca, então se o banco tiver mais fretes "aberto" que o limit, alguns
  // ficam de fora ANTES de serem comparados por distância. Bug real
  // encontrado em teste (02/09): com limit(300) e ~800 fretes "aberto"
  // compartilhando o mesmo created_at (import em lote), o Postgres não
  // garante uma ordem estável pra desempatar o ORDER BY created_at — cada
  // chamada podia trazer um recorte diferente dos 300, às vezes sem os
  // fretes de fato mais próximos do motorista (ex.: motorista em Guarulhos
  // recebendo só opções de Ribeirão Preto, porque os fretes perto de
  // Guarulhos simplesmente não entraram nesse recorte). 2000 dá folga
  // confortável acima do volume atual.
  const { data: fretesRaw, error } = await supabase
    .from("fretes_publicados")
    .select(
      "id, origem_cidade, origem_uf, origem_lat, origem_lng, destino_cidade, destino_uf, valor_frete_centavos, valor_a_combinar, tipo_valor, tipos_veiculo_aceitos",
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

  const compativeis = (fretesRaw as Array<Record<string, unknown>>)
    .filter((f) => {
      const tipos = (f.tipos_veiculo_aceitos as string[] | null) ?? [];
      return tipos.length === 0 || tipos.includes(tipoVeiculo);
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
      distanciaOrigemKm: distanciaKm(lat, lng, f.origem_lat as number, f.origem_lng as number),
    }))
    .sort((a, b) => a.distanciaOrigemKm - b.distanciaOrigemKm)
    .slice(0, RAIO_BUSCA_MAX_RESULTADOS);

  if (compativeis.length === 0) {
    await enviarMensagemWhatsapp(
      fromE164,
      `Não encontrei fretes compatíveis com seu ${tipoVeiculo} perto de ${cidadeOrigem}/${ufOrigem} agora. Abra o app pra ver o raio completo ou tenta de novo mais tarde: ${URL_APP}/buscar-frete`,
    );
    return;
  }

  const linhas: LinhaListaFrete[] = compativeis.map((f) => ({
    id: f.id,
    title: truncar(`${f.origemCidade}/${f.origemUf} → ${f.destinoCidade}/${f.destinoUf}`, 24),
    description: truncar(
      `${textoValorCurto(f.valorACombinar, f.valorFreteCentavos, f.tipoValor)} · ${f.distanciaOrigemKm.toFixed(0)} km daqui`,
      72,
    ),
  }));
  linhas.push({ id: "abrir_app", title: "Abrir o app", description: "Ver todos os fretes e mais detalhes" });

  await enviarListaFretes(fromE164, linhas, compativeis.length);
}

/**
 * Resposta a um clique na lista enviada por tratarBuscaDeFrete. "abrir_app"
 * é o 4º item fixo; qualquer outro id é o UUID de um fretes_publicados.
 * Reverifica status="aberto" (pode ter fechado entre o envio da lista e o
 * clique) antes de calcular — evita responder um cálculo de frete que já
 * saiu do ar.
 */
async function tratarRespostaLista(fromE164: string, rowId: string, waMessageId: string): Promise<void> {
  if (rowId === "abrir_app") {
    await enviarMensagemWhatsapp(fromE164, `Abra o app pra ver todos os fretes e mais detalhes: ${URL_APP}/buscar-frete`);
    return;
  }

  const { data: motorista } = await supabase
    .from("motoristas")
    .select("id, canal_wa_ativo")
    .eq("telefone_e164", fromE164)
    .maybeSingle();
  if (!motorista?.canal_wa_ativo) return; // defensivo — só quem está vinculado recebe a lista.

  const { data: frete } = await supabase
    .from("fretes_publicados")
    .select("id, origem_cidade, origem_uf, destino_cidade, destino_uf, valor_frete_centavos, valor_a_combinar, tipo_valor, status")
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
      `📦 ${origem} → ${destino}\nValor a combinar — abra o app pra ver os detalhes e negociar: ${URL_APP}/buscar-frete`,
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
        `📦 ${origem} → ${destino}\nEsse frete é por tonelada (${fmtBRL(frete.valor_frete_centavos / 100)}/ton) — cadastre a carga máxima do seu caminhão pra eu calcular o valor total: ${URL_APP}/perfil\nEnquanto isso, abra o app pra negociar esse frete: ${URL_APP}/buscar-frete`,
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
  });
}

Deno.serve(async (req: Request) => {
  // Handshake de verificação da Meta (configurado uma vez, no painel do
  // WhatsApp Business — GET com hub.mode/hub.verify_token/hub.challenge).
  if (req.method === "GET") {
    const url = new URL(req.url);
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

  // Diagnóstico: status de entrega (sent/delivered/read/failed) de
  // mensagens que NÓS enviamos — não tem relação com processar mensagem
  // recebida, só loga pra dar visibilidade de falha de envio (ver
  // extrairStatuses acima).
  for (const s of extrairStatuses(payload)) {
    if (s.status === "failed") {
      // eslint-disable-next-line no-console
      console.error("[wa-webhook] status=failed", JSON.stringify(s));
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

    if (intent.tipo === "vincular") {
      await tratarVincular(msg.fromE164, intent.codigo, msg.waMessageId);
    } else if (intent.tipo === "desvincular") {
      await tratarDesvincular(msg.fromE164, msg.waMessageId);
    } else if (intent.tipo === "buscar") {
      await tratarBuscaDeFrete(msg.fromE164, msg.waMessageId);
    } else {
      await tratarPedidoDeCalculo(msg.fromE164, msg.texto, msg.waMessageId);
    }
  }

  // Respostas de lista (clique num frete da busca ou em "Abrir o app") —
  // mesmo payload de mensagens, tipo "interactive" em vez de "text", por
  // isso um laço separado com sua própria checagem de idempotência.
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
    await tratarRespostaLista(it.fromE164, it.rowId, it.waMessageId);
  }

  // A Meta espera 200 rápido — se demorar ou der erro, ela reentrega.
  // Sempre 200 aqui, mesmo pra mensagem sem intent: já é o comportamento
  // esperado (cai pro NLU depois), não uma falha do webhook.
  return json({ recebido: mensagens.length + interacoes.length });
});
