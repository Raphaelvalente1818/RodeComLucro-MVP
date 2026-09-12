// apps/web/src/admin/pages/Empresas.tsx
//
// Fila de aprovação de empresas (embarcadores). Empresa nasce 'pendente'
// no auto-cadastro; aqui o admin aprova (libera publicar frete), rejeita
// ou suspende — tudo via admin_moderar_empresa, que grava audit_log
// (approve_company/reject_company) na mesma transação.

import { useEffect, useState } from 'react';
import { carregarEmpresas, moderarEmpresa, type AdminEmpresa } from '../../data/admin';
import { formatarCnpj } from '../../lib/empresa';

const POR_PAGINA = 30;
const STATUS_OPCOES = ['pendente', 'aprovada', 'rejeitada', 'suspensa', 'todos'];

function fmtDataBR(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function Empresas() {
  const [status, setStatus] = useState('pendente');
  const [pagina, setPagina] = useState(0);
  const [linhas, setLinhas] = useState<AdminEmpresa[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [moderando, setModerando] = useState<string | null>(null);

  function recarregar() {
    setCarregando(true);
    carregarEmpresas(status, pagina, POR_PAGINA)
      .then(({ linhas, total }) => {
        setLinhas(linhas);
        setTotal(total);
        setErro(null);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[admin] falha ao carregar empresas', e);
        setErro('Não foi possível carregar a lista.');
      })
      .finally(() => setCarregando(false));
  }

  useEffect(recarregar, [status, pagina]);

  async function moderar(id: string, decisao: 'approve' | 'reject' | 'suspend') {
    let motivo: string | undefined;
    if (decisao !== 'approve') {
      const digitado = window.prompt(decisao === 'reject' ? 'Motivo da rejeição (obrigatório):' : 'Motivo da suspensão (obrigatório):');
      if (!digitado || !digitado.trim()) return;
      motivo = digitado.trim();
    }
    setModerando(id);
    try {
      await moderarEmpresa(id, decisao, motivo);
      recarregar();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[admin] falha ao moderar empresa', e);
      setErro('Não foi possível aplicar a decisão.');
    } finally {
      setModerando(null);
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <div className="admin-tela-topo">
        <h1>Empresas</h1>
        <p className="admin-atualizado-em">{total} empresa(s)</p>
      </div>

      <div className="admin-toolbar">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPagina(0);
          }}
        >
          {STATUS_OPCOES.map((s) => (
            <option key={s} value={s}>
              {s === 'todos' ? 'Todos os status' : s}
            </option>
          ))}
        </select>
      </div>

      {erro && <p className="aviso-erro">{erro}</p>}

      <div className="admin-tabela-wrap">
        <table className="admin-tabela">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>CNPJ</th>
              <th>Contato</th>
              <th>Status</th>
              <th>Cadastro</th>
              <th>Moderação</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={6}>Carregando…</td>
              </tr>
            ) : linhas.length === 0 ? (
              <tr>
                <td colSpan={6}>Nenhuma empresa encontrada.</td>
              </tr>
            ) : (
              linhas.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.razaoSocial}
                    {e.nomeFantasia && <div className="admin-atualizado-em">{e.nomeFantasia}</div>}
                  </td>
                  <td>{formatarCnpj(e.cnpj)}</td>
                  <td>
                    {e.email}
                    {e.telefone && <div className="admin-atualizado-em">{e.telefone}</div>}
                  </td>
                  <td>
                    <span className="admin-tag">{e.status}</span>
                    {e.motivoRejeicao && (e.status === 'rejeitada' || e.status === 'suspensa') && (
                      <div className="admin-atualizado-em" title={e.motivoRejeicao}>
                        {e.motivoRejeicao}
                      </div>
                    )}
                  </td>
                  <td>{fmtDataBR(e.createdAt)}</td>
                  <td>
                    <div className="admin-abas-secundarias">
                      {e.status !== 'aprovada' && (
                        <button
                          type="button"
                          className="admin-aba-secundaria"
                          disabled={moderando === e.id}
                          onClick={() => moderar(e.id, 'approve')}
                        >
                          Aprovar
                        </button>
                      )}
                      {e.status === 'pendente' && (
                        <button
                          type="button"
                          className="admin-aba-secundaria"
                          disabled={moderando === e.id}
                          onClick={() => moderar(e.id, 'reject')}
                        >
                          Rejeitar
                        </button>
                      )}
                      {e.status === 'aprovada' && (
                        <button
                          type="button"
                          className="admin-aba-secundaria"
                          disabled={moderando === e.id}
                          onClick={() => moderar(e.id, 'suspend')}
                        >
                          Suspender
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-paginacao">
        <span>
          Página {pagina + 1} de {totalPaginas}
        </span>
        <div className="admin-abas-secundarias">
          <button type="button" className="admin-aba-secundaria" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </button>
          <button
            type="button"
            className="admin-aba-secundaria"
            disabled={pagina + 1 >= totalPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
          </button>
        </div>
      </div>
    </>
  );
}
