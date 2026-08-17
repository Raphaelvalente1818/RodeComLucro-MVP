// apps/web/src/pages/Garagem.tsx
//
// Portal inicial pós-login (substitui Home.tsx). Reúne os três blocos que
// o motorista usa toda vez que abre o app: analisar frete, perfil do
// caminhão e perfil do motorista — mais um resumo de meta de lucro e as
// últimas análises, que já eram salvas silenciosamente em analise_frete
// mas nunca apareciam em lugar nenhum. Ver Docs/status-sessao.md (04/08)
// pro contexto da decisão e o mockup que embasou este layout.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { decodeClaims } from '../lib/claims';
import { fmtBRL } from '@rode/calc';
import {
  carregarUltimasAnalises,
  carregarLucroMesAtual,
  alternarRealizado,
  tempoRelativo,
  type AnaliseResumo,
} from '../lib/frete';
import { carregarMotorista, type Motorista } from '../lib/motorista';
import { carregarPerfil } from '../lib/frete';
import { contarPendentes } from '../lib/filaOffline';
import { IconeCaminhao, IconePerfil } from '../components/IconesCard';
// PROVISÓRIO — remover esta linha e o bloco marcado abaixo quando os
// testes de backlog com os sócios acabarem (ver components/BacklogModal.tsx).
import BacklogModal from '../components/BacklogModal';

function classeVeredicto(v: AnaliseResumo['veredicto']): string {
  if (v === 'BOM') return 'badge-veredicto badge-bom';
  if (v === 'RUIM') return 'badge-veredicto badge-ruim';
  return 'badge-veredicto badge-aceitavel';
}

interface AlertaVencimento {
  label: string;
  data: string;
  dias: number;
  vencido: boolean;
}

