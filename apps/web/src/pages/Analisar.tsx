// apps/web/src/pages/Analisar.tsx
//
// Tela 1 do calc-app (Fase 1): coleta origem/destino/valor/custos e chama
// o motor puro @rode/calc. O cálculo em si nunca depende de rede — só a
// distância (route-cost) e o salvamento final dependem de rede, e ambos
// têm caminho manual/offline-tolerante.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calcularFrete, parseNumeroPtBR } from '@rode/calc';
import { supabase } from '../lib/supabaseClient';
import {
  carregarPerfil,
  diasPorFaixaKm,
  perfilParaCustos,
  PERFIL_DEFAULT,
  type CaminhaoPerfil,
} from '../lib/frete';

export default function Analisar() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<CaminhaoPerfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [distanciaKm, setDistanciaKm] = useState('');
  const [distanciaEstimada, setDistanciaEstimada] = useState(true);
  const [buscandoRota, setBuscandoRota] = useState(false);
  const [avisoRota, setAvisoRota] = useState<string | null>(null);

  const [valorFrete, setValorFrete] = useState('');
  const [voltaVazia, setVoltaVazia] = useState(false);
  const [margemDesejada, setMargemDesejada] = useState(20);
  const [dias, setDias] = useState(1);
  const [diasEditadoManual, setDiasEditadoManual] = useState(false);

  const [mostrarAvancado, setMostrarAvancado] = useState(false);
  const [numeroEixos, setNumeroEixos] = useState(5);
  const [dieselKmPorLt, setDieselKmPorLt] = useState(2.5);
  const [dieselPreco, setDieselPreco] = useState(6.1);
  const [arlaKmPorLt, setArlaKmPorLt] = useState(20);
  const [arlaPreco, setArlaPreco] = useState(4.5);
  const [pedagio, setPedagio] = useState('0');
  const [pedagioEditadoManual, setPedagioEditadoManual] = useState(false);
  const [pedagioCarroCentavos, setPedagioCarroCentavos] = useState<number | null>(null);
  const [estacionamento, setEstacionamento] = useState('0');
  const [chapa, setChapa] = useState('0');
  const [manutencaoPorKm, setManutencaoPorKm] = useState(0.35);
  const [pneusPorKm, setPneusPorKm] = useState(0.12);
  const [depreciacaoPorKm, setDepreciacaoPorKm] = useState(0.25);

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
        setPerfil(p);
        setNumeroEixos(p.numero_eixos);
        setDieselKmPorLt(p.diesel_km_por_lt);
        setDieselPreco(p.diesel_preco_por_litro);
        setArlaKmPorLt(p.arla_km_por_lt);
        setArlaPreco(p.arla_preco_por_litro);
        setEstacionamento(String(p.estacionamento_padrao));
        setChapa(String(p.chapa_padrao));
        setManutencaoPorKm(p.manutencao_por_km);
        setPneusPorKm(p.pneus_por_km);
        setDepreciacaoPorKm(p.depreciacao_por_km);
        setMargemDesejada(p.margem_desejada);
      } else {
        setNumeroEixos(PERFIL_DEFAULT.numero_eixos);
        setDieselKmPorLt(PERFIL_DEFAULT.diesel_km_por_lt);
        setDieselPreco(PERFIL_DEFAULT.diesel_preco_por_litro);
        setArlaKmPorLt(PERFIL_DEFAULT.arla_km_por_lt);
        setArlaPreco(PERFIL_DEFAULT.arla_preco_por_litro);
        setManutencaoPorKm(PERFIL_DEFAULT.manutencao_por_km);
        setPneusPorKm(PERFIL_DEFAULT.pneus_por_km);
        setDepreciacaoPorKm(PERFIL_DEFAULT.depreciacao_por_km);
        setMargemDesejada(PERFIL_DEFAULT.margem_desejada);
      }
      setCarregando(false);
    });
  }, [navigate]);

  // Auto-preenche dias por faixa de km, mas só enquanto o motorista não
  // tiver editado o campo manualmente.
  useEffect(() => {
    const km = parseNumeroPtBR(distanciaKm);
    if (km > 0 && !diasEditadoManual) {
      setDias(diasPorFaixaKm(km));
    }
  }, [distanciaKm, diasEditadoManual]);

  async function buscarDistancia(origemAtual: string, destinoAtual: string) {
    setBuscandoRota(true);
    setAvisoRota(null);
    try {
      const { data, error } = await supabase.functions.invoke('route-cost', {
        body: { origem: origemAtual, destino: destinoAtual },
      });
      if (error || !data || typeof data.distanciaKm !== 'number') {
        setAvisoRota('Distância automática indisponível agora — digite manualmente.');
        setDistanciaEstimada(true);
        return;
      }
      setDistanciaKm(String(data.distanciaKm));
      setDistanciaEstimada(Boolean(data.distanciaEstimada));
      if (typeof data.pedagioCentavos === 'number') {
        setPedagioCarroCentavos(data.pedagioCentavos);
        setPedagioEditadoManual(false);
      } else {
        setPedagioCarroCentavos(null);
      }
      setAvisoRota(data.fonte === 'cache' ? null : 'Distância calculada via Google Routes.');
    } catch {
      setAvisoRota('Distância automática indisponível agora — digite manualmente.');
      setDistanciaEstimada(true);
    } finally {
      setBuscandoRota(false);
    }
  }

  // Busca a distância sozinho 600ms depois que o motorista para de digitar
  // origem/destino (debounce) — sem botão manual. O motorista ainda pode
  // sobrescrever o km na mão a qualquer momento.
  useEffect(() => {
    const o = origem.trim();
    const d = destino.trim();
    if (!o || !d) return;
    const t = setTimeout(() => {
      buscarDistancia(o, d);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origem, destino]);

  // O valor que o Google devolve é tarifa de carro. No Brasil o pedágio é
  // cobrado por eixo e um carro de passeio equivale a 2 eixos — então a
  // regra usual (a mesma praticada por concessionárias como ARTESP/CCR/EPR)
  // é: tarifa_caminhão = tarifa_carro × (número_de_eixos / 2). Reajusta
  // sozinho quando a rota ou o número de eixos mudam, mas para de mexer
  // assim que o motorista edita o campo na mão.
  useEffect(() => {
    if (pedagioCarroCentavos == null || pedagioEditadoManual) return;
    const centavosCaminhao = Math.round(pedagioCarroCentavos * (numeroEixos / 2));
    setPedagio(String(centavosCaminhao / 100));
  }, [pedagioCarroCentavos, numeroEixos, pedagioEditadoManual]);

  function calcularEIr() {
    const km = parseNumeroPtBR(distanciaKm);
    const valor = parseNumeroPtBR(valorFrete);
    if (km <= 0 || valor <= 0) return;

    const custos = perfilParaCustos(
      {
        id: perfil?.id ?? '',
        user_id: userId ?? '',
        apelido: null,
        ano: null,
        valor_caminhao: null,
        numero_eixos: numeroEixos,
        diesel_km_por_lt: dieselKmPorLt,
        diesel_preco_por_litro: dieselPreco,
        arla_km_por_lt: arlaKmPorLt,
        arla_preco_por_litro: arlaPreco,
        manutencao_por_km: manutencaoPorKm,
        pneus_por_km: pneusPorKm,
        depreciacao_por_km: depreciacaoPorKm,
        alimentacao_dia: perfil?.alimentacao_dia ?? PERFIL_DEFAULT.alimentacao_dia,
        pernoite_dia: perfil?.pernoite_dia ?? PERFIL_DEFAULT.pernoite_dia,
        estacionamento_padrao: parseNumeroPtBR(estacionamento),
        chapa_padrao: parseNumeroPtBR(chapa),
        margem_desejada: margemDesejada,
        uf_base: null,
      },
      dias,
      parseNumeroPtBR(pedagio),
    );

    const resultado = calcularFrete({
      origem,
      destino,
      distanciaKm: km,
      valorFrete: valor,
      voltaVazia,
      margemDesejada,
      custos,
      distanciaEstimada,
      numeroEixos,
    });

    navigate('/resultado', {
      state: {
        resultado,
        custos,
        distanciaEstimada,
        dias,
        caminhaoPerfilId: perfil?.id ?? null,
      },
    });
  }

  if (carregando) return null;

  const podeCalcular = parseNumeroPtBR(distanciaKm) > 0 && parseNumeroPtBR(valorFrete) > 0;

  return (
    <main className="tela tela-analisar">
      <h1>Analisar frete</h1>

      <label>
        Origem
        <input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex.: São Paulo, SP" />
      </label>

      <label>
        Destino
        <input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ex.: Recife, PE" />
      </label>

      <label>
        Distância (km) {buscandoRota ? '— buscando...' : distanciaEstimada && distanciaKm ? '— estimativa manual' : ''}
        <input
          inputMode="decimal"
          value={distanciaKm}
          onChange={(e) => {
            setDistanciaKm(e.target.value);
            setDistanciaEstimada(true);
          }}
          placeholder="Preenchido automaticamente ao digitar origem/destino"
        />
      </label>

      <label>
        Pedágio de ida (R$) {buscandoRota ? '— buscando...' : ''}
        <input
          inputMode="decimal"
          value={pedagio}
          onChange={(e) => {
            setPedagio(e.target.value);
            setPedagioEditadoManual(true);
          }}
          placeholder="Ex.: 45,00"
        />
      </label>
      {!buscandoRota && distanciaKm && pedagio === '0' && (
        <p className="aviso">
          Não veio pedágio automático pra essa rota (ou é uma via sem cobertura da API) — confere e ajusta na mão se souber o valor.
        </p>
      )}
      {pedagioCarroCentavos != null && !pedagioEditadoManual && (
        <p className="aviso">
          Já ajustado pros seus {numeroEixos} eixos (o Google devolve tarifa de carro — pedágio no Brasil é cobrado por eixo, carro
          equivale a 2). Pode variar por concessionária; ajuste como preferir.
        </p>
      )}

      {avisoRota && <p className="aviso">{avisoRota}</p>}

      <label>
        Valor do frete (R$)
        <input inputMode="decimal" value={valorFrete} onChange={(e) => setValorFrete(e.target.value)} placeholder="Ex.: 8000" />
      </label>

      <label className="campo-toggle">
        <input type="checkbox" role="switch" checked={voltaVazia} onChange={(e) => setVoltaVazia(e.target.checked)} />
        Volta vazia (sem carga de retorno)
      </label>

      <label>
        Margem desejada: {margemDesejada}%
        <input
          type="range"
          min={5}
          max={40}
          step={1}
          value={margemDesejada}
          onChange={(e) => setMargemDesejada(Number(e.target.value))}
        />
      </label>

      <label>
        Dias de viagem
        <input
          type="number"
          min={0}
          value={dias}
          onChange={(e) => {
            setDias(Number(e.target.value));
            setDiasEditadoManual(true);
          }}
        />
      </label>

      <button type="button" className="link-secundario" onClick={() => setMostrarAvancado((v) => !v)}>
        {mostrarAvancado ? 'Ocultar' : 'Ajustar'} parâmetros do caminhão e custos
      </button>

      {mostrarAvancado && (
        <div className="accordion-custos">
          <label>
            Número de eixos
            <input type="number" min={2} max={9} value={numeroEixos} onChange={(e) => setNumeroEixos(Number(e.target.value))} />
          </label>
          <label>
            Consumo diesel (km/L)
            <input type="number" step="0.1" value={dieselKmPorLt} onChange={(e) => setDieselKmPorLt(Number(e.target.value))} />
          </label>
          <label>
            Preço diesel (R$/L)
            <input type="number" step="0.01" value={dieselPreco} onChange={(e) => setDieselPreco(Number(e.target.value))} />
          </label>
          <label>
            Consumo ARLA 32 (km/L)
            <input type="number" step="0.1" value={arlaKmPorLt} onChange={(e) => setArlaKmPorLt(Number(e.target.value))} />
          </label>
          <label>
            Preço ARLA 32 (R$/L)
            <input type="number" step="0.01" value={arlaPreco} onChange={(e) => setArlaPreco(Number(e.target.value))} />
          </label>
          <label>
            Estacionamento (R$)
            <input inputMode="decimal" value={estacionamento} onChange={(e) => setEstacionamento(e.target.value)} />
          </label>
          <label>
            Chapa (R$)
            <input inputMode="decimal" value={chapa} onChange={(e) => setChapa(e.target.value)} />
          </label>
          <label>
            Manutenção (R$/km)
            <input type="number" step="0.01" value={manutencaoPorKm} onChange={(e) => setManutencaoPorKm(Number(e.target.value))} />
          </label>
          <label>
            Pneus (R$/km)
            <input type="number" step="0.01" value={pneusPorKm} onChange={(e) => setPneusPorKm(Number(e.target.value))} />
          </label>
          <label>
            Depreciação (R$/km)
            <input type="number" step="0.01" value={depreciacaoPorKm} onChange={(e) => setDepreciacaoPorKm(Number(e.target.value))} />
          </label>
        </div>
      )}

      <button type="button" disabled={!podeCalcular} onClick={calcularEIr}>
        Calcular
      </button>
    </main>
  );
}
