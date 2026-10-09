// supabase/functions/wa-webhook/assinatura.ts
//
// "Rode com Lucro PRO" (09/10/2026, Docs/pagamentos-assinatura.md): o bot é o
// canal de venda. Fala com o Stripe direto pela API REST (sem SDK — o bundle do
// wa-webhook já está no limite), gera o link do Checkout hospedado (nenhum dado
// de cartão passa por aqui) e o link do Customer Portal (trocar cartão, cancelar).
// Quem grava a assinatura é a Edge Function stripe-webhook; aqui só se lê.
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ID (o preço vive no Stripe).
// Sem as duas, o bot responde que o plano ainda não está disponível — nunca quebra.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_PRICE_ID = Deno.env.get("STRIPE_PRICE_ID") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** Regras do grátis × PRO (decisão do Raphael, 09/10). */
export const PRO = {
  /** fretes na lista do WhatsApp */
  listaGratis: 3,
  listaPro: 9, // a Meta aceita 10 linhas; a 10ª é "Abrir o app"
  /** frete publicado há menos de X h só aparece pra PRO ("primeira mão") */
  primeiraMaoHoras: 2,
  /** fretes na tela Buscar do app (grátis); PRO vê todos */
  appGratis: 5,
} as const;

export interface EstadoAssinatura {
  ativa: boolean;
  status: string | null;
  periodoFim: string | null;
  customerId: string | null;
}

export function assinaturaConfigurada(): boolean {
  return Boolean(STRIPE_SECRET_KEY && STRIPE_PRICE_ID);
}

export async function estadoAssinatura(motoristaId: string | null): Promise<EstadoAssinatura> {
  if (!motoristaId) return { ativa: false, status: null, periodoFim: null, customerId: null };
  const [{ data: ativa }, { data: a }] = await Promise.all([
    supabase.rpc("motorista_assinante", { p_motorista: motoristaId }),
    supabase.from("assinatura").select("status, periodo_fim, customer_id").eq("motorista_id", motoristaId).maybeSingle(),
  ]);
  return {
    ativa: Boolean(ativa),
    status: (a?.status as string | undefined) ?? null,
    periodoFim: (a?.periodo_fim as string | undefined) ?? null,
    customerId: (a?.customer_id as string | undefined) ?? null,
  };
}

export async function ehAssinante(motoristaId: string | null): Promise<boolean> {
  if (!motoristaId) return false;
  const { data } = await supabase.rpc("motorista_assinante", { p_motorista: motoristaId });
  return Boolean(data);
}

// ---------------------------------------------------------------------
// Stripe REST (form-encoded). Só o que o bot precisa: preço, checkout, portal.
// ---------------------------------------------------------------------

function formEncode(obj: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function stripePost(caminho: string, corpo: Record<string, string | number | boolean | undefined>): Promise<Record<string, unknown> | null> {
  const r = await fetch(`https://api.stripe.com/v1/${caminho}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: formEncode(corpo),
  });
  const json = (await r.json()) as Record<string, unknown>;
  if (!r.ok) {
    await supabase.from("app_log").insert({ nivel: "erro", source: "wa-webhook.stripe", message: `Stripe ${caminho} falhou`, context: { status: r.status, erro: json?.error ?? null } });
    return null;
  }
  return json;
}

let precoCache: { texto: string; em: number } | null = null;

/** "R$ 29,90/mês" lido do Price do Stripe (cache 1 h). Null se não configurado. */
export async function textoPreco(): Promise<string | null> {
  if (!assinaturaConfigurada()) return null;
  if (precoCache && Date.now() - precoCache.em < 60 * 60_000) return precoCache.texto;
  const r = await fetch(`https://api.stripe.com/v1/prices/${STRIPE_PRICE_ID}`, { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } });
  if (!r.ok) return null;
  const p = (await r.json()) as { unit_amount?: number; currency?: string; recurring?: { interval?: string; interval_count?: number } };
  if (p.unit_amount == null) return null;
  const valor = (p.unit_amount / 100).toLocaleString("pt-BR", { style: "currency", currency: (p.currency ?? "brl").toUpperCase() });
  const intervalo = p.recurring?.interval === "year" ? "ano" : p.recurring?.interval === "week" ? "semana" : "mês";
  const texto = `${valor}/${intervalo}`;
  precoCache = { texto, em: Date.now() };
  return texto;
}

/** Link do Checkout hospedado do Stripe (assinatura, cartão). */
export async function linkCheckout(motoristaId: string, fromE164: string, urlApp: string): Promise<string | null> {
  if (!assinaturaConfigurada()) return null;
  const { customerId } = await estadoAssinatura(motoristaId);
  const sessao = await stripePost("checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": STRIPE_PRICE_ID,
    "line_items[0][quantity]": 1,
    client_reference_id: motoristaId,
    "metadata[motorista_id]": motoristaId,
    "metadata[telefone]": fromE164,
    "subscription_data[metadata][motorista_id]": motoristaId,
    customer: customerId ?? undefined,
    locale: "pt-BR",
    allow_promotion_codes: true,
    success_url: `${urlApp}/?assinatura=ok`,
    cancel_url: `${urlApp}/?assinatura=cancelou`,
  });
  return (sessao?.url as string | undefined) ?? null;
}

/** Link do Customer Portal (trocar cartão, ver faturas, cancelar). */
export async function linkPortal(customerId: string, urlApp: string): Promise<string | null> {
  if (!STRIPE_SECRET_KEY) return null;
  const sessao = await stripePost("billing_portal/sessions", { customer: customerId, return_url: `${urlApp}/`, locale: "pt-BR" });
  return (sessao?.url as string | undefined) ?? null;
}

function fmtDataBR(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/** Texto do comando PRO/ASSINAR/PLANO — vende pra quem não tem, gerencia pra quem tem. */
export async function mensagemPro(motoristaId: string, fromE164: string, urlApp: string): Promise<string> {
  const estado = await estadoAssinatura(motoristaId);
  if (estado.ativa) {
    const portal = estado.customerId ? await linkPortal(estado.customerId, urlApp) : null;
    return (
      `✅ Você é *Rode com Lucro PRO*${estado.periodoFim ? ` — renova em ${fmtDataBR(estado.periodoFim)}` : ""}.\n` +
      `Fretes ilimitados e em primeira mão, WhatsApp sem limite.` +
      (estado.status === "atrasada" ? `\n⚠️ A última cobrança falhou — atualiza o cartão pra não perder o PRO.` : "") +
      (portal ? `\n\nTrocar cartão, ver faturas ou cancelar: ${portal}` : "")
    );
  }
  const preco = await textoPreco();
  if (!preco) return "O plano PRO ainda não está disponível — em breve. Por enquanto você usa tudo de graça dentro do limite diário.";
  const link = await linkCheckout(motoristaId, fromE164, urlApp);
  if (!link) return "Não consegui gerar o link de assinatura agora. Tenta de novo em instantes.";
  return (
    `*Rode com Lucro PRO* — ${preco}, cancela quando quiser:\n` +
    `• Fretes *ilimitados* na busca\n` +
    `• Fretes *em primeira mão* (você vê antes de todo mundo)\n` +
    `• WhatsApp *sem limite* de consultas por dia\n\n` +
    `Assinar com cartão (página segura do Stripe): ${link}`
  );
}
