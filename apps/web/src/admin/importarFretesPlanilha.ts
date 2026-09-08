// apps/web/src/admin/importarFretesPlanilha.ts
//
// Parser + validação da planilha Excel de importação de fretes
// (apps/web/public/templates/planilha-fretes-modelo.xlsx é o modelo que
// o admin baixa e distribui pras empresas / preenche ele mesmo). Roda
// 100% no navegador — nada é enviado a lugar nenhum até o admin clicar
// em "Importar" na prévia.
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
import { VEICULOS, CARROCERIAS } from '@rode/calc';

const UFS_VALIDAS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

const VEICULOS_VALIDOS = new Set<string>(VEICULOS.flatMap((g) => g.opcoes));
const CARROCERIAS_VALIDAS = new Set<string>(CARROCERIAS.flatMap((g) => g.opcoes));
const TIPO_VALOR_VALIDOS = new Set(['fixo', 'por_tonelada']);
const PEDAGIO_VALIDOS = new Set(['empresa', 'motorista']);
const MAX_LINHAS = 2000;

export interface FreteParaInserir {
  empresa_nome: string;
  contato_nome: string | null;
  contato_telefone: string | null;
  origem_cidade: string;
  origem_uf: string;
  destino_cidade: string;
  destino_uf: string;
  valor_frete_centavos: number | null;
  valor_a_combinar: boolean;
  tipo_valor: string | null;
  peso_kg: number | null;
  distancia_km: number | null;
  data_coleta: string | null;
  pedagio_por_conta_de: string | null;
  tipos_veiculo_aceitos: string[];
  tipos_carroceria_aceitos: string[];
  observacoes: string | null;
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

/** Chave de "mesmo frete" — empresa+rota+valor+data. Usada só pra detectar duplicata, não gravada. */
function chaveDuplicata(d: FreteParaInserir): string {
  return [
    d.empresa_nome.trim().toLowerCase(),
    d.origem_cidade.trim().toLowerCase(),
    d.origem_uf,
    d.destino_cidade.trim().toLowerCase(),
    d.destino_uf,
    d.valor_frete_centavos ?? 'combinar',
    d.data_coleta ?? 'sem_data',
  ].join('|');
}

function textoOuNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function numeroOuNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** dd/mm/aaaa (texto) ou serial de data do Excel -> "aaaa-mm-dd". null se vazio/inválido. */
function dataOuNull(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    // Serial de data do Excel (epoch 1899-12-30).
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, aaaa] = m;
  return `${aaaa}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

// tipos_veiculo_aceitos/tipos_carroceria_aceitos são NOT NULL na tabela
// (default '{}'::text[], "vazio" = aceita qualquer tipo) — por isso
// devolve [] em vez de null quando a célula está em branco.
function listaOuVazia(v: unknown, validos: Set<string>, erros: string[], campo: string): string[] {
  const s = textoOuNull(v);
  if (!s) return [];
  const itens = s.split(',').map((x) => x.trim()).filter(Boolean);
  const invalidos = itens.filter((x) => !validos.has(x));
  if (invalidos.length) {
    erros.push(`${campo}: valor(es) desconhecido(s) — ${invalidos.join(', ')}`);
    return [];
  }
  return itens;
}

function validarLinha(raw: Record<string, unknown>, linha: number): LinhaImportada {
  const erros: string[] = [];

  const empresaNome = textoOuNull(raw.empresa_nome);
  const origemCidade = textoOuNull(raw.origem_cidade);
  const origemUf = textoOuNull(raw.origem_uf)?.toUpperCase() ?? null;
  const destinoCidade = textoOuNull(raw.destino_cidade);
  const destinoUf = textoOuNull(raw.destino_uf)?.toUpperCase() ?? null;

  if (!empresaNome) erros.push('empresa_nome obrigatório');
  if (!origemCidade) erros.push('origem_cidade obrigatório');
  if (!destinoCidade) erros.push('destino_cidade obrigatório');
  if (!origemUf) erros.push('origem_uf obrigatório');
  else if (!UFS_VALIDAS.has(origemUf)) erros.push(`origem_uf inválida: ${origemUf}`);
  if (!destinoUf) erros.push('destino_uf obrigatório');
  else if (!UFS_VALIDAS.has(destinoUf)) erros.push(`destino_uf inválida: ${destinoUf}`);

  const valorReais = numeroOuNull(raw.valor_frete_reais);
  let tipoValor = textoOuNull(raw.tipo_valor);
  if (valorReais != null) {
    if (valorReais <= 0) erros.push('valor_frete_reais precisa ser maior que zero');
    if (!tipoValor) {
      erros.push('tipo_valor obrigatório quando valor_frete_reais está preenchido');
    } else if (!TIPO_VALOR_VALIDOS.has(tipoValor)) {
      erros.push(`tipo_valor inválido: ${tipoValor} (use fixo ou por_tonelada)`);
    }
  } else {
    tipoValor = null;
  }

  const pesoKg = numeroOuNull(raw.peso_kg);
  const distanciaKm = numeroOuNull(raw.distancia_km);
  const dataColetaPreenchida = raw.data_coleta != null && raw.data_coleta !== '';
  const dataColeta = dataOuNull(raw.data_coleta);
  if (dataColetaPreenchida && dataColeta == null) {
    erros.push(`data_coleta inválida: ${raw.data_coleta} (use dd/mm/aaaa)`);
  }

  const pedagio = textoOuNull(raw.pedagio_por_conta_de);
  if (pedagio && !PEDAGIO_VALIDOS.has(pedagio)) {
    erros.push(`pedagio_por_conta_de inválido: ${pedagio} (use empresa ou motorista)`);
  }

  const tiposVeiculo = listaOuVazia(raw.tipos_veiculo_aceitos, VEICULOS_VALIDOS, erros, 'tipos_veiculo_aceitos');
  const tiposCarroceria = listaOuVazia(raw.tipos_carroceria_aceitos, CARROCERIAS_VALIDAS, erros, 'tipos_carroceria_aceitos');

  const resumo = {
    origem: origemCidade && origemUf ? `${origemCidade}/${origemUf}` : origemCidade ?? '—',
    destino: destinoCidade && destinoUf ? `${destinoCidade}/${destinoUf}` : destinoCidade ?? '—',
    empresa: empresaNome ?? '—',
  };

  if (erros.length || !empresaNome || !origemCidade || !origemUf || !destinoCidade || !destinoUf) {
    return { linha, valido: false, erros, dado: null, resumo, duplicata: false };
  }

  return {
    linha,
    valido: true,
    erros: [],
    resumo,
    duplicata: false, // preenchido depois, em marcarDuplicatas() — precisa do arquivo inteiro pra comparar
    dado: {
      empresa_nome: empresaNome,
      contato_nome: textoOuNull(raw.contato_nome),
      contato_telefone: textoOuNull(raw.contato_telefone),
      origem_cidade: origemCidade,
      origem_uf: origemUf,
      destino_cidade: destinoCidade,
      destino_uf: destinoUf,
      valor_frete_centavos: valorReais != null ? Math.round(valorReais * 100) : null,
      valor_a_combinar: valorReais == null,
      tipo_valor: tipoValor,
      peso_kg: pesoKg,
      distancia_km: distanciaKm,
      data_coleta: dataColeta,
      pedagio_por_conta_de: pedagio,
      tipos_veiculo_aceitos: tiposVeiculo,
      tipos_carroceria_aceitos: tiposCarroceria,
      observacoes: textoOuNull(raw.observacoes),
      status: 'aberto',
      fonte: 'MANUAL',
    },
  };
}

/**
 * Marca duplicata em dois níveis: (1) contra fretes "aberto" já no banco
 * pra mesma empresa (ver chaveDuplicata) — evita reimportar a mesma
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

  const chavesNoBanco = new Set((existentes ?? []).map((r) => chaveDuplicata(r as unknown as FreteParaInserir)));
  const vistasNaPlanilha = new Set<string>();

  return linhas.map((l) => {
    if (!l.valido || !l.dado) return l;
    const chave = chaveDuplicata(l.dado);
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
