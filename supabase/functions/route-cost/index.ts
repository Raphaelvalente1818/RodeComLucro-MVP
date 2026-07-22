// supabase/functions/route-cost/index.ts
//
// Resolve a distância de uma rota (origem/destino) via Google Routes
// API, com cache em Postgres para não pagar de novo pela mesma rota.
// Pedágio continua manual — nenhuma API de pedágio foi escolhida ainda
// (ver Docs/sequencia-construcao.md, Fase 1). Esta função só resolve o
// campo `distanciaKm` do contrato FreteInput de @rode/calc; o app
// preenche `distanciaEstimada: true` no cliente quando cair no
// fallback manual (sem chave configurada ou erro da API).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_ROUTES_API_KEY = Deno.env.get("GOOGLE_ROUTES_API_KEY");

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

function normalizar(endereco: string) {
  return endereco.trim().toLowerCase().replace(/\s+/g, " ");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "method_not_allowed" }, 405);

  let body: { origem?: string; destino?: string };
  try {
    body = await req.json();
  } catch {
    return json({ erro: "body_invalido" }, 400);
  }

  const origem = (body.origem ?? "").trim();
  const destino = (body.destino ?? "").trim();
  if (!origem || !destino) {
    return json({ erro: "origem_destino_obrigatorios" }, 400);
  }

  const origemNorm = normalizar(origem);
  const destinoNorm = normalizar(destino);

  // 1. Cache primeiro — evita cobrar de novo pela mesma rota.
  const { data: cache } = await supabase
    .from("rota_distancia_cache")
    .select("distancia_km, duracao_min")
    .eq("origem_norm", origemNorm)
    .eq("destino_norm", destinoNorm)
    .maybeSingle();

  if (cache) {
    return json({
      distanciaKm: Number(cache.distancia_km),
      duracaoMin: cache.duracao_min,
      distanciaEstimada: false,
      fonte: "cache",
    });
  }

  // 2. Sem chave configurada ainda: não quebra o app — só avisa que a
  // distância precisa ser estimada manualmente pelo motorista. O
  // cliente trata 503 como "abrir campo de km manual".
  if (!GOOGLE_ROUTES_API_KEY) {
    return json({ motivo: "sem_chave_google" }, 503);
  }

  // 3. Chama a Google Routes API (computeRoutes).
  let resposta: Response;
  try {
    resposta = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_ROUTES_API_KEY,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: { address: origem },
        destination: { address: destino },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        units: "METRIC",
      }),
    });
  } catch (err) {
    console.error("route_cost_fetch_error", err);
    return json({ erro: "falha_conexao_google" }, 502);
  }

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    console.error("route_cost_google_error", resposta.status, detalhe);
    return json({ erro: "falha_google_routes" }, 502);
  }

  const dados = await resposta.json();
  const rota = dados.routes?.[0];
  if (!rota?.distanceMeters) {
    return json({ erro: "rota_nao_encontrada" }, 404);
  }

  const distanciaKm = Math.round((rota.distanceMeters / 1000) * 10) / 10;
  const duracaoSegundos = Number(String(rota.duration ?? "0s").replace("s", ""));
  const duracaoMin = Math.round(duracaoSegundos / 60);

  // 4. Grava no cache para as próximas consultas da mesma rota.
  await supabase.from("rota_distancia_cache").upsert(
    {
      origem_norm: origemNorm,
      destino_norm: destinoNorm,
      distancia_km: distanciaKm,
      duracao_min: duracaoMin,
    },
    { onConflict: "origem_norm,destino_norm" },
  );

  return json({ distanciaKm, duracaoMin, distanciaEstimada: false, fonte: "google_routes" });
});
