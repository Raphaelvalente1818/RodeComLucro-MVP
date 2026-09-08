// apps/web/src/admin/pages/ImportarFretes.tsx
//
// Tela de importação em lote de fretes via planilha Excel (modelo em
// /templates/planilha-fretes-modelo.xlsx). Fluxo: escolher arquivo →
// prévia com validação linha a linha (sem gravar nada ainda) → admin
// confirma → grava só as linhas válidas.

import { useState } from 'react';
import { parseArquivoFretes, inserirFretes, type LinhaImportada } from '../importarFretesPlanilha';

export default function ImportarFretes() {
  const [linhas, setLinhas] = useState<LinhaImportada[] | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<number | null>(null);

  async function onArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo depois de corrigir
    if (!file) return;
    setErro(null);
    setResultado(null);
    setLinhas(null);
    setNomeArquivo(file.name);
    setProcessando(true);
    try {
      const parsed = await parseArquivoFretes(file);
      setLinhas(parsed);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[admin] falha ao ler planilha', e);
      setErro(e instanceof Error ? e.message : 'Não foi possível ler o arquivo. Confira se é um .xlsx válido, no formato do modelo.');
    } finally {
      setProcessando(false);
    }
  }

  async function confirmarImportacao() {
    if (!linhas) return;
    const validas = linhas.filter((l) => l.valido && l.dado);
    if (validas.length === 0) return;
    setImportando(true);
    setErro(null);
    try {
      const n = await inserirFretes(validas.map((l) => l.dado!));
      setResultado(n);
      setLinhas(null);
      setNomeArquivo(null);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[admin] falha ao importar fretes', e);
      const detalhe = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : null;
      setErro(`Falha ao gravar no banco${detalhe ? `: ${detalhe}` : ''}. Nenhuma linha adicional foi perdida — tente novamente.`);
    } finally {
      setImportando(false);
    }
  }

  const validas = linhas?.filter((l) => l.valido) ?? [];
  const invalidas = linhas?.filter((l) => !l.valido) ?? [];

  return (
    <>
      <div className="admin-tela-topo">
        <h1>Importar fretes</h1>
        <p className="admin-atualizado-em">Publica vários fretes de uma vez a partir de uma planilha Excel.</p>
      </div>

      <section className="admin-card">
        <span className="admin-card-titulo">1. Baixe o modelo</span>
        <p className="admin-card-nota">
          Preencha uma linha por frete seguindo a aba "Instruções" da planilha. Envie o mesmo modelo pra empresa preencher, se
          preferir.
        </p>
        <a href="/templates/planilha-fretes-modelo.xlsx" download className="link-secundario">
          Baixar planilha modelo (.xlsx)
        </a>
      </section>

      <section className="admin-card">
        <span className="admin-card-titulo">2. Envie a planilha preenchida</span>
        <input type="file" accept=".xlsx" onChange={onArquivoSelecionado} disabled={processando || importando} />
        {nomeArquivo && <p className="admin-card-nota">Arquivo: {nomeArquivo}</p>}
      </section>

      {processando && <p className="aviso">Lendo planilha…</p>}
      {erro && <p className="aviso-erro">{erro}</p>}
      {resultado != null && <p className="sucesso">{resultado} frete(s) importado(s) com sucesso.</p>}

      {linhas && (
        <section className="admin-card">
          <div className="admin-card-topo">
            <span className="admin-card-titulo">3. Confira antes de importar</span>
            <span>
              <span className="sucesso">{validas.length} válida(s)</span>
              {invalidas.length > 0 && <span className="aviso-erro"> · {invalidas.length} com erro</span>}
            </span>
          </div>

          {invalidas.length > 0 && (
            <div className="admin-tabela-wrap">
              <table className="admin-tabela">
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th>Empresa</th>
                    <th>Rota</th>
                    <th>Erros</th>
                  </tr>
                </thead>
                <tbody>
                  {invalidas.map((l) => (
                    <tr key={l.linha}>
                      <td>{l.linha}</td>
                      <td>{l.resumo.empresa}</td>
                      <td>
                        {l.resumo.origem} → {l.resumo.destino}
                      </td>
                      <td className="aviso-erro">{l.erros.join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invalidas.length > 0 && (
            <p className="admin-card-nota">
              As linhas com erro NÃO serão importadas. Corrija a planilha e envie de novo, ou prossiga só com as válidas.
            </p>
          )}

          <button type="button" className="cta-primaria" disabled={validas.length === 0 || importando} onClick={confirmarImportacao}>
            <span className="cta-titulo">{importando ? 'Importando…' : `Importar ${validas.length} frete(s)`}</span>
          </button>
        </section>
      )}
    </>
  );
}
