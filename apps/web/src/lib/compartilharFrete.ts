// apps/web/src/lib/compartilharFrete.ts
//
// "Mandar pra um colega" (09/10/2026). Mesma mensagem que o bot monta em
// wa-webhook/tratarCompartilharFrete: o colega toca no link, cai no WhatsApp
// do Rode com Lucro com "FRETE <código> #<quem indicou>" preenchido, a conta
// nasce e o frete chega calculado. No celular usa a folha de compartilhar do
// sistema (Web Share API); no PC abre o WhatsApp Web com o texto pronto.

import type { FretePublicado } from './fretesPublicados';
import { fmtBRL } from '@rode/calc';
import { track } from './track';

/** Número oficial do bot (mesmo NUMERO_OFICIAL_WA das Edge Functions). */
export const NUMERO_BOT_WA = '5511999919971';

function valorCurto(f: FretePublicado): string {
  if (f.valorACombinar || f.valorFreteCentavos == null) return 'A combinar';
  const v = fmtBRL(f.valorFreteCentavos / 100);
  return f.tipoValor === 'por_tonelada' ? `${v}/ton` : v;
}

export function linkDoFreteCompartilhado(codigoFrete: string, codigoIndicacao: string | null): string {
  const texto = `FRETE ${codigoFrete}${codigoIndicacao ? ` #${codigoIndicacao}` : ''}`;
  return `https://wa.me/${NUMERO_BOT_WA}?text=${encodeURIComponent(texto)}`;
}

export function mensagemFreteCompartilhado(f: FretePublicado, codigoIndicacao: string | null): string {
  const tipos = f.tiposVeiculoAceitos.slice(0, 3).join(', ');
  return (
    `📦 *${f.origemCidade}/${f.origemUf} → ${f.destinoCidade}/${f.destinoUf}* · ${valorCurto(f)}${tipos ? ` · ${tipos}` : ''}\n` +
    `Vê se esse frete vale a pena pro seu caminhão 👉 ${linkDoFreteCompartilhado(f.codigo ?? '', codigoIndicacao)}\n` +
    `_Rode com Lucro: custo real, lucro e piso ANTT na hora, de graça._`
  );
}

/** Abre a folha de compartilhar (celular) ou o WhatsApp com o texto (PC). */
export async function compartilharFrete(f: FretePublicado, codigoIndicacao: string | null): Promise<void> {
  if (!f.codigo) return;
  const texto = mensagemFreteCompartilhado(f, codigoIndicacao);
  void track('referral_shared', { via: 'frete_app', frete_id: f.id });
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: texto });
      return;
    } catch {
      // cancelou ou não suportou — cai pro WhatsApp
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
}
