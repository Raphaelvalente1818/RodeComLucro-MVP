// apps/web/src/pages/empresa/EmpresaFrete.tsx
//
// Detalhe de um frete da empresa (/empresa/frete/:id) — 05/10/2026,
// Docs/mockup-fretes-empresa-status.html. Tudo que a empresa preencheu,
// o status com as ações (pausar / publicar de novo / fechar) e o
// histórico de mudanças (quem, quando, motivo). Frete nunca é apagado.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import {
  acoesDoStatus,
  carregarFreteDaEmpresa,
  carregarHistoricoFrete,
  carregarMinhaEmpresa,
  type Empresa,
  type FreteDaEmpresaDetalhe,
  type HistoricoFrete,
} from '../../lib/empresa';
import { STATUS_FRETE, fmtDataBR, fmtValorFrete } from './EmpresaHome';
import StatusFreteModal, { type PedidoStatus } from './StatusFreteModal';

const TEXTO_STATUS: Record<string, { titulo: string; texto: string }> = {
  aberto: { titulo: 'Aparecendo pros motoristas', texto: 'Está na busca do app e nas respostas do WhatsApp pra caminhão compatível.' },
  pausado: { titulo: 'Pausado — ninguém vê', texto: 'Saiu da busca e do WhatsApp. Publique de novo quando quiser; não precisa de nova aprovação.' },
  fechado: { titulo: 'Fechado', texto: 'Este frete foi encerrado e fica aqui como registro. Dá pra publicar de novo se precisar.' },
  pendente_aprovacao: { titulo: 'Aguardando aprovação', texto: 'Nossa equipe está conferindo. Assim que aprovar, ele entra no ar.' },
  rejeitado: { titulo: 'Não aprovado', texto: 'A moderação não aprovou este frete.' },
  expirado: { titulo: 'Expirado', texto: 'Passou da data e saiu do ar. Pra ofertar de novo, publique outro.' },
  negociando: { titulo: 'Em negociação', texto: 'Está na busca do app e nas respostas do WhatsApp.' },
};

const ROTULO_PASSO: Record<string, string> = {
  pendente_aprovacao: 'Enviado pra aprovação',
  aberto: 'Publicado',
  pausado: 'Pausado',
  fechado: 'Fechado',
  rejeitado: 'Não aprovado',
  expirado: 'Expirado',
  negociando: 'Em negociação',
};

const ROTULO_ATOR: Record<HistoricoFrete['ator'], string> = { empresa: 'sua empresa', admin: 'moderação Sofrete', sistema: 'sistema' };

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtPeso(kg: number | null): string {
  if (kg == null) return '—';
  return `${kg.toLocaleString('pt-BR')} kg`;
}

function fmtTelefone(t: string | null): string {
  if (!t) return '—';
  const d = t.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t;
}

