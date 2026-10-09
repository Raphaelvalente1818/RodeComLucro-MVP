// supabase/functions/stripe-webhook/index.ts
//
// Recebe os eventos do Stripe e mantém a tabela `assinatura` (09/10/2026,
// Docs/pagamentos-assinatura.md). verify_jwt=false: quem chama é o Stripe,
// autenticado pela assinatura HMAC do cabeçalho Stripe-Signature.
//
// Eventos tratados (todos idempotentes via stripe_evento):
//   checkout.session.completed      → cria/ativa (client_reference_id = motorista_id)
//   customer.subscription.updated   → status + periodo_fim
//   customer.subscription.deleted   → cancelada
//   invoice.paid                    → ativa + periodo_fim (renovação mensal)
//   invoice.payment_failed          → atrasada (Stripe tenta de novo sozinho)
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
// Deploy: npx supabase@latest functions deploy stripe-webhook --no-verify-jwt --project-ref gastwloozlzthpqhxnzr
// Endpoint pra cadastrar no Stripe: https://gastwloozlzthpqhxnzr.supabase.co/functions/v1/stripe-webhook

import Stripe from "npm:stripe@17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });
const cryptoProvider = Stripe.createSubtleCryptoProvider();

type StatusAssinatura = "incompleta" | "ativa" | "atrasada" | "cancelada";

async function logErro(source: string, message: string, context: Record<string, unknown> = {}) {
  try {
    await supabase.from("app_log").insert({ nivel: "erro", source, message, context });
  } catch {
    // nunca derruba o fluxo por causa do log.
  }
}

/** Status do Stripe → nosso. */
function mapearStatus(s: Stripe.Subscription.Status): StatusAssinatura {
  switch (s) {
    case "active":
    case "trialing":
      return "ativa";
    case "past_due":
    case "unpaid":
      return "atrasada";
    case "canceled":
    case "incomplete_expired":
      return "cancelada";
    default:
      return "incompleta"; // incomplete, paused
  }
}

function periodoFim(sub: Stripe.Subscription): string | null {
  // stripe@17 (API 2024-11+): current_period_end mora no item; mantém o fallback do objeto.
  const item = sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const fim = item?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  return fim ? new Date(fim * 1000).toISOString() : null;
}

/** Acha o motorista: pelo subscription_id já gravado, pelo customer, ou pelo metadata. */
async function motoristaDaAssinatura(sub: Stripe.Subscription): Promise<string | null> {
  const meta = sub.metadata?.motorista_id;
  if (meta) return meta;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const { data } = await supabase
    .from("assinatura")
    .select("motorista_id")
    .or(`subscription_id.eq.${sub.id},customer_id.eq.${customerId ?? "-"}`)
    .limit(1)
    .maybeSingle();
  return (data?.motorista_id as string | undefined) ?? null;
}

async function gravar(motoristaId: string, patch: Record<string, unknown>, eventoId: string) {
  const { error } = await supabase
    .from("assinatura")
    .upsert({ motorista_id: motoristaId, provedor: "stripe", plano: "pro", ultimo_evento_id: eventoId, ...patch }, { onConflict: "motorista_id" });
  if (error) await logErro("stripe-webhook.gravar", "Falha ao gravar assinatura", { erro: error.message, motoristaId, patch });
}

async function aplicarAssinatura(sub: Stripe.Subscription, eventoId: string) {
  const motoristaId = await motoristaDaAssinatura(sub);
  if (!motoristaId) {
    await logErro("stripe-webhook.assinatura", "Assinatura sem motorista (metadata/customer não batem)", { subscription: sub.id });
    return;
  }
  const status = mapearStatus(sub.status);
  await gravar(
    motoristaId,
    {
      customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null,
      subscription_id: sub.id,
      status,
      periodo_fim: periodoFim(sub),
      cancelada_em: status === "cancelada" ? new Date().toISOString() : null,
    },
    eventoId,
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("método não suportado", { status: 405 });
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    await logErro("stripe-webhook.config", "STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET ausentes");
    return new Response("sem configuração", { status: 503 });
  }

  const assinatura = req.headers.get("stripe-signature");
  const corpo = await req.text();
  let evento: Stripe.Event;
  try {
    evento = await stripe.webhooks.constructEventAsync(corpo, assinatura ?? "", STRIPE_WEBHOOK_SECRET, undefined, cryptoProvider);
  } catch (err) {
    await logErro("stripe-webhook.assinaturaHmac", "Evento rejeitado (assinatura inválida)", { erro: String(err) });
    return new Response("assinatura inválida", { status: 400 });
  }

  // Idempotência: o Stripe reenvia eventos; o mesmo id nunca é aplicado duas vezes.
  const { error: dupErr } = await supabase.from("stripe_evento").insert({ id: evento.id, tipo: evento.type });
  if (dupErr) {
    if (dupErr.code === "23505") return new Response("já processado", { status: 200 });
    await logErro("stripe-webhook.idempotencia", "Falha ao registrar evento", { erro: dupErr.message, id: evento.id });
  }

  try {
    switch (evento.type) {
      case "checkout.session.completed": {
        const sessao = evento.data.object as Stripe.Checkout.Session;
        const motoristaId = sessao.client_reference_id ?? sessao.metadata?.motorista_id ?? null;
        const subscriptionId = typeof sessao.subscription === "string" ? sessao.subscription : sessao.subscription?.id ?? null;
        if (!motoristaId) {
          await logErro("stripe-webhook.checkout", "Checkout sem client_reference_id", { sessao: sessao.id });
          break;
        }
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          // garante o vínculo mesmo se o metadata não veio
          if (!sub.metadata?.motorista_id) await stripe.subscriptions.update(subscriptionId, { metadata: { motorista_id: motoristaId } });
          await aplicarAssinatura({ ...sub, metadata: { ...sub.metadata, motorista_id: motoristaId } }, evento.id);
        } else {
          await gravar(motoristaId, { customer_id: typeof sessao.customer === "string" ? sessao.customer : null, status: "incompleta" }, evento.id);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await aplicarAssinatura(evento.data.object as Stripe.Subscription, evento.id);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const fatura = evento.data.object as Stripe.Invoice;
        const subRef = (fatura as unknown as { subscription?: string | { id: string } | null }).subscription
          ?? (fatura as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription;
        const subscriptionId = typeof subRef === "string" ? subRef : subRef?.id ?? null;
        if (!subscriptionId) break;
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await aplicarAssinatura(sub, evento.id);
        break;
      }
      default:
        // outros eventos: só registrados em stripe_evento
        break;
    }
  } catch (err) {
    await logErro("stripe-webhook.processar", "Falha ao processar evento", { erro: String(err), tipo: evento.type, id: evento.id });
    // 500 faz o Stripe reenviar; a idempotência acima segura o reprocessamento.
    await supabase.from("stripe_evento").delete().eq("id", evento.id);
    return new Response("erro", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