/** Dias corridos até `iso` (negativo se já passou). Compara por data, sem hora. */
function diasAte(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${iso}T00:00:00`);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
}

function fmtDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function Garagem() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [motorista, setMotorista] = useState<Motorista | null>(null);
  const [proximaTrocaOleo, setProximaTrocaOleo] = useState<string | null>(null);
  const [analises, setAnalises] = useState<AnaliseResumo[]>([]);
  const [lucroMes, setLucroMes] = useState(0);
  // PROVISÓRIO — remover junto com o botão/modal de backlog abaixo.
  const [backlogAberto, setBacklogAberto] = useState(false);
  const [alertaVencimentoAberto, setAlertaVencimentoAberto] = useState(false);
  // Itens (análise salva, perfil editado, etc.) que ficaram na fila offline
  // esperando conexão pra sincronizar — ver lib/filaOffline.ts. Atualiza
  // sozinho quando a fila muda (item entra ou sai), sem precisar dar F5.
  const [pendentesOffline, setPendentesOffline] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user.id;
      if (!uid) {
        navigate('/entrar', { replace: true });
        return;
      }
      const claims = decodeClaims(data.session!.access_token);
      const [m, ultimas, lucro, perfil] = await Promise.all([
        carregarMotorista(uid),
        carregarUltimasAnalises(uid, 3),
        carregarLucroMesAtual(uid),
        carregarPerfil(uid),
      ]);
      setProximaTrocaOleo(perfil?.proxima_troca_oleo ?? null);
      setMotorista(
        m ?? {
          id: uid,
          nome: null,
          uf_base: null,
          meta_alvo_centavos: null,
          media_lucro_frete_centavos: null,
          canal_wa_ativo: Boolean(claims.telefone_verificado) && false,
          telefone_verificado: Boolean(claims.telefone_verificado),
          cnh_numero: null,
          cnh_vencimento: null,
          exame_toxicologico_vencimento: null,
          cidade_atual: null,
          uf_atual: null,
          cidade_atual_lat: null,
          cidade_atual_lng: null,
        },
      );
      setAnalises(ultimas);
      setLucroMes(lucro);
      setCarregando(false);
    });
  }, [navigate]);

  useEffect(() => {
    const atualizar = () => {
      contarPendentes().then(setPendentesOffline);
    };
    atualizar();
    window.addEventListener('rode:fila-offline-mudou', atualizar);
    return () => window.removeEventListener('rode:fila-offline-mudou', atualizar);
  }, []);

  // Alerta de CNH/exame toxicológico vencendo em até 60 dias (ou já
  // vencidos). Hook precisa vir antes do "return null" abaixo (regra dos
  // hooks), por isso trata motorista == null aqui dentro.
  const alertasVencimento = useMemo<AlertaVencimento[]>(() => {
    if (!motorista) return [];
    const itens: AlertaVencimento[] = [];
    function checar(label: string, iso: string | null, limiteDias = 60) {
      if (!iso) return;
      const dias = diasAte(iso);
      if (dias <= limiteDias) itens.push({ label, data: iso, dias, vencido: dias < 0 });
    }
    checar('CNH', motorista.cnh_vencimento);
    checar('Exame toxicológico', motorista.exame_toxicologico_vencimento);
    // Troca de óleo é por caminhão (caminhao_perfil), não por motorista — e o
    // Raphael pediu uma janela mais curta (1 semana), diferente dos 60 dias
    // de CNH/exame, já que óleo é algo que se resolve rápido numa oficina.
    checar('Troca de óleo', proximaTrocaOleo, 7);
    return itens;
  }, [motorista, proximaTrocaOleo]);

  // CNH/exame ficam em "Meu perfil" (motoristas), troca de óleo fica em
  // "Meu Caminhão" (caminhao_perfil) — o botão de atalho do alerta precisa
  // apontar pro lugar certo, e pode precisar mostrar os dois se houver
  // alerta dos dois tipos ao mesmo tempo.
  const botoesAtualizarAlerta = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const a of alertasVencimento) {
      if (a.label === 'Troca de óleo') mapa.set('/perfil', 'Atualizar em Meu Caminhão');
      else mapa.set('/motorista', 'Atualizar em Meu Perfil');
    }
    return Array.from(mapa.entries());
  }, [alertasVencimento]);

  if (carregando || !motorista) return null;

  // Botão "Realizado" na lista de análises: só fretes marcados como
  // realmente executados (não só calculados/salvos) entram na soma do
  // "lucro do mês" — daí recarregar carregarLucroMesAtual() ao alternar.
  async function alternarRealizadoEAtualizarLucro(a: AnaliseResumo) {
    setAnalises((prev) => prev.map((x) => (x.id === a.id ? { ...x, realizado: !x.realizado } : x)));
    const { error } = await alternarRealizado(a.id, a.realizado);
    if (!error) {
      setLucroMes(await carregarLucroMesAtual(motorista!.id));
    }
  }

  const primeiroNome = motorista.nome?.trim() ? motorista.nome.trim().split(' ')[0] : null;
  const metaReais = motorista.meta_alvo_centavos != null ? motorista.meta_alvo_centavos / 100 : null;
  const progresso = metaReais && metaReais > 0 ? Math.min(1, Math.max(0, lucroMes / metaReais)) : null;

  return (
    <main className="tela tela-garagem">
      <header className="garagem-header">
        <div>
          <p className="garagem-eyebrow">Garagem</p>
          <h1>
            Olá{primeiroNome ? `, ${primeiroNome}` : ''}
            {alertasVencimento.length > 0 && (
              <button
                type="button"
                className={`alerta-vencimento-bolinha ${alertasVencimento.some((a) => a.vencido) ? 'vencido' : 'proximo'}`}
                aria-label="Documento vencendo — clique para ver detalhes"
                onClick={() => setAlertaVencimentoAberto((v) => !v)}
              />
            )}
          </h1>
        </div>
        {/* PROVISÓRIO — botão de backlog para os sócios testando o app.
            Remover junto com components/BacklogModal.tsx e lib/backlog.ts. */}
        <button type="button" className="backlog-botao" onClick={() => setBacklogAberto(true)}>
          Backlog
        </button>
      </header>

      {alertaVencimentoAberto && alertasVencimento.length > 0 && (
        <div className="alerta-vencimento-detalhe">
          {alertasVencimento.map((a) => (
            <p key={a.label} className={a.vencido ? 'aviso-erro' : 'aviso'}>
              {a.label}: {a.vencido ? `vencida há ${Math.abs(a.dias)} dia(s)` : `vence em ${a.dias} dia(s)`} ({fmtDataBR(a.data)})
            </p>
          ))}
          {botoesAtualizarAlerta.map(([rota, texto]) => (
            <button key={rota} type="button" className="link-secundario" onClick={() => navigate(rota)}>
              {texto}
            </button>
          ))}
        </div>
      )}

      {backlogAberto && <BacklogModal onFechar={() => setBacklogAberto(false)} />}

      {pendentesOffline > 0 && (
        <p className="aviso">
          {pendentesOffline === 1
            ? '1 alteração aguardando conexão'
            : `${pendentesOffline} alterações aguardando conexão`}{' '}
          — vai sincronizar sozinho assim que voltar o sinal.
        </p>
      )}

      <div className="garagem-status">
        <span>Base: {motorista.uf_base ?? 'não informada'}</span>
        <span className={motorista.canal_wa_ativo ? 'sucesso' : 'aviso'}>
          {motorista.canal_wa_ativo ? 'WhatsApp vinculado' : 'WhatsApp não vinculado'}
        </span>
      </div>

      <button type="button" className="cta-primaria" onClick={() => navigate('/analisar')}>
        <span className="cta-titulo">Analisar frete</span>
        <span className="cta-subtitulo">Calcular lucro de uma nova rota</span>
      </button>

      <button type="button" className="cta-primaria cta-frete" onClick={() => navigate('/buscar-frete')}>
        <span className="cta-titulo">Buscar frete</span>
        <span className="cta-subtitulo">Ver fretes publicados por transportadoras</span>
      </button>

      <div className="grid-2">
        <button type="button" className="card-secundaria" onClick={() => navigate('/perfil')}>
          <span className="card-titulo card-titulo-icone">
            <IconeCaminhao />
            Meu Caminhão
          </span>
        </button>
        <button type="button" className="card-secundaria" onClick={() => navigate('/motorista')}>
          <span className="card-titulo card-titulo-icone">
            <IconePerfil />
            Meu Perfil
          </span>
        </button>
      </div>

      {metaReais != null && progresso != null && (
        <div className="meta-lucro">
          <div className="meta-lucro-topo">
            <span>Meta de lucro do mês</span>
            <b>
              {fmtBRL(lucroMes)} / {fmtBRL(metaReais)}
            </b>
          </div>
          <div className="barra-progresso">
            <div className="barra-progresso-preenchida" style={{ width: `${progresso * 100}%` }} />
          </div>
        </div>
      )}

      <section className="ultimas-analises">
        <div className="ultimas-analises-topo">
          <h2>Últimas análises</h2>
        </div>

        {analises.length === 0 ? (
          <p className="aviso">Você ainda não analisou nenhum frete.</p>
        ) : (
          <ul className="lista-analises">
            {analises.map((a) => (
              <li key={a.id} className="linha-analise-item">
                <button
                  type="button"
                  className="linha-analise"
                  onClick={() => navigate(`/resultado/${a.id}`)}
                >
                  <div>
                    <p className="linha-analise-rota">
                      {a.origem} → {a.destino}
                    </p>
                    <p className="linha-analise-detalhe">
                      {fmtBRL(a.valorFreteCentavos / 100)}
                      {a.valorACombinar ? ' (a combinar)' : ''} · {tempoRelativo(a.createdAt)}
                    </p>
                  </div>
                  <span className={classeVeredicto(a.veredicto)}>{a.veredicto}</span>
                </button>
                <button
                  type="button"
                  className={a.realizado ? 'realizado-toggle-on' : 'realizado-toggle-off'}
                  onClick={() => alternarRealizadoEAtualizarLucro(a)}
                >
                  {a.realizado ? '✓ Realizado' : 'Marcar como realizado'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
