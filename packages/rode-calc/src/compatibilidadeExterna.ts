// packages/rode-calc/src/compatibilidadeExterna.ts
//
// Camada de compatibilidade entre bases externas (Fretebras e futuras
// concorrentes) e o nosso modelo de dados.
//
// Por que existe: a Fretebras guarda tudo que descreve o veículo num único
// campo de texto ("Veículo"), com vários valores juntos separados por " / "
// (ex: "Bitrem 7 eixos / Bitrem 9 eixos / Rodotrem"). A nossa base separa
// duas coisas que, pro caminhoneiro, são conceitos diferentes:
//   - TipoVeiculo: configuração do conjunto (Carreta, Bitrem, Rodotrem,
//     Truck...) — relacionada a eixos/capacidade de carga.
//   - TipoCarroceria: o que o caminhão carrega/como (Graneleiro, Baú,
//     Sider, Tanque...).
// Um campo externo em texto livre pode, em tese, misturar as duas coisas
// no mesmo valor (ex: um valor futuro tipo "Rodotrem Graneleiro"). Esta
// camada existe pra decompor qualquer string externa nesses dois grupos,
// sem a gente precisar mudar o nosso modelo (que fica normalizado) nem
// depender de a fonte externa separar os campos do jeito que a gente
// separa.
//
// Ver Docs/status-sessao.md (11/08) pro pedido original do Raphael —
// planilha fretes_fretebras_800.xlsx amostrada: 800 anúncios, campo
// "Veículo" só trouxe valores de TipoVeiculo (nenhum de carroceria),
// mas a função abaixo já está pronta pra reconhecer os dois casos.

import { VEICULOS, CARROCERIAS, type TipoVeiculo, type TipoCarroceria } from './tiposCaminhao';

/**
 * Separadores comuns usados por fontes externas pra listar múltiplos valores
 * num campo só. A barra só conta como separador quando cercada de espaço
 * (" / ") — sem isso, valores legítimos como "3/4" (caminhão leve) seriam
 * quebrados em "3" e "4".
 */
const SEPARADORES = /\s+\/\s+|\s*,\s*|\s*;\s*/;

type EntradaMapa = { tipoVeiculo?: TipoVeiculo; tipoCarroceria?: TipoCarroceria };

/**
 * Alias -> valor canônico. Cobre variações de grafia observadas em fontes
 * externas que não batem 100% com o nosso enum (ex: Fretebras usa
 * "Bitruck", a gente usa "BiTruck").
 */
const ALIASES: Record<string, TipoVeiculo | TipoCarroceria> = {
  bitruck: 'BiTruck',
  'bi-truck': 'BiTruck',
  bau: 'Baú',
  'bau frigorifico': 'Baú Frigorífico',
  'bau refrigerado': 'Baú Refrigerado',
  graneleira: 'Graneleiro',
  'porta container': 'Bug Porta Container',
  'porta-container': 'Bug Porta Container',
};

function normalizarChave(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // remove acentos pra comparação
}

/** Monta o dicionário termo-normalizado -> {tipoVeiculo | tipoCarroceria} a partir dos enums oficiais + aliases. */
function montarMapa(): Record<string, EntradaMapa> {
  const mapa: Record<string, EntradaMapa> = {};

  for (const grupo of VEICULOS) {
    for (const opcao of grupo.opcoes) {
      mapa[normalizarChave(opcao)] = { tipoVeiculo: opcao };
    }
  }
  for (const grupo of CARROCERIAS) {
    for (const opcao of grupo.opcoes) {
      mapa[normalizarChave(opcao)] = { tipoCarroceria: opcao };
    }
  }
  for (const [alias, canonico] of Object.entries(ALIASES)) {
    const chave = normalizarChave(alias);
    const ehVeiculo = VEICULOS.some((g) => g.opcoes.includes(canonico as TipoVeiculo));
    mapa[chave] = ehVeiculo ? { tipoVeiculo: canonico as TipoVeiculo } : { tipoCarroceria: canonico as TipoCarroceria };
  }

  return mapa;
}

const MAPA_TERMOS_EXTERNOS = montarMapa();

export type ResultadoNormalizacao = {
  tiposVeiculo: TipoVeiculo[];
  tiposCarroceria: TipoCarroceria[];
  /** Termos que vieram na string externa e não bateram com nenhum valor conhecido — fica pra revisão manual, não é erro fatal. */
  naoReconhecidos: string[];
};

/**
 * Decompõe um campo de texto livre vindo de fonte externa (ex: coluna
 * "Veículo" da Fretebras) nos nossos dois campos normalizados. Um mesmo
 * campo pode conter só configuração de veículo, só carroceria, os dois
 * juntos, ou vários valores separados por "/", "," ou ";" — tudo isso é
 * decomposto e classificado automaticamente.
 *
 * Termos não reconhecidos não travam o import: entram em `naoReconhecidos`
 * pra alguém revisar depois (e, se for um termo novo legítimo, vira um
 * alias aqui).
 */
export function normalizarVeiculoExterno(bruto: string | null | undefined): ResultadoNormalizacao {
  const resultado: ResultadoNormalizacao = { tiposVeiculo: [], tiposCarroceria: [], naoReconhecidos: [] };
  if (!bruto || !bruto.trim()) return resultado;

  const termos = bruto.split(SEPARADORES).map((t) => t.trim()).filter(Boolean);

  for (const termo of termos) {
    const entrada = MAPA_TERMOS_EXTERNOS[normalizarChave(termo)];
    if (!entrada) {
      resultado.naoReconhecidos.push(termo);
      continue;
    }
    if (entrada.tipoVeiculo && !resultado.tiposVeiculo.includes(entrada.tipoVeiculo)) {
      resultado.tiposVeiculo.push(entrada.tipoVeiculo);
    }
    if (entrada.tipoCarroceria && !resultado.tiposCarroceria.includes(entrada.tipoCarroceria)) {
      resultado.tiposCarroceria.push(entrada.tipoCarroceria);
    }
  }

  return resultado;
}
