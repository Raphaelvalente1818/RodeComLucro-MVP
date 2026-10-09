// supabase/functions/assinar/index.ts
//
// Pro app (09/10/2026, Docs/pagamentos-assinatura.md): devolve o link do
// Checkout do Stripe (não assinante) ou do Customer Portal (assinante) pro
// motorista logado. verify_jwt=true: o usuário vem do JWT, nunca do corpo.
// Mesma lógica de wa-webhook/assinatura.ts, só que com o id do JWT.
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ID, URL_APP (opcional).
// Deploy: npx supabase@latest functions deploy assinar --project-ref gastwloozlzthpqhxnzr

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_PRICE_ID = Deno.env.get("STRIPE_PRICE_ID") ?? "";
const URL_APP = Deno.env.get("URL_APP") ?? "https://rode-com-lucro-mvp.vercel.app";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function formEncode(obj: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function stripePost(caminho: string, corpo: Record<string, string | number | boolean | undefined>) {
  const r = await fetch(`https://api.stripe.com/v1/${caminho}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: formEncode(corpo),
  });
  const body = (await r.json()) as Record<string, unknown>;
  if (!r.ok) {
    await admin.from("app_log").insert({ nivel: "erro", source: "assinar.stripe", message: `Stripe ${caminho} falhou`, context: { status: r.status, erro: body?.error ?? null } });
    return null;
  }
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);
  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) return json({ disponivel: false, motivo: "nao_configurado" });

  // acao "status": o app pergunta se o plano existe antes de aplicar qualquer limite.
  let acaoPedida: string | null = null;
  try {
    acaoPedida = ((await req.clone().json()) as { acao?: string }).acao ?? null;
  } catch {
    // sem corpo
  }
  if (acaoPedida === "status") return json({ disponivel: true });

  // Usuário do JWT (verify_jwt=true garante que existe).
  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ erro: "nao_autenticado" }, 401);

  let body: { acao?: "checkout" | "portal" } = {};
  try {
    body = await req.json();
  } catch {
    // corpo vazio = checkout
  }

  const { data: a } = await admin.from("assinatura").select("status, customer_id, periodo_fim").eq("motorista_id", user.id).maybeSingle();
  const { data: ativa } = await admin.rpc("motorista_assinante", { p_motorista: user.id });

  if (body.acao === "portal" || ativa) {
    if (!a?.customer_id) return json({ erro: "sem_cliente" }, 400);
    const sessao = await stripePost("billing_portal/sessions", { customer: a.customer_id, return_url: `${URL_APP}/`, locale: "pt-BR" });
    return sessao?.url ? json({ url: sessao.url, tipo: "portal" }) : json({ erro: "stripe" }, 502);
  }

  const { data: m } = await admin.from("motoristas").select("telefone_e164").eq("id", user.id).maybeSingle();
  const sessao = await stripePost("checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": STRIPE_PRICE_ID,
    "line_items[0][quantity]": 1,
    client_reference_id: user.id,
    "metadata[motorista_id]": user.id,
    "metadata[telefone]": m?.telefone_e164 ?? "",
    "subscription_data[metadata][motorista_id]": user.id,
    customer: a?.customer_id ?? undefined,
    locale: "pt-BR",
    allow_promotion_codes: true,
    success_url: `${URL_APP}/?assinatura=ok`,
    cancel_url: `${URL_APP}/?assinatura=cancelou`,
  });
  return sessao?.url ? json({ url: sessao.url, tipo: "checkout" }) : json({ erro: "stripe" }, 502);
});
