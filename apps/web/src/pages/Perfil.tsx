// apps/web/src/pages/Perfil.tsx
//
// Tela 3 do calc-app (Fase 1): dados do caminhão (consumo, custos/km,
// margem desejada) usados como default na tela Analisar. Upsert único por
// user_id (um perfil por motorista, por enquanto).
//
// Marca -> Modelo -> Ano vem da Tabela FIPE (lib/fipe.ts): é a FIPE que
// restringe de verdade as opções ao que existiu no mercado — a lista de
// anos é por MODELO (não um intervalo genérico). Ordem real da FIPE é
// marca->modelo->ano (não marca->ano->modelo: a API não tem esse
// caminho). Ao escolher o ano, preenche sozinho o valor do caminhão (FIPE
// do ano escolhido) e a depreciação por km (diferença de valor FIPE entre
// esse ano e o ano anterior do mesmo modelo, dividida pelos km rodados
// por ano). Consumo de diesel/ARLA e a taxa de manutenção por idade ainda
// usam o catálogo estático da calculadora do Emerson (@rode/calc),
// casado por nome com o que a FIPE devolveu — ver encontrarModeloEstatico
// em lib/fipe.ts. Tudo com fallback manual se a FIPE estiver fora do ar.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { carregarPerfil, salvarPerfil, PERFIL_DEFAULT, type CaminhaoPerfil } from '../lib/frete';
import { track } from '../lib/track';
import type { ModeloCaminhao, TipoVeiculo, TipoCarroceria } from '@rode/calc';
import { VEICULOS, CARROCERIAS, eixosPorCarroceria } from '@rode/calc';
import {
  buscarMarcasFipe,
  buscarModelosFipe,
  buscarAnosFipe,
  buscarValorFipe,
  anoDoItem,
  encontrarModeloEstatico,
  type FipeItem,
} from '../lib/fipe';

/**
 * Taxas de manutenção por km segundo idade do veículo e categoria do
 * modelo (pesado/semipesado/médio-leve): faixas ≤1, ≤5, ≤10, >10 anos.
 * Extraído de calculadora-experimental (mesma lógica, sem alteração de
 * valores).
 */
const TAXAS_MANUTENCAO_POR_IDADE: Record<ModeloCaminhao['categoria'], readonly [number, number, number, number]> = {
  pesado: [0.2, 0.35, 0.5, 0.7],
  semipesado: [0.16, 0.28, 0.4, 0.56],
  medio_leve: [0.12, 0.2, 0.3, 0.42],
};

type FormPerfil = Omit<CaminhaoPerfil, 'id' | 'user_id'>;

