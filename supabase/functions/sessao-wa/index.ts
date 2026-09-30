// supabase/functions/sessao-wa/index.ts
//
// Troca uma prova de posse do WhatsApp por uma sessão do app, sem SMS.
// Duas provas aceitas (30/09/2026, Docs/status-sessao.md):
//   1. { telefone_e164, codigo } — código de 6 dígitos que otp-solicitar
//      mandou pelo template de autenticação da Meta (tabela wa_otp);
//   2. { token } — token de uso único que o wa-webhook põe nos links do
//      app (?t=...), tabela wa_login_token. O motorista já provou o número
//      ao falar com o bot; o link só carrega essa prova até o navegador.
//
// Como o Supabase não emite sessão pra telefone sem OTP próprio, o truque
// é: garantir que o usuário tenha um e-mail sintético (<fone>@wa.rodecomlucro.app,
// confirmado, nunca mostrado) e gerar um magiclink por admin. Devolvemos
// só o hashed_token; o app chama supabase.auth.verifyOtp({ token_hash,
// type: 'magiclink' }) e cai logado. verify_jwt=false: roda ANTES do login.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEFONE_PEPPER = Deno.env.get("TELEFONE_PEPPER")!;
const DOMINIO_EMAIL_SINTETICO = "wa.rodecomlucro.app";
const MAX_TENTATIVAS_CODIGO = 5;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function logErro(source: string, message: string, context: Record<string, unknown> = {}) {
  try {
    await supabase.from("app_log").insert({ nivel: "erro", source, message, context });
  } catch {
    // nunca derruba o fluxo por causa do log.
  }
}

/** Mesmo HMAC de otp-solicitar (hashTelefone) e do wa-webhook (token). */
async function hmac(texto: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(TELEFONE_PEPPER), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Conta pelo telefone; cria se não existe (mesma regra do bot: o número já é o cadastro). */
async function garantirMotorista(telefoneE164: string): Promise<{ id: string; novo: boolean } | null> {
  const { data: m } = await supabase.from("motoristas").select("id").eq("telefone_e164", telefoneE164).maybeSingle();
  if (m) return { id: m.id, novo: false };
  const { data, error } = await supabase.auth.admin.createUser({
    phone: telefoneE164,
    phone_confirm: true,
    user_metadata: { origem_cadastro: "whatsapp_otp" },
  });
  if (error || !data.user) {
    await logErro("sessao-wa.criarMotorista", "Falha ao criar conta", { erro: error?.message, telefone: telefoneE164 });
    return null;
  }
  await supabase
    .from("motoristas")
    .update({ telefone_verificado: true, telefone_verificado_em: new Date().toISOString(), canal_wa_ativo: true, origem_cadastro: "whatsapp" })
    .eq("id", data.user.id);
  await supabase.from("analytics_event").insert({ event_name: "signup_completed", actor_id: data.user.id, source: "whatsapp", props: { canal: "whatsapp_otp" } });
  return { id: data.user.id, novo: true };
}

/** E-mail sintético + magiclink por admin → hashed_token pro verifyOtp do app. */
async function emitirTokenDeSessao(motoristaId: string): Promise<string | null> {
  const { data: u, error: getErr } = await supabase.auth.admin.getUserById(motoristaId);
  if (getErr || !u.user) {
    await logErro("sessao-wa.getUser", "Usuário não encontrado no Auth", { erro: getErr?.message, motoristaId });
    return null;
  }
  let email = u.user.email ?? null;
  if (!email) {
    const fone = u.user.phone ?? motoristaId.replace(/-/g, "");
    email = `${fone}@${DOMINIO_EMAIL_SINTETICO}`;
    const { error: upErr } = await supabase.auth.admin.updateUserById(motoristaId, { email, email_confirm: true });
    if (upErr) {
      await logErro("sessao-wa.emailSintetico", "Falha ao definir e-mail sintético", { erro: upErr.message, motoristaId });
      return null;
    }
  }
  const { data: link, error: linkErr } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !link?.properties?.hashed_token) {
    await logErro("sessao-wa.generateLink", "Falha ao gerar magiclink", { erro: linkErr?.message, motoristaId });
    return null;
  }
  return link.properties.hashed_token;
}

Deno.serve(async (req: Request) => {
  try {
    return await tratarRequisicao(req);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[sessao-wa] exceção não tratada", e);
    await logErro("sessao-wa.handler", "Exceção não tratada no handler", { erro: String(e) });
    return json({ erro: "erro_interno" }, 500);
  }
});

async function tratarRequisicao(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "method_not_allowed" }, 405);

  let body: { telefone_e164?: string; codigo?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ erro: "body_invalido" }, 400);
  }

  let motorista: { id: string; novo: boolean } | null = null;
  let via: "codigo" | "token";

  if (body.token) {
    // ---- Link mágico do bot ----
    via = "token";
    const tokenHash = await hmac(`login:${body.token}`);
    const { data: t } = await supabase
      .from("wa_login_token")
      .select("motorista_id, expira_em, usado_em")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!t || t.usado_em || new Date(t.expira_em).getTime() < Date.now()) {
      return json({ erro: "token_invalido" }, 401);
    }
    await supabase.from("wa_login_token").update({ usado_em: new Date().toISOString() }).eq("token_hash", tokenHash);
    motorista = { id: t.motorista_id, novo: false };
  } else {
    // ---- Código do template de OTP ----
    via = "codigo";
    const telefoneE164 = (body.telefone_e164 ?? "").replace(/\D/g, "");
    const codigo = (body.codigo ?? "").replace(/\D/g, "");
    if (!/^55[1-9][0-9]{9,10}$/.test(telefoneE164) || codigo.length !== 6) {
      return json({ erro: "dados_invalidos" }, 400);
    }
    const { data: otp } = await supabase
      .from("wa_otp")
      .select("codigo_hash, expira_em, tentativas")
      .eq("telefone_e164", telefoneE164)
      .maybeSingle();
    if (!otp || new Date(otp.expira_em).getTime() < Date.now()) {
      return json({ erro: "codigo_expirado" }, 401);
    }
    if (otp.tentativas >= MAX_TENTATIVAS_CODIGO) {
      return json({ erro: "muitas_tentativas" }, 429);
    }
    const esperado = await hmac(`${telefoneE164}:${codigo}`);
    if (esperado !== otp.codigo_hash) {
      await supabase.from("wa_otp").update({ tentativas: otp.tentativas + 1 }).eq("telefone_e164", telefoneE164);
      return json({ erro: "codigo_invalido", restantes: MAX_TENTATIVAS_CODIGO - otp.tentativas - 1 }, 401);
    }
    await supabase.from("wa_otp").delete().eq("telefone_e164", telefoneE164);
    motorista = await garantirMotorista(telefoneE164);
    if (!motorista) return json({ erro: "falha_conta" }, 500);
    // Login pelo WhatsApp prova o número e liga o canal (mesmo efeito do vínculo).
    await supabase
      .from("motoristas")
      .update({ telefone_verificado: true, telefone_verificado_em: new Date().toISOString(), canal_wa_ativo: true })
      .eq("id", motorista.id);
  }

  const tokenHash = await emitirTokenDeSessao(motorista.id);
  if (!tokenHash) return json({ erro: "falha_sessao" }, 500);

  await supabase.from("identidade_audit").insert({
    motorista_id: motorista.id,
    evento: "login_ok",
    detalhe: { via: `sessao_wa_${via}`, conta_nova: motorista.novo },
  });

  return json({ token_hash: tokenHash, conta_nova: motorista.novo });
}
