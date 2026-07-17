import { describe, it, expect } from 'vitest';
import { fmtBRL, fmtPct, centsToReais, reaisToCents, parseNumeroPtBR } from '../src/format';

describe('conversão de unidade reais <-> centavos', () => {
  it('reaisToCents(centsToReais(x)) === x para valores inteiros de centavos', () => {
    for (const cents of [0, 100, 800050, 2000000, 1]) {
      expect(reaisToCents(centsToReais(cents))).toBe(cents);
    }
  });

  it('centsToReais converte corretamente', () => {
    expect(centsToReais(800000)).toBe(8000);
    expect(centsToReais(150)).toBe(1.5);
  });

  it('reaisToCents arredonda para o centavo mais próximo', () => {
    expect(reaisToCents(10)).toBe(1000);
    expect(reaisToCents(9.999)).toBe(1000); // arredonda pra cima
    expect(reaisToCents(10.1)).toBe(1010);
  });
});

describe('parseNumeroPtBR', () => {
  it('interpreta formato pt-BR (ponto=milhar, vírgula=decimal)', () => {
    expect(parseNumeroPtBR('1.500,00')).toBeCloseTo(1500, 2);
    expect(parseNumeroPtBR('150,50')).toBeCloseTo(150.5, 2);
  });

  it('interpreta formato neutro sem vírgula', () => {
    expect(parseNumeroPtBR('150')).toBe(150);
  });

  it('retorna 0 para texto vazio ou inválido', () => {
    expect(parseNumeroPtBR('')).toBe(0);
    expect(parseNumeroPtBR('abc')).toBe(0);
  });
});

describe('formatadores de exibição', () => {
  it('fmtBRL formata em pt-BR com símbolo de moeda', () => {
    expect(fmtBRL(1500)).toContain('1.500,00');
  });

  it('fmtPct formata com 1 casa decimal e símbolo %', () => {
    expect(fmtPct(45.678)).toBe('45.7%');
  });
});
