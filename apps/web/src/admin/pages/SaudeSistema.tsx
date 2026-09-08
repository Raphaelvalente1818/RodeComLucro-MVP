// apps/web/src/admin/pages/SaudeSistema.tsx
//
// Tela "Saúde do sistema" — 4 cards: erros técnicos por função (via
// app_log, agora alimentado pelas Edge Functions), status dos jobs de
// rollup (pg_cron), tamanho/conexões do banco, e alertas abertos
// (calculados no cliente a partir dos outros 3 sinais + bloqueios OTP
// ativos). Motivação: comparação com o painel admin de outra aplicação
// do usuário mostrou que faltava visibilidade de saúde técnica — os
// bugs que realmente pegaram a gente de surpresa até agora (recursão de
// RLS, hook de claims sobrescrito) não tinham nenhum sinal visível no
// admin antes de um usuário reportar. Ver Docs/status-sessao.md, 08/09.

import { useEffect, useState } from 'react';
import { carregarSaudeSistema, type AdminSaudeSistema } from '../../data/admin';

function fmtDataHoraBR(iso: string | null): string {
  if (!iso) return 'nunca rodou';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export default function SaudeSistema() {
  const [dados, setDados] = useState<AdminSaudeSistema | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setCarregando(true);
    carregarSaudeSistema()
      .then((v) => {
        setDados(v);
        setErro(null);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[admin] falha ao carregar saúde do sistema', e);
        setErro('Não foi possível carregar a lista.');
      })
      .finally(() => setCarregando(false));
  }, []);

  const jobsAtrasados = dados?.jobs.filter((j) => j.ativo && j.atrasado) ?? [];
  const totalAlertas = (dados?.bloqueiosAtivos.length ?? 0) + jobsAtrasados.length + (dados && dados.totalErrosUltimas24h >= 20 ? 1 : 0);

  return (
    <>
      <div className="admin-tela-topo">
        <h1>Saúde do sistema</h1>
        <p className="admin-atualizado-em">Sinais técnicos — erros, jobs agendados, banco e bloqueios ativos.</p>
      </div>

      {erro && <p className="aviso-erro">{erro}</p>}

      {carregando && !dados ? (
        <p className="aviso">Carregando…</p>
      ) : dados ? (
        <div className="admin-grid-2">
          <section className="admin-card">
            <div className="admin-card-topo">
              <span className="admin-card-titulo">Alertas abertos</span>
              <span className={totalAlertas > 0 ? 'badge-veredicto badge-ruim' : 'badge-veredicto badge-bom'}>
                {totalAlertas > 0 ? `${totalAlertas} alerta(s)` : 'tudo ok'}
              </span>
            </div>
            {totalAlertas === 0 ? (
              <p className="admin-card-nota">Nenhum job atrasado, nenhum bloqueio ativo, sem pico de erro nas últimas 24h.</p>
            ) : (
              <ul className="admin-lista-simples">
                {jobsAtrasados.map((j) => (
                  <li key={j.jobname}>Job "{j.jobname}" atrasado — última execução: {fmtDataHoraBR(j.ultimaExecucao)}</li>
                ))}
                {dados.totalErrosUltimas24h >= 20 && <li>{dados.totalErrosUltimas24h} erros técnicos nas últimas 24h — acima do normal</li>}
                {dados.bloqueiosAtivos.map((b, i) => (
                  <li key={i}>
                    Bloqueio ativo ({b.escopo}, nível {b.nivel}) — {b.motivo}, até {fmtDataHoraBR(b.bloqueadoAte)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="admin-card">
            <span className="admin-card-titulo">Erros técnicos (últimas 24h)</span>
            {dados.totalErrosUltimas24h === 0 ? (
              <p className="admin-card-nota">Nenhum erro registrado. As Edge Functions gravam falha real em app_log (aba Auditoria também mostra isso).</p>
            ) : (
              <div className="admin-tabela-wrap">
                <table className="admin-tabela">
                  <thead>
                    <tr>
                      <th>Fonte</th>
                      <th>Ocorrências</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.errosUltimas24h.map((e) => (
                      <tr key={e.source}>
                        <td>{e.source}</td>
                        <td>{e.qtd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="admin-card">
            <span className="admin-card-titulo">Jobs de rollup (pg_cron)</span>
            <div className="admin-tabela-wrap">
              <table className="admin-tabela">
                <thead>
                  <tr>
                    <th>Job</th>
                    <th>Agenda</th>
                    <th>Última execução</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.jobs.map((j) => (
                    <tr key={j.jobname}>
                      <td>{j.jobname}</td>
                      <td>{j.schedule}</td>
                      <td>{fmtDataHoraBR(j.ultimaExecucao)}</td>
                      <td>
                        <span className={j.atrasado ? 'admin-tag admin-tag-ruim' : 'admin-tag admin-tag-bom'}>
                          {j.atrasado ? 'atrasado' : j.ultimoStatus ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-card">
            <span className="admin-card-titulo">Banco de dados</span>
            {dados.banco ? (
              <div className="admin-grid-kpi">
                <div className="admin-card admin-kpi">
                  <span className="admin-kpi-label">Tamanho</span>
                  <span className="admin-kpi-valor">{fmtBytes(dados.banco.tamanhoBytes)}</span>
                </div>
                <div className="admin-card admin-kpi">
                  <span className="admin-kpi-label">Conexões ativas</span>
                  <span className="admin-kpi-valor">{dados.banco.conexoesAtivas}</span>
                </div>
              </div>
            ) : (
              <p className="aviso">Sem dado.</p>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
