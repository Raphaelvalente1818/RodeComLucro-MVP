// packages/rode-calc/src/tipoCargaPorCarroceria.ts
//
// Liga o TipoCarroceria (o que o app já cadastra em Perfil.tsx desde
// 06/08 — Graneleiro, Tanque, Baú Frigorífico etc.) ao TipoCarga da
// ANTT (pisoANTT.ts — carga_geral/granel_solido/granel_liquido/
// frigorificada/conteinerizada), pra calcular o piso mínimo certo sem
// o motorista ter que escolher o tipo de carga de novo numa tela nova.
//
// Pedido do Raphael (13/08), em cima do fechamento do TODO da Fase 0
// (piso ANTT pros outros tipos de carga) — ver Docs/status-sessao.md.
//
// Mapeamento é uma aproximação de bom senso (a ANTT não define essa
// correspondência oficialmente — carroceria é característica física do
// veículo, tipo de carga é classificação da mercadoria transportada, e
// nem sempre uma implica a outra 1:1). Critério usado: o que aquela
// carroceria carrega na prática, na maioria dos casos:
//   - Graneleiro, Silo, Cavaqueira, Hoper → granel_solido (grão, cimento,
//     cavaco de madeira, minério a granel).
//   - Caçamba → granel_solido (areia, brita, minério).
//   - Tanque → granel_liquido.
//   - Baú Frigorífico / Baú Refrigerado → frigorificada.
//   - Bug Porta Container → conteinerizada.
//   - Todo o resto (Grade baixa, Prancha, Plataforma, Sider, Baú,
//     Cegonheiro, Gaiola, Munk, Apenas Cavalo) → carga_geral, por não
//     ter categoria ANTT própria ou por ser carga geral mesmo
//     (paletizada, veículos, máquinas, granel misto).
//
// Sem carroceria cadastrada (perfil incompleto ou não preenchido ainda),
// cai em 'carga_geral' — mesmo comportamento default de calcularPisoANTT.

import type { TipoCarroceria } from './tiposCaminhao';
import type { TipoCarga } from './pisoANTT';

export const TIPO_CARGA_POR_CARROCERIA: Record<TipoCarroceria, TipoCarga> = {
  Graneleiro: 'granel_solido',
  'Grade baixa': 'carga_geral',
  Prancha: 'carga_geral',
  Caçamba: 'granel_solido',
  Plataforma: 'carga_geral',
  Sider: 'carga_geral',
  Baú: 'carga_geral',
  'Baú Frigorífico': 'frigorificada',
  'Baú Refrigerado': 'frigorificada',
  Silo: 'granel_solido',
  Cegonheiro: 'carga_geral',
  Gaiola: 'carga_geral',
  Tanque: 'granel_liquido',
  'Bug Porta Container': 'conteinerizada',
  Munk: 'carga_geral',
  'Apenas Cavalo': 'carga_geral',
  Cavaqueira: 'granel_solido',
  Hoper: 'granel_solido',
};

/** Resolve o TipoCarga a partir da carroceria cadastrada no perfil — 'carga_geral' se não houver carroceria ou se o valor não for reconhecido. */
export function tipoCargaPorCarroceria(carroceria: string | null | undefined): TipoCarga {
  if (!carroceria) return 'carga_geral';
  return TIPO_CARGA_POR_CARROCERIA[carroceria as TipoCarroceria] ?? 'carga_geral';
}
