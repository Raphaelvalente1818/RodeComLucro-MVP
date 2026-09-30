// supabase/functions/otp-solicitar/index.ts
//
// Único ponto de entrada para solicitar OTP de login por telefone.
// O PWA nunca chama supabase.auth.signInWithOtp diretamente — sempre
// passa por aqui, para que o gate anti-abuso rode antes de qualquer
// custo de SMS/WhatsApp ser gerado.
//
// Ref: Docs/PRD-tecnico-identidade.html (secao otp-solicitar)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEFONE_PEPPER = Deno.env.get("TELEFONE_PEPPER")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const E164_BR = /^55[1-9][0-9]{9,10}$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Ver mesmo comentário em wa-webhook/index.ts — grava em app_log pra
// alimentar a aba "Saúde do sistema" do admin.
async function logErro(source: string, message: string, context: Record<string, unknown> = {}) {
  try {
    await supabase.from("app_log").insert({ nivel: "erro", source, message, context });
  } catch {
    // melhor perder um log do que quebrar o fluxo por causa dele.
  }
}

async function hashTelefone(telefoneE164: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(TELEFONE_PEPPER),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(telefoneE164));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getConfig(chave: string, fallback: string): Promise<string> {
  const { data } = await supabase
    .from("identidade_config")
    .select("valor")
    .eq("chave", chave)
    .maybeSingle();
  return data?.valor ?? fallback;
}

async function bloqueioAtivo(escopo: "telefone" | "ip" | "global", chave: string) {
  const { data } = await supabase
    .from("otp_bloqueio")
    .select("bloqueado_ate, nivel")
    .eq("escopo", escopo)
    .eq("chave", chave)
    .maybeSingle();
  if (data && new Date(data.bloqueado_ate).getTime() > Date.now()) {
    return data;
  }
  return null;
}

const NIVEL_MINUTOS: Record<1 | 2 | 3, number> = { 1: 15, 2: 60, 3: 60 * 24 };

async function registrarBloqueio(escopo: "telefone" | "ip" | "global", chave: string, motivo: string) {
  // Escalada de nivel via RPC atomica (migration
  // 0012_registrar_bloqueio_otp_atomico.sql): o SELECT nivel + UPSERT
  // em duas chamadas separadas que existia aqui tinha race condition —
  // requests quase simultaneas liam o mesmo nivel de partida e cada
  // uma escalava a partir dele, deixando um usuario pular de nivel 1
  // (15min) pra nivel 3 (24h) em poucos segundos. A RPC resolve tudo
  // num unico UPSERT no banco, que serializa via lock de linha.
  const { data, error } = await supabase.rpc("registrar_bloqueio_otp", {
    p_escopo: escopo,
    p_chave: chave,
    p_motivo: motivo,
  });

  if (error || !data) {
    // Fallback conservador (nivel 1) se a RPC falhar por algum motivo —
    // melhor bloquear 15min do que nao bloquear nada.
    // eslint-disable-next-line no-console
    console.error("registrar_bloqueio_otp falhou, aplicando fallback nivel 1", error);
    await logErro("otp-solicitar.registrarBloqueio", "RPC registrar_bloqueio_otp falhou, usando fallback nível 1", {
      erro: error?.message ?? String(error),
      escopo,
      chave,
    });
    const bloqueadoAte = new Date(Date.now() + NIVEL_MINUTOS[1] * 60_000).toISOString();
    await supabase.from("otp_bloqueio").upsert(
      { escopo, chave, nivel: 1, bloqueado_ate: bloqueadoAte, motivo },
      { onConflict: "escopo,chave" },
    );
    return bloqueadoAte;
  }

  return data as string;
}

async function contarEnvios(telefoneHash: string, desde: Date) {
  // Exclui tentativas com status 'bloqueado': elas nunca chegaram a
  // mandar SMS, entao nao devem contar pro proprio limite que as
  // gerou (senao o bloqueio se auto-reforca e nunca expira dentro da
  // janela — bug corrigido em 2026-08-04).
  const { count } = await supabase
    .from("otp_envio")
    .select("id", { count: "exact", head: true })
    .eq("telefone_hash", telefoneHash)
    .neq("status", "bloqueado")
    .gte("created_at", desde.toISOString());
  return count ?? 0;
}

async function contarEnviosPorIp(ip: string, desde: Date) {
  // Mesmo motivo de contarEnvios(): bloqueado nao conta.
  const { count } = await supabase
    .from("otp_envio")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .neq("status", "bloqueado")
    .gte("created_at", desde.toISOString());
  return count ?? 0;
}

Deno.serve(async (req: Request) => {
  try {
    return await tratarRequisicao(req);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[otp-solicitar] exceção não tratada no handler", e);
    await logErro("otp-solicitar.handler", "Exceção não tratada no handler", { erro: String(e) });
    return json({ erro: "erro_interno" }, 500);
  }
});

