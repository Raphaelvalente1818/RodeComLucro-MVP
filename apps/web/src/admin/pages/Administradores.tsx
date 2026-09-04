// apps/web/src/admin/pages/Administradores.tsx
//
// Lista de quem tem acesso ao painel (admin_user), cruzado com
// nome/telefone de motoristas quando existir. Só leitura — gestão de
// papel continua manual (service role/SQL), como documentado em
// 20260902182345_admin_auth_e_rollups.sql: sem self-service de promoção
// de papel por enquanto.

import { useEffect, useState } from 'react';
import { carregarAdministradores, type AdminAdministrador } from '../../data/admin';

function fmtDataBR(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function Administradores() {
  const [linhas, setLinhas] = useState<AdminAdministrador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarAdministradores()
      .then((linhas) => {
        setLinhas(linhas);
        setErro(null);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[admin] falha ao carregar administradores', e);
        setErro('Não foi possível carregar a lista.');
      })
      .finally(() => setCarregando(false));
  }, []);

  return (
    <>
      <div className="admin-tela-topo">
        <h1>Administradores</h1>
        <p className="admin-atualizado-em">{linhas.length} conta(s) com acesso ao painel</p>
      </div>

      {erro && <p className="aviso-erro">{erro}</p>}

      <div className="admin-tabela-wrap">
        <table className="admin-tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Papel</th>
              <th>Status</th>
              <th>Desde</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={5}>Carregando…</td>
              </tr>
            ) : linhas.length === 0 ? (
              <tr>
                <td colSpan={5}>Nenhum administrador cadastrado.</td>
              </tr>
            ) : (
              linhas.map((a) => (
                <tr key={a.userId}>
                  <td>{a.nome ?? '—'}</td>
                  <td>{a.telefoneE164 ?? '—'}</td>
                  <td>
                    <span className="admin-tag">{a.role}</span>
                  </td>
                  <td>
                    {a.ativo ? (
                      <span className="sucesso">ativo</span>
                    ) : (
                      <span className="aviso-erro">inativo</span>
                    )}
                  </td>
                  <td>{fmtDataBR(a.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="admin-card-nota">
        Gestão de papel é manual por enquanto (via banco) — sem self-service de promoção nesta primeira fase.
      </p>
    </>
  );
}
