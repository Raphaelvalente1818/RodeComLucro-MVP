// Decodifica as claims customizadas do access token (JWT).
//
// Por que não usar session.user.app_metadata: esse campo vem de
// auth.users.raw_app_meta_data, que o GoTrue reescreve a cada novo
// login por telefone (signInWithOtp/verifyOtp), apagando chaves
// customizadas como telefone_verificado que triggers no banco
// adicionaram anteriormente. As claims injetadas pelo
// custom_access_token_hook (ver supabase/migrations/0004_*), por
// outro lado, são recalculadas do zero a partir de public.motoristas
// a cada emissão de token — são a fonte confiável.
// Ref: Docs/PRD-tecnico-identidade.html

export interface ClaimsCustom {
  app_role?: string;
  driver_id?: string;
  telefone_verificado?: boolean;
  quarentena?: boolean;
}

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(padded);
}

export function decodeClaims(accessToken: string | undefined | null): ClaimsCustom {
  if (!accessToken) return {};
  const partes = accessToken.split('.');
  if (partes.length !== 3) return {};
  try {
    const payload = JSON.parse(base64UrlDecode(partes[1]));
    return payload as ClaimsCustom;
  } catch {
    return {};
  }
}
