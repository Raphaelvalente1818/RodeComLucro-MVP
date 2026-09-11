// Edge Function: otp-solicitar
// Fonte: Docs/PRD-tecnico-identidade.html seções 5 (Contratos de API) e 7
// (Lógica de negócio — Anti-abuso de envio).
//
// Única porta de disparo de OTP: o PWA nunca chama signInWithOtp direto.
// Pipeline: valida telefone -> kill-switch -> bloqueio existente (telefone/
// ip/global) -> janelas deslizantes (grava bloqueio se estourar) -> teto
// global diário de SMS -> aciona o envio -> grava otp_envio.
//
// Decisão (Raphael/David, 2026-07-31): canal='whatsapp' usa o WhatsApp do
// próprio Twilio (channel:'whatsapp' nativo do Supabase quando o SMS
// provider é Twilio/Twilio Verify) — não a Cloud API direta da Meta. Não há
// Send SMS Hook customizado nesta versão; os dois canais passam por
// signInWithOtp normalmente, só variando o parâmetro channel.
//
// Isso NÃO elimina a necessidade de verificação de negócio na Meta: mesmo
// via Twilio, o WhatsApp exige uma WABA vinculada à empresa (Overflash) e
// Business Verification aprovada antes de produção — Twilio só poupa
// construir a integração direta com a Cloud API (tokens, webhook, HMAC).
// As tarefas de cadastro/verificação da Overflash na Meta continuam de pé;
// o que muda é só a camada técnica de envio.
//
// Escopo explícito (Raphael/David, 2026-07-31): esse Twilio-via-Supabase é
// só para o OTP de login. O calc-wpp (copiloto de cálculo dentro do
// WhatsApp) e os demais módulos -wpp seguem usando a Cloud API da Meta
// direto (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID da Overflash,
// wa-webhook próprio) — são duas integrações de WhatsApp distintas e
// paralelas neste projeto, não uma substituindo a outra.
//
// Pendência: não testado (sem shell disponível na sessão em que foi
// escrita). Rodar com `supabase functions serve` + casos do plano de teste
// (seção 12 do PRD) antes de expor a qualquer tela real.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const TELEFONE_PEPPER = Deno.env.get('TELEFONE_PEPPER') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const TELEFONE_E164_BR = /^55[1-9][0-9]{9,10}$/;

async function telefoneHash(telefone: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(TELEFONE_PEPPER),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(telefone));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') ?? '0.0.0.0';
}

async function getConfig(admin: ReturnType<typeof createClient>, chave: string, fallback: string) {
  const { data } = await admin.from('identidade_config').select('valor').eq('chave', chave).maybeSingle();
  return data?.valor ?? fallback;
}

// Nível 1 = 15min, nível 2 = 1h, nível 3 = 24h.
const NIVEL_DURACAO_MS = { 1: 15 * 60 * 1000, 2: 60 * 60 * 1000, 3: 24 * 60 * 60 * 1000 };

