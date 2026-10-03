// Piso ANTT vigente vindo do banco (02/10/2026, "opção 3" — decisão do
// Raphael). O motor @rode/calc continua puro: a gente só troca a tabela que
// ele usa, via definirTabelaANTT(). Ordem no boot:
//   1. aplica o cache local (localStorage) na hora — serve offline e evita
//      calcular com a tabela embutida enquanto a rede responde;
//   2. busca a vigente na RPC antt_piso_vigente e, se mudou, aplica e
//      regrava o cache.
// Sem cache e sem rede: fica a tabela embutida no pacote (fallback), que é
// a última conhecida quando o código foi publicado.
import { definirTabelaANTT, montarTabelaANTT, tabelaANTTAtual, type LinhaTabelaANTT } from '@rode/calc';
import { supabase } from './supabaseClient';

const CHAVE_CACHE = 'antt-tabela-vigente-v1';

function lerCache(): LinhaTabelaANTT[] | null {
  try {
    const bruto = localStorage.getItem(CHAVE_CACHE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as { linhas?: LinhaTabelaANTT[] };
    return Array.isArray(dados.linhas) ? dados.linhas : null;
  } catch {
    return null;
  }
}

function gravarCache(linhas: LinhaTabelaANTT[]): void {
  try {
    localStorage.setItem(CHAVE_CACHE, JSON.stringify({ linhas, salvoEm: new Date().toISOString() }));
  } catch {
    // sem espaço / modo privado: segue sem cache.
  }
}

function aplicar(linhas: LinhaTabelaANTT[]): boolean {
  const t = montarTabelaANTT(linhas);
  if (!t) return false;
  definirTabelaANTT(t);
  return true;
}

/** Chamar uma vez no boot (main.tsx). Nunca lança; nunca bloqueia a UI. */
export async function carregarTabelaANTT(): Promise<void> {
  const cache = lerCache();
  if (cache) aplicar(cache);
  try {
    const { data, error } = await supabase.rpc('antt_piso_vigente');
    if (error || !Array.isArray(data) || data.length === 0) return;
    const linhas = data as LinhaTabelaANTT[];
    if (aplicar(linhas)) gravarCache(linhas);
  } catch {
    // offline: fica no cache ou na embutida.
  }
}

/** Versão em uso agora (pra mostrar na tela Resultado / admin). */
export function versaoANTTAtual(): { versao: string; fonte: string; vigenciaInicio: string } {
  const t = tabelaANTTAtual();
  return { versao: t.versao, fonte: t.fonte, vigenciaInicio: t.vigenciaInicio };
}