export default function Perfil() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [perfilId, setPerfilId] = useState<string | undefined>(undefined);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // "Apagar dados do caminhão" — pra quando o motorista troca de caminhão.
  // Reseta o perfil pra PERFIL_DEFAULT (mesmo estado de um perfil novo),
  // com confirmação antes de executar (ação irreversível).
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [apagando, setApagando] = useState(false);

  const [form, setForm] = useState<FormPerfil>(PERFIL_DEFAULT);

  // Autocomplete marca -> modelo -> ano via FIPE. Booleans só controlam
  // quando mostrar sugestões/select — o valor de verdade continua em
  // form.marca/form.modelo/form.ano/form.fipe_codigo_*.
  const [marcaConfirmada, setMarcaConfirmada] = useState(false);
  const [modeloConfirmado, setModeloConfirmado] = useState(false);
  const [manutencaoEditadaManualmente, setManutencaoEditadaManualmente] = useState(false);
  const [valorEditadoManualmente, setValorEditadoManualmente] = useState(false);
  const [depreciacaoEditadaManualmente, setDepreciacaoEditadaManualmente] = useState(false);
  const [eixosEditadoManualmente, setEixosEditadoManualmente] = useState(false);

  const [marcasFipe, setMarcasFipe] = useState<FipeItem[]>([]);
  const [modelosFipe, setModelosFipe] = useState<FipeItem[]>([]);
  const [anosFipe, setAnosFipe] = useState<FipeItem[]>([]);
  const [carregandoModelos, setCarregandoModelos] = useState(false);
  const [carregandoAnos, setCarregandoAnos] = useState(false);
  const [carregandoValor, setCarregandoValor] = useState(false);
  const [avisoFipe, setAvisoFipe] = useState<string | null>(null);
  const [fipeMesReferencia, setFipeMesReferencia] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) {
        navigate('/entrar', { replace: true });
        return;
      }
      setUserId(uid);
      const p = await carregarPerfil(uid);
      if (p) {
        setPerfilId(p.id);
        const { id: _id, user_id: _uid, ...resto } = p;
        setForm(resto);
        setMarcaConfirmada(Boolean(resto.marca));
        setModeloConfirmado(Boolean(resto.modelo));
      }
      setCarregando(false);
    });
    buscarMarcasFipe().then((lista) => {
      if (lista.length === 0) setAvisoFipe('Tabela FIPE indisponível agora — digite marca/modelo/ano manualmente.');
      setMarcasFipe(lista);
    });
  }, [navigate]);

  function campo<K extends keyof FormPerfil>(chave: K, valor: FormPerfil[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
    setSalvo(false);
  }

  // Modelos da marca escolhida, buscados uma vez quando o código FIPE da marca muda.
  useEffect(() => {
    if (!form.fipe_codigo_marca) {
      setModelosFipe([]);
      return;
    }
    setCarregandoModelos(true);
    buscarModelosFipe(form.fipe_codigo_marca).then((lista) => {
      setModelosFipe(lista);
      setCarregandoModelos(false);
    });
  }, [form.fipe_codigo_marca]);

  // Anos realmente disponíveis PARA AQUELE MODELO — buscados quando o código FIPE do modelo muda.
  useEffect(() => {
    if (!form.fipe_codigo_marca || !form.fipe_codigo_modelo) {
      setAnosFipe([]);
      return;
    }
    setCarregandoAnos(true);
    buscarAnosFipe(form.fipe_codigo_marca, form.fipe_codigo_modelo).then((lista) => {
      setAnosFipe(lista);
      setCarregandoAnos(false);
    });
  }, [form.fipe_codigo_marca, form.fipe_codigo_modelo]);

  const sugestoesMarca = useMemo(() => {
    if (marcaConfirmada || !form.marca || form.marca.length < 1) return [];
    const q = form.marca.toLowerCase();
    return marcasFipe.filter((m) => m.nome.toLowerCase().includes(q)).slice(0, 6);
  }, [form.marca, marcaConfirmada, marcasFipe]);

  const sugestoesModelo = useMemo(() => {
    if (!form.fipe_codigo_marca || modeloConfirmado || !form.modelo || form.modelo.length < 1) return [];
    const q = form.modelo.toLowerCase();
    return modelosFipe.filter((m) => m.nome.toLowerCase().includes(q)).slice(0, 8);
  }, [form.fipe_codigo_marca, form.modelo, modeloConfirmado, modelosFipe]);

  const placeholderModelo = useMemo(() => {
    if (!form.fipe_codigo_marca) return 'Selecione uma marca primeiro';
    if (carregandoModelos) return 'Carregando modelos da FIPE...';
    if (modelosFipe.length === 0) return 'Digite o modelo';
    return modelosFipe.slice(0, 2).map((m) => m.nome).join(', ') + '...';
  }, [form.fipe_codigo_marca, carregandoModelos, modelosFipe]);

  function selecionarMarca(item: FipeItem) {
    campo('marca', item.nome);
    campo('fipe_codigo_marca', item.codigo);
    setMarcaConfirmada(true);
    campo('modelo', null);
    campo('fipe_codigo_modelo', null);
    campo('fipe_codigo_ano', null);
    setModeloConfirmado(false);
  }

  function selecionarModelo(item: FipeItem) {
    campo('modelo', item.nome);
    campo('fipe_codigo_modelo', item.codigo);
    campo('fipe_codigo_ano', null);
    setModeloConfirmado(true);
    setManutencaoEditadaManualmente(false);

    // Best-effort: casa com o catálogo estático (Emerson) pra sugerir consumo — se não achar, fica no que já estava.
    const match = encontrarModeloEstatico(form.marca ?? item.nome, item.nome);
    if (match) {
      campo('diesel_km_por_lt', match.consumoDieselKmL);
      if (match.consumoArlaKmL !== null) campo('arla_km_por_lt', match.consumoArlaKmL);
    }
  }

  /**
   * Busca o valor FIPE do ano escolhido (+ ano anterior, pra depreciação
   * real) e aplica no form — respeitando edição manual do motorista.
   * Compartilhado entre `selecionarAno` (clique no select "Ano de
   * fabricação") e o autofill automático abaixo (quando o motorista digita
   * o ano direto no campo "Ano do caminhão", sem passar pelo select).
   */
  async function buscarEAplicarValorAno(codigoMarca: string, codigoModelo: string, item: FipeItem, anoNumero: number | null) {
    setCarregandoValor(true);
    setFipeMesReferencia(null);

    const valorAtual = await buscarValorFipe(codigoMarca, codigoModelo, item.codigo);
    if (valorAtual) {
      setFipeMesReferencia(valorAtual.mesReferencia);
      if (!valorEditadoManualmente) campo('valor_caminhao', valorAtual.valor);

      // Depreciação real: valor deste ano menos valor do mesmo modelo um ano mais velho, dividido pelos km/ano.
      if (anoNumero) {
        const itemAnoAnterior = anosFipe.find((a) => anoDoItem(a) === anoNumero - 1);
        if (itemAnoAnterior) {
          const valorAnterior = await buscarValorFipe(codigoMarca, codigoModelo, itemAnoAnterior.codigo);
          const kmAno = form.km_rodados_ano;
          if (valorAnterior && kmAno && kmAno > 0 && !depreciacaoEditadaManualmente) {
            const depreciacaoAnual = Math.max(0, valorAtual.valor - valorAnterior.valor);
            campo('depreciacao_por_km', Math.round((depreciacaoAnual / kmAno) * 100) / 100);
          }
        }
      }
    }
    setCarregandoValor(false);
  }

  async function selecionarAno(item: FipeItem) {
    campo('fipe_codigo_ano', item.codigo);
    const anoNumero = anoDoItem(item);
    if (anoNumero) campo('ano', anoNumero);

    if (!form.fipe_codigo_marca || !form.fipe_codigo_modelo) return;
    await buscarEAplicarValorAno(form.fipe_codigo_marca, form.fipe_codigo_modelo, item, anoNumero);
  }

  // Autofill automático do valor/depreciação: cobre o caso de o motorista
  // digitar o ano direto no campo "Ano do caminhão" (em vez de escolher no
  // select "Ano de fabricação — Tabela FIPE"), desde que marca e modelo já
  // tenham vindo de uma sugestão da FIPE e aquele ano exista no catálogo.
  // Sem isso, quem não percebe/usa o select nunca tinha o valor preenchido
  // sozinho — foi o que o Emerson reportou no backlog de testes.
  useEffect(() => {
    if (!form.fipe_codigo_marca || !form.fipe_codigo_modelo) return;
    if (!form.ano || anosFipe.length === 0) return;
    const item = anosFipe.find((a) => anoDoItem(a) === form.ano);
    if (!item || form.fipe_codigo_ano === item.codigo) return;
    campo('fipe_codigo_ano', item.codigo);
    buscarEAplicarValorAno(form.fipe_codigo_marca, form.fipe_codigo_modelo, item, form.ano);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.fipe_codigo_marca, form.fipe_codigo_modelo, form.ano, anosFipe]);

  // Recalcula manutencao_por_km por idade do veiculo (categoria do
  // modelo casado no catálogo estático -> taxa por faixa etária)
  // enquanto o motorista não tiver editado o campo na mão.
  useEffect(() => {
    if (manutencaoEditadaManualmente) return;
    if (!form.ano) return;
    const item = encontrarModeloEstatico(form.marca, form.modelo);
    if (!item) return;
    const anoAtual = new Date().getFullYear();
    if (form.ano < 1950 || form.ano > anoAtual) return;
    const idade = Math.max(0, anoAtual - form.ano);
    const taxas = TAXAS_MANUTENCAO_POR_IDADE[item.categoria];
    const custo = idade <= 1 ? taxas[0] : idade <= 5 ? taxas[1] : idade <= 10 ? taxas[2] : taxas[3];
    campo('manutencao_por_km', custo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.marca, form.modelo, form.ano, manutencaoEditadaManualmente]);

  // Selecionar/desselecionar (clique de novo desmarca) tipo de veículo e
  // carroceria — mesmo padrão de chip do Emerson. Escolher a carroceria
  // sugere numeroEixos (eixosPorCarroceria), a não ser que o motorista já
  // tenha editado esse campo na mão.
  function selecionarTipoVeiculo(op: TipoVeiculo) {
    campo('tipo_veiculo', form.tipo_veiculo === op ? null : op);
  }

  function selecionarTipoCarroceria(op: TipoCarroceria) {
    const novo = form.tipo_carroceria === op ? null : op;
    campo('tipo_carroceria', novo);
    if (novo && !eixosEditadoManualmente) {
      const eixosSugerido = eixosPorCarroceria[novo];
      if (eixosSugerido !== undefined) campo('numero_eixos', eixosSugerido);
    }
  }

  async function salvar() {
    if (!userId) return;
    setSalvando(true);
    setErro(null);
    const primeiroCadastro = !perfilId;
    const { error } = await salvarPerfil(userId, form, perfilId);
    setSalvando(false);
    if (error) {
      setErro(error);
      return;
    }
    void track('truck_profile_saved', {
      primeiro_cadastro: primeiroCadastro,
      tipo_veiculo: form.tipo_veiculo,
      tipo_carroceria: form.tipo_carroceria,
      marca: form.marca,
      modelo: form.modelo,
      ano: form.ano,
    });
    setSalvo(true);
  }

  /**
   * Reseta o perfil pra PERFIL_DEFAULT (mesmo estado de um caminhão novo,
   * nunca cadastrado) — usado quando o motorista troca de caminhão. Não
   * apaga a linha do banco (mantém o mesmo `perfilId`), só limpa os
   * valores: análises já salvas guardam seu próprio custos_snapshot, então
   * não são afetadas por isso. As sugestões de marca/modelo/ano (Tabela
   * FIPE) continuam funcionando normalmente pra cadastrar o caminhão novo
   * — não dependem do que foi apagado aqui.
   */
  async function apagarDados() {
    if (!userId) return;
    setApagando(true);
    setErro(null);
    const { error } = await salvarPerfil(userId, PERFIL_DEFAULT, perfilId);
    setApagando(false);
    if (error) {
      setErro(error);
      return;
    }
    setForm(PERFIL_DEFAULT);
    setMarcaConfirmada(false);
    setModeloConfirmado(false);
    setManutencaoEditadaManualmente(false);
    setValorEditadoManualmente(false);
    setDepreciacaoEditadaManualmente(false);
    setEixosEditadoManualmente(false);
    setFipeMesReferencia(null);
    setConfirmarApagar(false);
    setSalvo(false);
  }

  if (carregando) return null;

  return (
    <main className="tela tela-perfil">
      <h1>Perfil do caminhão</h1>

      {avisoFipe && <p className="aviso">{avisoFipe}</p>}

      <label>
        Apelido
        <input value={form.apelido ?? ''} onChange={(e) => campo('apelido', e.target.value)} placeholder="Ex.: Scania vermelha" />
      </label>

      <label>
        Marca
        <input
          value={form.marca ?? ''}
          onChange={(e) => {
            campo('marca', e.target.value || null);
            campo('fipe_codigo_marca', null);
            setMarcaConfirmada(false);
          }}
          placeholder="Volvo, Scania, Mercedes-Benz..."
        />
      </label>
      {sugestoesMarca.length > 0 && (
        <ul className="sugestoes-box">
          {sugestoesMarca.map((item) => (
            <li key={item.codigo}>
              <button type="button" className="sugestao-item" onClick={() => selecionarMarca(item)}>
                {item.nome}
              </button>
            </li>
          ))}
        </ul>
      )}

      <label>
        Modelo
        <input
          value={form.modelo ?? ''}
          disabled={!form.fipe_codigo_marca}
          onChange={(e) => {
            campo('modelo', e.target.value || null);
            campo('fipe_codigo_modelo', null);
            setModeloConfirmado(false);
          }}
          placeholder={placeholderModelo}
        />
      </label>
      {sugestoesModelo.length > 0 && (
        <ul className="sugestoes-box">
          {sugestoesModelo.map((item) => (
            <li key={item.codigo}>
              <button type="button" className="sugestao-item" onClick={() => selecionarModelo(item)}>
                {item.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
      {modeloConfirmado && encontrarModeloEstatico(form.marca, form.modelo) && (
        <p className="aviso">Consumo de diesel/ARLA preenchido com valor de referência do modelo — edite se souber o real.</p>
      )}

      {form.fipe_codigo_modelo && (
        <label>
          Ano de fabricação (Tabela FIPE)
          <select
            value={form.fipe_codigo_ano ?? ''}
            onChange={(e) => {
              const item = anosFipe.find((a) => a.codigo === e.target.value);
              if (item) selecionarAno(item);
            }}
          >
            <option value="">{carregandoAnos ? 'Carregando anos...' : 'Selecione o ano'}</option>
            {anosFipe.map((item) => (
              <option key={item.codigo} value={item.codigo}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      {!carregandoAnos && form.fipe_codigo_modelo && anosFipe.length === 0 && (
        <p className="aviso">FIPE não tem anos catalogados pra esse modelo — informe o ano manualmente abaixo.</p>
      )}
      {carregandoValor && <p className="aviso">Buscando valor de mercado na FIPE...</p>}
      {fipeMesReferencia && !carregandoValor && (
        <p className="aviso">Valor e depreciação calculados com a Tabela FIPE de {fipeMesReferencia} — edite se preferir.</p>
      )}

      <div className="chip-secao">
        <p className="chip-secao-titulo">Tipo de veículo</p>
        {VEICULOS.map(({ categoria, opcoes }) => (
          <div key={categoria} className="chip-grupo">
            <p className="chip-grupo-label">{categoria}</p>
            <div className="chip-grid">
              {opcoes.map((op) => (
                <button
                  key={op}
                  type="button"
                  className={`chip ${form.tipo_veiculo === op ? 'chip-ativo' : ''}`}
                  onClick={() => selecionarTipoVeiculo(op)}
                >
                  {op}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="chip-secao">
        <p className="chip-secao-titulo">Tipo de carroceria</p>
        {CARROCERIAS.map(({ categoria, opcoes }) => (
          <div key={categoria} className="chip-grupo">
            <p className="chip-grupo-label">{categoria}</p>
            <div className="chip-grid">
              {opcoes.map((op) => (
                <button
                  key={op}
                  type="button"
                  className={`chip ${form.tipo_carroceria === op ? 'chip-ativo' : ''}`}
                  onClick={() => selecionarTipoCarroceria(op)}
                >
                  {op}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <label>
        Número de eixos
        <input
          type="number"
          min={2}
          max={9}
          value={form.numero_eixos}
          onChange={(e) => {
            setEixosEditadoManualmente(true);
            campo('numero_eixos', Number(e.target.value));
          }}
        />
      </label>
      {form.tipo_carroceria && !eixosEditadoManualmente && (
        <p className="aviso">Sugerido pela carroceria escolhida — edite se souber o real.</p>
      )}

      <label>
        Carga máxima (toneladas)
        <input
          type="number"
          step="0.1"
          min={0}
          value={form.carga_maxima_toneladas ?? ''}
          onChange={(e) => campo('carga_maxima_toneladas', e.target.value === '' ? null : Number(e.target.value))}
          placeholder="Ex.: 27"
        />
      </label>
      <p className="aviso">Usada para estimar o valor total de fretes cobrados por tonelada, na tela Buscar frete.</p>

      <label>
        Ano do caminhão
        <input
          type="number"
          min={1970}
          max={2100}
          value={form.ano ?? ''}
          onChange={(e) => campo('ano', e.target.value === '' ? null : Number(e.target.value))}
          placeholder="Ex.: 2018"
        />
      </label>

      <label>
        Km rodados por ano
        <input
          type="number"
          step="1000"
          min={0}
          value={form.km_rodados_ano ?? ''}
          onChange={(e) => campo('km_rodados_ano', e.target.value === '' ? null : Number(e.target.value))}
          placeholder="Ex.: 120000"
        />
      </label>

      <label>
        Valor do caminhão (R$)
        <input
          type="number"
          step="1000"
          min={0}
          value={form.valor_caminhao ?? ''}
          onChange={(e) => {
            setValorEditadoManualmente(true);
            campo('valor_caminhao', e.target.value === '' ? null : Number(e.target.value));
          }}
          placeholder="Ex.: 250000"
        />
      </label>

      <label>
        UF base
        <input
          value={form.uf_base ?? ''}
          maxLength={2}
          onChange={(e) => campo('uf_base', e.target.value.toUpperCase())}
          placeholder="Ex.: SP"
        />
      </label>

      <label>
        Consumo diesel (km/L)
        <input type="number" step="0.1" value={form.diesel_km_por_lt} onChange={(e) => campo('diesel_km_por_lt', Number(e.target.value))} />
      </label>

      <label>
        Preço diesel (R$/L)
        <input type="number" step="0.01" value={form.diesel_preco_por_litro} onChange={(e) => campo('diesel_preco_por_litro', Number(e.target.value))} />
      </label>

      <label>
        Consumo ARLA 32 (km/L)
        <input type="number" step="0.1" value={form.arla_km_por_lt} onChange={(e) => campo('arla_km_por_lt', Number(e.target.value))} />
      </label>

      <label>
        Preço ARLA 32 (R$/L)
        <input type="number" step="0.01" value={form.arla_preco_por_litro} onChange={(e) => campo('arla_preco_por_litro', Number(e.target.value))} />
      </label>

      <label>
        Manutenção (R$/km)
        <input
          type="number"
          step="0.01"
          value={form.manutencao_por_km}
          onChange={(e) => {
            setManutencaoEditadaManualmente(true);
            campo('manutencao_por_km', Number(e.target.value));
          }}
        />
      </label>
      {!manutencaoEditadaManualmente && modeloConfirmado && form.ano && (
        <p className="aviso">Ajustado automaticamente pela idade do veículo — edite se preferir.</p>
      )}

      <label>
        Próxima troca de óleo
        <input
          type="date"
          value={form.proxima_troca_oleo ?? ''}
          onChange={(e) => campo('proxima_troca_oleo', e.target.value || null)}
        />
      </label>
      <p className="aviso">Você recebe um alerta na Garagem uma semana antes de vencer.</p>

      <label>
        Pneus (R$/km)
        <input type="number" step="0.01" value={form.pneus_por_km} onChange={(e) => campo('pneus_por_km', Number(e.target.value))} />
      </label>

      <label>
        Depreciação (R$/km)
        <input
          type="number"
          step="0.01"
          value={form.depreciacao_por_km}
          onChange={(e) => {
            setDepreciacaoEditadaManualmente(true);
            campo('depreciacao_por_km', Number(e.target.value));
          }}
        />
      </label>
      {!depreciacaoEditadaManualmente && fipeMesReferencia && (
        <p className="aviso">Calculada a partir da variação de valor FIPE entre este ano e o anterior, dividida pelos km/ano.</p>
      )}

      <label>
        Alimentação por dia (R$)
        <input type="number" step="1" value={form.alimentacao_dia} onChange={(e) => campo('alimentacao_dia', Number(e.target.value))} />
      </label>

      <label>
        Pernoite por dia (R$)
        <input type="number" step="1" value={form.pernoite_dia} onChange={(e) => campo('pernoite_dia', Number(e.target.value))} />
      </label>

      <label>
        Estacionamento padrão (R$)
        <input type="number" step="1" value={form.estacionamento_padrao} onChange={(e) => campo('estacionamento_padrao', Number(e.target.value))} />
      </label>

      <label>
        Chapa padrão (R$)
        <input type="number" step="1" value={form.chapa_padrao} onChange={(e) => campo('chapa_padrao', Number(e.target.value))} />
      </label>

      <label>
        Margem desejada: {form.margem_desejada}%
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={form.margem_desejada}
          onChange={(e) => campo('margem_desejada', Number(e.target.value))}
        />
      </label>

      <button type="button" disabled={salvando} onClick={salvar}>
        {salvando ? 'Salvando...' : 'Salvar perfil'}
      </button>
      {salvo && <p className="sucesso">Perfil salvo.</p>}
      {erro && <p className="aviso-erro">Não foi possível salvar: {erro}</p>}

      <button type="button" className="botao-perigo" onClick={() => setConfirmarApagar(true)}>
        Apagar dados do caminhão
      </button>
      <p className="aviso">Use ao trocar de caminhão — limpa marca, modelo, custos e demais dados deste perfil.</p>

      <button type="button" className="link-secundario" onClick={() => navigate('/')}>
        Voltar
      </button>

      {confirmarApagar && (
        <div className="modal-overlay" onClick={() => !apagando && setConfirmarApagar(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Apagar dados do caminhão?</h2>
            <p className="aviso" style={{ margin: 0 }}>
              Isso limpa marca, modelo, ano, valor, tipo de veículo/carroceria, consumo e custos por km deste
              perfil — como se fosse um caminhão novo. Suas análises já salvas não são afetadas. Essa ação não
              tem volta.
            </p>
            {erro && <p className="aviso-erro">Não foi possível apagar: {erro}</p>}
            <button type="button" className="botao-perigo" disabled={apagando} onClick={apagarDados}>
              {apagando ? 'Apagando...' : 'Apagar dados do caminhão'}
            </button>
            <button type="button" className="link-secundario" disabled={apagando} onClick={() => setConfirmarApagar(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
