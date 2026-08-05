// supabase/functions/fipe-caminhao/index.ts
//
// Proxy para a Tabela FIPE (via parallelum.com.br/fipe/api, espelho
// público e gratuito da FIPE oficial) para caminhões: marca -> modelo ->
// ano -> valor. Cache em Postgres (fipe_cache) por 30 dias — a FIPE
// atualiza a tabela mensalmente (mesReferencia na resposta), então não
// há necessidade de bater na API de novo com mais frequência que isso.
// Mesmo espírito do cache de route-cost (rota_distancia_cache), só que
// aqui os dados são ainda mais estáveis.
//
// Usado por Perfil.tsx para: autocomplete de marca (lista fixa, poucas
// dezenas), autocomplete de modelo filtrado pela marca, e a lista de
// anos disponíveis para aquele modelo (isso é o que de fato restringe
// as opções ao que existe no mercado — o catálogo estático da
// calculadora do Emerson não tem essa granularidade). O valor FIPE do
// ano escolhido vs. do ano anterior do mesmo modelo dá a base para
// calcular depreciação real em R$/km (ver lib/fipe.ts no app).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIPE_BASE = "https://parallelum.com.br/fipe/api/v1/caminhoes";
const CACHE_DIAS = 30;

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

type Acao = "marcas" | "modelos" | "anos" | "valor";
const ACOES_VALIDAS: Acao[] = ["marcas", "modelos", "anos", "valor"];

function montarUrl(acao: Acao, codigoMarca?: string, codigoModelo?: string, codigoAno?: string): string | null {
  switch (acao) {
    case "marcas":
      return `${FIPE_BASE}/marcas`;
    case "modelos":
      if (!codigoMarca) return null;
      return `${FIPE_BASE}/marcas/${encodeURIComponent(codigoMarca)}/modelos`;
    case "anos":
      if (!codigoMarca || !codigoModelo) return null;
      return `${FIPE_BASE}/marcas/${encodeURIComponent(codigoMarca)}/modelos/${encodeURIComponent(codigoModelo)}/anos`;
    case "valor":
      if (!codigoMarca || !codigoModelo || !codigoAno) return null;
      return `${FIPE_BASE}/marcas/${encodeURIComponent(codigoMarca)}/modelos/${encodeURIComponent(codigoModelo)}/anos/${encodeURIComponent(codigoAno)}`;
  }
}

function montarChave(acao: Acao, codigoMarca?: string, codigoModelo?: string, codigoAno?: string) {
  return [acao, codigoMarca ?? "", codigoModelo ?? "", codigoAno ?? ""].join(":");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "method_not_allowed" }, 405);

  let body: { acao?: string; codigoMarca?: string; codigoModelo?: string; codigoAno?: string };
  try {
    body = await req.json();
  } catch {
    return json({ erro: "body_invalido" }, 400);
  }

  const acao = body.acao as Acao | undefined;
  if (!acao || !ACOES_VALIDAS.includes(acao)) {
    return json({ erro: "acao_invalida" }, 400);
  }

  const url = montarUrl(acao, body.codigoMarca, body.codigoModelo, body.codigoAno);
  if (!url) {
    return json({ erro: "parametros_insuficientes" }, 400);
  }

  const chave = montarChave(acao, body.codigoMarca, body.codigoModelo, body.codigoAno);

  // 1. Cache primeiro — evita bater na FIPE de novo pela mesma consulta.
  const desdeIso = new Date(Date.now() - CACHE_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { data: cache } = await supabase
    .from("fipe_cache")
    .select("resposta")
    .eq("chave", chave)
    .gte("criado_em", desdeIso)
    .maybeSingle();

  if (cache) {
    return json({ dados: cache.resposta, fonte: "cache" });
  }

  // 2. Busca na FIPE (parallelum). Sem chave de API — é público.
  let resposta: Response;
  try {
    resposta = await fetch(url);
  } catch (err) {
    console.error("fipe_fetch_error", err);
    return json({ erro: "falha_conexao_fipe" }, 502);
  }

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    console.error("fipe_erro", resposta.status, detalhe);
    return json({ erro: "falha_fipe" }, 502);
  }

  let dados: unknown;
  try {
    dados = await resposta.json();
  } catch (err) {
    console.error("fipe_parse_error", err);
    return json({ erro: "resposta_fipe_invalida" }, 502);
  }

  // 3. Grava no cache (upsert por chave) — best-effort, não bloqueia a resposta se falhar.
  const { error: erroCache } = await supabase.from("fipe_cache").upsert(
    {
      chave,
      acao,
      codigo_marca: body.codigoMarca ?? null,
      codigo_modelo: body.codigoModelo ?? null,
      codigo_ano: body.codigoAno ?? null,
      resposta: dados,
    },
    { onConflict: "chave" },
  );
  if (erroCache) console.error("fipe_cache_upsert_error", erroCache);

  return json({ dados, fonte: "fipe" });
});
