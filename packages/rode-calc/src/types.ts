// Contrato de dados do motor de cálculo do RODE COM LUCRO.
//
// Origem: extraído de github.com/emerson1001a/calculadora-experimental
// (src/types/index.ts), com o contrato ajustado pelas decisões de
// 2026-07-17 registradas em Docs/sequencia-construcao.md:
//   - `voltaVazia` volta a ser booleano (não o `tipoRetorno` de 3 estados
//     da calculadora) — compatível com o que calc-wpp e find-app esperam.
//   - Campos novos validados na calculadora (`estacionamento`, `chapa`,
//     `pernoite`) entram no contrato desde já.
//   - A fórmula do ARLA 32 usa consumo próprio independente (litros/km +
//     preço/litro), não `arlaPct` como percentual do diesel — o PRD
//     calc-app estava desatualizado nesse ponto.

export interface Custos {
  /** Consumo de diesel em km por litro. */
  dieselKmPorLt: number;
  /** Preço do diesel em R$ por litro. */
  dieselPrecoPorLitro: number;
  /** Consumo de ARLA 32 em km por litro (taxa própria, independente do diesel). */
  arlaKmPorLt: number;
  /** Preço do ARLA 32 em R$ por litro. */
  arlaPrecoPorLitro: number;
  /** Pedágio de ida, em R$. Dobra automaticamente se `voltaVazia`. */
  pedagio: number;
  /** Alimentação total da viagem, em R$ (já multiplicado pelos dias fora do motor). */
  alimentacao: number;
  /** Pernoite/hospedagem total da viagem, em R$ (já multiplicado pelos dias fora do motor). */
  pernoite: number;
  /** Estacionamento, em R$ — custo fixo da viagem, não dobra na volta vazia. */
  estacionamento: number;
  /** Chapa (mão de obra de carga/descarga), em R$ — custo fixo, não dobra na volta vazia. */
  chapa: number;
  /** Manutenção por km rodado, em R$/km. */
  manutencaoPorKm: number;
  /** Desgaste de pneus por km rodado, em R$/km. */
  pneusPorKm: number;
  /** Depreciação do veículo por km rodado, em R$/km. */
  depreciacaoPorKm: number;
}

export interface FreteInput {
  origem: string;
  destino: string;
  /** Distância de ida, em km (não inclui volta). */
  distanciaKm: number;
  /** Valor ofertado pelo frete, em R$. */
  valorFrete: number;
  /** true = o caminhão volta vazio (custos variáveis e pedágio dobram; alimentação/pernoite não). */
  voltaVazia: boolean;
  /** Margem de lucro desejada pelo motorista, em %. */
  margemDesejada: number;
  custos: Custos;
  /** true quando a distância veio de preset/cache local, não de uma API ao vivo — aciona o aviso de estimativa. */
  distanciaEstimada?: boolean;
  /** Número de eixos do caminhão, usado para resolver o piso mínimo ANTT. Default: 5 (carreta). */
  numeroEixos?: number;
}

export interface CustoDetalhado {
  diesel: number;
  arla: number;
  pedagio: number;
  alimentacao: number;
  pernoite: number;
  estacionamento: number;
  chapa: number;
  manutencao: number;
  pneus: number;
  depreciacao: number;
}

export type Veredicto = 'BOM' | 'ACEITÁVEL' | 'RUIM';

export interface FreteResultado {
  entrada: FreteInput;
  custoTotal: number;
  custoDetalhado: CustoDetalhado;
  lucro: number;
  /** Margem real do frete, em %. */
  margemReal: number;
  /** Piso mínimo ANTT calculado para a rota/eixos informados, em R$. */
  pisoANTT: number;
  abaixoPisoANTT: boolean;
  veredicto: Veredicto;
  /** Versão da fórmula usada — carimbada para reprodutibilidade do histórico. */
  formulaVersao: string;
}
