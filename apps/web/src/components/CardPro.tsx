// apps/web/src/components/CardPro.tsx
//
// Card "Rode com Lucro PRO" na Garagem (09/10/2026). Três estados:
//   - PRO ativo: selo + botão "Gerenciar" (Customer Portal do Stripe).
//   - Não assinante, fora do app da Play: botão "Assinar" (Checkout do Stripe).
//   - Não assinante, dentro do app da Play: sem botão de compra (política da
//     loja) — "assine pelo WhatsApp: manda PRO".
// Se o plano ainda não está configurado no Stripe, o card nem aparece.

import { useEffect, useState } from 'react';
import { abrirAssinatura, carregarAssinatura, dentroDoAppDaPlay, type EstadoAssinatura } from '../lib/assinatura';

export default function CardPro({ userId }: { userId: string }) {
  const [estado, setEstado] = useState<EstadoAssinatura | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [indisponivel, setIndisponivel] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const naPlay = dentroDoAppDaPlay();

  useEffect(() => {
    carregarAssinatura(userId).then(setEstado);
  }, [userId]);

  async function abrir(acao: 'checkout' | 'portal') {
    setAbrindo(true);
    setErro(null);
    const r = await abrirAssinatura(acao);
    setAbrindo(false);
    if ('url' in r) {
      window.location.href = r.url;
      return;
    }
    if ('disponivel' in r) {
      setIndisponivel(true);
      return;
    }
    setErro('Não consegui abrir agora. Tenta de novo em instantes.');
  }

  if (!estado || indisponivel) return null;

  if (estado.ativa) {
    return (
      <div className="card-pro card-pro-ativo">
        <span className="card-pro-selo">PRO</span>
        <div className="card-pro-corpo">
          <b>Você é Rode com Lucro PRO</b>
          <span>
            Fretes ilimitados e em primeira mão, WhatsApp sem limite.
            {estado.periodoFim ? ` Renova em ${new Date(estado.periodoFim).toLocaleDateString('pt-BR')}.` : ''}
            {estado.status === 'atrasada' ? ' A última cobrança falhou — atualize o cartão.' : ''}
          </span>
          <button type="button" className="link-secundario" disabled={abrindo} onClick={() => abrir('portal')}>
            Trocar cartão, faturas ou cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card-pro">
      <span className="card-pro-selo">PRO</span>
      <div className="card-pro-corpo">
        <b>Fretes ilimitados e em primeira mão</b>
        <span>Veja os fretes antes de todo mundo e use o WhatsApp sem limite de consultas. Cancela quando quiser.</span>
        {naPlay ? (
          <span className="card-pro-whats">Pra assinar, manda <b>PRO</b> no WhatsApp do Rode com Lucro.</span>
        ) : (
          <button type="button" className="card-pro-botao" disabled={abrindo} onClick={() => abrir('checkout')}>
            {abrindo ? 'Abrindo…' : 'Assinar o PRO'}
          </button>
        )}
        {erro && <span className="aviso-erro">{erro}</span>}
      </div>
    </div>
  );
}
