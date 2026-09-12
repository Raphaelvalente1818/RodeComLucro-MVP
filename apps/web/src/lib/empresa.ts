// apps/web/src/lib/empresa.ts
//
// Camada de dados do portal da empresa (embarcador). Cadastro por
// e-mail+senha via Supabase Auth; a linha em `empresas` é criada pelo
// trigger handle_new_auth_user a partir dos metadados do signUp (ver
// 20260912140000_empresas_identidade.sql) — assim funciona com ou sem
// confirmação de e-mail ligada. Só publica frete depois que o admin
// aprova (status = 'aprovada').

import { supabase } from './supabaseClient';

export type StatusEmpresa = 'pendente' | 'aprovada' | 'rejeitada' | 'suspensa';

export interface Empresa {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  telefone: string | null;
  email: string;
  status: StatusEmpresa;
  motivoRejeicao: string | null;
  createdAt: string;
}

export function somenteDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

export function formatarCnpj(v: string): string {
  const d = somenteDigitos(v).slice(0, 14);
  let s = d;
  if (d.length > 2) s = `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length > 5) s = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length > 8) s = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  if (d.length > 12) s = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return s;
}

/** Mesma regra do cnpj_valido() no banco — dígitos verificadores. */
export function cnpjValido(v: string): boolean {
  const d = somenteDigitos(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const n = d.split('').map(Number);
  const calc = (pesos: number[]) => {
    const soma = pesos.reduce((acc, p, i) => acc + n[i] * p, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const dv1 = calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (n[12] !== dv1) return false;
  const dv2 = calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return n[13] === dv2;
}

export async function cnpjDisponivel(cnpj: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('cnpj_disponivel', { p_cnpj: somenteDigitos(cnpj) });
  if (error) throw error;
  return Boolean(data);
}

export interface DadosCadastroEmpresa {
  email: string;
  senha: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  telefone: string;
}

/**
 * Cria o usuário no Auth com metadados; o trigger no banco cria a
 * empresa. Retorna se já há sessão (confirmação de e-mail desligada) ou
 * se o usuário precisa confirmar o e-mail antes de entrar.
 */
export async function cadastrarEmpresa(d: DadosCadastroEmpresa): Promise<{ precisaConfirmarEmail: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: d.email.trim(),
    password: d.senha,
    options: {
      data: {
        tipo: 'empresa',
        cnpj: somenteDigitos(d.cnpj),
        razao_social: d.razaoSocial.trim(),
        nome_fantasia: d.nomeFantasia.trim(),
        telefone: somenteDigitos(d.telefone),
      },
    },
  });
  if (error) throw error;
  return { precisaConfirmarEmail: !data.session };
}

export async function entrarEmpresa(email: string, senha: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error) throw error;
}

export async function sairEmpresa(): Promise<void> {
  await supabase.auth.signOut();
}

/** Empresa do usuário logado, ou null se a conta não é de empresa. */
export async function carregarMinhaEmpresa(): Promise<Empresa | null> {
  const { data: sessao } = await supabase.auth.getSession();
  const uid = sessao.session?.user.id;
  if (!uid) return null;
  // Filtro explícito por user_id: admin enxerga todas as empresas via RLS,
  // e sem o filtro o maybeSingle() estouraria com mais de uma linha.
  const { data, error } = await supabase
    .from('empresas')
    .select('id, cnpj, razao_social, nome_fantasia, telefone, email, status, motivo_rejeicao, created_at')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    cnpj: data.cnpj,
    razaoSocial: data.razao_social,
    nomeFantasia: data.nome_fantasia,
    telefone: data.telefone,
    email: data.email,
    status: data.status as StatusEmpresa,
    motivoRejeicao: data.motivo_rejeicao,
    createdAt: data.created_at,
  };
}
