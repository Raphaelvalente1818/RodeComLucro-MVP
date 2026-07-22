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
  const { data: atual } = await supabase
    .from("otp_bloqueio")
    .select("nivel")
    .eq("escopo", escopo)
    .eq("chave", chave)
    .maybeSingle();

  const proximoNivel = (Math.min((atual?.nivel ?? 0) + 1, 3)) as 1 | 2 | 3;
  const bloqueadoAte = new Date(Date.now() + NIVEL_MINUTOS[proximoNivel] * 60_000).toISOString();

  await supabase.from("otp_bloqueio").upsert(
    { escopo, chave, nivel: proximoNivel, bloqueado_ate: bloqueadoAte, motivo },
    { onConflict: "escopo,chave" },
  );

  return bloqueadoAte;
}

async function contarEnvios(telefoneHash: string, desde: Date) {
  const { count } = await supabase
    .from("otp_envio")
    .select("id", { count: "exact", head: true })
    .eq("telefone_hash", telefoneHash)
    .gte("created_at", desde.toISOString());
  return count ?? 0;
}

async function contarEnviosPorIp(ip: string, desde: Date) {
  const { count } = await supabase
    .from("otp_envio")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", desde.toISOString());
  return count ?? 0;
}

Deno.serve(async (req: Request) => {
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

  // 6. Dispara o OTP via GoTrue. Canal 'whatsapp' ainda depende do
  // template HSM da Meta (Fase 2 do roadmap) — por enquanto cai para SMS.
  // TODO(fase 2): integrar wa-send / HSM 'authentication' quando aprovado.
  const canalEfetivo = "sms";
  const { error: otpError } = await supabase.auth.signInWithOtp({
    phone: `+${telefoneE164}`,
  });

  await supabase.from("otp_envio").insert({
    telefone_hash: telefoneHash,
    ip,
    canal: canalEfetivo,
    provider: "supabase_gotrue",
    status: otpError ? "falha" : "enviado",
  });

  await supabase.from("identidade_audit").insert({
    evento: "otp_solicitado",
    telefone_hash: telefoneHash,
    ip,
    detalhe: { canal: canalEfetivo, ok: !otpError },
  });

  if (otpError) {
    return json({ enviado: false, erro: "falha_envio" }, 502);
  }

  return json({ enviado: true, canal_efetivo: canalEfetivo, proximo_reenvio_s: 60 });
});
