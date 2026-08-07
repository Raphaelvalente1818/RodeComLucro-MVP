// apps/web/src/pages/Resultado.tsx
//
// Tela 2 do calc-app (Fase 1): mostra o veredito (semáforo BOM/ACEITÁVEL/
// RUIM), KPIs, o detalhamento de custo ("para onde vai o dinheiro") e o
// botão Salvar, que grava em analise_frete (id gerado no cliente, upsert).
//
// Também funciona em "modo histórico": quando aberta via /resultado/:id
// (clique numa linha de "Últimas análises" na Garagem), carrega a análise
// já salva do banco (resultado_snapshot/custos_snapshot) em vez de esperar
// o estado de navegação de uma análise recém-calculada. Nesse modo o botão
// Salvar some (já está salva) e aparece a data do cálculo original.

import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Custos, FreteResultado } from '@rode/calc';
import { fmtBRL, fmtPct } from '@rode/calc';
import { supabase } from '../lib/supabaseClient';
import { explicarVeredicto, salvarAnalise, carregarAnalisePorId } from '../lib/frete';

interface EstadoRota {
  resultado?: FreteResultado;
  custos?: Custos;
  distanciaEstimada?: boolean;
  dias?: number;
  caminhaoPerfilId?: string | null;
}

const CORES: Record<FreteResultado['veredicto'], string> = {
  BOM: '#059669',
  'ACEITÁVEL': '#d97706',
  RUIM: '#dc2626',
};

