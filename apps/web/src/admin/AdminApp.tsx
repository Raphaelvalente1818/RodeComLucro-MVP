// apps/web/src/admin/AdminApp.tsx
//
// Painel admin — primeira tela ("Visão geral"), única por enquanto. Não
// existe no código antes desta mudança (diferente do que o PRD original,
// Docs/PRD-tecnico-admin.html, dá a entender ao descrever telas como se
// já estivessem mockadas). Rota protegida por app_role (claim do JWT,
// injetada por custom_access_token_hook a partir de admin_user) — sem
// papel válido, nem carrega os dados, só mostra acesso negado.
//
// Layout aprovado por mockup (ver Docs/status-sessao.md, checkpoint
// 02/09 + atualização 04/09): gate de validação em destaque, KPIs,
// funil e distribuição de veredito, tudo com número real do banco.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { decodeClaims } from '../lib/claims';
import { carregarVisaoGeral, labelEtapaFunil, type AdminVisaoGeral, type PapelAdmin } from '../data/admin';

const PAPEIS_VALIDOS: PapelAdmin[] = ['admin', 'operacao', 'suporte'];

function fmtDataHoraBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  return `${n.toString().replace('.', ',')}%`;
}

type EstadoAcesso = 'verificando' | 'negado' | 'liberado';

export default function AdminApp() {
  const navigate = useNavigate();
  const [acesso, setAcesso] = useState<EstadoAcesso>('verificando');
  const [papel, setPapel] = useState<PapelAdmin | null>(null);
  const [dados, setDados] = useState<AdminVisaoGeral | null>(null);
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) {
        navigate('/entrar', { replace: true });
        return;
      }
      const claims = decodeClaims(session.access_token);
      const papelAtual = claims.app_role as PapelAdmin | undefined;
      if (!papelAtual || !PAPEIS_VALIDOS.includes(papelAtual)) {
        setAcesso('negado');
        return;
      }
      setPapel(papelAtual);
      setAcesso('liberado');
    });
  }, [navigate]);

  useEffect(() => {
    if (acesso !== 'liberado') return;
    setCarregandoDados(true);
    carregarVisaoGeral()
      .then((v) => {
        setDados(v);
        setErro(null);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[admin] falha ao carregar visão geral', e);
        setErro('Não foi possível carregar os dados. Tente recarregar a página.');
      })
      .finally(() => setCarregandoDados(false));
  }, [acesso]);

  if (acesso === 'verificando') return null;

  if (acesso === 'negado') {
    return (
      <main className="tela tela-admin">
        <h1>Acesso restrito</h1>
        <p className="aviso-erro">Esta conta não tem permissão pra acessar o painel admin.</p>
        <button type="button" className="link-secundario" onClick={() => navigate('/')}>
          Voltar pro app
        </button>
      </main>
    );
  }

  const gate = dados?.gate;
  const kpi = dados?.kpi;
  const progressoGate = gate ? Math.min(1, gate.completosCumulativo / gate.meta) : 0;
  const maxFunil = dados ? Math.max(1, ...dados.funil.map((f) => f.usuarios)) : 1;
  const totalVeredito = dados ? dados.veredito.reduce((s, v) => s + v.qtd, 0) : 0;

  return (
    <main className="tela tela-admin">
      <header className="admin-header">
        <div>
          <p className="garagem-eyebrow">Painel admin</p>
          <h1>Visão geral</h1>
          {kpi && <p className="admin-atualizado-em">Dados atualizados até {fmtDataHoraBR(kpi.refreshedAt)} · atualiza a cada 15-30min</p>}
        </div>
        <span className="admin-papel-badge">{papel}</span>
      </header>

      {erro && <p className="aviso-erro">{erro}</p>}

      {carregandoDados && !dados ? (
        <p className="aviso">Carregando…</p>
      ) : dados ? (
        <>
          {gate && (
            <section className="admin-card admin-gate">
              <div className="admin-card-topo">
                <span className="admin-card-titulo">Gate de validação do MVP</span>
                <span className={gate.validado ? 'badge-veredicto badge-bom' : 'badge-veredicto badge-ruim'}>
                  {gate.validado ? 'validado' : 'não validado'}
                </span>
              </div>
              <div className="admin-gate-numero">
                <span className="admin-gate-numero-atual">{gate.completosCumulativo}</span>
                <span className="admin-gate-numero-meta">/ {gate.meta} jornadas completas</span>
              </div>
              <div className="barra-progresso">
                <div className="barra-progresso-preenchida admin-barra-gate" style={{ width: `${progressoGate * 100}%` }} />
              </div>
              <p className="admin-card-nota">
                jornada v{gate.journeyVersion} · base cadastrada: {gate.baseCadastrada}
              </p>
            </section>
          )}

          {kpi && (
            <section className="admin-grid-kpi">
              <div className="admin-card admin-kpi">
                <span className="admin-kpi-label">Cadastrados</span>
                <span className="admin-kpi-valor">{kpi.cadastrados}</span>
              </div>
              <div className="admin-card admin-kpi">
                <span className="admin-kpi-label">Ativos (30d)</span>
                <span className="admin-kpi-valor">{kpi.ativos30d}</span>
              </div>
              <div className="admin-card admin-kpi">
                <span className="admin-kpi-label">Simulações</span>
                <span className="admin-kpi-valor">{kpi.simulacoes}</span>
              </div>
              <div className="admin-card admin-kpi">
                <span className="admin-kpi-label">% aceitas</span>
                <span className="admin-kpi-valor">{fmtPct(kpi.pctAceitas)}</span>
              </div>
            </section>
          )}

          <div className="admin-grid-2">
            <section className="admin-card">
              <span className="admin-card-titulo">Funil (hoje)</span>
              <div className="admin-funil">
                {dados.funil.map((f) => (
                  <div key={f.etapa} className="admin-funil-linha">
                    <div className="admin-funil-linha-topo">
                      <span>{labelEtapaFunil(f.etapa)}</span>
                      <b>{f.usuarios}</b>
                    </div>
                    <div className="barra-progresso admin-barra-funil">
                      <div className="barra-progresso-preenchida" style={{ width: `${(f.usuarios / maxFunil) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {dados.funil.find((f) => f.etapa === 'cadastro_conta')?.usuarios === 0 && (
                <p className="admin-card-nota">"Criou conta" ainda sem dado — evento novo, ninguém se cadastrou desde que entrou no ar.</p>
              )}
            </section>

            <section className="admin-card">
              <span className="admin-card-titulo">Veredito das simulações</span>
              {totalVeredito === 0 ? (
                <p className="aviso">Sem simulações com veredito ainda.</p>
              ) : (
                <>
                  <div className="admin-veredito-barra">
                    {dados.veredito.map((v) => (
                      <div
                        key={v.veredito}
                        className={`admin-veredito-segmento admin-veredito-${v.veredito.toLowerCase()}`}
                        style={{ width: `${(v.qtd / totalVeredito) * 100}%` }}
                      />
                    ))}
                  </div>
                  <div className="admin-veredito-legenda">
                    {dados.veredito.map((v) => (
                      <div key={v.veredito} className="admin-veredito-legenda-item">
                        <span className={`admin-veredito-bolinha admin-veredito-${v.veredito.toLowerCase()}`} />
                        <span>{v.veredito}</span>
                        <b>
                          {v.qtd} · {fmtPct(v.pct)}
                        </b>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        </>
      ) : null}
    </main>
  );
}
