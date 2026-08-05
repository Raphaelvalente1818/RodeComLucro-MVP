// apps/web/src/pages/Perfil.tsx
//
// Tela 3 do calc-app (Fase 1): dados do caminhão (consumo, custos/km,
// margem desejada) usados como default na tela Analisar. Upsert único por
// user_id (um perfil por motorista, por enquanto).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { carregarPerfil, salvarPerfil, PERFIL_DEFAULT, type CaminhaoPerfil } from '../lib/frete';
import { caminhoes, marcas, type ModeloCaminhao } from '@rode/calc';

/**
 * Taxas de manutenção por km segundo idade do veículo e categoria do
 * modelo (pesado/semipesado/médio-leve): faixas ≤1, ≤5, ≤10, >10 anos.
 * Extraído de calculadora-experimental (mesma lógica, sem alteração de
 * valores) — recalcula manutencao_por_km automaticamente ao escolher
 * marca+modelo+ano, mas para de mexer assim que o motorista edita o
 * campo na mão (mesmo princípio já usado em dias de viagem/pedágio na
 * tela Analisar).
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

  const [form, setForm] = useState<FormPerfil>(PERFIL_DEFAULT);

  // Autocomplete marca -> modelo (ver Docs/status-sessao.md, 05/08, pro
  // contexto: portado da calculadora-experimental do Emerson). Booleans
  // só controlam quando mostrar a lista de sugestões — o valor de
  // verdade continua em form.marca/form.modelo.
  const [marcaConfirmada, setMarcaConfirmada] = useState(false);
  const [modeloConfirmado, setModeloConfirmado] = useState(false);
  const [manutencaoEditadaManualmente, setManutencaoEditadaManualmente] = useState(false);

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
  }, [navigate]);

  function campo<K extends keyof FormPerfil>(chave: K, valor: FormPerfil[K]) {
    setForm((f) => ({ ...f, [chave]: valor }));
    setSalvo(false);
  }

  const sugestoesMarca = useMemo(() => {
    if (marcaConfirmada || !form.marca || form.marca.length < 1) return [];
    const q = form.marca.toLowerCase();
    return marcas.filter((m) => m.toLowerCase().includes(q)).slice(0, 6);
  }, [form.marca, marcaConfirmada]);

  const sugestoesModelo = useMemo(() => {
    if (!form.marca || modeloConfirmado || !form.modelo || form.modelo.length < 1) return [];
    const q = form.modelo.toLowerCase();
    const lista = caminhoes[form.marca] ?? [];
    return lista.filter((m) => m.modelo.toLowerCase().includes(q)).slice(0, 6);
  }, [form.marca, form.modelo, modeloConfirmado]);

  const placeholderModelo = useMemo(() => {
    if (!form.marca) return 'Selecione uma marca primeiro';
    const lista = caminhoes[form.marca] ?? [];
    if (lista.length === 0) return 'Digite o modelo';
    return lista.slice(0, 3).map((m) => m.modelo).join(', ') + '...';
  }, [form.marca]);

  function selecionarMarca(m: string) {
    campo('marca', m);
    setMarcaConfirmada(true);
    campo('modelo', null);
    setModeloConfirmado(false);
  }

  function selecionarModelo(item: ModeloCaminhao) {
    campo('modelo', item.modelo);
    setModeloConfirmado(true);
    campo('diesel_km_por_lt', item.consumoDieselKmL);
    if (item.consumoArlaKmL !== null) {
      campo('arla_km_por_lt', item.consumoArlaKmL);
    }
    setManutencaoEditadaManualmente(false);
  }

  // Recalcula manutencao_por_km por idade do veiculo (marca+modelo+ano
  // -> categoria do modelo -> taxa por faixa etária) enquanto o
  // motorista não tiver editado o campo na mão.
  useEffect(() => {
    if (manutencaoEditadaManualmente) return;
    if (!form.marca || !form.modelo || !form.ano) return;
    const item = (caminhoes[form.marca] ?? []).find((m) => m.modelo === form.modelo);
    if (!item) return;
    const anoAtual = new Date().getFullYear();
    if (form.ano < 1950 || form.ano > anoAtual) return;
    const idade = Math.max(0, anoAtual - form.ano);
    const taxas = TAXAS_MANUTENCAO_POR_IDADE[item.categoria];
    const custo = idade <= 1 ? taxas[0] : idade <= 5 ? taxas[1] : idade <= 10 ? taxas[2] : taxas[3];
    campo('manutencao_por_km', custo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.marca, form.modelo, form.ano, manutencaoEditadaManualmente]);

  async function salvar() {
    if (!userId) return;
    setSalvando(true);
    setErro(null);
    const { error } = await salvarPerfil(userId, form, perfilId);
    setSalvando(false);
    if (error) {
      setErro(error);
      return;
    }
    setSalvo(true);
  }

  if (carregando) return null;

  return (
    <main className="tela tela-perfil">
      <h1>Perfil do caminhão</h1>

      <label>
        Marca
        <input
          value={form.marca ?? ''}
          onChange={(e) => {
            campo('marca', e.target.value || null);
            setMarcaConfirmada(false);
          }}
          placeholder="Volvo, Scania, Mercedes-Benz..."
        />
      </label>
      {sugestoesMarca.length > 0 && (
        <ul className="sugestoes-box">
          {sugestoesMarca.map((m) => (
            <li key={m}>
              <button type="button" className="sugestao-item" onClick={() => selecionarMarca(m)}>
                {m}
              </button>
            </li>
          ))}
        </ul>
      )}

      <label>
        Modelo
        <input
          value={form.modelo ?? ''}
          disabled={!form.marca}
          onChange={(e) => {
            campo('modelo', e.target.value || null);
            setModeloConfirmado(false);
          }}
          placeholder={placeholderModelo}
        />
      </label>
      {sugestoesModelo.length > 0 && (
        <ul className="sugestoes-box">
          {sugestoesModelo.map((item) => (
            <li key={item.modelo}>
              <button type="button" className="sugestao-item" onClick={() => selecionarModelo(item)}>
                {item.modelo}
              </button>
            </li>
          ))}
        </ul>
      )}
      {modeloConfirmado && (
        <p className="aviso">Consumo de diesel/ARLA preenchido com valor de referência do modelo — edite se souber o real.</p>
      )}

      <label>
        Apelido
        <input value={form.apelido ?? ''} onChange={(e) => campo('apelido', e.target.value)} placeholder="Ex.: Scania vermelha" />
      </label>

      <label>
        Número de eixos
        <input
          type="number"
          min={2}
          max={9}
          value={form.numero_eixos}
          onChange={(e) => campo('numero_eixos', Number(e.target.value))}
        />
      </label>

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
        Valor do caminhão (R$)
        <input
          type="number"
          step="1000"
          min={0}
          value={form.valor_caminhao ?? ''}
          onChange={(e) => campo('valor_caminhao', e.target.value === '' ? null : Number(e.target.value))}
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
        Pneus (R$/km)
        <input type="number" step="0.01" value={form.pneus_por_km} onChange={(e) => campo('pneus_por_km', Number(e.target.value))} />
      </label>

      <label>
        Depreciação (R$/km)
        <input type="number" step="0.01" value={form.depreciacao_por_km} onChange={(e) => campo('depreciacao_por_km', Number(e.target.value))} />
      </label>

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

      <button type="button" className="link-secundario" onClick={() => navigate('/')}>
        Voltar
      </button>
    </main>
  );
}
