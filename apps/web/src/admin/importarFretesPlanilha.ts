// apps/web/src/admin/importarFretesPlanilha.ts
//
// Parser da planilha Excel de importação de fretes
// (apps/web/public/templates/planilha-fretes-modelo.xlsx é o modelo que
// o admin baixa e distribui pras empresas / preenche ele mesmo). Roda
// 100% no navegador — nada é enviado a lugar nenhum até o admin clicar
// em "Importar" na prévia.
//
// A validação de cada linha NÃO mora aqui — está em lib/validarFrete.ts,
// módulo neutro compartilhado com o futuro formulário de empresa. Este
// arquivo só cuida do que é específico de planilha: ler o .xlsx, numerar
// linhas, detectar duplicata (que precisa do arquivo inteiro + banco) e
// fixar status/fonte do caminho admin ('aberto'/'MANUAL' — admin é agente
// interno confiável, não passa pela fila de moderação).
//
// Nota de segurança: a lib `xlsx` (SheetJS) tem duas CVEs conhecidas sem
// correção publicada no npm (prototype pollution + ReDoS,
// GHSA-4r6h-8v6p-xvw6 / GHSA-5pgg-2g8v-p4x9) — a build corrigida só é
// distribuída pelo CDN próprio do SheetJS, bloqueado nesta rede. Mitigado
// por escopo: parsing roda só no navegador do admin (não em servidor
// exposto), o resultado nunca é injetado em HTML nem usado como objeto
// dinâmico — cada campo é lido, validado e convertido pra um tipo
// primitivo explícito antes de qualquer uso. Reavaliar (trocar de lib ou
// liberar o CDN do SheetJS) se esse fluxo crescer além de uso interno.

import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';
import { validarFrete, chaveDuplicataFrete, type FreteValidado } from '../lib/validarFrete';

const MAX_LINHAS = 2000;

export interface FreteParaInserir extends FreteValidado {
  status: 'aberto';
  fonte: 'MANUAL';
}

export interface LinhaImportada {
  linha: number;
  valido: boolean;
  erros: string[];
  dado: FreteParaInserir | null;
  // Campos brutos só pra exibir na prévia (não usados na gravação).
  resumo: { origem: string; destino: string; empresa: string };
  /** true se já existe um frete "aberto" idêntico (no banco ou repetido na própria planilha). */
  duplicata: boolean;
}

function validarLinha(raw: Record<string, unknown>, linha: number): LinhaImportada {
  const r = validarFrete(raw);
  return {
    linha,
    valido: r.valido,
    erros: r.erros,
    resumo: r.resumo,
    duplicata: false, // preenchido depois, em marcarDuplicatas() — precisa do arquivo inteiro pra comparar
    dado: r.dado ? { ...r.dado, status: 'aberto', fonte: 'MANUAL' } : null,
  };
}

/**
 * Marca duplicata em dois níveis: (1) contra fretes "aberto" já no banco
 * pra mesma empresa (ver chaveDuplicataFrete) — evita reimportar a mesma
 * planilha duas vezes sem querer, que foi o caso real que motivou isso;
 * (2) contra outra linha igual dentro da própria planilha (a partir da
 * 2ª ocorrência). Só marca — quem decide se importa mesmo assim é o
 * admin, na tela.
 */
async function marcarDuplicatas(linhas: LinhaImportada[]): Promise<LinhaImportada[]> {
  const validas = linhas.filter((l) => l.valido && l.dado);
  if (validas.length === 0) return linhas;

  const empresas = Array.from(new Set(validas.map((l) => l.dado!.empresa_nome)));
  const { data: existentes, error } = await supabase
    .from('fretes_publicados')
    .select('empresa_nome, origem_cidade, origem_uf, destino_cidade, destino_uf, valor_frete_centavos, data_coleta')
    .eq('status', 'aberto')
    .in('empresa_nome', empresas);

  if (error) {
    // Falha ao checar duplicata não deve travar a prévia — só fica sem o aviso.
    // eslint-disable-next-line no-console
    console.error('[admin] falha ao checar duplicatas', error);
  }

  const chavesNoBanco = new Set(
    (existentes ?? []).map((r) => chaveDuplicataFrete(r as unknown as FreteValidado)),
  );
  const vistasNaPlanilha = new Set<string>();

  return linhas.map((l) => {
    if (!l.valido || !l.dado) return l;
    const chave = chaveDuplicataFrete(l.dado);
    const duplicata = chavesNoBanco.has(chave) || vistasNaPlanilha.has(chave);
    vistasNaPlanilha.add(chave);
    return { ...l, duplicata };
  });
}

export async function parseArquivoFretes(file: File): Promise<LinhaImportada[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const nomeAba = wb.SheetNames.includes('Fretes') ? 'Fretes' : wb.SheetNames[0];
  const ws = wb.Sheets[nomeAba];
  if (!ws) throw new Error('Planilha sem nenhuma aba legível.');

  const linhasBrutas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  if (linhasBrutas.length > MAX_LINHAS) {
    throw new Error(`Planilha com mais de ${MAX_LINHAS} linhas — divida em arquivos menores.`);
  }

  const linhas = linhasBrutas.map((raw, i) => validarLinha(raw, i + 2)); // +2: linha 1 é cabeçalho
  return marcarDuplicatas(linhas);
}

/** Insere em lotes de 200 pra não estourar o tamanho de uma única requisição. */
export async function inserirFretes(dados: FreteParaInserir[]): Promise<number> {
  const TAMANHO_LOTE = 200;
  let inseridos = 0;
  for (let i = 0; i < dados.length; i += TAMANHO_LOTE) {
    const lote = dados.slice(i, i + TAMANHO_LOTE);
    const { error } = await supabase.from('fretes_publicados').insert(lote);
    if (error) throw error;
    inseridos += lote.length;
  }
  return inseridos;
}
