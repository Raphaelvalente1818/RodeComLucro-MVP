// apps/web/src/components/TestesModal.tsx
//
// PROVISÓRIO — mural de testes para os sócios testando o MVP: alguém
// cadastra o que precisa ser testado (tela, funcionalidade, obs pro
// teste); depois, o testador escolhe um pendente, executa e registra o
// resultado (resultado do teste, observação, aprovado). Sem relação com o
// produto final. Remover este arquivo junto com lib/testes.ts, o botão
// "Testes" na Garagem.tsx e a migration
// 20260818140000_testes_provisorio_schema.sql quando os testes acabarem.

import { useEffect, useState } from 'react';
import {
  criarTeste,
  listarTestes,
  reabrirTeste,
  registrarResultadoTeste,
  type TesteItem,
} from '../lib/testes';

interface TestesModalProps {
  onFechar: () => void;
}

const CAMPOS_VAZIOS = { tela: '', funcionalidade: '', obsParaTeste: '', nomeCadastro: '' };
const RESULTADO_VAZIO = { resultadoTeste: '', observacaoTeste: '', aprovado: true, nomeTeste: '' };

export default function TestesModal({ onFechar }: TestesModalProps) {
  const [itens, setItens] = useState<TesteItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [campos, setCampos] = useState(CAMPOS_VAZIOS);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  // Só um item por vez com o formulário de resultado aberto.
  const [idEmTeste, setIdEmTeste] = useState<string | null>(null);
  const [resultado, setResultado] = useState(RESULTADO_VAZIO);
  const [registrando, setRegistrando] = useState(false);
  const [erroResultado, setErroResultado] = useState<string | null>(null);

  async function recarregar() {
    setCarregando(true);
    setItens(await listarTestes());
    setCarregando(false);
  }

  useEffect(() => {
    recarregar();
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!campos.tela.trim() || !campos.funcionalidade.trim() || !campos.nomeCadastro.trim()) {
      setErro('Preencha tela, funcionalidade e seu nome.');
      return;
    }
    setEnviando(true);
    setErro(null);
    const { error } = await criarTeste(campos);
    setEnviando(false);
    if (error) {
      setErro(error);
      return;
    }
    setCampos(CAMPOS_VAZIOS);
    setMostrarForm(false);
    recarregar();
  }

  function abrirTesteDe(item: TesteItem) {
    setIdEmTeste(item.id);
    setResultado(RESULTADO_VAZIO);
    setErroResultado(null);
  }

  async function enviarResultado(e: React.FormEvent) {
    e.preventDefault();
    if (!idEmTeste) return;
    if (!resultado.resultadoTeste.trim() || !resultado.nomeTeste.trim()) {
      setErroResultado('Preencha o resultado do teste e seu nome.');
      return;
    }
    setRegistrando(true);
    setErroResultado(null);
    const { error } = await registrarResultadoTeste(idEmTeste, resultado);
    setRegistrando(false);
    if (error) {
      setErroResultado(error);
      return;
    }
    setIdEmTeste(null);
    recarregar();
  }

  async function reabrir(id: string) {
    setItens((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, aprovado: null, resultadoTeste: null, observacaoTeste: null, nomeTeste: null, testadoEm: null }
          : i,
      ),
    );
    await reabrirTeste(id);
    recarregar();
  }

  const pendentes = itens.filter((i) => i.aprovado === null);
  const testados = itens.filter((i) => i.aprovado !== null);

  return (
    <div className="backlog-overlay" onClick={onFechar}>
      <div className="backlog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="backlog-modal-topo">
          <h2>Testes (provisório)</h2>
          <button type="button" className="backlog-fechar" onClick={onFechar}>
            Fechar
          </button>
        </div>

        {!mostrarForm ? (
          <button type="button" className="link-secundario" onClick={() => setMostrarForm(true)}>
            + Cadastrar o que precisa ser testado
          </button>
        ) : (
          <form className="backlog-form" onSubmit={enviar}>
            <label>
              Tela
              <input
                value={campos.tela}
                onChange={(e) => setCampos({ ...campos, tela: e.target.value })}
                placeholder="Ex.: Buscar frete"
              />
            </label>
            <label>
              Funcionalidade
              <input
                value={campos.funcionalidade}
                onChange={(e) => setCampos({ ...campos, funcionalidade: e.target.value })}
                placeholder="Ex.: Filtro por raio de distância"
              />
            </label>
            <label>
              Obs para o teste
              <textarea
                value={campos.obsParaTeste}
                onChange={(e) => setCampos({ ...campos, obsParaTeste: e.target.value })}
                rows={2}
                placeholder="O que o testador deve conferir/tentar"
              />
            </label>
            <label>
              Seu nome
              <input
                value={campos.nomeCadastro}
                onChange={(e) => setCampos({ ...campos, nomeCadastro: e.target.value })}
              />
            </label>
            {erro && <p className="aviso-erro">{erro}</p>}
            <div className="testes-form-botoes">
              <button type="submit" disabled={enviando}>
                {enviando ? 'Registrando…' : 'Registrar teste'}
              </button>
              <button type="button" className="link-secundario" onClick={() => setMostrarForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="backlog-lista">
          {carregando ? (
            <p className="aviso">Carregando…</p>
          ) : itens.length === 0 ? (
            <p className="aviso">Nenhum teste cadastrado ainda.</p>
          ) : (
            <>
              {pendentes.length > 0 && (
                <>
                  <p className="testes-secao-titulo">A testar ({pendentes.length})</p>
                  {pendentes.map((item) => (
                    <div key={item.id} className="backlog-item">
                      <div className="backlog-item-topo">
                        <b>
                          {item.tela} · {item.funcionalidade}
                        </b>
                      </div>
                      {item.obsParaTeste && <p className="backlog-item-obs">{item.obsParaTeste}</p>}
                      <p className="backlog-item-rodape">Cadastrado por {item.nomeCadastro}</p>

                      {idEmTeste !== item.id ? (
                        <button type="button" className="testes-testar-botao" onClick={() => abrirTesteDe(item)}>
                          Testar
                        </button>
                      ) : (
                        <form className="backlog-form testes-resultado-form" onSubmit={enviarResultado}>
                          <label>
                            Resultado do teste
                            <textarea
                              value={resultado.resultadoTeste}
                              onChange={(e) => setResultado({ ...resultado, resultadoTeste: e.target.value })}
                              rows={2}
                              placeholder="O que aconteceu ao testar"
                            />
                          </label>
                          <label>
                            Observação do teste
                            <textarea
                              value={resultado.observacaoTeste}
                              onChange={(e) => setResultado({ ...resultado, observacaoTeste: e.target.value })}
                              rows={2}
                              placeholder="Detalhe extra, sugestão de melhoria (opcional)"
                            />
                          </label>
                          <div className="testes-aprovado-escolha">
                            <button
                              type="button"
                              className={resultado.aprovado ? 'realizado-toggle-on' : 'realizado-toggle-off'}
                              onClick={() => setResultado({ ...resultado, aprovado: true })}
                            >
                              ✓ Aprovado
                            </button>
                            <button
                              type="button"
                              className={!resultado.aprovado ? 'testes-reprovado-on' : 'realizado-toggle-off'}
                              onClick={() => setResultado({ ...resultado, aprovado: false })}
                            >
                              ✕ Reprovado
                            </button>
                          </div>
                          <label>
                            Seu nome
                            <input
                              value={resultado.nomeTeste}
                              onChange={(e) => setResultado({ ...resultado, nomeTeste: e.target.value })}
                            />
                          </label>
                          {erroResultado && <p className="aviso-erro">{erroResultado}</p>}
                          <div className="testes-form-botoes">
                            <button type="submit" disabled={registrando}>
                              {registrando ? 'Salvando…' : 'Salvar resultado'}
                            </button>
                            <button type="button" className="link-secundario" onClick={() => setIdEmTeste(null)}>
                              Cancelar
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ))}
                </>
              )}

              {testados.length > 0 && (
                <>
                  <p className="testes-secao-titulo">Testados ({testados.length})</p>
                  {testados.map((item) => (
                    <div key={item.id} className="backlog-item">
                      <div className="backlog-item-topo">
                        <b>
                          {item.tela} · {item.funcionalidade}
                        </b>
                        <span className={item.aprovado ? 'realizado-toggle-on' : 'testes-reprovado-on'}>
                          {item.aprovado ? '✓ Aprovado' : '✕ Reprovado'}
                        </span>
                      </div>
                      {item.resultadoTeste && <p className="backlog-item-texto">{item.resultadoTeste}</p>}
                      {item.observacaoTeste && <p className="backlog-item-obs">{item.observacaoTeste}</p>}
                      <p className="backlog-item-rodape">
                        Testado por {item.nomeTeste} · cadastrado por {item.nomeCadastro}
                      </p>
                      <button type="button" className="link-secundario" onClick={() => reabrir(item.id)}>
                        Reabrir (testar de novo)
                      </button>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
