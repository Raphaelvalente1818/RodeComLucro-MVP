// apps/web/src/pages/empresa/EmpresaHome.tsx
//
// Tela inicial do portal da empresa: situação do cadastro (pendente /
// aprovada / rejeitada / suspensa) e lista dos fretes da própria empresa.
// 05/10/2026 (Docs/mockup-fretes-empresa-status.html): filtros por status,
// linha abre o detalhe (/empresa/frete/:id), botões Pausar / Publicar de
// novo / Fechar direto na linha. O botão "Publicar frete" saiu daqui — a
// aba "Publicar frete" do cabeçalho já faz isso (pedido do Raphael).

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fmtBRL } from '@rode/calc';
import { supabase } from '../../lib/supabaseClient';
import {
  acoesDoStatus,
  carregarFretesDaEmpresa,
  carregarMinhaEmpresa,
  formatarCnpj,
  sairEmpresa,
  type Empresa,
  type FreteDaEmpresa,
} from '../../lib/empresa';
import StatusFreteModal, { type PedidoStatus } from './StatusFreteModal';

const TEXTO_STATUS: Record<Empresa['status'], { titulo: string; texto: string; classe: string }> = {
  pendente: {
    titulo: 'Cadastro em análise',
    texto: 'Nossa equipe está conferindo os dados da sua empresa. Assim que for aprovada, você poderá publicar fretes por aqui.',
    classe: 'aviso',
  },
  aprovada: {
    titulo: 'Empresa aprovada',
    texto: 'Sua empresa está liberada pra publicar fretes. Use a aba "Publicar frete" no topo.',
    classe: 'sucesso',
  },
  rejeitada: {
    titulo: 'Cadastro não aprovado',
    texto: 'Não foi possível aprovar o cadastro da sua empresa.',
    classe: 'aviso-erro',
  },
  suspensa: {
    titulo: 'Empresa suspensa',
    texto: 'A publicação de fretes está suspensa pra sua empresa.',
    classe: 'aviso-erro',
  },
};

/** Rótulo e cor de cada status, como a empresa vê. Exportado pro detalhe. */
export const STATUS_FRETE: Record<string, { label: string; classe: string }> = {
  pendente_aprovacao: { label: 'em análise', classe: 'admin-tag-duplicada' },
  aberto: { label: 'publicado', classe: 'admin-tag-nova' },
  pausado: { label: 'pausado', classe: 'admin-tag-pausado' },
  negociando: { label: 'negociando', classe: 'admin-tag-nova' },
  fechado: { label: 'fechado', classe: '' },
  expirado: { label: 'expirado', classe: '' },
  rejeitado: { label: 'não aprovado', classe: 'admin-tag-erro' },
};

type Filtro = 'ativos' | 'aberto' | 'pausado' | 'todos';
const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'ativos', label: 'Ativos' },
  { id: 'aberto', label: 'Publicados' },
  { id: 'pausado', label: 'Pausados' },
  { id: 'todos', label: 'Todos' },
];

export function fmtDataBR(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('pt-BR');
}

export function fmtValorFrete(f: Pick<FreteDaEmpresa, 'valorACombinar' | 'valorFreteCentavos' | 'tipoValor'>): string {
  if (f.valorACombinar || f.valorFreteCentavos == null) return 'a combinar';
  return `${fmtBRL(f.valorFreteCentavos / 100)}${f.tipoValor === 'por_tonelada' ? '/t' : ''}`;
}