async function tratarRequisicao(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "method_not_allowed" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";

  let body: { telefone_e164?: string; canal?: "sms" | "whatsapp"; captcha_token?: string };
  try {
    body = await req.json();
  } catch {
    return json({ erro: "body_invalido" }, 400);
  }

  const telefoneE164 = (body.telefone_e164 ?? "").replace(/\D/g, "");
  const canal = body.canal === "whatsapp" ? "whatsapp" : "sms";

  if (!E164_BR.test(telefoneE164)) {
    return json({ erro: "telefone_invalido" }, 400);
  }

  // 1. Kill-switch
  const canalAtivo = await getConfig("otp_canal_ativo", "true");
  if (canalAtivo !== "true") {
    return json({ motivo: "kill_switch" }, 503);
  }

  const telefoneHash = await hashTelefone(telefoneE164);

  // 2. Bloqueios já ativos (telefone / ip / global)
  for (const [escopo, chave] of [
    ["telefone", telefoneHash],
    ["ip", ip],
    ["global", "global"],
  ] as const) {
    const bloqueio = await bloqueioAtivo(escopo, chave);
    if (bloqueio) {
      await supabase.from("identidade_audit").insert({
        evento: "otp_bloqueado",
        telefone_hash: telefoneHash,
        ip,
        detalhe: { escopo, nivel: bloqueio.nivel },
      });
      return json({ bloqueado_ate: bloqueio.bloqueado_ate, motivo: `bloqueio_${escopo}` }, 429);
    }
  }

  // 3. Janelas deslizantes
  const agora = Date.now();
  const [limTel15, limTel24h, limIpHora, limIp24h] = await Promise.all([
    getConfig("limite_telefone_15min", "3"),
    getConfig("limite_telefone_24h", "5"),
    getConfig("limite_ip_hora", "10"),
    getConfig("limite_ip_24h", "20"),
  ]);

  const [envios15min, envios24h, enviosIpHora, enviosIp24h] = await Promise.all([
    contarEnvios(telefoneHash, new Date(agora - 15 * 60_000)),
    contarEnvios(telefoneHash, new Date(agora - 24 * 60 * 60_000)),
    contarEnviosPorIp(ip, new Date(agora - 60 * 60_000)),
    contarEnviosPorIp(ip, new Date(agora - 24 * 60 * 60_000)),
  ]);

  let overflow: { escopo: "telefone" | "ip"; chave: string; motivo: string } | null = null;
  if (envios15min >= Number(limTel15)) overflow = { escopo: "telefone", chave: telefoneHash, motivo: "limite_telefone" };
  else if (envios24h >= Number(limTel24h)) overflow = { escopo: "telefone", chave: telefoneHash, motivo: "limite_telefone" };
  else if (enviosIpHora >= Number(limIpHora)) overflow = { escopo: "ip", chave: ip, motivo: "limite_ip" };
  else if (enviosIp24h >= Number(limIp24h)) overflow = { escopo: "ip", chave: ip, motivo: "limite_ip" };

  if (overflow) {
    const bloqueadoAte = await registrarBloqueio(overflow.escopo, overflow.chave, overflow.motivo);
    await supabase.from("otp_envio").insert({
      telefone_hash: telefoneHash, ip, canal, status: "bloqueado", motivo_bloqueio: overflow.motivo,
    });
    await supabase.from("identidade_audit").insert({
      evento: "otp_bloqueado", telefone_hash: telefoneHash, ip, detalhe: overflow,
    });
    return json({ bloqueado_ate: bloqueadoAte, motivo: overflow.motivo }, 429);
  }

  // 4. Teto diário global — soft check, só alerta (nao bloqueia aqui).
  const tetoDia = Number(await getConfig("teto_sms_dia", "500"));
  const inicioDia = new Date();
  inicioDia.setUTCHours(0, 0, 0, 0);
  const { count: enviosHoje } = await supabase
    .from("otp_envio")
    .select("id", { count: "exact", head: true })
    .gte("created_at", inicioDia.toISOString());
  if (tetoDia > 0 && (enviosHoje ?? 0) >= tetoDia * 0.8) {
    await supabase.from("identidade_audit").insert({
      evento: "otp_solicitado",
      telefone_hash: telefoneHash,
      ip,
      detalhe: { alerta: "teto_sms_dia_80pct", enviosHoje },
    });
  }

  // 5. Detecção de SMS pumping: >=5 telefones distintos do mesmo IP em 10min.
  const { data: recentesIp } = await supabase
    .from("otp_envio")
    .select("telefone_hash")
    .eq("ip", ip)
    .gte("created_at", new Date(agora - 10 * 60_000).toISOString());
  const distintos = new Set((recentesIp ?? []).map((r: { telefone_hash: string }) => r.telefone_hash));
  if (distintos.size >= 5) {
    const bloqueadoAte = new Date(agora + 24 * 60 * 60_000).toISOString();
    await supabase.from("otp_bloqueio").upsert(
      { escopo: "ip", chave: ip, nivel: 3, bloqueado_ate: bloqueadoAte, motivo: "sms_pumping" },
      { onConflict: "escopo,chave" },
    );
    await supabase.from("identidade_audit").insert({
      evento: "otp_bloqueado", telefone_hash: telefoneHash, ip, detalhe: { motivo: "sms_pumping" },
    });
    return json({ bloqueado_ate: bloqueadoAte, motivo: "sms_pumping" }, 429);
  }

  // 6. Dispara o OTP.
  // - sms: GoTrue (Twilio), verificação pelo verifyOtp do app;
  // - whatsapp (30/09): código nosso, guardado em wa_otp, mandado pelo
  //   template de autenticação "modelo01" da Meta; verificação na Edge
  //   Function sessao-wa. Se a Meta falhar, cai pra SMS na hora — o
  //   motorista nunca fica sem código.
  let canalEfetivo: "sms" | "whatsapp" = canal;
  let erroEnvio: string | null = null;

  if (canal === "whatsapp") {
    const erroWa = await enviarCodigoPorWhatsapp(telefoneE164);
    if (erroWa) {
      await logErro("otp-solicitar.whatsapp", "Meta falhou ao mandar template de OTP; caindo pra SMS", { erro: erroWa });
      canalEfetivo = "sms";
    }
  }
  if (canalEfetivo === "sms") {
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone: `+${telefoneE164}` });
    erroEnvio = otpError?.message ?? null;
  }

  await supabase.from("otp_envio").insert({
    telefone_hash: telefoneHash,
    ip,
    canal: canalEfetivo,
    provider: canalEfetivo === "whatsapp" ? "meta_cloud_api" : "supabase_gotrue",
    status: erroEnvio ? "falha" : "enviado",
  });

  await supabase.from("identidade_audit").insert({
    evento: "otp_solicitado",
    telefone_hash: telefoneHash,
    ip,
    detalhe: { canal: canalEfetivo, canal_pedido: canal, ok: !erroEnvio },
  });

  if (erroEnvio) {
    await logErro("otp-solicitar.enviarOtp", "GoTrue falhou ao enviar OTP", { erro: erroEnvio, canal: canalEfetivo });
    return json({ enviado: false, erro: "falha_envio" }, 502);
  }

  return json({ enviado: true, canal_efetivo: canalEfetivo, proximo_reenvio_s: 60 });
}

