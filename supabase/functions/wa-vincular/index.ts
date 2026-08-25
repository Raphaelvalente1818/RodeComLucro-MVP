// supabase/functions/wa-vincular/index.ts
//
// Inicia a prova de posse do número no WhatsApp (Fase 2, calc-wpp/
// identidade): gera um código de 6 dígitos, grava um wa_vinculo pendente
// (TTL 10min, revogando qualquer pendente anterior do mesmo motorista) e
// devolve o link direto pro WhatsApp oficial já com o texto
// "VINCULAR <código>" preenchido. Quem confirma de verdade é o
// wa-webhook, quando a mensagem chegar (ver esse arquivo pro outro lado
// do fluxo). Contrato completo em Docs/PRD-tecnico-identidade.html —
// seção "Vínculo app<->WhatsApp".
//
// motorista_id vem SEMPRE do claim "sub" do JWT (verify_jwt=true, config
// desta function no Supabase, já garante um token com assinatura válida
// e não expirado antes deste código rodar) — nunca do body, pra ninguém
// gerar código de vínculo pra conta alheia.
//
// Variável de ambiente necessária: NUMERO_OFICIAL_WA (E.164 sem "+", ex.:
// "5511987654321") — o número do WhatsApp Business oficial. Só serve pra
// montar o link; não depende do WA_ACCESS_TOKEN/WA_PHONE_NUMBER_ID (chave
// de envio da Meta) que o wa-webhook usa.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NUMERO_OFICIAL_WA = Deno.env.get("NUMERO_OFICIAL_WA");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

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

/**
 * Lê o motorista_id direto do claim "sub" do JWT, sem chamar o GoTrue de
 * novo — a plataforma (verify_jwt=true) já validou assinatura/expiração
 * antes de invocar esta function. Chamada com só a chave anônima (sem
 * sessão de usuário de verdade) não tem "sub" — retorna null, tratado
 * como não-autenticado.
 */
export function motoristaIdDoToken(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(partes[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

export function gerarCodigo6Digitos(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, "0");
}

export async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "method_not_allowed" }, 405);

  const motoristaId = motoristaIdDoToken(req);
  if (!motoristaId) return json({ erro: "nao_autenticado" }, 401);

  if (!NUMERO_OFICIAL_WA) {
    // Número oficial ainda não configurado — sem ele não tem link pra
    // devolver. Não é erro de código, é config pendente (mesma ideia do
    // "sem chave" do route-cost).
    return json({ erro: "numero_oficial_nao_configurado" }, 503);
  }

  // Rate-limit próprio: máx 5 solicitações/hora por motorista, além do
  // índice único parcial (1 pendente por vez) já garantido pelo schema.
  const umaHoraAtras = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count } = await supabase
    .from("wa_vinculo")
    .select("id", { count: "exact", head: true })
    .eq("motorista_id", motoristaId)
    .gte("created_at", umaHoraAtras);
  if ((count ?? 0) >= 5) {
    return json({ erro: "limite_solicitacoes" }, 429);
  }

  const codigo = gerarCodigo6Digitos();
  const codigoHash = await sha256Hex(codigo);
  const expiraEm = new Date(Date.now() + 10 * 60_000).toISOString();

  // Revoga qualquer pendente anterior — só o último código gerado vale.
  // Feito ANTES do insert pra não bater no índice único parcial
  // (motorista_id) where status='pendente'.
  await supabase
    .from("wa_vinculo")
    .update({ status: "revogado" })
    .eq("motorista_id", motoristaId)
    .eq("status", "pendente");

  const { error } = await supabase.from("wa_vinculo").insert({
    motorista_id: motoristaId,
    codigo_hash: codigoHash,
    expira_em: expiraEm,
    status: "pendente",
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[wa-vincular] falha ao gravar wa_vinculo", error);
    return json({ erro: "falha_gravar" }, 500);
  }

  // codigo em claro só existe aqui, na resposta — nunca persiste (só o
  // hash fica salvo, conforme o comentário da coluna codigo_hash).
  const waLink = `https://wa.me/${NUMERO_OFICIAL_WA}?text=${encodeURIComponent(`VINCULAR ${codigo}`)}`;
  return json({ wa_link: waLink, expira_em: expiraEm });
});
