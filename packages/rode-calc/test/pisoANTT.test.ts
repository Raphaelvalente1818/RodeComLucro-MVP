import { describe, it, expect } from 'vitest';
import { calcularPisoANTT, ANTT_CARGA_GERAL } from '../src/pisoANTT';

describe('calcularPisoANTT', () => {
  it('aplica piso = distanciaKm * CCD + CC para eixos exatos da tabela', () => {
    const { ccd, cc } = ANTT_CARGA_GERAL[5];
    expect(calcularPisoANTT(900, 5)).toBeCloseTo(900 * ccd + cc, 4);

    const eixos2 = ANTT_CARGA_GERAL[2];
    expect(calcularPisoANTT(100, 2)).toBeCloseTo(100 * eixos2.ccd + eixos2.cc, 4);
  });

  it('usa 5 eixos como default quando numeroEixos não é informado', () => {
    const semEixos = calcularPisoANTT(900);
    const cincoEixos = calcularPisoANTT(900, 5);
    expect(semEixos).toBe(cincoEixos);
  });

  it('eixos fora da tabela usam o coeficiente do eixo imediatamente inferior (Res. ANTT 6.076/2026 Art. 5º §5º)', () => {
    // 8 eixos não existe na tabela (só 7 e 9) -> deve cair no 7
    const oitoEixos = calcularPisoANTT(500, 8);
    const seteEixos = calcularPisoANTT(500, 7);
    expect(oitoEixos).toBe(seteEixos);

    // 1 eixo é menor que o mínimo da tabela (2) -> cai no menor disponível (2)
    const umEixo = calcularPisoANTT(500, 1);
    const doisEixos = calcularPisoANTT(500, 2);
    expect(umEixo).toBe(doisEixos);
  });

  it('é monotônico crescente em distância', () => {
    const curto = calcularPisoANTT(100, 5);
    const longo = calcularPisoANTT(1000, 5);
    expect(longo).toBeGreaterThan(curto);
  });
});