// ---------------------------------------------------------------------
// OTP pelo WhatsApp — template de autenticação da Meta (categoria
// AUTHENTICATION, formato fixo: código no corpo + botão "Copiar código").
// Mesmos secrets do wa-webhook. O código fica hasheado com o pepper em
// wa_otp; quem confere é a Edge Function sessao-wa.
// ---------------------------------------------------------------------
const WA_ACCESS_TOKEN = Deno.env.get("WA_ACCESS_TOKEN");
const WA_PHONE_NUMBER_ID = Deno.env.get("WA_PHONE_NUMBER_ID");
const WA_TEMPLATE_OTP = Deno.env.get("WA_TEMPLATE_OTP") ?? "modelo01";
const WA_TEMPLATE_OTP_IDIOMA = Deno.env.get("WA_TEMPLATE_OTP_IDIOMA") ?? "pt_BR";
const OTP_VALIDADE_MIN = 10;

async function enviarCodigoPorWhatsapp(telefoneE164: string): Promise<string | null> {
  if (!WA_ACCESS_TOKEN || !WA_PHONE_NUMBER_ID) return "WA_ACCESS_TOKEN/WA_PHONE_NUMBER_ID ausentes";

  // 6 dígitos com crypto, sem zero à esquerda perdido (string).
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const codigo = String(buf[0] % 1_000_000).padStart(6, "0");
  const codigoHash = await hashTelefone(`${telefoneE164}:${codigo}`);

  const { error: dbErr } = await supabase.from("wa_otp").upsert(
    {
      telefone_e164: telefoneE164,
      codigo_hash: codigoHash,
      expira_em: new Date(Date.now() + OTP_VALIDADE_MIN * 60_000).toISOString(),
      tentativas: 0,
      criado_em: new Date().toISOString(),
    },
    { onConflict: "telefone_e164" },
  );
  if (dbErr) return `wa_otp: ${dbErr.message}`;

  try {
    const resp = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefoneE164,
        type: "template",
        template: {
          name: WA_TEMPLATE_OTP,
          language: { code: WA_TEMPLATE_OTP_IDIOMA },
          components: [
            { type: "body", parameters: [{ type: "text", text: codigo }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: codigo }] },
          ],
        },
      }),
    });
    if (!resp.ok) {
      const detalhe = await resp.text();
      await supabase.from("wa_otp").delete().eq("telefone_e164", telefoneE164);
      return `Meta ${resp.status}: ${detalhe.slice(0, 300)}`;
    }
    return null;
  } catch (e) {
    await supabase.from("wa_otp").delete().eq("telefone_e164", telefoneE164);
    return String(e);
  }
}
