// apps/web/src/components/BacklogModal.tsx
//
// PROVISÓRIO — formulário de backlog para os 4 sócios registrarem
// bugs/sugestões enquanto testam o app. Sem relação com o produto final.
// Remover este arquivo junto com lib/backlog.ts, o botão "Backlog" na
// Garagem.tsx e a migration 20260805200031_backlog_provisorio_schema.sql
// quando os testes acabarem.

import { useEffect, useState } from 'react';
import {
  alternarStatusBacklog,
  criarBacklog,
  listarBacklog,
  type BacklogItem,
} from '../lib/backlog';

interface BacklogModalProps {
  onFechar: () => void;
}

const CAMPOS_VAZIOS = { nome: '', pagina: '', problemaSugestao: '', observacao: '' };

export default function BacklogModal({ onFechar }: BacklogModalProps) {
  const [itens, setItens] = useState<BacklogItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [campos, setCampos] = useState(CAMPOS_VAZIOS);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function recarregar() {
    setCarregando(true);
    setItens(await listarBacklog());
    setCarregando(false);
  }

  useEffect(() => {
    recarregar();
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!campos.nome.trim() || !campos.pagina.trim() || !campos.problemaSugestao.trim()) {
      setErro('Preencha nome, página e problema/sugestão.');
      return;
    }
    setEnviando(true);
    setErro(null);
    const { error } = await criarBacklog(campos);
    setEnviando(false);
    if (error) {
      setErro(error);
      return;
    }
    setCampos(CAMPOS_VAZIOS);
    recarregar();
  }

  async function alternar(item: BacklogItem) {
    setItens((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: item.status === 'aberto' ? 'feito' : 'aberto' } : i)),
    );
    await alternarStatusBacklog(item.id, item.status);
  }

  return (
    <div className="backlog-overlay" onClick={onFechar}>
      <div className="backlog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="backlog-modal-topo">
          <h2>Backlog (provisório)</h2>
          <button type="button" className="backlog-fechar" onClick={onFechar}>
            Fechar
          </button>
        </div>

        <form className="backlog-form" onSubmit={enviar}>
          <label>
            Nome
            <input
              value={campos.nome}
              onChange={(e) => setCampos({ ...campos, nome: e.target.value })}
              placeholder="Seu nome"
            />
          </label>
          <label>
            Página
            <input
              value={campos.pagina}
              onChange={(e) => setCampos({ ...campos, pagina: e.target.value })}
              placeholder="Ex.: Analisar frete"
            />
          </label>
          <label>
            Problema / Sugestão
            <textarea
              value={campos.problemaSugestao}
              onChange={(e) => setCampos({ ...campos, problemaSugestao: e.target.value })}
              rows={3}
            />
          </label>
          <label>
            Observação
            <textarea
              value={campos.observacao}
              onChange={(e) => setCampos({ ...campos, observacao: e.target.value })}
              rows={2}
            />
          </label>
          {erro && <p className="aviso-erro">{erro}</p>}
          <button type="submit" disabled={enviando}>
            {enviando ? 'Registrando…' : 'Registrar'}
          </button>
        </form>

        <div className="backlog-lista">
          {carregando ? (
            <p className="aviso">Carregando…</p>
          ) : itens.length === 0 ? (
            <p className="aviso">Nenhum item registrado ainda.</p>
          ) : (
            itens.map((item) => (
              <div key={item.id} className="backlog-item">
                <div className="backlog-item-topo">
                  <b>{item.pagina}</b>
                  <button
                    type="button"
                    className={item.status === 'aberto' ? 'backlog-toggle-aberto' : 'backlog-toggle-feito'}
                    onClick={() => alternar(item)}
                  >
                    {item.status === 'aberto' ? 'Aberto' : 'Feito'}
                  </button>
                </div>
                <p className="backlog-item-texto">{item.problemaSugestao}</p>
                {item.observacao && <p className="backlog-item-obs">{item.observacao}</p>}
                <p className="backlog-item-rodape">{item.nome}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
