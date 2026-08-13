import { describe, it, expect } from 'vitest';
import { tipoCargaPorCarroceria, TIPO_CARGA_POR_CARROCERIA } from '../src/tipoCargaPorCarroceria';
import { CARROCERIAS } from '../src/tiposCaminhao';

describe('tipoCargaPorCarroceria', () => {
  it('mapeia cada carroceria conhecida pro tipo de carga esperado', () => {
    expect(tipoCargaPorCarroceria('Graneleiro')).toBe('granel_solido');
    expect(tipoCargaPorCarroceria('Silo')).toBe('granel_solido');
    expect(tipoCargaPorCarroceria('Cavaqueira')).toBe('granel_solido');
    expect(tipoCargaPorCarroceria('Hoper')).toBe('granel_solido');
    expect(tipoCargaPorCarroceria('Caçamba')).toBe('granel_solido');
    expect(tipoCargaPorCarroceria('Tanque')).toBe('granel_liquido');
    expect(tipoCargaPorCarroceria('Baú Frigorífico')).toBe('frigorificada');
    expect(tipoCargaPorCarroceria('Baú Refrigerado')).toBe('frigorificada');
    expect(tipoCargaPorCarroceria('Bug Porta Container')).toBe('conteinerizada');
    expect(tipoCargaPorCarroceria('Baú')).toBe('carga_geral');
    expect(tipoCargaPorCarroceria('Sider')).toBe('carga_geral');
  });

  it('cai em carga_geral quando não há carroceria', () => {
    expect(tipoCargaPorCarroceria(null)).toBe('carga_geral');
    expect(tipoCargaPorCarroceria(undefined)).toBe('carga_geral');
    expect(tipoCargaPorCarroceria('')).toBe('carga_geral');
  });

  it('cai em carga_geral pra valor não reconhecido (dado inconsistente)', () => {
    expect(tipoCargaPorCarroceria('Carroceria Inexistente')).toBe('carga_geral');
  });

  it('todas as 18 carrocerias cadastradas em CARROCERIAS têm mapeamento', () => {
    const todasCarrocerias = CARROCERIAS.flatMap((grupo) => grupo.opcoes);
    expect(todasCarrocerias).toHaveLength(18);
    for (const carroceria of todasCarrocerias) {
      expect(TIPO_CARGA_POR_CARROCERIA[carroceria]).toBeDefined();
    }
  });
});
