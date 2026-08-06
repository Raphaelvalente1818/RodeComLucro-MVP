// packages/rode-calc/src/tiposCaminhao.ts
//
// Importado da calculadora-experimental do Emerson
// (github.com/emerson1001a/calculadora-experimental, src/types/index.ts +
// src/data/eixosPorCarroceria.ts) — mesmos valores, sem alteração. Ver
// Docs/status-sessao.md (05/08) pro pedido original do Raphael.
//
// Duas classificações distintas, do jeito que o Emerson desenhou:
//   - TipoVeiculo: configuração do conjunto (Carreta, Truck, Toco...) —
//     relacionada ao número de eixos.
//   - TipoCarroceria: o que o caminhão carrega/como (Graneleiro, Baú,
//     Porta Container, Tanque...).
//
// Hoje isso é só perfil/UX: sugere numeroEixos ao escolher a carroceria
// (eixosPorCarroceria) — igual o Emerson fazia, o piso ANTT continua
// calculado só por numeroEixos (ver pisoANTT.ts). Guardar esses dois
// campos agora deixa a base pronta pro TODO já registrado em
// pisoANTT.ts: tabela ANTT por tipo de carga (granel sólido, líquido,
// frigorificada, conteinerizada...), que ainda não foi levantada.

export type TipoVeiculo =
  | 'Carreta'
  | 'Carreta LS'
  | 'Vanderléia'
  | 'Carreta 4º eixo'
  | 'Bitrem 7 eixos'
  | 'Bitrem 9 eixos'
  | 'Rodotrem'
  | 'Truck'
  | 'BiTruck'
  | 'Fiorino'
  | 'VLC'
  | '3/4'
  | 'Toco';

export type TipoCarroceria =
  | 'Graneleiro'
  | 'Grade baixa'
  | 'Prancha'
  | 'Caçamba'
  | 'Plataforma'
  | 'Sider'
  | 'Baú'
  | 'Baú Frigorífico'
  | 'Baú Refrigerado'
  | 'Silo'
  | 'Cegonheiro'
  | 'Gaiola'
  | 'Tanque'
  | 'Bug Porta Container'
  | 'Munk'
  | 'Apenas Cavalo'
  | 'Cavaqueira'
  | 'Hoper';

export const VEICULOS: { categoria: string; opcoes: TipoVeiculo[] }[] = [
  {
    categoria: 'Pesado',
    opcoes: ['Carreta', 'Carreta LS', 'Vanderléia', 'Carreta 4º eixo', 'Bitrem 7 eixos', 'Bitrem 9 eixos', 'Rodotrem'],
  },
  { categoria: 'Médio', opcoes: ['Truck', 'BiTruck'] },
  { categoria: 'Leve', opcoes: ['Fiorino', 'VLC', '3/4', 'Toco'] },
];

export const CARROCERIAS: { categoria: string; opcoes: TipoCarroceria[] }[] = [
  {
    categoria: 'Abertas',
    opcoes: ['Graneleiro', 'Grade baixa', 'Prancha', 'Caçamba', 'Plataforma'],
  },
  {
    categoria: 'Fechadas',
    opcoes: ['Sider', 'Baú', 'Baú Frigorífico', 'Baú Refrigerado'],
  },
  {
    categoria: 'Especiais',
    opcoes: [
      'Silo',
      'Cegonheiro',
      'Gaiola',
      'Tanque',
      'Bug Porta Container',
      'Munk',
      'Apenas Cavalo',
      'Cavaqueira',
      'Hoper',
    ],
  },
];

/** Sugestão de número de eixos ao escolher a carroceria — mesmo mapeamento do Emerson. */
export const eixosPorCarroceria: Record<TipoCarroceria, number> = {
  Graneleiro: 6,
  'Grade baixa': 6,
  Prancha: 6,
  Caçamba: 6,
  Plataforma: 6,
  Sider: 6,
  Baú: 6,
  'Baú Frigorífico': 6,
  'Baú Refrigerado': 6,
  Silo: 7,
  Cegonheiro: 6,
  Gaiola: 6,
  Tanque: 7,
  'Bug Porta Container': 7,
  Munk: 4,
  'Apenas Cavalo': 3,
  Cavaqueira: 3,
  Hoper: 7,
};
