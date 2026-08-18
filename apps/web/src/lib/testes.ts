// apps/web/src/lib/testes.ts
//
// PROVISÓRIO — suporte ao mural de testes internos (os sócios testando o
// MVP). Sem relação com o produto final. Remover este arquivo junto com
// components/TestesModal.tsx, o botão "Testes" na Garagem.tsx e a
// migration 20260818140000_testes_provisorio_schema.sql quando os testes
// acabarem.
//
// Fluxo em duas etapas, feito por pessoas diferentes em momentos
// diferentes: (1) alguém cadastra o que precisa ser testado (tela,
// funcionalidade, obs para o teste); (2) o testador escolhe um item
// pendente, executa e registra o resultado (resultado do teste,
// observação, aprovado). `aprovado` fica `null` até ser testado — depois
// vira `true`/`false`; reprovado não é erro do app, é um resultado válido
// (indica ponto a melhorar).

import { supabase } from './supabaseClient';

export interface TesteItem {
  id: string;
  tela: string;
  funcionalidade: string;
  obsParaTeste: string | null;
  nomeCadastro: string;
  resultadoTeste: string | null;
  observacaoTeste: string | null;
  /** null = ainda não testado. */
  aprovado: boolean | null;
  nomeTeste: string | null;
  testadoEm: string | null;
  createdAt: string;
}

export interface TesteParaCriar {
  tela: string;
  funcionalidade: string;
  obsParaTeste: string;
  nomeCadastro: string;
}

export interface ResultadoParaRegistrar {
  resultadoTeste: string;
  observacaoTeste: string;
  aprovado: boolean;
  nomeTeste: string;
}

function mapTeste(r: Record<string, unknown>): TesteItem {
  return {
    id: r.id as string,
    tela: r.tela as string,
    funcionalidade: r.funcionalidade as string,
    obsParaTeste: (r.obs_para_teste as string | null) ?? null,
    nomeCadastro: r.nome_cadastro as string,
    resultadoTeste: (r.resultado_teste as string | null) ?? null,
    observacaoTeste: (r.observacao_teste as string | null) ?? null,
    aprovado: (r.aprovado as boolean | null) ?? null,
    nomeTeste: (r.nome_teste as string | null) ?? null,
    testadoEm: (r.testado_em as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

const COLUNAS_TESTE =
  'id, tela, funcionalidade, obs_para_teste, nome_cadastro, resultado_teste, observacao_teste, aprovado, nome_teste, testado_em, created_at';

/** Pendentes primeiro (mais antigos primeiro — testar na ordem que entrou), já testados depois (mais recentes primeiro). */
export async function listarTestes(): Promise<TesteItem[]> {
  const { data, error } = await supabase
    .from('testes_provisorio')
    .select(COLUNAS_TESTE)
    .order('aprovado', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('listarTestes', error);
    return [];
  }
  return (data ?? []).map(mapTeste);
}

export async function criarTeste(item: TesteParaCriar): Promise<{ error: string | null }> {
  const { error } = await supabase.from('testes_provisorio').insert({
    tela: item.tela.trim(),
    funcionalidade: item.funcionalidade.trim(),
    obs_para_teste: item.obsParaTeste.trim() || null,
    nome_cadastro: item.nomeCadastro.trim(),
  });
  return { error: error?.message ?? null };
}

/** Registra o resultado de um teste executado — some da lista de pendentes, entra na de testados. */
export async function registrarResultadoTeste(
  id: string,
  resultado: ResultadoParaRegistrar,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('testes_provisorio')
    .update({
      resultado_teste: resultado.resultadoTeste.trim(),
      observacao_teste: resultado.observacaoTeste.trim() || null,
      aprovado: resultado.aprovado,
      nome_teste: resultado.nomeTeste.trim(),
      testado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  return { error: error?.message ?? null };
}

/** "Reabrir" um teste já feito — volta pra fila de pendentes, caso alguém queira testar de novo (ex.: depois de um fix). */
export async function reabrirTeste(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('testes_provisorio')
    .update({
      resultado_teste: null,
      observacao_teste: null,
      aprovado: null,
      nome_teste: null,
      testado_em: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  return { error: error?.message ?? null };
}
