// apps/web/src/admin/pages/Motoristas.tsx
//
// Lista de motoristas cadastrados — busca por nome/telefone/cidade,
// paginada (30 por página). Só leitura por enquanto: sem RPC de
// moderação (suspender, etc.) ainda, então não tem ação nenhuma na
// linha além de ver os dados.

import { useEffect, useState } from 'react';
import { carregarMotoristas, type AdminMotorista } from '../../data/admin';

const POR_PAGINA = 30;

function fmtDataBR(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function Motoristas() {
  const [termo, setTermo] = useState('');
  const [termoDebounced, setTermoDebounced] = useState('');
  const [pagina, setPagina] = useState(0);
  const [linhas, setLinhas] = useState<AdminMotorista[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setTermoDebounced(termo);
      setPagina(0);
    }, 300);
    return () => clearTimeout(t);
  }, [termo]);

  useEffect(() => {
    setCarregando(true);
    carregarMotoristas(termoDebounced, pagina, POR_PAGINA)
      .then(({ linhas, total }) => {
        setLinhas(linhas);
        setTotal(total);
        setErro(null);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[admin] falha ao carregar motoristas', e);
        setErro('Não foi possível carregar a lista.');
      })
      .finally(() => setCarregando(false));
  }, [termoDebounced, pagina]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <div className="admin-tela-topo">
        <h1>Motoristas</h1>
        <p className="admin-atualizado-em">{total} cadastrado(s)</p>
      </div>

      <div className="admin-toolbar">
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou cidade…"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
        />
      </div>

      {erro && <p className="aviso-erro">{erro}</p>}

      <div className="admin-tabela-wrap">
        <table className="admin-tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Cidade base</th>
              <th>Status</th>
              <th>WhatsApp</th>
              <th>CNH vence</th>
              <th>Último login</th>
              <th>Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={8}>Carregando…</td>
              </tr>
            ) : linhas.length === 0 ? (
              <tr>
                <td colSpan={8}>Nenhum motorista encontrado.</td>
              </tr>
            ) : (
              linhas.map((m) => (
                <tr key={m.id}>
                  <td>{m.nome ?? '—'}</td>
                  <td>
                    {m.telefoneE164 ?? '—'}
                    {m.telefoneVerificado ? ' ✓' : ''}
                  </td>
                  <td>{m.cidadeBase ? `${m.cidadeBase} - ${m.ufBase}` : m.ufBase ?? '—'}</td>
                  <td>
                    <span className="admin-tag">{m.status ?? 'ativo'}</span>
                  </td>
                  <td>{m.canalWaAtivo ? 'vinculado' : '—'}</td>
                  <td>{fmtDataBR(m.cnhVencimento)}</td>
                  <td>{fmtDataBR(m.ultimoLoginAt)}</td>
                  <td>{fmtDataBR(m.createdAt)}</td>
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
