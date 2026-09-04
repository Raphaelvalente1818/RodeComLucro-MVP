// apps/web/src/admin/pages/Auditoria.tsx
//
// Duas fontes bem diferentes debaixo da mesma tela:
// - audit_log: trilha de ações administrativas (suspender motorista,
//   derrubar frete etc.) — hoje SEMPRE vazia, porque as RPCs de
//   moderação do PRD ainda não foram construídas (só a tabela existe).
//   Não é bug, é o próximo passo natural do painel.
// - app_log: execução dos jobs de rollup (pg_cron) — esse já tem dado
//   real, útil pra ver se algum refresh_* está falhando.

import { useEffect, useState } from 'react';
import { carregarAppLog, carregarAuditLog, type AdminAppLog, type AdminAuditLog } from '../../data/admin';

const POR_PAGINA = 30;
const NIVEIS = ['todos', 'erro', 'aviso', 'info'];

function fmtDataHoraBR(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function classeNivel(n: string): string {
  if (n === 'erro') return 'aviso-erro';
  if (n === 'aviso') return 'aviso';
  return 'sucesso';
}

export default function Auditoria() {
  const [aba, setAba] = useState<'acoes' | 'jobs'>('jobs');

  return (
    <>
      <div className="admin-tela-topo">
        <h1>Auditoria</h1>
      </div>

      <div className="admin-abas-secundarias">
        <button
          type="button"
          className={aba === 'jobs' ? 'admin-aba-secundaria admin-aba-secundaria-ativa' : 'admin-aba-secundaria'}
          onClick={() => setAba('jobs')}
        >
          Jobs de rollup
        </button>
        <button
          type="button"
          className={aba === 'acoes' ? 'admin-aba-secundaria admin-aba-secundaria-ativa' : 'admin-aba-secundaria'}
          onClick={() => setAba('acoes')}
        >
          Ações administrativas
        </button>
      </div>

      {aba === 'jobs' ? <AbaAppLog /> : <AbaAuditLog />}
    </>
  );
}

function AbaAppLog() {
  const [nivel, setNivel] = useState('todos');
  const [pagina, setPagina] = useState(0);
  const [linhas, setLinhas] = useState<AdminAppLog[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setCarregando(true);
    carregarAppLog(nivel, pagina, POR_PAGINA)
      .then(({ linhas, total }) => {
        setLinhas(linhas);
        setTotal(total);
        setErro(null);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[admin] falha ao carregar app_log', e);
        setErro('Não foi possível carregar o log.');
      })
      .finally(() => setCarregando(false));
  }, [nivel, pagina]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <div className="admin-toolbar">
        <select
          value={nivel}
          onChange={(e) => {
            setNivel(e.target.value);
            setPagina(0);
          }}
        >
          {NIVEIS.map((n) => (
            <option key={n} value={n}>
              {n === 'todos' ? 'Todos os níveis' : n}
            </option>
          ))}
        </select>
      </div>

      {erro && <p className="aviso-erro">{erro}</p>}

      <div className="admin-tabela-wrap">
        <table className="admin-tabela">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Nível</th>
              <th>Origem</th>
              <th>Mensagem</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={4}>Carregando…</td>
              </tr>
            ) : linhas.length === 0 ? (
              <tr>
                <td colSpan={4}>Nenhum registro.</td>
              </tr>
            ) : (
              linhas.map((l) => (
                <tr key={l.id}>
                  <td>{fmtDataHoraBR(l.createdAt)}</td>
                  <td className={classeNivel(l.nivel)}>{l.nivel}</td>
                  <td>{l.source}</td>
                  <td>{l.message}</td>
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

function AbaAuditLog() {
  const [pagina, setPagina] = useState(0);
  const [linhas, setLinhas] = useState<AdminAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setCarregando(true);
    carregarAuditLog(pagina, POR_PAGINA)
      .then(({ linhas, total }) => {
        setLinhas(linhas);
        setTotal(total);
        setErro(null);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[admin] falha ao carregar audit_log', e);
        setErro('Não foi possível carregar o log.');
      })
      .finally(() => setCarregando(false));
  }, [pagina]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      {erro && <p className="aviso-erro">{erro}</p>}

      {!carregando && linhas.length === 0 && (
        <p className="aviso">
          Nenhuma ação registrada ainda — as RPCs de moderação (suspender motorista, derrubar frete etc.) do PRD original ainda não
          foram construídas nesta fase, só a tabela existe.
        </p>
      )}

      <div className="admin-tabela-wrap">
        <table className="admin-tabela">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Ação</th>
              <th>Alvo</th>
              <th>Motivo</th>
              <th>Por</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={5}>Carregando…</td>
              </tr>
            ) : linhas.length === 0 ? (
              <tr>
                <td colSpan={5}>—</td>
              </tr>
            ) : (
              linhas.map((l) => (
                <tr key={l.id}>
                  <td>{fmtDataHoraBR(l.createdAt)}</td>
                  <td>
                    <span className="admin-tag">{l.action}</span>
                  </td>
                  <td>
                    {l.targetType}
                    {l.targetId ? ` · ${l.targetId}` : ''}
                  </td>
                  <td>{l.reason}</td>
                  <td>{l.role}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
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
      )}
    </>
  );
}
