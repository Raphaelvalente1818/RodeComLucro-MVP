import { describe, it, expect } from 'vitest';
import { numeroPneus, pneusPorKmPadrao, PNEU } from '../src/pneus';

describe('pneus por eixo (09/10/2026)', () => {
  it('conta 2 na direção e 4 nos demais eixos', () => {
    expect(numeroPneus(2)).toBe(6); // toco
    expect(numeroPneus(3)).toBe(10); // truck
    expect(numeroPneus(5)).toBe(18); // carreta simples
    expect(numeroPneus(6)).toBe(22); // carreta LS
    expect(numeroPneus(7)).toBe(26); // bitrem
    expect(numeroPneus(9)).toBe(34); // rodotrem
  });

  it('custo por km cresce com os eixos e bate com a fórmula', () => {
    const custoPneu = PNEU.precoNovo + PNEU.recapagens * PNEU.precoRecapagem;
    expect(pneusPorKmPadrao(3)).toBeCloseTo((10 * custoPneu) / PNEU.vidaKmTotal, 3);
    expect(pneusPorKmPadrao(6)).toBeCloseTo((22 * custoPneu) / PNEU.vidaKmTotal, 3);
    expect(pneusPorKmPadrao(6)).toBeGreaterThan(pneusPorKmPadrao(3));
    // calibração inicial: Truck ≈ 0,133; LS ≈ 0,293; bitrem ≈ 0,347
    expect(pneusPorKmPadrao(3)).toBe(0.133);
    expect(pneusPorKmPadrao(6)).toBe(0.293);
    expect(pneusPorKmPadrao(7)).toBe(0.347);
  });

  it('não quebra com eixos inválidos', () => {
    expect(numeroPneus(0)).toBe(2);
    expect(numeroPneus(-3)).toBe(2);
    expect(pneusPorKmPadrao(0)).toBeGreaterThan(0);
  });
});
