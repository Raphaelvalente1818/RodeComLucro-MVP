// apps/web/src/pages/empresa/StatusFreteModal.tsx
//
// Confirmação de pausar / publicar de novo / fechar um frete (05/10/2026,
// Docs/mockup-fretes-empresa-status.html). Motivo opcional — vai pro
// histórico do frete como evidência ("já tem motorista", "coleta adiada").
// Usado pela lista (EmpresaHome) e pelo detalhe (EmpresaFrete).

import { useState } from 'react';
import { mudarStatusFrete, type StatusFreteEmpresa } from '../../lib/empresa';

const TEXTO: Record<StatusFreteEmpresa, { titulo: string; texto: string; botao: string; placeholder: string }> = {
  pausado: {
    titulo: 'Pausar este frete?',
    texto: 'Ele sai da busca do app e das respostas do WhatsApp agora. Você pode publicar de novo quando quiser.',
    botao: 'Pausar',
    placeholder: 'Ex.: coleta adiada',
  },
  aberto: {
    titulo: 'Publicar de novo?',
    texto: 'Volta pra busca do app e pro WhatsApp na hora. Não precisa de nova aprovação.',
    botao: 'Publicar',
    placeholder: 'Ex.: nova data de coleta confirmada',
  },
  fechado: {
    titulo: 'Fechar este frete?',
    texto: 'Ele some pros motoristas e fica no seu histórico. Dá pra publicar de novo depois, se precisar.',
    botao: 'Fechar',
    placeholder: 'Ex.: já tem motorista',
  },
};

export interface PedidoStatus {
  freteId: string;
  rota: string;
  para: StatusFreteEmpresa;
}

export default function StatusFreteModal({
  pedido,
  onFechar,
  onFeito,
}: {
  pedido: PedidoStatus;
  onFechar: () => void;
  onFeito: (para: StatusFreteEmpresa) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const t = TEXTO[pedido.para];

  async function confirmar() {
    setSalvando(true);
    setErro(null);
    try {
      await mudarStatusFrete(pedido.freteId, pedido.para, motivo);
      onFeito(pedido.para);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[empresa] falha ao mudar status do frete', e);
      setErro('Não foi possível mudar o status agora. Tenta de novo em instantes.');
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !salvando && onFechar()}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{t.titulo}</h2>
        <p className="empresa-modal-rota">{pedido.rota}</p>
        <p className="empresa-modal-texto">{t.texto}</p>
        <label>
          Motivo (opcional, fica no histórico)
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t.placeholder} maxLength={140} />
        </label>
        {erro && <p className="aviso-erro">{erro}</p>}
        <button type="button" disabled={salvando} onClick={confirmar}>
          {salvando ? 'Salvando...' : t.botao}
        </button>
        <button type="button" className="link-secundario" disabled={salvando} onClick={onFechar}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
