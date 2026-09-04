// apps/web/src/admin/pages/ConsultasWhatsapp.tsx
//
// Auditoria das consultas de cálculo/busca de frete feitas via WhatsApp
// (wa_freight_query, gravada por supabase/functions/wa-webhook). Clique
// na linha expande o snapshot de extração (o que a IA entendeu do texto)
// e o resultado calculado — útil pra depurar respostas erradas sem
// precisar ir direto no banco.

import { Fragment, useEffect, useState } from 'react';
import { carregarConsultasWhatsapp, type AdminConsultaWhatsapp } from '../../data/admin';

const POR_PAGINA = 30;

function fmtDataHoraBR(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ConsultasWhatsapp() {
  const [pagina, setPagina] = useState(0);
  const [linhas, setLinhas] = useState<AdminConsultaWhatsapp[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);

  useEffect(() => {
    setCarregando(true);
    carregarConsultasWhatsapp(pagina, POR_PAGINA)
      .then(({ linhas, total }) => {
        setLinhas(linhas);
        setTotal(total);
        setErro(null);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[admin] falha ao carregar consultas WhatsApp', e);
        setErro('Não foi possível carregar a lista.');
      })
      .finally(() => setCarregando(false));
  }, [pagina]);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <div className="admin-tela-topo">
        <h1>Consultas via WhatsApp</h1>
        <p className="admin-atualizado-em">{total} consulta(s) — clique numa linha pra ver o detalhe</p>
      </div>

      {erro && <p className="aviso-erro">{erro}</p>}

      <div className="admin-tabela-wrap">
        <table className="admin-tabela">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Telefone</th>
              <th>Mensagem</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              <tr>
                <td colSpan={4}>Carregando…</td>
              </tr>
            ) : linhas.length === 0 ? (
              <tr>
                <td colSpan={4}>Nenhuma consulta ainda.</td>
              </tr>
            ) : (
              linhas.map((c) => (
                <Fragment key={c.id}>
                  <tr
                    className="admin-linha-clicavel"
                    onClick={() => setExpandida((prev) => (prev === c.id ? null : c.id))}
                  >
                    <td>{fmtDataHoraBR(c.criadoEm)}</td>
                    <td>{c.fromE164 ?? '—'}</td>
                    <td>{c.textoRecebido ?? '—'}</td>
                    <td>
                      <span className="admin-tag">{c.status ?? '—'}</span>
                    </td>
                  </tr>
                  {expandida === c.id && (
                    <tr className="admin-detalhe-linha">
                      <td colSpan={4}>
                        <p className="admin-card-nota">Extração (o que a IA entendeu):</p>
                        <pre className="admin-detalhe-pre">{JSON.stringify(c.extracaoSnapshot, null, 2)}</pre>
                        <p className="admin-card-nota">Resultado calculado:</p>
                        <pre className="admin-detalhe-pre">{JSON.stringify(c.resultadoSnapshot, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