const RUBRICAS: Array<[keyof FreteResultado['custoDetalhado'], string]> = [
  ['diesel', 'Diesel'],
  ['arla', 'ARLA 32'],
  ['pedagio', 'Pedágio'],
  ['alimentacao', 'Alimentação'],
  ['pernoite', 'Pernoite'],
  ['estacionamento', 'Estacionamento'],
  ['chapa', 'Chapa'],
  ['manutencao', 'Manutenção'],
  ['pneus', 'Pneus'],
  ['depreciacao', 'Depreciação'],
];

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Resultado() {
  const { id } = useParams<{ id: string }>();
  const { state } = useLocation();
  const navigate = useNavigate();
  const estadoRota = (state ?? {}) as EstadoRota;

  const modoHistorico = Boolean(id);

  const [carregandoHistorico, setCarregandoHistorico] = useState(modoHistorico);
  const [naoEncontrada, setNaoEncontrada] = useState(false);
  const [dados, setDados] = useState<{
    resultado?: FreteResultado;
    custos?: Custos;
    distanciaEstimada?: boolean;
    caminhaoPerfilId?: string | null;
    analisadoEm?: string;
  }>(modoHistorico ? {} : estadoRota);

  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  useEffect(() => {
    if (!modoHistorico || !id) return;
    carregarAnalisePorId(id).then((achada) => {
      if (!achada) {
        setNaoEncontrada(true);
        setCarregandoHistorico(false);
        return;
      }
      setDados({
        resultado: achada.resultado,
        custos: achada.custos,
        distanciaEstimada: achada.distanciaEstimada,
        caminhaoPerfilId: achada.caminhaoPerfilId,
        analisadoEm: achada.createdAt,
      });
      setCarregandoHistorico(false);
    });
  }, [modoHistorico, id]);

  if (carregandoHistorico) return null;

  if (naoEncontrada) {
    return (
      <main className="tela tela-resultado">
        <h1>Análise não encontrada</h1>
        <p className="aviso">Essa análise não existe mais ou não pertence a esta conta.</p>
        <button type="button" onClick={() => navigate('/')}>
          Voltar para a Garagem
        </button>
      </main>
    );
  }

  const { resultado, custos, distanciaEstimada, caminhaoPerfilId, analisadoEm } = dados;

  if (!resultado || !custos) {
    navigate('/analisar', { replace: true });
    return null;
  }

  async function salvar() {
    setSalvando(true);
    setErroSalvar(null);
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) {
        navigate('/entrar', { replace: true });
        return;
      }
      const { error } = await salvarAnalise(userId, {
        origem: resultado!.entrada.origem,
        destino: resultado!.entrada.destino,
        distanciaKm: resultado!.entrada.distanciaKm,
        distanciaEstimada: Boolean(distanciaEstimada),
        voltaVazia: resultado!.entrada.voltaVazia,
        valorFreteCentavos: Math.round(resultado!.entrada.valorFrete * 100),
        margemDesejada: resultado!.entrada.margemDesejada,
        numeroEixos: resultado!.entrada.numeroEixos,
        custos: custos!,
        resultado: resultado!,
        caminhaoPerfilId,
      });
      if (error) {
        setErroSalvar(error);
        return;
      }
      setSalvo(true);
    } finally {
      setSalvando(false);
    }
  }

  const cor = CORES[resultado.veredicto];

  return (
    <main className="tela tela-resultado">
      <h1>Resultado</h1>

      {modoHistorico && analisadoEm && <p className="aviso">Analisado em {fmtDataHora(analisadoEm)}</p>}

      <p className="linha-analise-rota" style={{ margin: 0 }}>
        {resultado.entrada.origem} → {resultado.entrada.destino}
      </p>

      <div className="chip-veredicto" style={{ backgroundColor: cor }}>
        {resultado.veredicto}
      </div>

      <p className="conselho">{explicarVeredicto(resultado)}</p>

      <div className="kpis">
        <div className="kpi">
          <span>Valor do frete</span>
          <b>{fmtBRL(resultado.entrada.valorFrete)}</b>
        </div>
        <div className="kpi">
          <span>{resultado.lucro >= 0 ? 'Lucro provável' : 'Prejuízo provável'}</span>
          <b>{fmtBRL(Math.abs(resultado.lucro))}</b>
        </div>
        <div className="kpi">
          <span>Custo estimado</span>
          <b>{fmtBRL(resultado.custoTotal)}</b>
        </div>
        <div className="kpi">
          <span>Margem real</span>
          <b>{fmtPct(resultado.margemReal)}</b>
        </div>
        <div className="kpi">
          <span>Piso mínimo ANTT</span>
          <b>{fmtBRL(resultado.pisoANTT)}</b>
        </div>
        <div className="kpi">
          <span>Negocie a partir de</span>
          <b>{fmtBRL(resultado.custoTotal * (1 + resultado.entrada.margemDesejada / 100))}</b>
        </div>
      </div>

      {distanciaEstimada && (
        <p className="aviso">Distância informada manualmente — não veio de uma consulta ao vivo.</p>
      )}

      <h2>Para onde vai o dinheiro</h2>
      <ul className="detalhamento">
        {RUBRICAS.map(([chave, rotulo]) => (
          <li key={chave}>
            <span>{rotulo}</span>
            <span>{fmtBRL(resultado.custoDetalhado[chave])}</span>
          </li>
        ))}
      </ul>

      <p className="disclaimer">
        Estimativa com base em modelo de custo transparente. O piso ANTT é referência regulatória; este
        veredito não é aconselhamento jurídico ou financeiro.
      </p>

      {modoHistorico ? (
        <button type="button" onClick={() => navigate('/')}>
          Voltar para a Garagem
        </button>
      ) : (
        <>
          {salvo ? (
            <p className="sucesso">Análise salva.</p>
          ) : (
            <button type="button" disabled={salvando} onClick={salvar}>
              {salvando ? 'Salvando...' : 'Salvar análise'}
            </button>
          )}
          {erroSalvar && <p className="aviso-erro">Não foi possível salvar: {erroSalvar}</p>}

          <button type="button" className="link-secundario" onClick={() => navigate('/analisar')}>
            Nova análise
          </button>
          <button type="button" className="link-secundario" onClick={() => navigate('/')}>
            Voltar para a Garagem
          </button>
        </>
      )}
    </main>
  );
}