export default function EmpresaHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const publicadoAgora = Boolean((location.state as { publicado?: boolean } | null)?.publicado);
  const [empresa, setEmpresa] = useState<Empresa | null | undefined>(undefined);
  const [fretes, setFretes] = useState<FreteDaEmpresa[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('ativos');
  const [pedido, setPedido] = useState<PedidoStatus | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        navigate('/empresa/entrar', { replace: true });
        return;
      }
      try {
        const e = await carregarMinhaEmpresa();
        setEmpresa(e);
        if (e) setFretes(await carregarFretesDaEmpresa(e.id));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[empresa] falha ao carregar empresa', e);
        setErro('Não foi possível carregar os dados da empresa.');
        setEmpresa(null);
      }
    });
  }, [navigate]);

  async function sair() {
    await sairEmpresa();
    navigate('/empresa/entrar', { replace: true });
  }

  if (empresa === undefined) return null;

  if (empresa === null) {
    return (
      <main className="tela tela-empresa-login">
        <h1>Conta sem empresa</h1>
        <p className="aviso-erro">{erro ?? 'Esta conta não está vinculada a nenhuma empresa.'}</p>
        <button type="button" className="link-secundario" onClick={sair}>
          Sair
        </button>
      </main>
    );
  }

  const st = TEXTO_STATUS[empresa.status];
  const visiveis = fretes.filter((f) => {
    if (filtro === 'todos') return true;
    if (filtro === 'ativos') return f.status !== 'fechado' && f.status !== 'rejeitado' && f.status !== 'expirado';
    return f.status === filtro;
  });

  return (
    <main className="tela">
      <p className="garagem-eyebrow">
        {empresa.razaoSocial} · CNPJ {formatarCnpj(empresa.cnpj)}
      </p>
      <h1>Seus fretes</h1>

      {publicadoAgora && <p className="sucesso">Frete enviado pra aprovação. Você acompanha o status na lista abaixo.</p>}
      {aviso && <p className="sucesso">{aviso}</p>}

      <section className="admin-card">
        <span className={`admin-card-titulo ${st.classe}`}>{st.titulo}</span>
        <p>{st.texto}</p>
        {empresa.motivoRejeicao && (empresa.status === 'rejeitada' || empresa.status === 'suspensa') && (
          <p className="admin-card-nota">Motivo: {empresa.motivoRejeicao}</p>
        )}
      </section>

      {fretes.length > 0 && (
        <section className="admin-card">
          <span className="admin-card-titulo">
            Seus fretes <span className="empresa-contagem">· {visiveis.length}</span>
          </span>
          <p className="admin-card-nota">
            Pausado some do app e do WhatsApp na hora; publicado volta na hora. Nada é apagado — toque no frete pra ver o histórico.
          </p>
          <div className="empresa-filtros">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`chip${filtro === f.id ? ' chip-ativo' : ''}`}
                onClick={() => setFiltro(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="admin-tabela-wrap">
            <table className="admin-tabela">
              <thead>
                <tr>
                  <th>Rota</th>
                  <th>Valor</th>
                  <th>Coleta</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visiveis.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empresa-vazio">
                      Nenhum frete nesse filtro.
                    </td>
                  </tr>
                )}
                {visiveis.map((f) => {
                  const s = STATUS_FRETE[f.status] ?? { label: f.status, classe: '' };
                  const rota = `${f.origemCidade}/${f.origemUf} → ${f.destinoCidade}/${f.destinoUf}`;
                  return (
                    <tr key={f.id} className="admin-linha-clicavel" onClick={() => navigate(`/empresa/frete/${f.id}`)}>
                      <td>{rota}</td>
                      <td>{fmtValorFrete(f)}</td>
                      <td>{fmtDataBR(f.dataColeta)}</td>
                      <td>
                        <span className={`admin-tag ${s.classe}`}>{s.label}</span>
                        {f.status === 'rejeitado' && f.motivoRejeicao && (
                          <div className="admin-atualizado-em">{f.motivoRejeicao}</div>
                        )}
                      </td>
                      <td className="empresa-acoes" onClick={(e) => e.stopPropagation()}>
                        {acoesDoStatus(f.status).map((a) => (
                          <button
                            key={a.para}
                            type="button"
                            className={`empresa-btn-mini${a.destaque ? '' : ' empresa-btn-sec'}`}
                            onClick={() => setPedido({ freteId: f.id, rota, para: a.para })}
                          >
                            {a.rotulo}
                          </button>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pedido && (
        <StatusFreteModal
          pedido={pedido}
          onFechar={() => setPedido(null)}
          onFeito={(para) => {
            setFretes((lista) => lista.map((f) => (f.id === pedido.freteId ? { ...f, status: para } : f)));
            setAviso(para === 'pausado' ? 'Frete pausado.' : para === 'aberto' ? 'Frete publicado de novo.' : 'Frete fechado.');
            setPedido(null);
          }}
        />
      )}
    </main>
  );
}
