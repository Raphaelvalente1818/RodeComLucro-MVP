// apps/web/src/admin/pages/VisaoGeral.tsx
//
// Tela "Visão geral" do painel admin — gate de validação do MVP, KPIs,
// funil e distribuição de veredito. Guarda de acesso e navegação ficam
// em AdminLayout.tsx (pai da rota); esta tela só cuida dos próprios
// dados. Layout aprovado por mockup (ver Docs/status-sessao.md,
// checkpoint 02/09 + atualizações de 04/09).

import { useEffect, useState } from 'react';
import { carregarVisaoGeral, labelEtapaFunil, type AdminVisaoGeral } from '../../data/admin';

function fmtDataHoraBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  return `${n.toString().replace('.', ',')}%`;
}

export default function VisaoGeral() {
  const [dados, setDados] = useState<AdminVisaoGeral | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setCarregando(true);
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
      .finally(() => setCarregando(false));
  }, []);

  const gate = dados?.gate;
  const kpi = dados?.kpi;
  const progressoGate = gate ? Math.min(1, gate.completosCumulativo / gate.meta) : 0;
  const maxFunil = dados ? Math.max(1, ...dados.funil.map((f) => f.usuarios)) : 1;
  const totalVeredito = dados ? dados.veredito.reduce((s, v) => s + v.qtd, 0) : 0;

  return (
    <>
      <div className="admin-tela-topo">
        <h1>Visão geral</h1>
        {kpi && <p className="admin-atualizado-em">Dados atualizados até {fmtDataHoraBR(kpi.refreshedAt)} · atualiza a cada 15-30min</p>}
      </div>

      {erro && <p className="aviso-erro">{erro}</p>}

      {carregando && !dados ? (
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
    </>
  );
}
