// apps/web/src/admin/pages/ImportarFretes.tsx
//
// Tela de importação em lote de fretes via planilha Excel (modelo em
// /templates/planilha-fretes-modelo.xlsx). Fluxo: escolher arquivo →
// prévia com validação linha a linha (sem gravar nada ainda) → admin
// confirma → grava só as linhas válidas e não-duplicadas (duplicata =
// mesma empresa+rota+valor+data já "aberta" no banco, ou repetida na
// própria planilha — checagem adicionada depois que uma planilha de
// teste foi importada duas vezes sem querer).

import { useState } from 'react';
import { parseArquivoFretes, inserirFretes, type LinhaImportada } from '../importarFretesPlanilha';

export default function ImportarFretes() {
  const [linhas, setLinhas] = useState<LinhaImportada[] | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<number | null>(null);
  // Duplicatas ficam de fora da importação por padrão — o admin marca
  // aqui as que decidiu importar mesmo assim (ex.: frete legítimo
  // repetido, mesmo valor de novo).
  const [duplicatasLiberadas, setDuplicatasLiberadas] = useState<Set<number>>(new Set());

  async function onArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo depois de corrigir
    if (!file) return;
    setErro(null);
    setResultado(null);
    setLinhas(null);
    setDuplicatasLiberadas(new Set());
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

  function alternarDuplicataLiberada(linha: number) {
    setDuplicatasLiberadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(linha)) novo.delete(linha);
      else novo.add(linha);
      return novo;
    });
  }

  async function confirmarImportacao() {
    if (!linhas) return;
    const prontas = linhas.filter((l) => l.valido && l.dado && (!l.duplicata || duplicatasLiberadas.has(l.linha)));
    if (prontas.length === 0) return;
    setImportando(true);
    setErro(null);
    try {
      const n = await inserirFretes(prontas.map((l) => l.dado!));
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

  const validasNovas = linhas?.filter((l) => l.valido && !l.duplicata) ?? [];
  const duplicadas = linhas?.filter((l) => l.valido && l.duplicata) ?? [];
  const invalidas = linhas?.filter((l) => !l.valido) ?? [];
  const totalProntas = validasNovas.length + duplicatasLiberadas.size;

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

      {processando && <p className="aviso">Lendo planilha e checando duplicatas…</p>}
      {erro && <p className="aviso-erro">{erro}</p>}
      {resultado != null && <p className="sucesso">{resultado} frete(s) importado(s) com sucesso.</p>}

      {linhas && (
        <section className="admin-card">
          <div className="admin-card-topo">
            <span className="admin-card-titulo">3. Confira antes de importar</span>
            <span>
              <span className="sucesso">{validasNovas.length} nova(s)</span>
              {duplicadas.length > 0 && <span className="aviso"> · {duplicadas.length} duplicada(s)</span>}
              {invalidas.length > 0 && <span className="aviso-erro"> · {invalidas.length} com erro</span>}
            </span>
          </div>

          {duplicadas.length > 0 && (
            <p className="admin-card-nota">
              Linhas em amarelo parecem repetir um frete já "aberto" no banco (mesma empresa, rota, valor e data) — ou aparecem
              duplicadas dentro da própria planilha. Ficam de fora da importação por padrão; marque a caixa se quiser importar
              mesmo assim.
            </p>
          )}
          {invalidas.length > 0 && (
            <p className="admin-card-nota">
              Linhas em vermelho NÃO serão importadas. Corrija a planilha e envie de novo, ou prossiga só com as válidas.
            </p>
          )}

          <div className="admin-tabela-wrap">
            <table className="admin-tabela">
              <thead>
                <tr>
                  <th></th>
                  <th>Linha</th>
                  <th>Situação</th>
                  <th>Empresa</th>
                  <th>Rota</th>
                  <th>Erros</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const tipo = !l.valido ? 'erro' : l.duplicata ? 'duplicada' : 'nova';
                  return (
                    <tr key={l.linha} className={`admin-linha-${tipo}`}>
                      <td>
                        {tipo === 'duplicada' && (
                          <input
                            type="checkbox"
                            checked={duplicatasLiberadas.has(l.linha)}
                            onChange={() => alternarDuplicataLiberada(l.linha)}
                          />
                        )}
                      </td>
                      <td>{l.linha}</td>
                      <td>
                        <span className={`admin-tag admin-tag-${tipo}`}>{tipo}</span>
                      </td>
                      <td>{l.resumo.empresa}</td>
                      <td>
                        {l.resumo.origem} → {l.resumo.destino}
                      </td>
                      <td className={tipo === 'erro' ? 'aviso-erro' : undefined}>{l.erros.join('; ') || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button type="button" className="cta-primaria" disabled={totalProntas === 0 || importando} onClick={confirmarImportacao}>
            <span className="cta-titulo">{importando ? 'Importando…' : `Importar ${totalProntas} frete(s)`}</span>
          </button>
        </section>
      )}
    </>
  );
}
