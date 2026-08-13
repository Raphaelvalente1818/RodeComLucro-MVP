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
import { fmtBRL, fmtPct, TIPO_CARGA_LABEL } from '@rode/calc';
import { supabase } from '../lib/supabaseClient';
import { explicarVeredicto, salvarAnalise, carregarAnalisePorId } from '../lib/frete';
import { carregarMotorista } from '../lib/motorista';

/** Primeiro nome, ou null se vazio — usado pra deixar a saudação da mensagem de WhatsApp mais natural. */
function primeiroNome(nome: string | null | undefined): string | null {
  const p = nome?.trim().split(' ')[0];
  return p || null;
}

interface EstadoRota {
  resultado?: FreteResultado;
  custos?: Custos;
  distanciaEstimada?: boolean;
  dias?: number;
  caminhaoPerfilId?: string | null;
  /** Vem da tela Buscar Frete (via Analisar) quando a análise nasceu de um frete publicado — pré-preenche o popup de "Salvar análise" em vez do motorista redigitar. */
  contato?: {
    empresaNome: string | null;
    contatoNome: string | null;
    contatoTelefone: string | null;
  } | null;
  /** true quando o valor veio do modo "A negociar" (mínimo calculado pelo motorista pra bater a margem), não de uma oferta real da empresa. */
  valorACombinar?: boolean;
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
    empresaNome?: string | null;
    contatoNome?: string | null;
    contatoTelefone?: string | null;
    valorACombinar?: boolean;
  }>(modoHistorico ? {} : estadoRota);

  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  // Popup de contato (empresa/nome/telefone), aberto ao clicar "Salvar
  // análise" — pedido do Raphael pra achar o contato depois ao reabrir um
  // frete salvo.
  const [mostrarContato, setMostrarContato] = useState(false);
  // Pré-preenche com o contato do frete, se a análise veio da tela Buscar
  // Frete (ver Analisar.tsx) — o motorista ainda pode editar antes de salvar.
  const [empresaNome, setEmpresaNome] = useState(estadoRota.contato?.empresaNome ?? '');
  const [contatoNome, setContatoNome] = useState(estadoRota.contato?.contatoNome ?? '');
  const [contatoTelefone, setContatoTelefone] = useState(estadoRota.contato?.contatoTelefone ?? '');

  // Nome do motorista (perfil próprio) — usado só pra montar a mensagem
  // de WhatsApp ("Aqui é o Fulano, motorista"), não pro resto da tela.
  const [nomeMotorista, setNomeMotorista] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) return;
      carregarMotorista(uid).then((m) => setNomeMotorista(m?.nome ?? null));
    });
  }, []);

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
        empresaNome: achada.empresaNome,
        contatoNome: achada.contatoNome,
        contatoTelefone: achada.contatoTelefone,
        valorACombinar: achada.valorACombinar,
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

  const { resultado, custos, distanciaEstimada, caminhaoPerfilId, analisadoEm, empresaNome: empresaSalva, contatoNome: contatoSalvo, contatoTelefone: telefoneSalvo, valorACombinar } = dados;

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
        empresaNome,
        contatoNome,
        contatoTelefone,
        valorACombinar,
      });
      if (error) {
        setErroSalvar(error);
        return;
      }
      setMostrarContato(false);
      setSalvo(true);
    } finally {
      setSalvando(false);
    }
  }

  const cor = CORES[resultado.veredicto];

  // Mensagem pronta pro WhatsApp da empresa: saudação (com o nome do
  // contato, se tiver) + quem é o motorista + o frete específico (rota +
  // valor) + as 3 perguntas que importam pra fechar (data, prazo de
  // pagamento, quem paga o pedágio). Estrutura combinada com o Raphael
  // antes de codar.
  function montarMensagemWhatsapp(): string {
    const nomeContato = primeiroNome(contatoSalvo);
    const nomeMoto = primeiroNome(nomeMotorista);
    const saudacao = nomeContato ? `Olá, ${nomeContato}!` : 'Olá!';
    const apresentacao = nomeMoto ? ` Aqui é o ${nomeMoto}, motorista.` : '';
    const corpo =
      ` Vi o frete de ${resultado!.entrada.origem} para ${resultado!.entrada.destino}, valor de ${fmtBRL(
        resultado!.entrada.valorFrete,
      )}, e tenho interesse. Pode me passar mais detalhes? Preciso saber a data de coleta, o prazo de pagamento e quem fica responsável pelo pedágio. Fico no aguardo, obrigado!`;
    return `${saudacao}${apresentacao}${corpo}`;
  }

  return (
    <main className="tela tela-resultado">
      <h1>Resultado</h1>

      {modoHistorico && analisadoEm && <p className="aviso">Analisado em {fmtDataHora(analisadoEm)}</p>}

      {modoHistorico && (empresaSalva || contatoSalvo || telefoneSalvo) && (
        <div className="contato-frete">
          <p className="chip-secao-titulo" style={{ margin: 0 }}>
            Contato do frete
          </p>
          {empresaSalva && <p className="contato-frete-linha">{empresaSalva}</p>}
          {contatoSalvo && <p className="contato-frete-linha">{contatoSalvo}</p>}
          {telefoneSalvo && (
            <p className="contato-frete-linha">
              {telefoneSalvo}
              {' · '}
              <a href={`tel:${telefoneSalvo.replace(/\D/g, '')}`}>Ligar</a>
              {' · '}
              <a
                href={`https://wa.me/55${telefoneSalvo.replace(/\D/g, '')}?text=${encodeURIComponent(montarMensagemWhatsapp())}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            </p>
          )}
        </div>
      )}

      <p className="linha-analise-rota" style={{ margin: 0 }}>
        {resultado.entrada.origem} → {resultado.entrada.destino}
      </p>

      <div className="chip-veredicto" style={{ backgroundColor: cor }}>
        {resultado.veredicto}
      </div>

      <p className="conselho">{explicarVeredicto(resultado)}</p>

      {valorACombinar && (
        <p className="aviso">
          Frete a combinar — este valor é o mínimo que você calculou pra bater sua margem, não uma oferta da empresa.
        </p>
      )}

      <div className="kpis">
        <div className="kpi">
          <span>Valor do frete{valorACombinar ? ' (a combinar)' : ''}</span>
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
          <span>
            Piso mínimo ANTT
            {resultado.entrada.tipoCarga && resultado.entrada.tipoCarga !== 'carga_geral'
              ? ` (${TIPO_CARGA_LABEL[resultado.entrada.tipoCarga]})`
              : ''}
          </span>
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
            <button type="button" disabled={salvando} onClick={() => setMostrarContato(true)}>
              Salvar análise
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

      {mostrarContato && (
        <div className="modal-overlay" onClick={() => !salvando && setMostrarContato(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Contato do frete</h2>
            <p className="aviso" style={{ margin: 0 }}>
              Fica salvo com essa análise, pra você achar o contato depois.
            </p>
            <label>
              Empresa
              <input value={empresaNome} onChange={(e) => setEmpresaNome(e.target.value)} placeholder="Nome da empresa" />
            </label>
            <label>
              Contato
              <input value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} placeholder="Nome da pessoa" />
            </label>
            <label>
              Telefone / WhatsApp
              <input value={contatoTelefone} onChange={(e) => setContatoTelefone(e.target.value)} placeholder="(11) 91234-5678" />
            </label>
            {erroSalvar && <p className="aviso-erro">Não foi possível salvar: {erroSalvar}</p>}
            <button type="button" disabled={salvando} onClick={salvar}>
              {salvando ? 'Salvando...' : 'Salvar análise'}
            </button>
            <button type="button" className="link-secundario" disabled={salvando} onClick={() => setMostrarContato(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
