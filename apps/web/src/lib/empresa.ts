// apps/web/src/lib/empresa.ts
//
// Camada de dados do portal da empresa (embarcador). Cadastro por
// e-mail+senha via Supabase Auth; a linha em `empresas` é criada pelo
// trigger handle_new_auth_user a partir dos metadados do signUp (ver
// 20260912140000_empresas_identidade.sql) — assim funciona com ou sem
// confirmação de e-mail ligada. Só publica frete depois que o admin
// aprova (status = 'aprovada').

import { supabase } from './supabaseClient';
import type { FreteValidado } from './validarFrete';

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

// ---------------------------------------------------------------------
// Fretes da empresa
// ---------------------------------------------------------------------

export interface FreteDaEmpresa {
  id: string;
  origemCidade: string;
  origemUf: string;
  destinoCidade: string;
  destinoUf: string;
  valorFreteCentavos: number | null;
  valorACombinar: boolean;
  tipoValor: string | null;
  dataColeta: string | null;
  status: string;
  motivoRejeicao: string | null;
  createdAt: string;
}

export async function carregarFretesDaEmpresa(empresaId: string): Promise<FreteDaEmpresa[]> {
  const { data, error } = await supabase
    .from('fretes_publicados')
    .select(
      'id, origem_cidade, origem_uf, destino_cidade, destino_uf, valor_frete_centavos, valor_a_combinar, tipo_valor, data_coleta, status, motivo_rejeicao, created_at',
    )
    .eq('company_id', empresaId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((f) => ({
    id: f.id,
    origemCidade: f.origem_cidade,
    origemUf: f.origem_uf,
    destinoCidade: f.destino_cidade,
    destinoUf: f.destino_uf,
    valorFreteCentavos: f.valor_frete_centavos,
    valorACombinar: Boolean(f.valor_a_combinar),
    tipoValor: f.tipo_valor,
    dataColeta: f.data_coleta,
    status: f.status,
    motivoRejeicao: f.motivo_rejeicao ?? null,
    createdAt: f.created_at,
  }));
}

// ---------------------------------------------------------------------
// Detalhe + status (05/10/2026 — Docs/mockup-fretes-empresa-status.html).
// A empresa pausa / republica / fecha o próprio frete pela RPC
// empresa_mudar_status_frete; cada mudança vira linha no histórico
// (trigger no banco). Frete nunca é apagado.
// ---------------------------------------------------------------------

/** Status que a empresa pode escolher. 'fechado' é reversível (decisão 05/10). */
export type StatusFreteEmpresa = 'aberto' | 'pausado' | 'fechado';

export interface FreteDaEmpresaDetalhe extends FreteDaEmpresa {
  distanciaKm: number | null;
  pedagioPorContaDe: string | null;
  pesoKg: number | null;
  tiposVeiculoAceitos: string[];
  tiposCarroceriaAceitos: string[];
  contatoNome: string | null;
  contatoTelefone: string | null;
  observacoes: string | null;
}

export interface HistoricoFrete {
  id: number;
  statusDe: string | null;
  statusPara: string;
  ator: 'empresa' | 'admin' | 'sistema';
  motivo: string | null;
  criadoEm: string;
}

export async function carregarFreteDaEmpresa(empresaId: string, freteId: string): Promise<FreteDaEmpresaDetalhe | null> {
  const { data, error } = await supabase
    .from('fretes_publicados')
    .select(
      'id, origem_cidade, origem_uf, destino_cidade, destino_uf, valor_frete_centavos, valor_a_combinar, tipo_valor, data_coleta, status, motivo_rejeicao, created_at, distancia_km, pedagio_por_conta_de, peso_kg, tipos_veiculo_aceitos, tipos_carroceria_aceitos, contato_nome, contato_telefone, observacoes',
    )
    .eq('company_id', empresaId)
    .eq('id', freteId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    origemCidade: data.origem_cidade,
    origemUf: data.origem_uf,
    destinoCidade: data.destino_cidade,
    destinoUf: data.destino_uf,
    valorFreteCentavos: data.valor_frete_centavos,
    valorACombinar: Boolean(data.valor_a_combinar),
    tipoValor: data.tipo_valor,
    dataColeta: data.data_coleta,
    status: data.status,
    motivoRejeicao: data.motivo_rejeicao ?? null,
    createdAt: data.created_at,
    distanciaKm: data.distancia_km == null ? null : Number(data.distancia_km),
    pedagioPorContaDe: data.pedagio_por_conta_de ?? null,
    pesoKg: data.peso_kg == null ? null : Number(data.peso_kg),
    tiposVeiculoAceitos: (data.tipos_veiculo_aceitos as string[] | null) ?? [],
    tiposCarroceriaAceitos: (data.tipos_carroceria_aceitos as string[] | null) ?? [],
    contatoNome: data.contato_nome ?? null,
    contatoTelefone: data.contato_telefone ?? null,
    observacoes: data.observacoes ?? null,
  };
}

export async function carregarHistoricoFrete(freteId: string): Promise<HistoricoFrete[]> {
  const { data, error } = await supabase
    .from('fretes_publicados_historico')
    .select('id, status_de, status_para, ator, motivo, criado_em')
    .eq('frete_id', freteId)
    .order('criado_em', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((h) => ({
    id: h.id as number,
    statusDe: (h.status_de as string | null) ?? null,
    statusPara: h.status_para as string,
    ator: h.ator as HistoricoFrete['ator'],
    motivo: (h.motivo as string | null) ?? null,
    criadoEm: h.criado_em as string,
  }));
}

/** Pausar / publicar de novo / fechar. O banco valida dono e transição. */
export async function mudarStatusFrete(freteId: string, status: StatusFreteEmpresa, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('empresa_mudar_status_frete', {
    p_frete_id: freteId,
    p_status: status,
    p_motivo: motivo.trim() || null,
  });
  if (error) throw error;
}

/** Ações que a empresa pode tomar a partir de cada status (ordem = ordem dos botões). */
export function acoesDoStatus(status: string): { rotulo: string; para: StatusFreteEmpresa; destaque: boolean }[] {
  if (status === 'aberto') return [{ rotulo: 'Pausar', para: 'pausado', destaque: false }, { rotulo: 'Fechar', para: 'fechado', destaque: false }];
  if (status === 'pausado') return [{ rotulo: 'Publicar de novo', para: 'aberto', destaque: true }, { rotulo: 'Fechar', para: 'fechado', destaque: false }];
  if (status === 'fechado') return [{ rotulo: 'Publicar de novo', para: 'aberto', destaque: true }];
  return [];
}

/**
 * Publica um frete em nome da empresa. `dado` já validado por
 * lib/validarFrete.ts. Entra SEMPRE como pendente_aprovacao / fonte
 * EMPRESA / company_id da empresa — a policy fretes_publicados_insert_empresa
 * rejeita qualquer outra combinação (e exige empresa aprovada).
 */
export async function publicarFrete(empresa: Empresa, dado: FreteValidado): Promise<void> {
  const { error } = await supabase.from('fretes_publicados').insert({
    ...dado,
    empresa_nome: empresa.nomeFantasia || empresa.razaoSocial,
    company_id: empresa.id,
    status: 'pendente_aprovacao',
    fonte: 'EMPRESA',
  });
  if (error) throw error;
}

/**
 * Edita os dados que a empresa pode mudar sozinha. CNPJ e razão social
 * ficam de fora de propósito: são a identidade que o admin aprovou —
 * mudar exigiria nova aprovação. Status/motivo são bloqueados no banco
 * pelo trigger empresas_protege_status.
 */
export async function atualizarMinhaEmpresa(
  empresaId: string,
  dados: { nomeFantasia: string; telefone: string; email: string },
): Promise<void> {
  const { error } = await supabase
    .from('empresas')
    .update({
      nome_fantasia: dados.nomeFantasia.trim() || null,
      telefone: somenteDigitos(dados.telefone) || null,
      email: dados.email.trim(),
    })
    .eq('id', empresaId);
  if (error) throw error;
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