export default function EmpresaFrete() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [frete, setFrete] = useState<FreteDaEmpresaDetalhe | null | undefined>(undefined);
  const [historico, setHistorico] = useState<HistoricoFrete[]>([]);
  const [pedido, setPedido] = useState<PedidoStatus | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        navigate('/empresa/entrar', { replace: true });
        return;
      }
      try {
        const e = await carregarMinhaEmpresa();
        setEmpresa(e);
        if (!e) {
          setFrete(null);
          return;
        }
        const [f, h] = await Promise.all([carregarFreteDaEmpresa(e.id, id), carregarHistoricoFrete(id)]);
        setFrete(f);
        setHistorico(h);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[empresa] falha ao carregar frete', e);
        setErro('Não foi possível carregar este frete.');
        setFrete(null);
      }
    });
  }, [id, navigate]);

  if (frete === undefined) return null;

  if (!frete || !empresa) {
    return (
      <main className="tela">
        <button type="button" className="link-secundario empresa-voltar" onClick={() => navigate('/empresa')}>
          ← Seus fretes
        </button>
        <h1>Frete não encontrado</h1>
        <p className="aviso-erro">{erro ?? 'Esse frete não existe ou não é da sua empresa.'}</p>
      </main>
    );
  }

  const rota = `${frete.origemCidade}/${frete.origemUf} → ${frete.destinoCidade}/${frete.destinoUf}`;
  const tag = STATUS_FRETE[frete.status] ?? { label: frete.status, classe: '' };
  const st = TEXTO_STATUS[frete.status] ?? { titulo: frete.status, texto: '' };
  const acoes = acoesDoStatus(frete.status);

  return (
    <main className="tela">
      <button type="button" className="link-secundario empresa-voltar" onClick={() => navigate('/empresa')}>
        ← Seus fretes
      </button>
      <p className="garagem-eyebrow">Frete · publicado em {fmtDataBR(frete.createdAt)}</p>
      <h1>{rota}</h1>

      <section className="admin-card">
        <div className="empresa-status-box">
          <div>
            <span className={`admin-tag ${tag.classe}`}>{tag.label}</span>
            <b className="empresa-status-titulo">{st.titulo}</b>
            <p className="admin-card-nota">{st.texto}</p>
            {frete.status === 'rejeitado' && frete.motivoRejeicao && <p className="admin-card-nota">Motivo: {frete.motivoRejeicao}</p>}
          </div>
          {acoes.length > 0 && (
            <div className="empresa-acoes">
              {acoes.map((a) => (
                <button
                  key={a.para}
                  type="button"
                  className={a.destaque ? '' : 'empresa-btn-sec'}
                  onClick={() => setPedido({ freteId: frete.id, rota, para: a.para })}
                >
                  {a.rotulo}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="admin-card">
        <span className="admin-card-titulo">Rota e prazo</span>
        <dl className="empresa-grade">
          <div>
            <dt>Origem</dt>
            <dd>
              {frete.origemCidade}/{frete.origemUf}
            </dd>
          </div>
          <div>
            <dt>Destino</dt>
            <dd>
              {frete.destinoCidade}/{frete.destinoUf}
            </dd>
          </div>
          <div>
            <dt>Distância</dt>
            <dd>{frete.distanciaKm != null ? `${frete.distanciaKm.toLocaleString('pt-BR')} km` : '—'}</dd>
          </div>
          <div>
            <dt>Coleta</dt>
            <dd>{fmtDataBR(frete.dataColeta)}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-card">
        <span className="admin-card-titulo">Valor</span>
        <dl className="empresa-grade">
          <div>
            <dt>Frete</dt>
            <dd className="empresa-valor-grande">{fmtValorFrete(frete)}</dd>
          </div>
          <div>
            <dt>Tipo de valor</dt>
            <dd>{frete.valorACombinar ? 'A combinar' : frete.tipoValor === 'por_tonelada' ? 'Por tonelada' : 'Fechado (viagem)'}</dd>
          </div>
          <div>
            <dt>Pedágio por conta de</dt>
            <dd>{frete.pedagioPorContaDe === 'empresa' ? 'Empresa' : frete.pedagioPorContaDe === 'motorista' ? 'Motorista' : '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-card">
        <span className="admin-card-titulo">Carga e caminhão</span>
        <dl className="empresa-grade">
          <div>
            <dt>Peso</dt>
            <dd>{fmtPeso(frete.pesoKg)}</dd>
          </div>
          <div className="empresa-grade-largo">
            <dt>Veículos aceitos</dt>
            <dd>
              {frete.tiposVeiculoAceitos.length === 0 ? (
                'Qualquer'
              ) : (
                <span className="empresa-chips">
                  {frete.tiposVeiculoAceitos.map((v) => (
                    <i key={v}>{v}</i>
                  ))}
                </span>
              )}
            </dd>
          </div>
          <div className="empresa-grade-largo">
            <dt>Carrocerias aceitas</dt>
            <dd>
              {frete.tiposCarroceriaAceitos.length === 0 ? (
                'Qualquer'
              ) : (
                <span className="empresa-chips">
                  {frete.tiposCarroceriaAceitos.map((v) => (
                    <i key={v}>{v}</i>
                  ))}
                </span>
              )}
            </dd>
          </div>
          {frete.observacoes && (
            <div className="empresa-grade-largo">
              <dt>Observações</dt>
              <dd className="empresa-obs">{frete.observacoes}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="admin-card">
        <span className="admin-card-titulo">Contato que o motorista vê</span>
        <dl className="empresa-grade">
          <div>
            <dt>Nome</dt>
            <dd>{frete.contatoNome || '—'}</dd>
          </div>
          <div>
            <dt>Telefone</dt>
            <dd>{fmtTelefone(frete.contatoTelefone)}</dd>
          </div>
        </dl>
      </section>

      <section className="admin-card">
        <span className="admin-card-titulo">Histórico</span>
        <ul className="empresa-historico">
          {historico.map((h) => (
            <li key={h.id}>
              <span className="empresa-historico-quando">{fmtDataHora(h.criadoEm)}</span>
              <span>
                {ROTULO_PASSO[h.statusPara] ?? h.statusPara}
                {h.motivo && h.ator !== 'sistema' ? ` — "${h.motivo}"` : ''}
                <span className="empresa-historico-quem">{ROTULO_ATOR[h.ator]}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="admin-card-nota">Fretes não são apagados. Este histórico fica guardado como registro do que foi publicado, quando e por quem.</p>
      </section>

      {pedido && (
        <StatusFreteModal
          pedido={pedido}
          onFechar={() => setPedido(null)}
          onFeito={async (para) => {
            setFrete({ ...frete, status: para });
            setPedido(null);
            try {
              setHistorico(await carregarHistoricoFrete(frete.id));
            } catch {
              // histórico desatualizado não impede nada; recarrega na próxima abertura.
            }
          }}
        />
      )}
    </main>
  );
}
