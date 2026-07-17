import { describe, it, expect } from 'vitest';
import { calcularFrete, FORMULA_VERSAO } from '../src/calcularFrete';
import type { Custos, FreteInput } from '../src/types';

const custosBase: Custos = {
  dieselKmPorLt: 2.5,
  dieselPrecoPorLitro: 6.1,
  arlaKmPorLt: 25,
  arlaPrecoPorLitro: 4.5,
  pedagio: 150,
  alimentacao: 360, // 4 dias x 90/dia, já totalizado
  pernoite: 0,
  estacionamento: 0,
  chapa: 0,
  manutencaoPorKm: 0.35,
  pneusPorKm: 0.12,
  depreciacaoPorKm: 0.25,
};

function inputBase(overrides: Partial<FreteInput> = {}): FreteInput {
  return {
    origem: 'São Paulo',
    destino: 'Recife',
    distanciaKm: 2650,
    valorFrete: 8000,
    voltaVazia: false,
    margemDesejada: 20,
    numeroEixos: 5,
    custos: custosBase,
    ...overrides,
  };
}

describe('calcularFrete — fórmula e componentes de custo', () => {
  it('calcula diesel e ARLA como consumo próprio independente (não % do diesel)', () => {
    const r = calcularFrete(inputBase());
    // diesel = (preco/kmPorLt) * distanciaTotal
    expect(r.custoDetalhado.diesel).toBeCloseTo((6.1 / 2.5) * 2650, 2);
    // arla = (preco/kmPorLt) * distanciaTotal — fórmula independente, NÃO custoDiesel * pct
    expect(r.custoDetalhado.arla).toBeCloseTo((4.5 / 25) * 2650, 2);
    expect(r.custoDetalhado.arla).not.toBeCloseTo(r.custoDetalhado.diesel * 0.05, 2);
  });

  it('carimba FORMULA_VERSAO no resultado', () => {
    const r = calcularFrete(inputBase());
    expect(r.formulaVersao).toBe(FORMULA_VERSAO);
  });

  it('volta vazia dobra distância total, pedágio e custos por km — mas não alimentação/pernoite/estacionamento/chapa', () => {
    const semRetorno = calcularFrete(inputBase({ voltaVazia: false }));
    const comRetorno = calcularFrete(
      inputBase({ voltaVazia: true, custos: { ...custosBase, estacionamento: 40, chapa: 60, pernoite: 120 } })
    );

    expect(comRetorno.custoDetalhado.pedagio).toBeCloseTo(semRetorno.custoDetalhado.pedagio * 2, 2);
    expect(comRetorno.custoDetalhado.diesel).toBeCloseTo(semRetorno.custoDetalhado.diesel * 2, 2);
    expect(comRetorno.custoDetalhado.manutencao).toBeCloseTo(semRetorno.custoDetalhado.manutencao * 2, 2);

    // fixos: não dobram com a volta vazia
    expect(comRetorno.custoDetalhado.estacionamento).toBe(40);
    expect(comRetorno.custoDetalhado.chapa).toBe(60);
    expect(comRetorno.custoDetalhado.pernoite).toBe(120);
    expect(comRetorno.custoDetalhado.alimentacao).toBe(semRetorno.custoDetalhado.alimentacao);
  });

  it('margemReal e custoPorKm não quebram com valorFrete=0 (guarda de divisão por zero)', () => {
    const r = calcularFrete(inputBase({ valorFrete: 0 }));
    expect(r.margemReal).toBe(0);
    expect(Number.isNaN(r.margemReal)).toBe(false);
  });
});

describe('calcularFrete — veredito (lógica simples da calculadora, sem LIMIAR_VERDE)', () => {
  it('lucro <= 0 → RUIM, mesmo que a distância/eixos deixem o piso ANTT baixo', () => {
    // frete caríssimo em custo, valor baixo -> lucro negativo
    const r = calcularFrete(
      inputBase({ valorFrete: 100, distanciaKm: 2650 })
    );
    expect(r.lucro).toBeLessThan(0);
    expect(r.veredicto).toBe('RUIM');
  });

  it('valorFrete abaixo do piso ANTT força RUIM mesmo com lucro positivo', () => {
    // distância curta (50km, 5 eixos -> piso = 50*6.7126+635.08 = R$970,71),
    // custo total baixo (~R$167) e valor ofertado de R$200: lucro positivo
    // (~R$33), mas bem abaixo do piso ANTT.
    const input = inputBase({
      distanciaKm: 50,
      valorFrete: 200,
      custos: { ...custosBase, pedagio: 0, alimentacao: 0 },
    });
    const r = calcularFrete(input);
    expect(r.lucro).toBeGreaterThan(0);
    expect(r.abaixoPisoANTT).toBe(true);
    expect(r.veredicto).toBe('RUIM');
  });

  it('margemReal >= margemDesejada e acima do piso → BOM', () => {
    // 900km/5 eixos -> piso ANTT = 900*6,7126+635,08 = R$6.676,42; custo
    // total ~R$3.516 (diesel/arla/pedágio/alimentação/manutenção/pneus/
    // depreciação); valorFrete=8000 fica acima do piso e dá margem >20%.
    const r = calcularFrete(inputBase({ distanciaKm: 900, valorFrete: 8000, margemDesejada: 20 }));
    expect(r.lucro).toBeGreaterThan(0);
    expect(r.abaixoPisoANTT).toBe(false);
    expect(r.margemReal).toBeGreaterThanOrEqual(20);
    expect(r.veredicto).toBe('BOM');
  });

  it('lucro positivo, acima do piso, mas margemReal < margemDesejada → ACEITÁVEL', () => {
    const r = calcularFrete(inputBase({ distanciaKm: 900, valorFrete: 7000, margemDesejada: 50 }));
    expect(r.lucro).toBeGreaterThan(0);
    expect(r.abaixoPisoANTT).toBe(false);
    expect(r.margemReal).toBeLessThan(50);
    expect(r.veredicto).toBe('ACEITÁVEL');
  });
});

describe('calcularFrete — determinismo', () => {
  it('mesmos inputs sempre produzem o mesmo resultado (puro, sem efeitos colaterais)', () => {
    const input = inputBase();
    const r1 = calcularFrete(input);
    const r2 = calcularFrete(input);
    expect(r1).toEqual(r2);
  });
});
