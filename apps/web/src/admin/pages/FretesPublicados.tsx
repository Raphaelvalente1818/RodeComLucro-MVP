// apps/web/src/admin/pages/FretesPublicados.tsx
//
// Lista do marketplace de fretes (fretes_publicados, hoje alimentado por
// import em lote do Fretebras) — busca por cidade/empresa, filtro por
// status, paginada.

import { useEffect, useState } from 'react';
import { fmtBRL } from '@rode/calc';
import { carregarFretesPublicados, moderarFrete, type AdminFretePublicado } from '../../data/admin';

const POR_PAGINA = 30;
// Valores reais do CHECK de fretes_publicados.status (ver
// 20260911130000_moderacao_fretes_publicados.sql) — 'removido' nunca
// existiu no banco, era um bug de digitação desta lista.
const STATUS_OPCOES = ['todos', 'aberto', 'negociando', 'fechado', 'expirado', 'pendente_aprovacao', 'rejeitado'];

function fmtDataBR(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function FretesPublicados() {
  const [termo, setTermo] = useState('');
  const [termoDebounced, setTermoDebounced] = useState('');
  const [status, setStatus] = useState('todos');
  const [pagina, setPagina] = useState(0);
  const [linhas, setLinhas] = useState<AdminFretePublicado[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [moderando, setModerando] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setTermoDebounced(termo);
      setPagina(0);
    }, 300);
    return () => clearTimeout(t);
  }, [termo]);

  function recarregar() {
    setCarregando(true);
    carregarFretesPublicados(termoDebounced, status, pagina, POR_PAGINA)
      .then(({ linhas, total }) => {
        setLinhas(linhas);
        setTotal(total);
        setErro(null);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[admin] falha ao carregar fretes publicados', e);
        setErro('Não foi possível carregar a lista.');
      })
      .finally(() => setCarregando(false));
  }

  useEffect(recarregar, [termoDebounced, status, pagina]);

  async function aprovar(freteId: string) {
    setModerando(freteId);
    try {
      await moderarFrete(freteId, 'approve');
      recarregar();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[admin] falha ao aprovar frete', e);
      setErro('Não foi possível aprovar o frete.');
    } finally {
      setModerando(null);
    }
  }

  async function rejeitar(freteId: string) {
    const motivo = window.prompt('Motivo da rejeição (obrigatório):');
    if (!motivo || !motivo.trim()) return;
    setModerando(freteId);
    try {
      await moderarFrete(freteId, 'reject', motivo.trim());
      recarregar();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[admin] falha ao rejeitar frete', e);
      setErro('Não foi possível rejeitar o frete.');
    } finally {
      setModerando(null);
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <div className="admin-tela-topo">
        <h1>Fretes publicados</h1>
        <p className="admin-atualizado-em">{total} frete(s)</p>
      </div>

      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Buscar por origem, destino ou empresa…"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
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
              <th>Rota</th>
              <th>Empresa</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Fonte</th>
              <th>Coleta</th>
              <th>Moderação</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={7}>Carregando…</td>
              </tr>
            ) : linhas.length === 0 ? (
              <tr>
                <td colSpan={7}>Nenhum frete encontrado.</td>
              </tr>
            ) : (
              linhas.map((f) => (
                <tr key={f.id}>
                  <td>
                    {f.origemCidade}/{f.origemUf} → {f.destinoCidade}/{f.destinoUf}
                  </td>
                  <td>
                    {f.empresaNome ?? '—'}
                    {f.dadoTeste ? <span className="admin-tag" style={{ marginLeft: 6 }}>teste</span> : null}
                  </td>
                  <td>
                    {f.valorACombinar || f.valorFreteCentavos == null
                      ? 'a combinar'
                      : `${fmtBRL(f.valorFreteCentavos / 100)}${f.tipoValor ? ` (${f.tipoValor})` : ''}`}
                  </td>
                  <td>
                    <span className="admin-tag">{f.status ?? '—'}</span>
                    {f.status === 'rejeitado' && f.motivoRejeicao ? (
                      <div className="admin-atualizado-em" title={f.motivoRejeicao}>
                        {f.motivoRejeicao}
                      </div>
                    ) : null}
                  </td>
                  <td>{f.fonte ?? '—'}</td>
                  <td>{fmtDataBR(f.dataColeta)}</td>
                  <td>
                    {f.status === 'pendente_aprovacao' ? (
                      <div className="admin-abas-secundarias">
                        <button
                          type="button"
                          className="admin-aba-secundaria"
                          disabled={moderando === f.id}
                          onClick={() => aprovar(f.id)}
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          className="admin-aba-secundaria"
                          disabled={moderando === f.id}
                          onClick={() => rejeitar(f.id)}
                        >
                          Rejeitar
                        </button>
                      </div>
                    ) : (
                      '—'
                    )}
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
