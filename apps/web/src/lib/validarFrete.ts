// apps/web/src/lib/validarFrete.ts
//
// Validação estrutural de um frete a ser publicado em fretes_publicados —
// campos obrigatórios, UF, enums, listas de veículo/carroceria, formato
// de data. Módulo NEUTRO: não sabe de onde o dado veio (planilha Excel do
// admin hoje, formulário de empresa amanhã) nem pra onde vai (não toca
// no Supabase). Extraído de admin/importarFretesPlanilha.ts em 12/09
// como pré-requisito #3 do módulo de empresas — ver status-sessao.md,
// "PLANEJAMENTO — 11/09" — pra que a regra viva num lugar só e não
// divirja entre o import do admin e o self-service da empresa.
//
// Quem chama decide `status`/`fonte` (admin → 'aberto'/'MANUAL'; empresa
// → 'pendente_aprovacao'/fonte própria) — por isso o resultado aqui NÃO
// inclui esses dois campos.
//
// Validação de risco/confiança (preço vs. piso ANTT, empresa já rejeitada
// antes etc.) NÃO entra aqui — é uma camada separada, a ser construída
// como sinalizador quando houver dado real. Ver a mesma seção do
// status-sessao.md.

import { VEICULOS, CARROCERIAS } from '@rode/calc';

export const UFS_VALIDAS: ReadonlySet<string> = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

const VEICULOS_VALIDOS = new Set<string>(VEICULOS.flatMap((g) => g.opcoes));
const CARROCERIAS_VALIDAS = new Set<string>(CARROCERIAS.flatMap((g) => g.opcoes));
const TIPO_VALOR_VALIDOS = new Set(['fixo', 'por_tonelada']);
const PEDAGIO_VALIDOS = new Set(['empresa', 'motorista']);

/** Frete validado e normalizado, pronto pra INSERT — menos status/fonte, que são do chamador. */
export interface FreteValidado {
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
}

export interface ResultadoValidacaoFrete {
  valido: boolean;
  erros: string[];
  dado: FreteValidado | null;
  /** Campos brutos só pra exibir (prévia, mensagens de erro) — não usados na gravação. */
  resumo: { origem: string; destino: string; empresa: string };
}

/**
 * Chave de "mesmo frete" — empresa+rota+valor+data. Usada só pra detectar
 * duplicata, não gravada. Aceita qualquer objeto com esses campos (linha
 * do banco ou frete validado).
 */
export function chaveDuplicataFrete(d: {
  empresa_nome: string;
  origem_cidade: string;
  origem_uf: string;
  destino_cidade: string;
  destino_uf: string;
  valor_frete_centavos: number | null;
  data_coleta: string | null;
}): string {
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

export function textoOuNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export function numeroOuNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Aceita "aaaa-mm-dd" (input type=date), "dd/mm/aaaa" (texto de planilha)
 * ou serial de data do Excel -> "aaaa-mm-dd". null se vazio/inválido.
 */
export function dataOuNull(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    // Serial de data do Excel (epoch 1899-12-30).
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, aaaa] = m;
  return `${aaaa}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

// tipos_veiculo_aceitos/tipos_carroceria_aceitos são NOT NULL na tabela
// (default '{}'::text[], "vazio" = aceita qualquer tipo) — por isso
// devolve [] em vez de null quando vem em branco. Aceita string
// separada por vírgula (planilha) ou array (formulário).
function listaOuVazia(v: unknown, validos: Set<string>, erros: string[], campo: string): string[] {
  let itens: string[];
  if (Array.isArray(v)) {
    itens = v.map((x) => String(x).trim()).filter(Boolean);
  } else {
    const s = textoOuNull(v);
    if (!s) return [];
    itens = s.split(',').map((x) => x.trim()).filter(Boolean);
  }
  const invalidos = itens.filter((x) => !validos.has(x));
  if (invalidos.length) {
    erros.push(`${campo}: valor(es) desconhecido(s) — ${invalidos.join(', ')}`);
    return [];
  }
  return itens;
}

/**
 * Valida e normaliza um frete a partir de um objeto genérico com as chaves
 * do template (empresa_nome, origem_cidade, origem_uf, destino_cidade,
 * destino_uf, valor_frete_reais, tipo_valor, peso_kg, distancia_km,
 * data_coleta, pedagio_por_conta_de, tipos_veiculo_aceitos,
 * tipos_carroceria_aceitos, contato_nome, contato_telefone, observacoes).
 */
export function validarFrete(raw: Record<string, unknown>): ResultadoValidacaoFrete {
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
    return { valido: false, erros, dado: null, resumo };
  }

  return {
    valido: true,
    erros: [],
    resumo,
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
    },
  };
}