async function registrarBloqueio(
  admin: ReturnType<typeof createClient>,
  escopo: 'telefone' | 'ip' | 'global',
  chave: string,
  motivo: string,
) {
  const { data: existente } = await admin
    .from('otp_bloqueio')
    .select('nivel')
    .eq('escopo', escopo)
    .eq('chave', chave)
    .maybeSingle();

  const nivelAtual = (existente?.nivel ?? 0) as 0 | 1 | 2 | 3;
  const proximoNivel = (Math.min(nivelAtual + 1, 3) || 1) as 1 | 2 | 3;
  const bloqueadoAte = new Date(Date.now() + NIVEL_DURACAO_MS[proximoNivel]).toISOString();

  await admin.from('otp_bloqueio').upsert(
    { escopo, chave, nivel: proximoNivel, bloqueado_ate: bloqueadoAte, motivo },
    { onConflict: 'escopo,chave' },
  );

  return bloqueadoAte;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ erro: 'method_not_allowed' }, 405);

  let body: { telefone_e164?: string; canal?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ erro: 'json_invalido' }, 400);
  }

  const telefoneBruto = (body.telefone_e164 ?? '').replace(/\D/g, '');
  const canal = body.canal === 'whatsapp' ? 'whatsapp' : 'sms';

  if (!TELEFONE_E164_BR.test(telefoneBruto)) {
    return jsonResponse({ erro: 'telefone_invalido' }, 400);
  }
  const telefone = telefoneBruto;
  const hash = await telefoneHash(telefone);
  const ip = getClientIp(req);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Kill-switch.
  const canalAtivo = await getConfig(admin, 'otp_canal_ativo', 'true');
  if (canalAtivo !== 'true') {
    return jsonResponse({ erro: 'kill_switch' }, 503);
  }

  // 2. Bloqueio já ativo (telefone / ip / global)?
  const agora = new Date().toISOString();
  const { data: bloqueiosAtivos } = await admin
    .from('otp_bloqueio')
    .select('escopo, chave, bloqueado_ate, motivo')
    .in('escopo', ['telefone', 'ip', 'global'])
    .in('chave', [hash, ip, 'global'])
    .gt('bloqueado_ate', agora);

  const bloqueioVigente = bloqueiosAtivos?.find(
    (b) => (b.escopo === 'telefone' && b.chave === hash) || (b.escopo === 'ip' && b.chave === ip) || b.escopo === 'global',
  );
  if (bloqueioVigente) {
    return jsonResponse({ bloqueado_ate: bloqueioVigente.bloqueado_ate, motivo: bloqueioVigente.motivo }, 429);
  }

  // 3. Janelas deslizantes.
  const desde15min = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const desde24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const desde1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const limiteTelefone15min = Number(await getConfig(admin, 'limite_telefone_15min', '3'));
  const limiteTelefone24h = Number(await getConfig(admin, 'limite_telefone_24h', '5'));
  const limiteIpHora = Number(await getConfig(admin, 'limite_ip_hora', '10'));
  const limiteIp24h = Number(await getConfig(admin, 'limite_ip_24h', '20'));

  const [tel15, tel24, ip1h, ip24] = await Promise.all([
    admin.from('otp_envio').select('id', { count: 'exact', head: true }).eq('telefone_hash', hash).gte('created_at', desde15min),
    admin.from('otp_envio').select('id', { count: 'exact', head: true }).eq('telefone_hash', hash).gte('created_at', desde24h),
    admin.from('otp_envio').select('id', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', desde1h),
    admin.from('otp_envio').select('id', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', desde24h),
  ]);

  let motivoBloqueio: string | null = null;
  let escopoBloqueio: 'telefone' | 'ip' | null = null;
  let chaveBloqueio: string | null = null;

  if ((tel15.count ?? 0) >= limiteTelefone15min || (tel24.count ?? 0) >= limiteTelefone24h) {
    motivoBloqueio = 'limite_telefone';
    escopoBloqueio = 'telefone';
    chaveBloqueio = hash;
  } else if ((ip1h.count ?? 0) >= limiteIpHora || (ip24.count ?? 0) >= limiteIp24h) {
    motivoBloqueio = 'limite_ip';
    escopoBloqueio = 'ip';
    chaveBloqueio = ip;
  }

  if (motivoBloqueio && escopoBloqueio && chaveBloqueio) {
    const bloqueadoAte = await registrarBloqueio(admin, escopoBloqueio, chaveBloqueio, motivoBloqueio);
    await admin.from('otp_envio').insert({
      telefone_hash: hash,
      ip,
      canal,
      status: 'bloqueado',
      motivo_bloqueio: motivoBloqueio,
      custo_estimado_centavos: 0,
    });
    await admin.from('identidade_audit').insert({
      evento: 'otp_bloqueado',
      telefone_hash: hash,
      ip,
      detalhe: { motivo: motivoBloqueio },
    });
    return jsonResponse({ bloqueado_ate: bloqueadoAte, motivo: motivoBloqueio }, 429);
  }

  // 4. Teto global diário — só se aplica ao canal SMS (WhatsApp segue até teto próprio, não implementado ainda).
  if (canal === 'sms') {
    const tetoSmsDia = Number(await getConfig(admin, 'teto_sms_dia', '500'));
    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);
    const { count: enviadosHoje } = await admin
      .from('otp_envio')
      .select('id', { count: 'exact', head: true })
      .eq('canal', 'sms')
      .eq('status', 'enviado')
      .gte('created_at', inicioDoDia.toISOString());

    if ((enviadosHoje ?? 0) >= tetoSmsDia) {
      await admin.from('otp_envio').insert({
        telefone_hash: hash,
        ip,
        canal,
        status: 'bloqueado',
        motivo_bloqueio: 'teto_global',
        custo_estimado_centavos: 0,
      });
      return jsonResponse({ erro: 'teto_global_atingido' }, 503);
    }
    // TODO: alertar admin quando enviadosHoje/tetoSmsDia >= 0.8 (painel admin ainda não existe).
  }

  // 5. Aciona o envio — SMS e WhatsApp passam pelo mesmo signInWithOtp,
  // o Supabase decide o transporte via `channel` (Twilio/Twilio Verify
  // como provider cobre os dois).
  const canalEfetivo = canal;
  let custoEstimadoCentavos = canal === 'whatsapp' ? 5 : 8; // estimativas placeholder — ajustar com o custo real do provider.
  let status: 'enviado' | 'falha' = 'enviado';
  const provider = 'twilio_verify';

  const authClient = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await authClient.auth.signInWithOtp({
    phone: `+${telefone}`,
    options: { channel: canal },
  });
  if (error) {
    status = 'falha';
    custoEstimadoCentavos = 0;
  }

  await admin.from('otp_envio').insert({
    telefone_hash: hash,
    ip,
    canal: canalEfetivo,
    provider,
    custo_estimado_centavos: custoEstimadoCentavos,
    status,
  });

  if (status === 'falha') {
    return jsonResponse({ erro: 'falha_envio', canal_efetivo: canalEfetivo }, 502);
  }

  return jsonResponse({ enviado: true, canal_efetivo: canalEfetivo, proximo_reenvio_s: 60 });
});
